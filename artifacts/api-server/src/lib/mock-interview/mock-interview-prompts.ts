import type { SessionType } from "./mock-interview-schemas.js";

interface ApplicationContext {
  applicationTitle: string;
  company: string | null;
  jobDescription?: string | null;
}

interface CandidateContext {
  parsedCvJson?: Record<string, unknown> | null;
  tailoredCvText?: string | null;
}

interface PrepContext {
  prepSummary?: string | null;
  likelyQuestions?: Array<{ question: string; answer_type: string }>;
}

interface BuildMockInterviewPromptOpts {
  application: ApplicationContext;
  candidate: CandidateContext;
  prep?: PrepContext | null;
  sessionType: SessionType;
  questionCount: 5 | 8 | 10;
}

interface BuildAnswerFeedbackPromptOpts {
  question: string;
  answerType: string;
  whyItMatters: string | null;
  answerText: string;
  application: ApplicationContext;
  candidate: CandidateContext;
}

function cvSummary(cv: CandidateContext): string {
  const p = cv.parsedCvJson as Record<string, unknown> | null;
  if (!p) return cv.tailoredCvText ? `Tailored CV:\n${cv.tailoredCvText.slice(0, 2000)}` : "No CV context.";
  const we = Array.isArray(p.work_experience)
    ? (p.work_experience as any[]).map(w => `  - ${w.title} @ ${w.company} (${w.start_date}–${w.end_date ?? "Present"}): ${(w.bullets ?? []).slice(0, 2).join("; ")}`).join("\n")
    : "";
  return [
    `Name: ${p.name ?? "Unknown"}`,
    `Summary: ${p.summary ?? "None"}`,
    `Total experience: ${p.total_years_experience ?? "Unknown"} years`,
    `Skills: ${Array.isArray(p.skills) ? (p.skills as string[]).join(", ") : ""}`,
    we ? `Work experience:\n${we}` : "",
  ].filter(Boolean).join("\n");
}

const SESSION_TYPE_INSTRUCTIONS: Record<SessionType, string> = {
  role_specific: "Focus on role-specific competencies: responsibilities, outcomes, domain expertise relevant to this exact job.",
  behavioral: "Focus on behavioral questions using STAR format (Situation, Task, Action, Result). Cover leadership, conflict, teamwork, failure, and growth.",
  technical: "Focus on technical depth relevant to the role. Include problem-solving, tools, and domain knowledge questions.",
  mixed: "Mix behavioral, role-fit, motivation, and role-specific questions in roughly equal proportions. Include 1–2 culture/motivation questions.",
};

export function buildMockInterviewPrompt(opts: BuildMockInterviewPromptOpts): string {
  const { application, candidate, prep, sessionType, questionCount } = opts;

  const lines: string[] = [
    "You are a senior hiring manager conducting a practice mock interview.",
    "",
    "ROLE BEING APPLIED TO:",
    `Title: ${application.applicationTitle}`,
    application.company ? `Company: ${application.company}` : "",
    application.jobDescription ? `Job Description:\n${application.jobDescription.slice(0, 3000)}` : "",
    "",
    "CANDIDATE PROFILE:",
    cvSummary(candidate),
  ];

  if (prep?.prepSummary) {
    lines.push("", "PREP SUMMARY:", prep.prepSummary);
  }

  lines.push(
    "",
    `SESSION TYPE: ${sessionType}`,
    `INSTRUCTION: ${SESSION_TYPE_INSTRUCTIONS[sessionType]}`,
    "",
    `Generate exactly ${questionCount} interview questions.`,
    "",
    "RULES:",
    "- Questions must be grounded in the real job requirements and candidate profile",
    "- Do not invent candidate achievements not shown in their CV",
    "- No trick questions or gimmicks",
    "- suggested_points: 2–4 bullet points the candidate should include in a strong answer",
    "- why_it_matters: 1 sentence explaining why this question is asked for this role",
    "- session_title: a short (4–7 word) descriptive title for this mock session",
    "",
    "Respond with ONLY valid JSON matching this schema:",
    `{
  "session_title": "string",
  "questions": [
    {
      "question": "string",
      "answer_type": "behavioral|technical|role_fit|motivation|culture|leadership|experience|communication|general",
      "why_it_matters": "string",
      "suggested_points": ["string"]
    }
  ]
}`,
    "Return ONLY the JSON. No markdown, no explanation.",
  );

  return lines.filter(s => s !== undefined).join("\n");
}

export function buildAnswerFeedbackPrompt(opts: BuildAnswerFeedbackPromptOpts): string {
  const { question, answerType, whyItMatters, answerText, application, candidate } = opts;

  return [
    "You are an expert interview coach evaluating a candidate's practice answer.",
    "",
    "CONTEXT:",
    `Role: ${application.applicationTitle}${application.company ? ` at ${application.company}` : ""}`,
    application.jobDescription ? `Job (excerpt): ${application.jobDescription.slice(0, 1000)}` : "",
    "",
    "CANDIDATE PROFILE:",
    cvSummary(candidate),
    "",
    "INTERVIEW QUESTION:",
    question,
    `Answer type: ${answerType}`,
    whyItMatters ? `Why it matters: ${whyItMatters}` : "",
    "",
    "CANDIDATE'S ANSWER:",
    answerText,
    "",
    "EVALUATION RULES:",
    "- Score 1–10: 1 = totally off-target, 10 = outstanding and complete",
    "- Be honest and direct about weaknesses — do not flatter",
    "- improved_answer must stay truthful and grounded in the candidate's actual experience",
    "- Do not invent background, achievements, or facts not in the candidate profile",
    "- missing_points: key things a strong answer would include that are absent",
    "- delivery_tips: practical advice on how to say it better, not just what to say",
    "",
    "Respond with ONLY valid JSON:",
    `{
  "score": 0,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "missing_points": ["string"],
  "improved_answer": "string",
  "delivery_tips": ["string"],
  "overall_feedback": "string"
}`,
    "Return ONLY the JSON. No markdown, no explanation.",
  ].filter(Boolean).join("\n");
}
