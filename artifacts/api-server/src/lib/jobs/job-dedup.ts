import { buildCanonicalKey } from "./job-normalize.js";
import type { UnifiedJob } from "./job-schema.js";

// ─── Richness scoring ─────────────────────────────────────────────────────────
// Higher score = richer record. Used when choosing between duplicates.

function richnessScore(job: UnifiedJob): number {
  let score = 0;
  if (job.description && job.description.length > 100) score += 3;
  if (job.applyUrl) score += 2;
  if (job.salaryMin != null || job.salaryMax != null) score += 2;
  if (job.postedAt) score += 1;
  if (job.company) score += 1;
  if (job.location) score += 1;
  if (job.skills && job.skills.length > 0) score += 1;
  return score;
}

/** Choose the richer of two duplicate job records. */
export function choosePreferredJobRecord(a: UnifiedJob, b: UnifiedJob): UnifiedJob {
  return richnessScore(a) >= richnessScore(b) ? a : b;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Deduplicate a list of discovered jobs.
 *
 * Rules (in priority order):
 * 1. Same source + externalId → duplicate
 * 2. Same canonical_key → duplicate
 * 3. When duplicates found, keep the richer record
 */
export function dedupeJobs(jobs: UnifiedJob[]): UnifiedJob[] {
  // Map: sourceKey → index into `unique` array
  const bySourceKey = new Map<string, number>();
  // Map: canonicalKey → index
  const byCanonicalKey = new Map<string, number>();
  const unique: UnifiedJob[] = [];

  for (const job of jobs) {
    const sourceKey =
      job.source && job.externalId ? `${job.source}::${job.externalId}` : null;
    const canonicalKey = buildCanonicalKey({
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      externalId: job.externalId,
    });

    // Check source key first
    if (sourceKey && bySourceKey.has(sourceKey)) {
      const idx = bySourceKey.get(sourceKey)!;
      unique[idx] = choosePreferredJobRecord(unique[idx], job);
      continue;
    }

    // Check canonical key
    if (byCanonicalKey.has(canonicalKey)) {
      const idx = byCanonicalKey.get(canonicalKey)!;
      unique[idx] = choosePreferredJobRecord(unique[idx], job);
      continue;
    }

    // New unique job
    const idx = unique.length;
    unique.push(job);
    if (sourceKey) bySourceKey.set(sourceKey, idx);
    byCanonicalKey.set(canonicalKey, idx);
  }

  return unique;
}
