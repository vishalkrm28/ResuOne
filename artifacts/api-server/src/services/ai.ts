import { openai } from "@workspace/integrations-openai-ai-server";
import type { ParsedCv, ParsedJobDescription } from "@workspace/db";
import { z } from "zod";

// ─── Local Zod schemas (use "zod" not "zod/v4" for esbuild compat) ─────────

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

const LocalParsedJdSchema = z.object({
  required_skills: z.array(z.string()).catch([]),
  preferred_skills: z.array(z.string()).catch([]),
  required_experience_years: z.number().nullable().catch(null),
  key_responsibilities: z.array(z.string()).catch([]),
  must_have: z.array(z.string()).catch([]),
  nice_to_have: z.array(z.string()).catch([]),
  job_type: z.enum(["full-time", "part-time", "contract", "internship"]).nullable().catch(null),
  location_type: z.enum(["remote", "hybrid", "onsite"]).nullable().catch(null),
});

const AnalysisOutputSchema = z.object({
  tailoredCvText: z.string().catch(""),
  missingInfoQuestions: z.array(z.string()).catch([]),
  sectionSuggestions: z.array(z.string()).catch([]),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonResponse<T>(content: string | null | undefined, label: string): unknown {
  if (!content) throw new Error(`AI returned empty response for ${label}`);
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`AI returned invalid JSON for ${label}`);
  }
}

// ─── CV Parsing (Responses API) ──────────────────────────────────────────────

const CV_PARSE_INSTRUCTIONS = `You are a precise CV/resume data extraction engine.
Extract all structured information from the raw CV text provided.
Return ONLY valid JSON. Do not include commentary, markdown, or explanation.

ABSOLUTE RULES — violation is unacceptable:
- Extract ONLY what is explicitly present in the text — never infer, assume, or invent
- Never add skills, roles, dates, or achievements not present verbatim
- Dates must be in the original format from the CV (e.g. "Jan 2021", "2019–2022", "Present")
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
  "summary": "string or null",
  "work_experience": [{"company":"string","title":"string","start_date":"string","end_date":"string|null","bullets":["string"]}],
  "education": [{"institution":"string","degree":"string","field":"string|null","start_date":"string|null","end_date":"string|null"}],
  "skills": ["string"],
  "certifications": ["string"],
  "languages": ["string"]
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

  const raw = parseJsonResponse(response.output_text, "CV parsing");
  const result = LocalParsedCvSchema.safeParse(raw);

  if (!result.success) {
    return {
      name: null, email: null, phone: null, location: null, summary: null,
      work_experience: [], education: [], skills: [], certifications: [], languages: [],
      ...((raw as Record<string, unknown>) ?? {}),
    } as ParsedCv;
  }
  return result.data;
}

// ─── Job Description Parsing (Responses API) ─────────────────────────────────

const JD_PARSE_INSTRUCTIONS = `You are a job description analysis engine.
Extract structured requirements from the job description provided.
Return ONLY valid JSON. Do not include commentary, markdown, or explanation.

RULES:
- required_skills: skills explicitly marked as required, must-have, or essential
- preferred_skills: skills marked as preferred, nice-to-have, bonus, or desirable
- required_experience_years: extract the minimum years if explicitly stated (e.g. "5+ years" → 5), else null
- key_responsibilities: the main job duties, condensed to 3–8 clear bullet points
- must_have: non-negotiable qualifications (education level, specific certs, hard requirements)
- nice_to_have: desirable but clearly optional qualifications
- job_type: "full-time" | "part-time" | "contract" | "internship" | null
- location_type: "remote" | "hybrid" | "onsite" | null

Return JSON matching this exact schema:
{
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "required_experience_years": number or null,
  "key_responsibilities": ["string"],
  "must_have": ["string"],
  "nice_to_have": ["string"],
  "job_type": "full-time" | "part-time" | "contract" | "internship" | null,
  "location_type": "remote" | "hybrid" | "onsite" | null
}`;

export async function parseJobDescription(jobDescription: string): Promise<ParsedJobDescription> {
  if (!jobDescription || jobDescription.trim().length < 20) {
    throw new Error("Job description is too short to parse");
  }

  const response = await openai.responses.create({
    model: "gpt-5.2",
    instructions: JD_PARSE_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `Extract structured requirements from the following job description and return valid JSON:\n\n${jobDescription.slice(0, 20000)}`,
      },
    ],
    text: { format: { type: "json_object" } },
    max_output_tokens: 4096,
  });

  const raw = parseJsonResponse(response.output_text, "JD parsing");
  const result = LocalParsedJdSchema.safeParse(raw);

  if (!result.success) {
    return {
      required_skills: [], preferred_skills: [], required_experience_years: null,
      key_responsibilities: [], must_have: [], nice_to_have: [],
      job_type: null, location_type: null,
      ...((raw as Record<string, unknown>) ?? {}),
    } as ParsedJobDescription;
  }
  return result.data;
}

// ─── CV Analysis (Responses API) ─────────────────────────────────────────────

export interface AnalysisInput {
  originalCvText: string;
  jobDescription: string;
  jobTitle: string;
  company: string;
  parsedJd?: ParsedJobDescription | null;
  confirmedAnswers?: Record<string, string>;
}

export interface AnalysisOutput {
  tailoredCvText: string;
  missingInfoQuestions: string[];
  sectionSuggestions: string[];
}

export async function analyzeCvForJob(input: AnalysisInput): Promise<AnalysisOutput> {
  const filledAnswers = Object.entries(input.confirmedAnswers ?? {}).filter(
    ([, a]) => a && a.trim().length > 0,
  );
  const hasConfirmedAnswers = filledAnswers.length > 0;

  const confirmedSection = hasConfirmedAnswers
    ? `\n\nCANDIDATE-CONFIRMED INFORMATION (treat as VERIFIED FACTS — confirmed by the candidate):
${filledAnswers.map(([q, a]) => `• Question: ${q}\n  Answer: ${a.trim()}`).join("\n\n")}

PLACEMENT RULES — follow precisely for each confirmed answer:
- If the answer describes an achievement, project, or responsibility at a specific job → add it as a bullet point under that role in WORK EXPERIENCE
- If the answer names a skill, tool, technology, or methodology → add it to the SKILLS section
- If the answer describes a certification or qualification → add it to CERTIFICATIONS
- If the answer relates to education → add it to EDUCATION
- ONLY add to PROFESSIONAL SUMMARY if the answer is genuinely summary-level (career goals, overall positioning) and does not fit any other section
- Do NOT cluster all confirmed answers into PROFESSIONAL SUMMARY — distribute them into the correct sections above

CRITICAL: Do NOT include in missingInfoQuestions any topic that the candidate has already answered above. Those questions are CLOSED.`
    : "";

  const parsedJdContext = input.parsedJd
    ? `\n\nSTRUCTURED JOB REQUIREMENTS (parsed from the job description):
Required skills: ${input.parsedJd.required_skills.join(", ") || "none specified"}
Preferred skills: ${input.parsedJd.preferred_skills.join(", ") || "none specified"}
Must-have qualifications: ${input.parsedJd.must_have.join("; ") || "none specified"}
Nice-to-have: ${input.parsedJd.nice_to_have.join("; ") || "none specified"}
Required experience: ${input.parsedJd.required_experience_years != null ? `${input.parsedJd.required_experience_years}+ years` : "not specified"}
Key responsibilities: ${input.parsedJd.key_responsibilities.join("; ") || "see job description"}`
    : "";

  const SYSTEM_PROMPT = `You are an elite ATS (Applicant Tracking System) CV optimization expert and senior career coach.
Your task: analyze a candidate's CV against a job description and return a structured JSON response.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES — VIOLATION IS GROUNDS FOR FAILURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NEVER invent, fabricate, or hallucinate content — only use what is in the original CV OR confirmed by the candidate
2. NEVER add fake job titles, companies, employment dates, degrees, certifications, skills, or metrics
3. NEVER embellish or upgrade job titles (e.g. do NOT change "Engineer" to "Senior Engineer")
4. NEVER add years of experience to a skill unless stated in the original CV or confirmed by the candidate
5. Keep all dates, company names, job titles, and metrics EXACTLY as they appear in the original CV
6. ONLY rewrite, reorder, and rephrase existing content to better match the job description's language
7. Candidate-confirmed answers (labeled "CANDIDATE-CONFIRMED INFORMATION") are VERIFIED FACTS — place each answer in the correct CV section: work achievements → WORK EXPERIENCE bullets under the relevant role; skills/tools → SKILLS; certifications → CERTIFICATIONS; education details → EDUCATION; only summary-level info → PROFESSIONAL SUMMARY. Never dump all answers into PROFESSIONAL SUMMARY.
8. For topics where the candidate LEFT THE FIELD BLANK → add a question to missingInfoQuestions. For topics already answered in CANDIDATE-CONFIRMED INFORMATION → do NOT re-ask them.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ATS FORMATTING RULES for tailoredCvText:
- Use plain text only — no tables, columns, borders, or graphics
- Standard section headings: PROFESSIONAL SUMMARY, WORK EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS
- Each job: Company | Title | Date range, followed by bullet points starting with strong action verbs
- Bullet points: quantified achievements preferred (keep existing numbers, do NOT invent them)
- One blank line between sections

Return ONLY valid JSON matching this schema:
{
  "tailoredCvText": "complete ATS-formatted CV using original CV content and any candidate-confirmed facts",
  "missingInfoQuestions": ["questions only for topics the candidate has NOT confirmed — skip any already answered above"],
  "sectionSuggestions": ["concrete structural improvements to the CV — only based on existing or confirmed content"]
}`;

  const USER_PROMPT = `JOB TITLE: ${input.jobTitle}
COMPANY: ${input.company}

JOB DESCRIPTION:
${input.jobDescription}${parsedJdContext}

ORIGINAL CV (source of truth):
${input.originalCvText}${confirmedSection}

Analyze the CV against the job description. Return JSON.`;

  const response = await openai.responses.create({
    model: "gpt-5.2",
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: USER_PROMPT }],
    text: { format: { type: "json_object" } },
    max_output_tokens: 8192,
  });

  const raw = parseJsonResponse(response.output_text, "CV analysis");
  const result = AnalysisOutputSchema.safeParse(raw);

  // Build a set of normalised tokens from already-answered question text so we
  // can strip any question the AI re-asks despite the candidate having answered it.
  const answeredTokens: Set<string> = new Set();
  if (hasConfirmedAnswers) {
    for (const [q] of filledAnswers) {
      // Tokenise: lowercase, strip punctuation, split on whitespace — keep words ≥4 chars
      const tokens = q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length >= 4);
      tokens.forEach(t => answeredTokens.add(t));
    }
  }

  function isAlreadyAnswered(question: string): boolean {
    if (!hasConfirmedAnswers || answeredTokens.size === 0) return false;
    const qTokens = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length >= 4);
    // Consider it answered if ≥40% of the new question's meaningful tokens match an answered question
    const matches = qTokens.filter(t => answeredTokens.has(t)).length;
    return qTokens.length > 0 && matches / qTokens.length >= 0.4;
  }

  if (!result.success) {
    const r = raw as Record<string, unknown>;
    const questions = Array.isArray(r.missingInfoQuestions) ? (r.missingInfoQuestions as string[]) : [];
    return {
      tailoredCvText: (r.tailoredCvText as string) ?? "",
      missingInfoQuestions: questions.filter(q => !isAlreadyAnswered(q)),
      sectionSuggestions: Array.isArray(r.sectionSuggestions) ? (r.sectionSuggestions as string[]) : [],
    };
  }
  return {
    ...result.data,
    missingInfoQuestions: result.data.missingInfoQuestions.filter(q => !isAlreadyAnswered(q)),
  };
}

// ─── Cover Letter Generation ──────────────────────────────────────────────────

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
  // Each tone produces a genuinely different letter character
  const toneGuide = {
    professional: `
TONE: Professional — authoritative, measured, senior-executive voice.
- Use first person ("I", "my", "I've") but vary sentence openings so not every line starts with "I"
- Begin with a confident opening that frames the candidate as already doing this work at a high level
- Mix short declarative statements with longer, richer sentences
- Avoid exclamation marks; let the facts carry the weight
- Closing: measured confidence — "I'd welcome the opportunity to discuss..."`,

    enthusiastic: `
TONE: Enthusiastic — warm, genuine, energised without being over the top.
- Use first person freely and let personality show
- Opening line should feel like the candidate lit up when they saw this role
- Reference something specific about the company (culture, mission, product line) and why it matters to this person
- Some sentences can be shorter and punchy; let genuine excitement come through in the rhythm
- Closing: forward-looking and warm — something like "I'd love to bring this directly into [Company]..."`,

    concise: `
TONE: Concise — 3 tight paragraphs, every sentence earns its place.
- No scene-setting, no preamble — start with the most compelling credential immediately
- Each paragraph = one clear idea, max 3 sentences
- No transitional padding ("Furthermore", "In addition", "Additionally")
- Closing paragraph is a single confident sentence with a CTA
- Total word count: under 200 words`,
  };

  const SYSTEM_PROMPT = `You are an expert cover letter writer. Your job is to write a cover letter that reads like a real, thoughtful human wrote it — not an AI summarising a CV.

${toneGuide[input.tone]}

════ NON-NEGOTIABLE RULES ════
- Every factual claim (metrics, achievements, tools, roles) MUST come from the candidate's CV — never invent
- BANNED words/phrases: passionate, hard-working, team player, dynamic, results-driven, leverage, synergy, proactive, seamlessly, I am writing to apply, I am excited to apply, I would like to apply
- Do NOT list CV bullet points as sentences — weave achievements into prose with context and meaning
- Do NOT use a new sentence for every single achievement — group related things naturally
- Each paragraph should flow into the next; use transitions that feel human ("What this means in practice...", "Beyond the numbers...", "What draws me to [Company] specifically...")
- Metrics are good — but they need context, not just "drove a 30% improvement" with no story around it
- The letter should feel like a conversation with a sharp person, not a performance review

════ STRUCTURE ════
Para 1 — HOOK: Open with something that immediately signals why this candidate is right for this specific role.
  Not: "I am applying for..." or a list of credentials.
  Yes: A sentence that puts the reader in the candidate's world and shows fit instantly.

Para 2 — PROOF: Back the hook with 2-3 specific achievements relevant to the JD, told as connected narrative, not a list.
  Include metrics where available but frame them within what actually happened.

Para 3 — FIT & ANGLE: What makes this candidate different from others with similar experience?
  Could be: a cross-functional perspective, a specific tool mastery, a unique combination of skills, or genuine alignment with the company's mission.

Para 4 — CLOSE: Express genuine, specific interest in this company and role (not just "any opportunity").
  End with a confident, non-desperate CTA.

════ OUTPUT FORMAT ════
Dear Hiring Manager,

[Para 1]

[Para 2]

[Para 3]

[Para 4]

Kind regards,
[Candidate's actual full name from the CV]

Strict format rules:
- Blank line between every paragraph
- "Kind regards," on its own line, then the name on the next line
- No subject lines, dates, or addresses — these are added automatically
- Return ONLY the letter body above, nothing else`;

  const USER_PROMPT = `JOB TITLE: ${input.jobTitle}
COMPANY: ${input.company}

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE CV:
${input.tailoredCvText || input.originalCvText}
${input.additionalContext ? `\nADDITIONAL CONTEXT PROVIDED BY CANDIDATE: ${input.additionalContext}` : ""}

Write the cover letter following the exact format specified.`;

  const response = await openai.responses.create({
    model: "gpt-5.2",
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: USER_PROMPT }],
    max_output_tokens: 2048,
  });

  const content = response.output_text;
  if (!content) throw new Error("AI returned empty cover letter");
  return content;
}
