import { buildCanonicalKey, sanitizeDescription, inferRemoteFlag, inferCountry, inferEmploymentType, normalizeLocation } from "../job-normalize.js";
import type { UnifiedJob } from "../job-schema.js";
import { logger } from "../../logger.js";

export interface LeverInput {
  companies: string[];
}

/**
 * Get the default Lever company handles from environment config or seed list.
 * Set LEVER_COMPANIES_JSON='["company1","company2"]' to configure.
 */
export function getDefaultLeverCompanies(
  _query?: string,
  _country?: string,
): string[] {
  const envJson = process.env.LEVER_COMPANIES_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === "string");
    } catch {
      logger.warn("LEVER_COMPANIES_JSON is not valid JSON");
    }
  }
  // Seed list of companies known to use Lever
  return [
    "netflix",
    "figma",
    "linear",
    "loom",
    "scale",
    "snyk",
    "contentful",
  ];
}

/**
 * Fetch and normalize jobs from multiple Lever public postings.
 * Tolerates individual company failures.
 */
export async function fetchLeverJobs(input: LeverInput): Promise<UnifiedJob[]> {
  const { companies } = input;
  if (!companies.length) return [];

  const results = await Promise.allSettled(
    companies.map((company) => fetchCompanyJobs(company)),
  );

  const jobs: UnifiedJob[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    } else {
      logger.warn({ err: result.reason }, "Lever company fetch failed (tolerated)");
    }
  }
  return jobs;
}

async function fetchCompanyJobs(company: string): Promise<UnifiedJob[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Lever postings for "${company}" returned HTTP ${res.status}`);
  }

  const data: any = await res.json();
  const rawJobs: any[] = Array.isArray(data) ? data : data.postings ?? [];

  return rawJobs.map((raw) => normalizeLeverJob(raw, company));
}

function normalizeLeverJob(raw: any, company: string): UnifiedJob {
  const title: string = raw.text ?? "";
  const locationRaw: string = raw.categories?.location ?? "";
  const location = normalizeLocation(locationRaw);
  const description = sanitizeDescription(raw.descriptionPlain ?? raw.description ?? "");
  const externalId: string = raw.id ?? raw.hostedUrl ?? String(Date.now());
  const applyUrl: string = raw.applyUrl ?? raw.hostedUrl ?? "";
  const rawCommitment: string = raw.categories?.commitment ?? "";
  const employmentType = inferEmploymentType(rawCommitment);
  const remote = inferRemoteFlag(title, location);
  const country = inferCountry(location);
  const canonicalKey = buildCanonicalKey({ title, company, location, source: "lever", externalId });

  const postedAt: string | null = raw.createdAt
    ? new Date(raw.createdAt).toISOString()
    : null;

  return {
    source: "lever",
    sourceType: "lever",
    externalId,
    title,
    company,
    location,
    country,
    remote,
    employmentType,
    seniority: "",
    salaryMin: null,
    salaryMax: null,
    currency: "",
    description,
    applyUrl,
    companyCareersUrl: `https://jobs.lever.co/${company}`,
    postedAt,
    expiresAt: null,
    skills: [],
    metadata: {
      companyHandle: company,
      team: raw.categories?.team ?? "",
      department: raw.categories?.department ?? "",
      commitment: rawCommitment,
      canonicalKey,
    },
    rawPayload: raw,
  };
}
