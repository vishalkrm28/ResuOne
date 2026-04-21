import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, candidateProfilesTable, discoveredJobsTable, jobDiscoveryRunsTable } from "@workspace/db";
import { and, count, eq, desc, gte, inArray } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { discoverJobsFromSources } from "../lib/jobs/job-sources.js";
import { dedupeJobs } from "../lib/jobs/job-dedup.js";
import { upsertDiscoveredJobs, saveDiscoveryRun } from "../lib/jobs/job-store.js";
import { buildSearchCacheKey, getCachedSearchResult, saveCachedSearchResult } from "../lib/jobs/job-cache.js";
import { getJobsByIds } from "../lib/jobs/job-store.js";
import { matchDiscoveredJobsWithAI, saveJobMatchResults } from "../lib/jobs/job-matching.js";
const router: IRouter = Router();

const DAILY_LIMIT_PER_CV = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUtcStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Count how many Global Job searches this user has done today for a given CV. */
async function countDiscoveryRunsToday(userId: string, applicationId: string): Promise<number> {
  const since = todayUtcStart();
  const [row] = await db
    .select({ total: count() })
    .from(jobDiscoveryRunsTable)
    .where(
      and(
        eq(jobDiscoveryRunsTable.userId, userId),
        eq(jobDiscoveryRunsTable.sourceApplicationId, applicationId),
        gte(jobDiscoveryRunsTable.createdAt, since),
      ),
    );
  return row?.total ?? 0;
}

// ─── POST /api/jobs/discover ──────────────────────────────────────────────────
// Main discovery endpoint. Requires auth.
// Quota: 10 searches per CV per day for all users.
// Does NOT consume job_rec_credits — that pool is reserved for Find Jobs.

const DiscoverBodySchema = z.object({
  query: z.string().min(1).max(200),
  country: z.string().max(10).optional().default(""),
  location: z.string().max(100).optional().default(""),
  remoteOnly: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(50),
  skipCache: z.boolean().optional().default(false),
  aiRanking: z.boolean().optional().default(false),
  applicationId: z.string().optional(),
});

router.post("/jobs/discover", authMiddleware, async (req, res) => {
  // ── Parse & validate input ────────────────────────────────────────────────
  const result = DiscoverBodySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request", details: result.error.flatten() });
  }

  const {
    query,
    country,
    location,
    remoteOnly,
    limit,
    skipCache,
    aiRanking,
    applicationId,
  } = result.data;

  // Require authentication
  const userId: string | undefined = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Per-CV daily limit (applies to all users, Pro and non-Pro alike) ────────
  // Global Jobs does NOT consume job_rec_credits — that pool is reserved for
  // Find Jobs. Instead, every user gets the same 10-searches-per-CV-per-day cap.
  if (!applicationId) {
    return res.status(422).json({
      error: "Please select a CV to search for jobs.",
      code: "NO_CV_SELECTED",
    });
  }
  const runsToday = await countDiscoveryRunsToday(userId, applicationId);
  if (runsToday >= DAILY_LIMIT_PER_CV) {
    return res.status(429).json({
      error: `You've used all ${DAILY_LIMIT_PER_CV} searches for this CV today. Try again tomorrow or select a different CV.`,
      code: "CV_DAILY_LIMIT_REACHED",
      remainingForCv: 0,
      runsUsedTodayForCv: runsToday,
    });
  }

  const defaultCountry =
    country || process.env.JOB_DISCOVERY_DEFAULT_COUNTRY || "";

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const cacheKey = buildSearchCacheKey({
    query,
    country: defaultCountry,
    location,
    remoteOnly,
  });

  // Skip cache when:
  //  - caller explicitly requests skipCache
  //  - a country filter is active (stale cache may contain jobs from other countries)
  //  - AI ranking is requested by an auth'd user (cached path has no matchData)
  const effectiveSkipCache = skipCache || !!defaultCountry || (aiRanking && !!userId);

  if (!effectiveSkipCache) {
    const cached = await getCachedSearchResult(cacheKey);
    if (cached) {
      const cachedJobs = await getJobsByIds(cached.jobIds);
      if (cachedJobs.length > 0) {
        await saveDiscoveryRun({
          userId,
          applicationId: applicationId ?? null,
          query,
          country: defaultCountry,
          remoteOnly,
          sourceBreakdown: {},
          discoveredCount: cachedJobs.length,
          dedupedCount: cachedJobs.length,
          cached: true,
        });
        return res.json({
          jobs: cachedJobs.slice(0, limit),
          total: cachedJobs.length,
          cached: true,
          aiRanked: false,
          matchData: {},
          sourceBreakdown: {},
        });
      }
    }
  }

  // ── Discover from sources ─────────────────────────────────────────────────
  let discovery: Awaited<ReturnType<typeof discoverJobsFromSources>>;
  try {
    discovery = await discoverJobsFromSources({
      query,
      country: defaultCountry,
      location,
      remoteOnly,
      limit: Math.min(limit * 3, 100),
    });
  } catch (err) {
    logger.error({ err }, "Job discovery sources all failed");
    return res.status(502).json({ error: "Job discovery failed — all sources unavailable" });
  }

  // ── Deduplicate ───────────────────────────────────────────────────────────
  const deduped = dedupeJobs(discovery.jobs);

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const storedIds = await upsertDiscoveredJobs(deduped);
  const storedJobs = await getJobsByIds(storedIds.slice(0, limit));

  // ── Cache the result ──────────────────────────────────────────────────────
  await saveCachedSearchResult({
    query,
    country: defaultCountry,
    location,
    remoteOnly,
    cacheKey,
    jobIds: storedIds,
  });

  // ── AI Ranking (optional, requires auth + candidate profile) ──────────────
  let aiRankedJobs: typeof storedJobs = [];
  let aiRanked = false;
  // matchData: jobId → { matchScore, fitReasons, missingRequirements, recommendationSummary }
  let matchData: Record<string, { matchScore: number; fitReasons: string[]; missingRequirements: string[]; recommendationSummary: string }> = {};

  if (aiRanking && userId) {
    try {
      // Get the most recent candidate profile for this user
      const [profile] = await db
        .select()
        .from(candidateProfilesTable)
        .where(
          applicationId
            ? eq(candidateProfilesTable.sourceApplicationId, applicationId)
            : eq(candidateProfilesTable.userId, userId),
        )
        .orderBy(desc(candidateProfilesTable.createdAt))
        .limit(1);

      // Fallback: if no profile found for this specific application, try the
      // most recent profile for this user (handles cases where the candidate
      // profile was created under a different application ID)
      let resolvedProfile = profile;
      if (!resolvedProfile && applicationId) {
        const [fallback] = await db
          .select()
          .from(candidateProfilesTable)
          .where(eq(candidateProfilesTable.userId, userId))
          .orderBy(desc(candidateProfilesTable.createdAt))
          .limit(1);
        resolvedProfile = fallback;
      }

      if (resolvedProfile?.normalizedProfile) {
        const unifiedJobs = deduped.slice(0, 50);
        const recommendations = await matchDiscoveredJobsWithAI({
          candidateProfile: resolvedProfile.normalizedProfile as Record<string, unknown>,
          jobs: unifiedJobs,
          remoteOnly,
        });

        // Build a reliable canonical_key → stored DB id map.
        // We query the DB directly because PostgreSQL's RETURNING after
        // ON CONFLICT DO UPDATE does not guarantee the same row order as input.
        const canonicalKeys = unifiedJobs
          .map((j) => (j.metadata?.canonicalKey as string) ?? j.externalId)
          .filter(Boolean);
        const jobRows = canonicalKeys.length
          ? await db
              .select({ id: discoveredJobsTable.id, canonicalKey: discoveredJobsTable.canonicalKey })
              .from(discoveredJobsTable)
              .where(inArray(discoveredJobsTable.canonicalKey, canonicalKeys))
          : [];
        const jobIdByKey = new Map(jobRows.map((r) => [r.canonicalKey, r.id]));

        await saveJobMatchResults({
          userId,
          candidateProfileId: resolvedProfile.id,
          recommendations,
          jobIdByCanonicalKey: jobIdByKey,
        });

        // Build matchData map (jobId → match details) to include in response
        for (const rec of recommendations) {
          const jobId = jobIdByKey.get(rec.jobCanonicalKey);
          if (jobId) {
            matchData[jobId] = {
              matchScore: rec.matchScore,
              fitReasons: rec.fitReasons,
              missingRequirements: rec.missingRequirements,
              recommendationSummary: rec.recommendationSummary,
            };
          }
        }

        // Re-order storedJobs by AI match score
        const scoreByKey = new Map(
          recommendations.map((r) => [r.jobCanonicalKey, r.matchScore]),
        );
        aiRankedJobs = storedJobs
          .slice()
          .sort((a, b) => {
            const aKey = (a.metadata as any)?.canonicalKey ?? "";
            const bKey = (b.metadata as any)?.canonicalKey ?? "";
            return (scoreByKey.get(bKey) ?? 0) - (scoreByKey.get(aKey) ?? 0);
          });

        aiRanked = true;
      }
    } catch (err) {
      logger.warn({ err }, "AI ranking failed — returning unranked results");
    }
  }

  // ── Log discovery run ─────────────────────────────────────────────────────
  await saveDiscoveryRun({
    userId,
    applicationId: applicationId ?? null,
    query,
    country: defaultCountry,
    remoteOnly,
    sourceBreakdown: discovery.sourceBreakdown,
    discoveredCount: discovery.jobs.length,
    dedupedCount: deduped.length,
    cached: false,
  });

  return res.json({
    jobs: (aiRanked ? aiRankedJobs : storedJobs).slice(0, limit),
    total: deduped.length,
    cached: false,
    aiRanked,
    matchData,
    sourceBreakdown: discovery.sourceBreakdown,
    errors: discovery.errors.length > 0 ? discovery.errors : undefined,
  });
});

export default router;
