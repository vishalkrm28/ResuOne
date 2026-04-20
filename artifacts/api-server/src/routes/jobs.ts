import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNotNull } from "drizzle-orm";
import {
  db,
  applicationsTable,
  candidateProfilesTable,
  externalJobsCacheTable,
  jobRecommendationsTable,
  usersTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { getJobRecCredits, spendJobRecCredit } from "../lib/credits.js";
import { subscriptionIsActive } from "../lib/billing.js";
import { normalizeCandidateProfile, rerankJobsWithAI } from "../services/ai.js";
import { fetchAdzunaJobs } from "../lib/jobs/providers/adzuna.js";
import { fetchMuseJobs } from "../lib/jobs/providers/muse.js";
import { normalizeAdzunaJob, normalizeMuseJob } from "../lib/jobs/normalize.js";
import { prefilterJobs } from "../lib/jobs/ranking.js";

const router: IRouter = Router();

const PRO_DAILY_LIMIT_PER_CV = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns start-of-today in UTC as a Date (00:00:00.000Z). */
function todayUtcStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Maps a free-text job title to a valid The Muse category slug.
 * Only returns categories confirmed to have active listings.
 * Returns undefined to fall back to general (no-category) search.
 */
function mapRoleToMuseCategory(role: string): string | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  if (/software|engineer|developer|backend|frontend|full.?stack|sre|devops|platform/.test(r)) return "Software Engineering";
  if (/project manager|program manager|scrum|agile/.test(r)) return "Project Management";
  if (/sales|account exec|business dev|bdr|sdr/.test(r)) return "Sales";
  if (/manager|director|vp |vice president|head of|lead|recruit|talent|hr |human res|people ops/.test(r)) return "Management";
  return undefined;
}

/** How many recommendation runs have been made for this (user, application) today. */
async function countCvRunsToday(userId: string, applicationId: string | null): Promise<number> {
  const since = todayUtcStart();
  const conditions = [
    eq(candidateProfilesTable.userId, userId),
    gte(candidateProfilesTable.createdAt, since),
  ];
  if (applicationId) {
    conditions.push(eq(candidateProfilesTable.sourceApplicationId, applicationId));
  } else {
    // "most recent CV" path — count runs where sourceApplicationId IS NULL (treated as one bucket)
    conditions.push(eq(candidateProfilesTable.sourceApplicationId, ""));
  }

  const [row] = await db
    .select({ total: count() })
    .from(candidateProfilesTable)
    .where(and(...conditions));
  return row?.total ?? 0;
}

/** True if the user has an active Pro subscription. */
async function checkIsPro(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ subscriptionStatus: usersTable.subscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return subscriptionIsActive(user?.subscriptionStatus);
}

// ─── GET /api/jobs/credits ────────────────────────────────────────────────────
// Returns credit / quota info for the current user.
// Query param: ?applicationId=<uuid> — when provided, also returns how many
// searches have been done for that CV today (Pro users).

router.get("/jobs/credits", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const applicationId = (req.query.applicationId as string | undefined) ?? null;
  const isPro = await checkIsPro(userId);

  if (isPro) {
    const runsToday = applicationId ? await countCvRunsToday(userId, applicationId) : 0;
    res.json({
      isProUser: true,
      dailyLimitPerCv: PRO_DAILY_LIMIT_PER_CV,
      runsUsedTodayForCv: runsToday,
      remainingForCv: Math.max(0, PRO_DAILY_LIMIT_PER_CV - runsToday),
    });
  } else {
    const credits = await getJobRecCredits(userId);
    res.json({ isProUser: false, jobRecCredits: credits });
  }
});

// ─── GET /api/jobs/recommendations ────────────────────────────────────────────
// Returns the user's saved recommendations, grouped by candidate_profile_id.

router.get("/jobs/recommendations", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      rec: jobRecommendationsTable,
      job: externalJobsCacheTable,
      profile: {
        id: candidateProfilesTable.id,
        normalizedProfile: candidateProfilesTable.normalizedProfile,
        preferences: candidateProfilesTable.preferences,
        createdAt: candidateProfilesTable.createdAt,
        sourceApplicationId: candidateProfilesTable.sourceApplicationId,
      },
    })
    .from(jobRecommendationsTable)
    .innerJoin(
      externalJobsCacheTable,
      eq(jobRecommendationsTable.externalJobCacheId, externalJobsCacheTable.id),
    )
    .innerJoin(
      candidateProfilesTable,
      eq(jobRecommendationsTable.candidateProfileId, candidateProfilesTable.id),
    )
    .where(eq(jobRecommendationsTable.userId, userId))
    .orderBy(
      desc(candidateProfilesTable.createdAt),
      desc(jobRecommendationsTable.matchScore),
    )
    .limit(100);

  const grouped: Record<string, {
    profile: typeof rows[0]["profile"];
    recommendations: Array<typeof rows[0]["rec"] & { job: typeof rows[0]["job"] }>;
  }> = {};

  for (const row of rows) {
    const pid = row.profile.id;
    if (!grouped[pid]) grouped[pid] = { profile: row.profile, recommendations: [] };
    grouped[pid].recommendations.push({ ...row.rec, job: row.job });
  }

  res.json({ groups: Object.values(grouped) });
});

// ─── POST /api/jobs/recommend ─────────────────────────────────────────────────
// Main recommendation endpoint.
//
// Credit / quota rules:
//   Pro users   → 10 searches per CV per day (tracked via candidate_profiles count)
//   Non-Pro     → deducts 1 from global job_rec_credits pool (from unlock purchases)

router.post("/jobs/recommend", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    applicationId,
    preferredLocation,
    country = "gb",
    remotePreference,
    roleType,
  } = req.body as {
    applicationId?: string;
    preferredLocation?: string;
    country?: string;
    remotePreference?: string;
    roleType?: string;
  };

  // ── Determine Pro status and enforce quota ───────────────────────────────────
  const isPro = await checkIsPro(userId);

  if (isPro) {
    if (!applicationId) {
      res.status(422).json({
        error: "Please select a CV to get job recommendations.",
        code: "NO_CV_SELECTED",
      });
      return;
    }
    const runsToday = await countCvRunsToday(userId, applicationId);
    if (runsToday >= PRO_DAILY_LIMIT_PER_CV) {
      res.status(429).json({
        error: `You've used all ${PRO_DAILY_LIMIT_PER_CV} searches for this CV today. Try again tomorrow or select a different CV.`,
        code: "CV_DAILY_LIMIT_REACHED",
        remainingForCv: 0,
        runsUsedTodayForCv: runsToday,
      });
      return;
    }
  } else {
    // Non-Pro: check global job rec credits (from unlock purchases)
    const credits = await getJobRecCredits(userId);
    if (credits < 1) {
      res.status(402).json({
        error: "No job recommendation credits. Unlock a CV analysis ($6.99) to receive 10 searches.",
        code: "NO_JOB_REC_CREDITS",
      });
      return;
    }
  }

  // ── Resolve source application ───────────────────────────────────────────────
  let parsedCvJson: unknown = null;
  let resolvedApplicationId = applicationId ?? null;

  if (applicationId) {
    const [app] = await db
      .select({ parsedCvJson: applicationsTable.parsedCvJson })
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.id, applicationId),
          eq(applicationsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    parsedCvJson = app.parsedCvJson;
  } else {
    // Non-Pro fallback: use most recent analyzed application
    const [latest] = await db
      .select({ id: applicationsTable.id, parsedCvJson: applicationsTable.parsedCvJson })
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.userId, userId),
          isNotNull(applicationsTable.parsedCvJson),
        ),
      )
      .orderBy(desc(applicationsTable.createdAt))
      .limit(1);

    if (!latest) {
      res.status(422).json({
        error: "No analyzed applications found. Please analyze a CV first.",
        code: "NO_CV",
      });
      return;
    }
    parsedCvJson = latest.parsedCvJson;
    resolvedApplicationId = latest.id;
  }

  // ── Build normalized candidate profile ──────────────────────────────────────
  let normalizedProfile: Awaited<ReturnType<typeof normalizeCandidateProfile>>;
  try {
    normalizedProfile = await normalizeCandidateProfile(JSON.stringify(parsedCvJson));
  } catch (err) {
    logger.error({ err, userId }, "Failed to normalize candidate profile");
    res.status(500).json({ error: "Failed to build candidate profile from CV" });
    return;
  }

  if (preferredLocation) {
    normalizedProfile.preferred_locations = [preferredLocation, ...normalizedProfile.preferred_locations];
  }
  if (remotePreference) normalizedProfile.remote_preference = remotePreference;
  if (roleType) normalizedProfile.target_roles = [roleType, ...normalizedProfile.target_roles];

  const preferences = { preferredLocation, country, remotePreference, roleType };

  // ── Persist candidate profile (this also records the run for quota tracking) ─
  const [savedProfile] = await db
    .insert(candidateProfilesTable)
    .values({
      userId,
      sourceApplicationId: resolvedApplicationId,
      parsedCv: parsedCvJson as Record<string, unknown>,
      normalizedProfile: normalizedProfile as unknown as Record<string, unknown>,
      preferences: preferences as Record<string, unknown>,
    })
    .returning({ id: candidateProfilesTable.id });

  // ── Fetch external jobs ──────────────────────────────────────────────────────
  const topRoles = normalizedProfile.target_roles.slice(0, 3);
  const searchTerms = topRoles.length > 0
    ? topRoles
    : [normalizedProfile.keywords.slice(0, 2).join(" ") || "software engineer"];

  // Adzuna only supports a fixed set of country codes.
  const ADZUNA_SUPPORTED = new Set([
    "at", "au", "be", "br", "ca", "ch", "de", "es", "fr",
    "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za",
  ]);
  const adzunaCountry = ADZUNA_SUPPORTED.has(country) ? country : "gb";
  if (adzunaCountry !== country) {
    logger.info({ requestedCountry: country, fallbackCountry: adzunaCountry }, "Country not supported by Adzuna — falling back to gb");
  }

  const rawJobs: ReturnType<typeof normalizeAdzunaJob>[] = [];

  for (const term of searchTerms) {
    try {
      const results = await fetchAdzunaJobs({ what: term, where: preferredLocation, country: adzunaCountry, resultsPerPage: 20 });
      rawJobs.push(...results.map(normalizeAdzunaJob));
    } catch (err) {
      logger.warn({ err, term }, "Adzuna fetch failed for term — skipping");
    }
  }

  // The Muse is a last-resort fallback ONLY when Adzuna returns nothing at all.
  // Do NOT mix Muse jobs in with Adzuna results — Muse has no country filter
  // and would contaminate country-specific searches with global (often US) jobs.
  if (rawJobs.length === 0) {
    const museCategory = mapRoleToMuseCategory(topRoles[0] ?? "");
    for (const page of [1, 2]) {
      try {
        const museResults = await fetchMuseJobs({ category: museCategory, page });
        rawJobs.push(...museResults.map(normalizeMuseJob));
      } catch (err) {
        logger.warn({ err, page, museCategory }, "The Muse fetch failed — skipping");
      }
    }
    // If category-filtered still empty, fetch general recent jobs from The Muse
    if (rawJobs.length === 0) {
      try {
        const museResults = await fetchMuseJobs({ page: 1 });
        rawJobs.push(...museResults.map(normalizeMuseJob));
      } catch (err) {
        logger.warn({ err }, "The Muse general fetch failed — skipping");
      }
    }
  }

  if (rawJobs.length === 0) {
    res.status(502).json({
      error: "Could not fetch any jobs from the job boards. Please try again.",
      code: "NO_JOBS_FETCHED",
    });
    return;
  }

  // ── Deduplicate + cache jobs ─────────────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueJobs = rawJobs.filter((j) => {
    const key = `${j.source}:${j.external_job_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const cachedIds: Record<string, string> = {};

  for (const job of uniqueJobs) {
    const [row] = await db
      .insert(externalJobsCacheTable)
      .values({
        source: job.source,
        externalJobId: job.external_job_id,
        title: job.title,
        company: job.company ?? null,
        location: job.location ?? null,
        employmentType: job.employment_type ?? null,
        remoteType: job.remote_type ?? null,
        salaryMin: job.salary_min != null ? String(job.salary_min) : null,
        salaryMax: job.salary_max != null ? String(job.salary_max) : null,
        currency: job.currency ?? null,
        description: job.description ?? null,
        applyUrl: job.apply_url ?? null,
        sourcePayload: job.source_payload as Record<string, unknown>,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [externalJobsCacheTable.source, externalJobsCacheTable.externalJobId],
        set: {
          title: job.title,
          company: job.company ?? null,
          location: job.location ?? null,
          description: job.description ?? null,
          applyUrl: job.apply_url ?? null,
          fetchedAt: new Date(),
        },
      })
      .returning({ id: externalJobsCacheTable.id });

    if (row) cachedIds[`${job.source}:${job.external_job_id}`] = row.id;
  }

  // ── Pre-filter + AI reranking ────────────────────────────────────────────────
  const prefiltered = prefilterJobs(normalizedProfile, uniqueJobs).slice(0, 20);

  let aiRankings: Awaited<ReturnType<typeof rerankJobsWithAI>>;
  try {
    aiRankings = await rerankJobsWithAI(normalizedProfile, prefiltered);
  } catch (err) {
    logger.error({ err, userId }, "AI reranking failed");
    res.status(500).json({ error: "AI ranking failed. Please try again." });
    return;
  }

  // ── Spend credit (non-Pro only — Pro uses per-CV count already recorded above) ─
  if (!isPro) {
    const { success } = await spendJobRecCredit(userId);
    if (!success) {
      res.status(402).json({ error: "No job recommendation credits remaining.", code: "NO_JOB_REC_CREDITS" });
      return;
    }
  }

  // ── Persist recommendations ──────────────────────────────────────────────────
  const top10 = aiRankings.slice(0, 10);
  const savedRecs: Array<{
    id: string;
    matchScore: number;
    fitReasons: unknown;
    missingRequirements: unknown;
    recommendationSummary: string | null;
    job: typeof uniqueJobs[0];
    cacheId: string;
  }> = [];

  for (const ranking of top10) {
    const cacheKey = `${ranking.source}:${ranking.external_job_id}`;
    const cacheId = cachedIds[cacheKey];
    if (!cacheId) continue;

    const jobData = uniqueJobs.find(
      (j) => j.source === ranking.source && j.external_job_id === ranking.external_job_id,
    );
    if (!jobData) continue;

    const [rec] = await db
      .insert(jobRecommendationsTable)
      .values({
        userId,
        candidateProfileId: savedProfile.id,
        externalJobCacheId: cacheId,
        matchScore: ranking.match_score,
        fitReasons: ranking.fit_reasons as string[],
        missingRequirements: ranking.missing_requirements as string[],
        recommendationSummary: ranking.recommendation_summary ?? null,
      })
      .returning({ id: jobRecommendationsTable.id });

    if (rec) {
      savedRecs.push({
        id: rec.id,
        matchScore: ranking.match_score,
        fitReasons: ranking.fit_reasons,
        missingRequirements: ranking.missing_requirements,
        recommendationSummary: ranking.recommendation_summary ?? null,
        job: jobData,
        cacheId,
      });
    }
  }

  // ── Build response ───────────────────────────────────────────────────────────
  const responseBase = {
    profileId: savedProfile.id,
    candidateName: normalizedProfile.candidate_name,
    targetRoles: normalizedProfile.target_roles,
    recommendations: savedRecs,
    totalJobsFetched: uniqueJobs.length,
  };

  if (isPro) {
    const runsAfter = await countCvRunsToday(userId, resolvedApplicationId);
    res.json({
      ...responseBase,
      isProUser: true,
      runsUsedTodayForCv: runsAfter,
      remainingForCv: Math.max(0, PRO_DAILY_LIMIT_PER_CV - runsAfter),
    });
  } else {
    const remainingCredits = await getJobRecCredits(userId);
    res.json({ ...responseBase, isProUser: false, remainingCredits });
  }
});

export default router;
