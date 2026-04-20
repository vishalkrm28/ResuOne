import { eq, inArray, sql } from "drizzle-orm";
import { db, discoveredJobsTable, jobDiscoveryRunsTable } from "@workspace/db";
import { buildCanonicalKey } from "./job-normalize.js";
import type { UnifiedJob } from "./job-schema.js";
import { logger } from "../logger.js";

// ─── Upsert discovered jobs ───────────────────────────────────────────────────

/**
 * Upsert a batch of normalized jobs into the `jobs` table.
 * Uses canonical_key as the conflict target so cross-source duplicates merge.
 * Returns the array of stored job IDs (in the same order as input).
 */
export async function upsertDiscoveredJobs(jobs: UnifiedJob[]): Promise<string[]> {
  if (!jobs.length) return [];

  const rows = jobs.map((job) => {
    const canonicalKey: string =
      (job.metadata?.canonicalKey as string) ??
      buildCanonicalKey({
        title: job.title,
        company: job.company,
        location: job.location,
        source: job.source,
        externalId: job.externalId,
      });

    return {
      source: job.source,
      sourceType: job.sourceType,
      externalId: job.externalId || null,
      canonicalKey,
      title: job.title,
      company: job.company || null,
      location: job.location || null,
      country: job.country || null,
      remote: job.remote,
      employmentType: job.employmentType || null,
      seniority: job.seniority || null,
      salaryMin: job.salaryMin != null ? String(job.salaryMin) : null,
      salaryMax: job.salaryMax != null ? String(job.salaryMax) : null,
      currency: job.currency || null,
      description: job.description || null,
      applyUrl: job.applyUrl || null,
      companyCareersUrl: job.companyCareersUrl || null,
      postedAt: job.postedAt ? new Date(job.postedAt) : null,
      expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
      skills: job.skills as any,
      metadata: job.metadata as any,
      rawPayload: job.rawPayload as any,
      fetchedAt: new Date(),
      updatedAt: new Date(),
    };
  });

  // Batch upsert in chunks of 50 to avoid query size limits
  const CHUNK = 50;
  const ids: string[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    try {
      const inserted = await db
        .insert(discoveredJobsTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: discoveredJobsTable.canonicalKey,
          set: {
            fetchedAt: new Date(),
            updatedAt: new Date(),
            // Prefer richer data: only update description if the new one is longer
            description: sql`CASE WHEN length(EXCLUDED.description) > length(jobs.description) THEN EXCLUDED.description ELSE jobs.description END`,
            applyUrl: sql`COALESCE(EXCLUDED.apply_url, jobs.apply_url)`,
            salaryMin: sql`COALESCE(EXCLUDED.salary_min, jobs.salary_min)`,
            salaryMax: sql`COALESCE(EXCLUDED.salary_max, jobs.salary_max)`,
            remote: sql`EXCLUDED.remote OR jobs.remote`,
            skills: sql`CASE WHEN jsonb_array_length(EXCLUDED.skills) > jsonb_array_length(jobs.skills) THEN EXCLUDED.skills ELSE jobs.skills END`,
          },
        })
        .returning({ id: discoveredJobsTable.id });

      ids.push(...inserted.map((r) => r.id));
    } catch (err) {
      logger.error({ err, chunkIndex: i }, "Failed to upsert job chunk");
    }
  }

  return ids;
}

// ─── Get jobs by IDs ──────────────────────────────────────────────────────────

export async function getJobsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db
    .select()
    .from(discoveredJobsTable)
    .where(inArray(discoveredJobsTable.id, ids));
}

// ─── Save discovery run ───────────────────────────────────────────────────────

export async function saveDiscoveryRun({
  userId,
  query,
  country,
  remoteOnly,
  sourceBreakdown,
  discoveredCount,
  dedupedCount,
  cached,
}: {
  userId?: string;
  query: string;
  country?: string;
  remoteOnly?: boolean;
  sourceBreakdown: Record<string, number>;
  discoveredCount: number;
  dedupedCount: number;
  cached: boolean;
}) {
  try {
    await db.insert(jobDiscoveryRunsTable).values({
      userId: userId ?? null,
      query,
      country: country ?? null,
      remoteOnly: remoteOnly ?? false,
      sourceBreakdown: sourceBreakdown as any,
      discoveredCount,
      dedupedCount,
      cached,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to save discovery run (non-critical)");
  }
}
