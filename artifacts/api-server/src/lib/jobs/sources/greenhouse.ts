import { buildCanonicalKey, sanitizeDescription, inferRemoteFlag, inferCountry, normalizeLocation } from "../job-normalize.js";
import type { UnifiedJob } from "../job-schema.js";
import { logger } from "../../logger.js";

export interface GreenhouseInput {
  boardTokens: string[];
}

/**
 * Get the default Greenhouse board tokens from environment config or seed list.
 * Set GREENHOUSE_BOARD_TOKENS_JSON='["token1","token2"]' to configure.
 */
export function getDefaultGreenhouseBoardTokens(
  _query?: string,
  _country?: string,
): string[] {
  const envJson = process.env.GREENHOUSE_BOARD_TOKENS_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === "string");
    } catch {
      logger.warn("GREENHOUSE_BOARD_TOKENS_JSON is not valid JSON");
    }
  }
  // Built-in seed list of well-known tech companies on Greenhouse
  return [
    "spotify",
    "klarna",
    "king",
    "mojang",
    "truecaller",
    "einride",
    "northvolt",
    "voi",
    "anyfin",
  ];
}

/**
 * Fetch and normalize jobs from multiple Greenhouse public boards.
 * Tolerates individual board failures — always returns what succeeded.
 */
export async function fetchGreenhouseJobs(input: GreenhouseInput): Promise<UnifiedJob[]> {
  const { boardTokens } = input;
  if (!boardTokens.length) return [];

  const results = await Promise.allSettled(
    boardTokens.map((token) => fetchBoardJobs(token)),
  );

  const jobs: UnifiedJob[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    } else {
      logger.warn({ err: result.reason }, "Greenhouse board fetch failed (tolerated)");
    }
  }
  return jobs;
}

async function fetchBoardJobs(boardToken: string): Promise<UnifiedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Greenhouse board "${boardToken}" returned HTTP ${res.status}`);
  }

  const data: any = await res.json();
  const rawJobs: any[] = data.jobs ?? [];

  return rawJobs.map((raw) => normalizeGreenhouseJob(raw, boardToken));
}

function normalizeGreenhouseJob(raw: any, boardToken: string): UnifiedJob {
  const title: string = raw.title ?? "";
  const company: string = raw.company ?? boardToken;
  const locationRaw: string = raw.location?.name ?? "";
  const location = normalizeLocation(locationRaw);
  const description = sanitizeDescription(raw.content ?? "");
  const externalId = String(raw.id);
  const applyUrl: string = raw.absolute_url ?? "";

  const remote = inferRemoteFlag(title, location);
  const country = inferCountry(location);
  const canonicalKey = buildCanonicalKey({ title, company, location, source: "greenhouse", externalId });

  return {
    source: "greenhouse",
    sourceType: "greenhouse",
    externalId,
    title,
    company,
    location,
    country,
    remote,
    employmentType: "",
    seniority: "",
    salaryMin: null,
    salaryMax: null,
    currency: "",
    description,
    applyUrl,
    companyCareersUrl: `https://boards.greenhouse.io/${boardToken}`,
    postedAt: raw.updated_at ?? null,
    expiresAt: null,
    skills: [],
    metadata: {
      boardToken,
      departments: (raw.departments ?? []).map((d: any) => d.name).filter(Boolean),
      offices: (raw.offices ?? []).map((o: any) => o.name ?? o.location).filter(Boolean),
      canonicalKey,
    },
    rawPayload: raw,
  };
}
