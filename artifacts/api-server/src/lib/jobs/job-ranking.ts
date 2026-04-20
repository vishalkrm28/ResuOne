import type { UnifiedJob } from "./job-schema.js";

// ─── Local pre-scoring for discovered jobs ────────────────────────────────────
// Fast, zero-cost scoring before sending a subset to AI for deep ranking.

export interface ScoredDiscoveredJob extends UnifiedJob {
  preScore: number;
}

export interface CandidateSignals {
  targetRoles?: string[];
  coreSkills?: string[];
  tools?: string[];
  preferredLocations?: string[];
  preferredCountries?: string[];
  seniorityLevel?: string;
  remotePreferred?: boolean;
}

/**
 * Score a discovered job against candidate signals.
 * Returns a score 0–100 (not normalized — just additive weights).
 */
export function scoreDiscoveredJob(
  job: UnifiedJob,
  signals: CandidateSignals,
  remoteOnly = false,
): number {
  const haystack =
    `${job.title} ${job.description} ${job.company} ${job.location}`.toLowerCase();

  let score = 0;

  // Title / role match (highest weight)
  for (const role of signals.targetRoles ?? []) {
    if (haystack.includes(role.toLowerCase())) score += 15;
  }

  // Skill overlap
  for (const skill of signals.coreSkills ?? []) {
    if (haystack.includes(skill.toLowerCase())) score += 5;
  }

  // Tool overlap
  for (const tool of signals.tools ?? []) {
    if (haystack.includes(tool.toLowerCase())) score += 3;
  }

  // Job skills match
  for (const jobSkill of job.skills ?? []) {
    for (const skill of signals.coreSkills ?? []) {
      if (jobSkill.toLowerCase().includes(skill.toLowerCase())) score += 2;
    }
  }

  // Location preference
  for (const loc of signals.preferredLocations ?? []) {
    if (haystack.includes(loc.toLowerCase())) score += 8;
  }

  // Country preference
  for (const country of signals.preferredCountries ?? []) {
    if (
      job.country?.toLowerCase() === country.toLowerCase() ||
      haystack.includes(country.toLowerCase())
    ) {
      score += 6;
    }
  }

  // Remote match
  if (remoteOnly && job.remote) score += 10;
  if (remoteOnly && !job.remote) score -= 5;

  // Seniority match
  if (signals.seniorityLevel && job.seniority) {
    if (
      signals.seniorityLevel.toLowerCase() === job.seniority.toLowerCase()
    ) {
      score += 8;
    }
  }

  // Freshness bonus (prefer recently posted)
  if (job.postedAt) {
    const ageMs = Date.now() - new Date(job.postedAt).getTime();
    const ageDays = ageMs / 86_400_000;
    if (ageDays < 3) score += 5;
    else if (ageDays < 7) score += 3;
    else if (ageDays < 14) score += 1;
  }

  return Math.max(0, score);
}

/**
 * Pre-score and sort discovered jobs, returning top N candidates for AI ranking.
 */
export function preScoreDiscoveredJobs(
  jobs: UnifiedJob[],
  signals: CandidateSignals,
  remoteOnly = false,
  topN = 30,
): ScoredDiscoveredJob[] {
  return jobs
    .map((job) => ({
      ...job,
      preScore: scoreDiscoveredJob(job, signals, remoteOnly),
    }))
    .sort((a, b) => b.preScore - a.preScore)
    .slice(0, topN);
}
