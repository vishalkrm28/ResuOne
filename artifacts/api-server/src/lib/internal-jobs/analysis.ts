import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";
import { db, internalJobCandidateAnalysesTable, internalJobsTable, candidateProfilesTable, applicationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../logger.js";

const AI_MODEL = process.env.AI_MODEL_FAST ?? "gpt-4o-mini";

// ─── AI output schema ─────────────────────────────────────────────────────────

const AnalysisOutputSchema = z.object({
  match_score: z.number().int().min(0).max(100),
  fit_reasons: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendation_summary: z.string(),
  tailored_cv_suggestion: z.object({
    key_changes: z.array(z.string()).optional(),
    headline_suggestion: z.string().optional(),
  }).optional().default({}),
  cover_letter_suggestion: z.string().optional().default(""),
  apply_recommendation: z.enum(["apply_now", "tailor_first", "skip"]),
});

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(jobJson: string, candidateJson: string): string {
  return `You are a senior recruiter and career coach analysing a candidate's fit for an internal job posting on Resuone.

JOB DETAILS (JSON):
${jobJson}

CANDIDATE PROFILE (JSON):
${candidateJson}

Your task: provide a thorough, realistic, and honest analysis. Do NOT flatter. Do NOT invent experience.

Return a JSON object with these fields:
- match_score: integer 0–100 (100 = perfect fit, 0 = completely irrelevant)
- fit_reasons: array of strings — concrete reasons why they fit
- missing_requirements: array of strings — genuine gaps vs. the job requirements
- strengths: array of strings — candidate's strongest relevant attributes
- concerns: array of strings — honest concerns a recruiter would have
- recommendation_summary: 2–3 sentence overall assessment
- tailored_cv_suggestion: object with "key_changes" (array) and "headline_suggestion" (string)
- cover_letter_suggestion: short opening paragraph for a cover letter (2–3 sentences)
- apply_recommendation: one of "apply_now" | "tailor_first" | "skip"
  - apply_now: score >= 65 and no critical gaps
  - tailor_first: score 40–64 or gaps that tailoring can address
  - skip: score < 40 or fundamental mismatch

Respond with valid JSON only.`;
}

// ─── Get latest analysis if recent ───────────────────────────────────────────

export async function getExistingAnalysis(userId: string, jobId: string) {
  const [existing] = await db
    .select()
    .from(internalJobCandidateAnalysesTable)
    .where(
      and(
        eq(internalJobCandidateAnalysesTable.userId, userId),
        eq(internalJobCandidateAnalysesTable.internalJobId, jobId),
      ),
    )
    .orderBy(desc(internalJobCandidateAnalysesTable.createdAt))
    .limit(1);
  return existing ?? null;
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzeInternalJobForCandidate(params: {
  userId: string;
  jobId: string;
  candidateProfileId?: string;
  sourceApplicationId?: string;
  forceRefresh?: boolean;
}) {
  const { userId, jobId, candidateProfileId, sourceApplicationId, forceRefresh } = params;

  // Return cached if fresh (< 24h) and not forcing refresh
  if (!forceRefresh) {
    const existing = await getExistingAnalysis(userId, jobId);
    if (existing) {
      const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / 3600000;
      if (ageHours < 24) return existing;
    }
  }

  // Load job
  const [job] = await db
    .select()
    .from(internalJobsTable)
    .where(eq(internalJobsTable.id, jobId))
    .limit(1);
  if (!job) throw new Error("Job not found");

  // Load candidate data — prefer candidate profile, fall back to application
  let candidateData: unknown = null;

  if (candidateProfileId) {
    const [profile] = await db
      .select()
      .from(candidateProfilesTable)
      .where(eq(candidateProfilesTable.id, candidateProfileId))
      .limit(1);
    if (profile) candidateData = profile.normalizedProfile;
  }

  if (!candidateData && sourceApplicationId) {
    const [app] = await db
      .select({ parsedCvJson: applicationsTable.parsedCvJson })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, sourceApplicationId))
      .limit(1);
    if (app) candidateData = app.parsedCvJson;
  }

  // Fall back to most recent candidate profile for user
  if (!candidateData) {
    const [profile] = await db
      .select()
      .from(candidateProfilesTable)
      .where(eq(candidateProfilesTable.userId, userId))
      .orderBy(desc(candidateProfilesTable.createdAt))
      .limit(1);
    if (profile) candidateData = profile.normalizedProfile;
  }

  if (!candidateData) {
    throw new Error("No CV data found. Please analyse a CV first.");
  }

  const jobJson = JSON.stringify({
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    employmentType: job.employmentType,
    seniority: job.seniority,
    description: job.description,
    requirements: job.requirements,
    preferredSkills: job.preferredSkills,
  });

  const prompt = buildAnalysisPrompt(jobJson, JSON.stringify(candidateData));

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const rawText = completion.choices[0]?.message?.content ?? "{}";
  let parsed: z.infer<typeof AnalysisOutputSchema>;

  try {
    parsed = AnalysisOutputSchema.parse(JSON.parse(rawText));
  } catch (err) {
    logger.error({ err, rawText }, "Failed to parse analysis AI output");
    throw new Error("AI analysis returned an unexpected format");
  }

  // Store
  const [analysis] = await db
    .insert(internalJobCandidateAnalysesTable)
    .values({
      internalJobId: jobId,
      userId,
      candidateProfileId: candidateProfileId ?? null,
      sourceApplicationId: sourceApplicationId ?? null,
      matchScore: parsed.match_score,
      fitReasons: parsed.fit_reasons,
      missingRequirements: parsed.missing_requirements,
      strengths: parsed.strengths,
      concerns: parsed.concerns,
      recommendationSummary: parsed.recommendation_summary,
      tailoredCvSuggestion: parsed.tailored_cv_suggestion ?? {},
      coverLetterSuggestion: parsed.cover_letter_suggestion ?? "",
      applyRecommendation: parsed.apply_recommendation,
    })
    .returning();

  return analysis;
}
