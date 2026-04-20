import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";
import { db, jobMatchResultsTable } from "@workspace/db";
import { preScoreDiscoveredJobs, type CandidateSignals } from "./job-ranking.js";
import type { UnifiedJob } from "./job-schema.js";
import { logger } from "../logger.js";

const AI_MODEL = process.env.AI_MODEL_FAST ?? "gpt-5.2";

// ─── AI output schema ─────────────────────────────────────────────────────────

const MatchOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      job_canonical_key: z.string(),
      match_score: z.number().int().min(0).max(100),
      fit_reasons: z.array(z.string()),
      missing_requirements: z.array(z.string()),
      recommendation_summary: z.string(),
    }),
  ),
});

export interface JobMatchRecommendation {
  jobCanonicalKey: string;
  matchScore: number;
  fitReasons: string[];
  missingRequirements: string[];
  recommendationSummary: string;
  job: UnifiedJob;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildDiscoveredJobsRankingPrompt(
  candidateProfileJson: string,
  jobsJson: string,
): string {
  return `You are an expert career advisor. Your task is to rank a list of job postings against a candidate's profile.

CANDIDATE PROFILE:
${candidateProfileJson}

JOB POSTINGS (as JSON array):
${jobsJson}

RULES:
- Be realistic. Do NOT flatter. Penalize obvious mismatches.
- Prefer relevant title, location, skills, and seniority.
- match_score is 0–100 (100 = perfect fit, 0 = completely irrelevant).
- fit_reasons: 2–4 specific reasons the job is a good match.
- missing_requirements: 1–3 honest gaps or concerns.
- recommendation_summary: 1–2 sentences max, plain English.
- If remote_only is true in preferences, penalize non-remote roles.
- Return ONLY valid JSON. No markdown, no explanation.

RESPONSE FORMAT:
{
  "recommendations": [
    {
      "job_canonical_key": "<canonical_key from the job>",
      "match_score": 0,
      "fit_reasons": [],
      "missing_requirements": [],
      "recommendation_summary": ""
    }
  ]
}`;
}

// ─── AI matching ──────────────────────────────────────────────────────────────

/**
 * Run AI-powered matching against a set of discovered jobs.
 * 1. Pre-score locally and take top 25
 * 2. Send compact profile + jobs to OpenAI
 * 3. Parse and return ranked recommendations
 */
export async function matchDiscoveredJobsWithAI({
  candidateProfile,
  jobs,
  remoteOnly = false,
}: {
  candidateProfile: Record<string, unknown>;
  jobs: UnifiedJob[];
  remoteOnly?: boolean;
}): Promise<JobMatchRecommendation[]> {
  if (!jobs.length) return [];

  // Extract signals from the candidate profile
  const signals: CandidateSignals = {
    targetRoles: (candidateProfile.target_roles as string[]) ?? [],
    coreSkills: (candidateProfile.core_skills as string[]) ?? [],
    tools: (candidateProfile.tools as string[]) ?? [],
    preferredLocations: (candidateProfile.preferred_locations as string[]) ?? [],
    seniorityLevel: (candidateProfile.seniority_level as string) ?? "",
    remotePreferred: remoteOnly,
  };

  // Pre-score and take top 25 for AI ranking
  const topJobs = preScoreDiscoveredJobs(jobs, signals, remoteOnly, 25);

  if (!topJobs.length) return [];

  // Build compact job representations for AI (avoid sending huge raw payloads)
  const compactJobs = topJobs.map((j) => ({
    canonical_key: (j.metadata?.canonicalKey as string) ?? j.externalId,
    title: j.title,
    company: j.company,
    location: j.location,
    country: j.country,
    remote: j.remote,
    employment_type: j.employmentType,
    seniority: j.seniority,
    description: j.description.slice(0, 800),
    skills: j.skills.slice(0, 10),
  }));

  // Build compact candidate profile
  const compactProfile = {
    target_roles: signals.targetRoles,
    core_skills: signals.coreSkills,
    tools: signals.tools,
    preferred_locations: signals.preferredLocations,
    seniority_level: signals.seniorityLevel,
    remote_only: remoteOnly,
    summary: candidateProfile.summary ?? "",
    total_years_experience: candidateProfile.total_years_experience ?? null,
  };

  const prompt = buildDiscoveredJobsRankingPrompt(
    JSON.stringify(compactProfile, null, 2),
    JSON.stringify(compactJobs, null, 2),
  );

  let rawResponse: string;
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 3000,
    });
    rawResponse = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.error({ err }, "AI job matching request failed");
    throw new Error("AI matching failed");
  }

  // Parse AI response
  let parsed: z.infer<typeof MatchOutputSchema>;
  try {
    const jsonStart = rawResponse.indexOf("{");
    const jsonEnd = rawResponse.lastIndexOf("}") + 1;
    const jsonStr = rawResponse.slice(jsonStart, jsonEnd);
    parsed = MatchOutputSchema.parse(JSON.parse(jsonStr));
  } catch (err) {
    logger.error({ err, rawResponse: rawResponse.slice(0, 200) }, "AI match output parse error");
    throw new Error("AI response parsing failed");
  }

  // Build a lookup: canonical_key → original UnifiedJob
  const jobByKey = new Map<string, UnifiedJob>();
  for (const j of topJobs) {
    const key = (j.metadata?.canonicalKey as string) ?? j.externalId;
    jobByKey.set(key, j);
  }

  return parsed.recommendations
    .filter((r) => jobByKey.has(r.job_canonical_key))
    .map((r) => ({
      jobCanonicalKey: r.job_canonical_key,
      matchScore: r.match_score,
      fitReasons: r.fit_reasons,
      missingRequirements: r.missing_requirements,
      recommendationSummary: r.recommendation_summary,
      job: jobByKey.get(r.job_canonical_key)!,
    }));
}

// ─── Persist match results ────────────────────────────────────────────────────

export async function saveJobMatchResults({
  userId,
  candidateProfileId,
  recommendations,
  jobIdByCanonicalKey,
}: {
  userId: string;
  candidateProfileId?: string;
  recommendations: JobMatchRecommendation[];
  jobIdByCanonicalKey: Map<string, string>;
}): Promise<void> {
  const rows = recommendations
    .map((r) => {
      const jobId = jobIdByCanonicalKey.get(r.jobCanonicalKey);
      if (!jobId) return null;
      return {
        userId,
        candidateProfileId: candidateProfileId ?? null,
        jobId,
        matchScore: r.matchScore,
        fitReasons: r.fitReasons as any,
        missingRequirements: r.missingRequirements as any,
        recommendationSummary: r.recommendationSummary,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) return;

  try {
    await db.insert(jobMatchResultsTable).values(rows);
  } catch (err) {
    logger.warn({ err }, "Failed to save match results (non-critical)");
  }
}
