import { fetchGoogleJobs } from "./sources/google-jobs-serpapi.js";
import {
  fetchGreenhouseJobs,
  getDefaultGreenhouseBoardTokens,
} from "./sources/greenhouse.js";
import type { UnifiedJob } from "./job-schema.js";
import { logger } from "../logger.js";

/**
 * Filter Greenhouse jobs by title-only keyword match.
 * Description-based matching is too broad — words like "Manager" or "Data"
 * appear in virtually every job and cause thousands of false positives.
 * Title matching is strict and meaningful.
 */
function filterByTitleQuery(jobs: UnifiedJob[], query: string): UnifiedJob[] {
  if (!query.trim()) return jobs;
  // Split into meaningful words (4+ chars to avoid noise like "and", "for")
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (!keywords.length) return jobs;
  return jobs.filter((job) => {
    const title = job.title.toLowerCase();
    // At least one keyword must appear in the title
    return keywords.some((kw) => title.includes(kw));
  });
}

/**
 * Filter jobs by country code — strict mode.
 * Only keeps jobs that match the requested country OR are remote.
 * Jobs with unknown/unrecognised country are excluded when a filter is active,
 * because that "unknown" set is dominated by far-away results leaking through.
 */
function filterByCountry(jobs: UnifiedJob[], country: string): UnifiedJob[] {
  if (!country) return jobs;
  return jobs.filter(
    (job) => job.country === country || job.remote === true || job.country === "remote",
  );
}

export interface DiscoveryInput {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
  limit?: number;
}

export interface DiscoveryResult {
  jobs: UnifiedJob[];
  sourceBreakdown: {
    google_jobs: number;
    greenhouse: number;
  };
  errors: string[];
}

/**
 * Orchestrate all discovery sources.
 *
 * Sources:
 *  - Google Jobs via SerpApi (query + country aware, primary source)
 *  - Greenhouse ATS (company boards, filtered by title keywords + country)
 *
 * Lever is excluded — all tested company handles currently return 404.
 */
export async function discoverJobsFromSources(
  input: DiscoveryInput,
): Promise<DiscoveryResult> {
  const { query, country = "", location = "", remoteOnly = false, limit = 50 } = input;

  const maxResults = parseInt(
    process.env.JOB_DISCOVERY_MAX_RESULTS ?? "100",
    10,
  );
  const effectiveLimit = Math.min(limit, maxResults);

  const errors: string[] = [];

  // ── Run sources in parallel ───────────────────────────────────────────────

  const [googleResult, greenhouseResult] = await Promise.allSettled([
    // Google Jobs via SerpApi — respects query + country natively
    fetchGoogleJobs({ query, country, location, remoteOnly, limit: effectiveLimit }),

    // Greenhouse ATS — fetch all boards then filter locally
    fetchGreenhouseJobs({
      boardTokens: getDefaultGreenhouseBoardTokens(query, country),
    }),
  ]);

  const googleJobs: UnifiedJob[] =
    googleResult.status === "fulfilled" ? googleResult.value : [];
  if (googleResult.status === "rejected") {
    const msg = String(googleResult.reason?.message ?? googleResult.reason);
    logger.warn({ err: googleResult.reason }, "Google Jobs source failed");
    errors.push(`google_jobs: ${msg}`);
  }

  const greenhouseRaw: UnifiedJob[] =
    greenhouseResult.status === "fulfilled" ? greenhouseResult.value : [];
  if (greenhouseResult.status === "rejected") {
    const msg = String(greenhouseResult.reason?.message ?? greenhouseResult.reason);
    logger.warn({ err: greenhouseResult.reason }, "Greenhouse source failed");
    errors.push(`greenhouse: ${msg}`);
  }

  // Apply country filter to Google Jobs.
  // SerpApi doesn't guarantee strict geo-filtering, and inferCountry now correctly
  // infers country from location text (queryCountry is only a fallback, not an override).
  const googleFiltered = country ? filterByCountry(googleJobs, country) : googleJobs;

  // Apply title-keyword filter then country filter for Greenhouse
  const greenhouseFiltered = filterByTitleQuery(greenhouseRaw, query);
  const greenhouseJobs = country
    ? filterByCountry(greenhouseFiltered, country)
    : greenhouseFiltered;

  const jobs = [...googleFiltered, ...greenhouseJobs];

  return {
    jobs,
    sourceBreakdown: {
      google_jobs: googleJobs.length,
      greenhouse: greenhouseJobs.length,
    },
    errors,
  };
}
