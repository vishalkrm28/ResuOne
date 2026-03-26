import { openai } from "@workspace/integrations-openai-ai-server";

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

  const parsed = JSON.parse(content) as AnalysisOutput;
  return {
    tailoredCvText: parsed.tailoredCvText ?? "",
    keywordMatchScore: Math.min(100, Math.max(0, parsed.keywordMatchScore ?? 0)),
    matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
    missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
    missingInfoQuestions: Array.isArray(parsed.missingInfoQuestions) ? parsed.missingInfoQuestions : [],
    sectionSuggestions: Array.isArray(parsed.sectionSuggestions) ? parsed.sectionSuggestions : [],
  };
}

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

  return response.choices[0]?.message?.content ?? "";
}
