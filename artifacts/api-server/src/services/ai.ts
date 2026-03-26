import { openai } from "@workspace/integrations-openai-ai-server";
import type { ParsedCv } from "@workspace/db";
import { z } from "zod";

// Local zod schema for AI output validation (uses "zod" not "zod/v4" for esbuild compat)
const LocalParsedCvSchema = z.object({
  name: z.string().nullable().catch(null),
  email: z.string().nullable().catch(null),
  phone: z.string().nullable().catch(null),
  location: z.string().nullable().catch(null),
  summary: z.string().nullable().catch(null),
  work_experience: z
    .array(
      z.object({
        company: z.string().catch(""),
        title: z.string().catch(""),
        start_date: z.string().catch(""),
        end_date: z.string().nullable().catch(null),
        bullets: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
  education: z
    .array(
      z.object({
        institution: z.string().catch(""),
        degree: z.string().catch(""),
        field: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().nullable().optional(),
      }),
    )
    .catch([]),
  skills: z.array(z.string()).catch([]),
  certifications: z.array(z.string()).catch([]),
  languages: z.array(z.string()).catch([]),
});

// ─── CV Parsing (Responses API) ────────────────────────────────────────────

const CV_PARSE_INSTRUCTIONS = `You are a precise CV/resume data extraction engine.
Extract all structured information from the raw CV text provided.
Return ONLY valid JSON. Do not include commentary, markdown, or explanation.

RULES:
- Extract only what is explicitly present in the text — never infer or invent
- Dates should be in the original format from the CV (e.g. "Jan 2021", "2019-2022", "Present")
- For end_date: use null when the role is current/ongoing
- bullets: extract each distinct achievement or responsibility as a separate string
- skills: flat array of all technical and soft skills mentioned
- certifications: only formal certifications/licences (not skills)
- languages: human languages only (not programming languages)

Return JSON matching this exact schema:
{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "summary": "string or null — professional summary/objective if present",
  "work_experience": [
    {
      "company": "string",
      "title": "string",
      "start_date": "string",
      "end_date": "string or null",
      "bullets": ["string", ...]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string or null",
      "start_date": "string or null",
      "end_date": "string or null"
    }
  ],
  "skills": ["string", ...],
  "certifications": ["string", ...],
  "languages": ["string", ...]
}`;

export async function parseCv(rawText: string): Promise<ParsedCv> {
  if (!rawText || rawText.trim().length < 20) {
    throw new Error("CV text is too short to parse (minimum 20 characters)");
  }

  const response = await openai.responses.create({
    model: "gpt-5.2",
    instructions: CV_PARSE_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `Extract all structured information from the following CV text and return valid JSON:\n\n${rawText.slice(0, 30000)}`,
      },
    ],
    text: { format: { type: "json_object" } },
    max_output_tokens: 8192,
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("AI returned empty response during CV parsing");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("AI returned invalid JSON during CV parsing");
  }

  const result = LocalParsedCvSchema.safeParse(raw);
  if (!result.success) {
    // Attempt lenient recovery: fill missing fields with defaults
    return {
      name: null,
      email: null,
      phone: null,
      location: null,
      summary: null,
      work_experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      ...((raw as Record<string, unknown>) ?? {}),
    } as ParsedCv;
  }

  return result.data;
}

// ─── CV Analysis ────────────────────────────────────────────────────────────

export interface AnalysisInput {
  originalCvText: string;
  jobDescription: string;
  jobTitle: string;
  company: string;
  confirmedAnswers?: Record<string, string>;
}

export interface AnalysisOutput {
  tailoredCvText: string;
  keywordMatchScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  missingInfoQuestions: string[];
  sectionSuggestions: string[];
}

const AnalysisOutputSchema = z.object({
  tailoredCvText: z.string(),
  keywordMatchScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  missingInfoQuestions: z.array(z.string()),
  sectionSuggestions: z.array(z.string()),
});

export async function analyzeCvForJob(input: AnalysisInput): Promise<AnalysisOutput> {
  const confirmedContext =
    input.confirmedAnswers && Object.keys(input.confirmedAnswers).length > 0
      ? `\n\nThe user has confirmed the following additional information:\n${Object.entries(input.confirmedAnswers)
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join("\n\n")}`
      : "";

  const systemPrompt = `You are an expert ATS (Applicant Tracking System) CV optimizer and career coach.
Your task is to analyze a candidate's CV against a job description and return a structured JSON response.

CRITICAL RULES — you MUST follow these without exception:
1. NEVER invent, fabricate, or add any information not present in the original CV
2. NEVER add fake job experience, skills, tools, degrees, certifications, or achievements
3. ONLY rewrite, reorder, and rephrase existing content from the CV to better match the job description
4. If critical information is missing (e.g., years of experience in a required skill), add it to missingInfoQuestions
5. Keep all dates, company names, job titles, and metrics exactly as they appear in the original CV
6. The tailored CV must be ATS-friendly: use standard section headings, avoid tables/columns/graphics in text

Return ONLY valid JSON matching this exact schema:
{
  "tailoredCvText": "string - ATS-optimized CV text using only information from the original CV",
  "keywordMatchScore": "number 0-100 - percentage of important job keywords present in the original CV",
  "matchedKeywords": ["array of keywords from the job description that appear in the CV"],
  "missingKeywords": ["array of important keywords from the job that are NOT in the CV"],
  "missingInfoQuestions": ["array of questions to ask the candidate about information that would strengthen their application but is absent from their CV"],
  "sectionSuggestions": ["array of specific suggestions for improving the CV structure/content based only on what IS in the CV"]
}`;

  const userPrompt = `JOB TITLE: ${input.jobTitle}
COMPANY: ${input.company}

JOB DESCRIPTION:
${input.jobDescription}

ORIGINAL CV:
${input.originalCvText}${confirmedContext}

Analyze the CV against the job description and return the JSON response.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("AI returned invalid JSON during analysis");
  }

  const result = AnalysisOutputSchema.safeParse(raw);
  if (!result.success) {
    // lenient fallback
    const r = raw as Record<string, unknown>;
    return {
      tailoredCvText: (r.tailoredCvText as string) ?? "",
      keywordMatchScore: Math.min(100, Math.max(0, (r.keywordMatchScore as number) ?? 0)),
      matchedKeywords: Array.isArray(r.matchedKeywords) ? (r.matchedKeywords as string[]) : [],
      missingKeywords: Array.isArray(r.missingKeywords) ? (r.missingKeywords as string[]) : [],
      missingInfoQuestions: Array.isArray(r.missingInfoQuestions) ? (r.missingInfoQuestions as string[]) : [],
      sectionSuggestions: Array.isArray(r.sectionSuggestions) ? (r.sectionSuggestions as string[]) : [],
    };
  }

  return result.data;
}

// ─── Cover Letter ────────────────────────────────────────────────────────────

export interface CoverLetterInput {
  originalCvText: string;
  tailoredCvText: string;
  jobDescription: string;
  jobTitle: string;
  company: string;
  tone: "professional" | "enthusiastic" | "concise";
  additionalContext?: string;
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const toneDescriptions = {
    professional: "formal, polished, and measured",
    enthusiastic: "warm, energetic, and genuinely excited about the role",
    concise: "brief, direct, and highly focused (3 short paragraphs max)",
  };

  const systemPrompt = `You are an expert cover letter writer for job applications.
Your task is to write an ATS-friendly cover letter based ONLY on information present in the candidate's CV.

CRITICAL RULES:
1. NEVER invent or fabricate any experience, skills, or achievements not in the CV
2. Use ONLY information from the CV to support claims
3. Match the tone: ${toneDescriptions[input.tone]}
4. Keep it to 3-4 paragraphs
5. Do NOT use generic filler phrases like "I am a hard-working individual"
6. Address the specific requirements from the job description using evidence from the CV
7. Return ONLY the cover letter text, no JSON`;

  const userPrompt = `JOB TITLE: ${input.jobTitle}
COMPANY: ${input.company}

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE CV:
${input.tailoredCvText || input.originalCvText}
${input.additionalContext ? `\nADDITIONAL CONTEXT: ${input.additionalContext}` : ""}

Write the cover letter.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI returned empty cover letter");
  }

  return content;
}
