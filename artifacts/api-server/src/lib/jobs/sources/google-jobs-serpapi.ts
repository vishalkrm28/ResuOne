import { buildGoogleJobsQuery, toGlParam } from "../job-query.js";
import { buildCanonicalKey, sanitizeDescription, inferRemoteFlag, inferEmploymentType, inferSeniority, inferCountry, normalizeLocation } from "../job-normalize.js";
import type { UnifiedJob } from "../job-schema.js";
import { logger } from "../../logger.js";

export interface GoogleJobsInput {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
  limit?: number;
}

/**
 * Fetch jobs from Google Jobs via SerpApi.
 * Normalizes results into the unified job schema.
 *
 * Docs: https://serpapi.com/google-jobs-api
 */
export async function fetchGoogleJobs(input: GoogleJobsInput): Promise<UnifiedJob[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not configured");
  }

  const { query, country = "", location = "", remoteOnly = false, limit = 50 } = input;

  const searchQuery = buildGoogleJobsQuery({ query, country, location, remoteOnly });
  const gl = toGlParam(country) || undefined;

  const params = new URLSearchParams({
    engine: "google_jobs",
    q: searchQuery,
    api_key: apiKey,
    hl: "en",
    num: String(Math.min(limit, 100)),
  });

  if (gl) params.set("gl", gl);
  if (location) params.set("location", location);
  if (remoteOnly) params.set("chips", "date_posted:today,work_from_home:1");

  const url = `https://serpapi.com/search.json?${params.toString()}`;

  let raw: any;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SerpApi HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    raw = await res.json();
  } catch (err) {
    logger.error({ err, query: searchQuery }, "SerpApi request failed");
    throw err;
  }

  const jobsResults: any[] = raw?.jobs_results ?? [];

  return jobsResults.slice(0, limit).map((raw) => normalizeGoogleJob(raw, country));
}

function normalizeGoogleJob(raw: any, queryCountry: string): UnifiedJob {
  const title: string = raw.title ?? "";
  const company: string = raw.company_name ?? "";
  const location = normalizeLocation(raw.location ?? "");
  const description = sanitizeDescription(raw.description ?? "");
  const externalId: string = raw.job_id ?? raw.title?.slice(0, 40) ?? String(Date.now());

  // Extract apply URL from apply_options
  const applyUrl: string =
    raw.apply_options?.[0]?.link ??
    raw.related_links?.[0]?.link ??
    "";

  // Parse extensions array for employment type
  const extensions: string[] = raw.extensions ?? [];
  const rawEmploymentType = extensions.find((e) =>
    /full.?time|part.?time|contract|internship|temporary/i.test(e),
  ) ?? "";

  // Detect posted_at from detected_extensions
  const postedAtRaw: string | undefined =
    (raw.detected_extensions as any)?.posted_at;
  const postedAt: string | null = parseRelativeDate(postedAtRaw);

  // Extract skills from job_highlights
  const skills: string[] = [];
  const highlights: any[] = raw.job_highlights ?? [];
  for (const section of highlights) {
    if (/qualif|require|skill/i.test(section.title ?? "")) {
      for (const item of section.items ?? []) {
        if (typeof item === "string" && item.length < 80) skills.push(item);
      }
    }
  }

  const remote = inferRemoteFlag(title, location);
  const country = inferCountry(location, queryCountry);
  const employmentType = inferEmploymentType(rawEmploymentType);
  const seniority = inferSeniority(title);
  const canonicalKey = buildCanonicalKey({ title, company, location, source: "google_jobs_serpapi", externalId });

  return {
    source: "google_jobs_serpapi",
    sourceType: "google_jobs",
    externalId,
    title,
    company,
    location,
    country,
    remote,
    employmentType,
    seniority,
    salaryMin: null,
    salaryMax: null,
    currency: "",
    description,
    applyUrl,
    companyCareersUrl: "",
    postedAt,
    expiresAt: null,
    skills,
    metadata: {
      via: raw.via ?? "",
      canonicalKey,
      serpApiJobId: raw.job_id,
    },
    rawPayload: raw,
  };
}

/** Convert SerpApi relative date strings ("3 days ago", "2 weeks ago") to ISO-8601. */
function parseRelativeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const now = new Date();
  const s = raw.toLowerCase();

  const match = s.match(/(\d+)\s+(hour|day|week|month)/);
  if (!match) return null;

  const [, numStr, unit] = match;
  const n = parseInt(numStr, 10);
  const ms = {
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  }[unit];

  if (!ms) return null;
  return new Date(now.getTime() - n * ms).toISOString();
}
