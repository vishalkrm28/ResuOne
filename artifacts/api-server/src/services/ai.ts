import { openai } from "@workspace/integrations-openai-ai-server";
import type { ParsedCv, ParsedJobDescription } from "@workspace/db";
import { z } from "zod";

// ─── Local Zod schemas (use "zod" not "zod/v4" for esbuild compat) ─────────

const LocalParsedCvSchema = z.object({
  name: z.string().nullable().catch(null),
  email: z.string().nullable().catch(null),
  phone: z.string().nullable().catch(null),
  linkedin: z.string().nullable().catch(null),
  github: z.string().nullable().catch(null),
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
  "linkedin": "full LinkedIn URL or null (e.g. https://linkedin.com/in/username)",
  "github": "full GitHub URL or null (e.g. https://github.com/username)",
  "location": "city/country or null",
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
      name: null, email: null, phone: null, linkedin: null, github: null, location: null, summary: null,
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

SKILL EXTRACTION RULES (critical for required_skills, preferred_skills, must_have, nice_to_have):
- Extract each skill as a SHORT, ATOMIC term — ideally 1–3 words. Never include qualifiers.
- WRONG: "5+ years of experience with Python" → RIGHT: "Python"
- WRONG: "strong proficiency in SQL databases" → RIGHT: "SQL"
- WRONG: "excellent communication and leadership skills" → RIGHT: ["communication", "leadership"]
- WRONG: "experience with AWS cloud infrastructure" → RIGHT: "AWS"
- WRONG: "knowledge of Agile/Scrum methodologies" → RIGHT: ["Agile", "Scrum"]
- Do NOT include phrases like "experience with", "proficiency in", "knowledge of", "understanding of",
  "familiarity with", "X years of", "strong", "excellent", "good", "solid", "proven" as part of a skill.
- Do split compound "A and B" or "A/B" skill items into separate array entries.
- Preserve technology names exactly (e.g. "Node.js", "CI/CD", "PostgreSQL", "RESTful API").

OTHER RULES:
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
9. NEVER remove any existing section from the original CV. Preserve ALL sections exactly as-is including academic projects, personal projects, dissertations, volunteer work, extracurricular activities, publications, awards, and any other section present in the original — even if that section seems unrelated to the job. Only reword content within sections; never delete entire sections.
10. NEVER ask in missingInfoQuestions about content that is already present in the original CV. Only ask for information that the job genuinely requires and is completely absent from the CV.
11. NEVER ask about education qualifications if the candidate's CV already shows a degree equal to or higher than what the job requires. Education hierarchy from lowest to highest: high school diploma / GCSEs / A-levels → associate's degree / HND → bachelor's degree / undergraduate → master's degree / postgraduate → PhD / doctorate. If the JD requires a lower-level qualification (e.g. high school diploma, associate's) and the CV already shows a higher degree (e.g. bachelor's, master's, PhD), education is FULLY SATISFIED — do NOT include any education question in missingInfoQuestions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ATS FORMATTING RULES for tailoredCvText — follow exactly, character for character:
- Use plain text only — no tables, columns, borders, graphics, bold, italics, or markdown
- Standard section headings: ALL CAPS, e.g. PROFESSIONAL SUMMARY, WORK EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS
- Each job entry: one line in format  Company | Job Title | Date Range  (always all three fields, pipe-separated)
  Example: Acme Corp | Senior Engineer | Jan 2020 – Mar 2024
- Each bullet point MUST start with "• " (bullet character + space), then an action verb
  Example: • Reduced processing time by 30% by redesigning the data pipeline
- Education entries: one line for institution name, then one line in format  Degree | Year or Date Range
  Example: University of Amsterdam
           Bachelor of Science in Computer Science | 2018
- SKILLS and CERTIFICATIONS: list items separated by " • " or one per line
- One blank line between sections
- Keep all dates, company names, job titles, and metrics EXACTLY as they appear in the original CV

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

  // Post-processing: filter out education questions if the CV already contains a
  // degree that is equal to or higher than common minimum requirements.
  const cvLower = input.originalCvText.toLowerCase();
  const cvHasDegree =
    /\b(bachelor|b\.?s\.?|b\.?a\.?|b\.?eng|bsc|ba\b|master|m\.?s\.?|m\.?a\.?|m\.?eng|msc|mba|phd|ph\.?d|doctorate|postgraduate|graduate degree|university degree|honours degree|hons)\b/.test(cvLower);

  const educationQuestionPattern =
    /\b(education|degree|qualification|diploma|certificate|undergraduate|bachelor|master|phd|school|college|university|academic credential|educational background|highest.*level.*education|level of education)\b/i;

  function isRedundantEducationQuestion(question: string): boolean {
    if (!cvHasDegree) return false;
    return educationQuestionPattern.test(question);
  }

  function shouldFilterQuestion(q: string): boolean {
    return isAlreadyAnswered(q) || isRedundantEducationQuestion(q);
  }

  if (!result.success) {
    const r = raw as Record<string, unknown>;
    const questions = Array.isArray(r.missingInfoQuestions) ? (r.missingInfoQuestions as string[]) : [];
    return {
      tailoredCvText: (r.tailoredCvText as string) ?? "",
      missingInfoQuestions: questions.filter(q => !shouldFilterQuestion(q)),
      sectionSuggestions: Array.isArray(r.sectionSuggestions) ? (r.sectionSuggestions as string[]) : [],
    };
  }
  return {
    ...result.data,
    missingInfoQuestions: result.data.missingInfoQuestions.filter(q => !shouldFilterQuestion(q)),
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
  candidateName?: string;
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {

  // ── Tone examples: show the model exactly what quality looks like ─────────
  const toneExamples = {
    professional: {
      label: "Professional — authoritative, composed, senior-level voice",
      opening_example: `"Nine years in supply chain taught me something most CVs don't show: the real work isn't in the process — it's in what you do when the process breaks down. That instinct for operational resilience is exactly what I'd bring to [Role] at [Company]."`,
      rhythm: "Alternate short declarative sentences with longer, layered ones. Let facts carry the emotional weight — no exclamation marks.",
      closing_example: `"I'd welcome the opportunity to discuss how my background maps to [Company]'s needs — I'm available at your convenience."`,
    },
    enthusiastic: {
      label: "Enthusiastic — genuine, warm, energised without being breathless",
      opening_example: `"When I came across the [Role] opening at [Company], I had to pause — it describes almost exactly the kind of work I've been building toward. This isn't a job I'm applying to; it's a role I've been preparing for."`,
      rhythm: "Short sentences mixed with longer ones. Let real excitement show in the rhythm — but every claim must be backed by the CV.",
      closing_example: `"I'd love the chance to bring this into [Company] and make an immediate impact — please do reach out, I'm available from next week."`,
    },
    concise: {
      label: "Concise — 3 paragraphs, under 180 words, every word earns its place",
      opening_example: `"[Specific credential or metric from CV] — that's the foundation I'd bring to [Role] at [Company]."`,
      rhythm: "No preamble. No transitional padding. Max 3 sentences per paragraph. One idea per paragraph.",
      closing_example: `"I'd welcome a conversation — available from [timeframe]."`,
    },
  };

  const ex = toneExamples[input.tone];

  const SYSTEM_PROMPT = `You are a senior cover letter editor at a top executive recruitment firm. You write letters that make hiring managers stop scrolling and read carefully — letters that feel authored, not generated.

SELECTED TONE: ${ex.label}

OPENING STYLE: Begin with something that earns the reader's attention in the first line.
Example of the quality you're aiming for:
${ex.opening_example}

RHYTHM & FLOW: ${ex.rhythm}

CLOSING STYLE: End with a confident, specific call-to-action — not pleading, not generic.
Example:
${ex.closing_example}

══════════════════════════════════════════════
THE MOST IMPORTANT RULE: Write like a person, not like an AI paraphrasing a CV.

❌ ROBOTIC (what to NEVER produce):
"Delivered a 15–20% reduction in warehouse operational issues at Expeditors while sustaining a 96% smooth operation rate by tightening inbound/outbound execution and discrepancy control. Reduced inventory discrepancies by ~15% through sharper receiving/shipping documentation."
→ This is a CV bullet turned into a sentence. It has no human voice, no story, no flow.

✅ POLISHED (the quality to aim for):
"At Expeditors, tightening the inbound/outbound process brought operational issues down by 15–20% — but what mattered more was the 96% smooth-operation rate we maintained through peak periods. That kind of consistency doesn't come from a single fix; it comes from fixing the receiving documentation, tightening cycle counts, and following up with suppliers before issues compound."
→ This tells a story. It has cause and effect. It has a voice.

══════════════════════════════════════════════
ABSOLUTE RULES:
1. Every factual claim MUST be grounded in the candidate's CV — never invent or embellish
2. BANNED words: passionate, hard-working, team player, dynamic, results-driven, leverage, synergy, proactive, seamlessly, spearheaded
3. BANNED openers: "I am writing to apply", "I am excited to apply", "I would like to express my interest"
4. Vary sentence length — mix short punchy statements with longer richer ones
5. Each paragraph must flow naturally into the next — use bridges like "What that experience taught me...", "Beyond the numbers...", "What draws me to [Company] specifically..."
6. Metrics need context — don't just drop a number, briefly explain what it took to achieve it or why it mattered

STRUCTURE (4 paragraphs for professional/enthusiastic, 3 for concise):
▸ Para 1 — HOOK: A sentence or two that immediately shows fit. Don't list credentials — create a moment.
▸ Para 2 — PROOF: 2-3 achievements woven as narrative, not a list. Show what happened, why it mattered.
▸ Para 3 — ANGLE: What's the unique thing this candidate brings that others won't? A combination, a perspective, a tool mastery.
▸ Para 4 — CLOSE (skip for concise): Specific genuine interest in THIS company + confident CTA.

══════════════════════════════════════════════
OUTPUT FORMAT — follow exactly:

Dear Hiring Manager,

[Para 1]

[Para 2]

[Para 3]

[Para 4 if applicable]

Kind regards,
${input.candidateName ? input.candidateName : "[Candidate's full name — extract it from the CV header, first line, or contact section. Use ONLY the name as written in the CV — do not alter, shorten, or invent it.]"}

Rules:
- Blank line between every paragraph
- "Kind regards," on its own line, name on the next line
- No dates, addresses, subject lines — added automatically
- Return ONLY the letter body, nothing else`;

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
