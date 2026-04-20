import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, candidateProfilesTable, discoveredJobsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { discoverJobsFromSources } from "../lib/jobs/job-sources.js";
import { dedupeJobs } from "../lib/jobs/job-dedup.js";
import { upsertDiscoveredJobs, saveDiscoveryRun } from "../lib/jobs/job-store.js";
import { buildSearchCacheKey, getCachedSearchResult, saveCachedSearchResult } from "../lib/jobs/job-cache.js";
import { getJobsByIds } from "../lib/jobs/job-store.js";
import { matchDiscoveredJobsWithAI, saveJobMatchResults } from "../lib/jobs/job-matching.js";

const router: IRouter = Router();

// ─── POST /api/jobs/discover ──────────────────────────────────────────────────
// Main discovery endpoint. Auth optional: non-authed users get raw results.

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

router.post("/jobs/discover", async (req, res) => {
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

  // Resolve authenticated user (optional auth)
  let userId: string | undefined;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const { verifyToken } = await import("@clerk/backend");
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      userId = payload.sub;
    }
  } catch {
    // Continue as anonymous
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

  if (!skipCache) {
    const cached = await getCachedSearchResult(cacheKey);
    if (cached) {
      const cachedJobs = await getJobsByIds(cached.jobIds);
      if (cachedJobs.length > 0) {
        await saveDiscoveryRun({
          userId,
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

        // Build canonical_key → stored DB id map
        const jobIdByKey = new Map<string, string>();
        for (let i = 0; i < deduped.length; i++) {
          const canonicalKey = (deduped[i].metadata?.canonicalKey as string) ?? deduped[i].externalId;
          if (storedIds[i]) jobIdByKey.set(canonicalKey, storedIds[i]);
        }

        await saveJobMatchResults({
          userId,
          candidateProfileId: profile.id,
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
