import type { DraftType, EmailTone } from "./email-schemas.js";

interface ApplicationContext {
  applicationTitle: string;
  company: string | null;
  stage: string;
  jobDescription?: string | null;
  notes?: string | null;
}

interface InterviewContext {
  title: string;
  interviewType: string;
  scheduledAt: string;
  location?: string | null;
  meetingUrl?: string | null;
}

interface CvContext {
  candidateName?: string | null;
  tailoredCvText?: string | null;
  coverLetterText?: string | null;
}

interface BuildEmailPromptOpts {
  draftType: DraftType;
  application: ApplicationContext;
  cv: CvContext;
  interview?: InterviewContext | null;
  extraContext?: string | null;
  tone: EmailTone;
}

const TONE_INSTRUCTIONS: Record<EmailTone, string> = {
  professional: "Use a professional, polished tone. Clear and respectful.",
  warm: "Use a warm, personable tone. Friendly but still professional.",
  concise: "Be brief and direct. Every sentence earns its place. No fluff.",
  confident: "Sound confident and decisive. Strong verbs, no hedging.",
};

function toneBlock(tone: EmailTone): string {
  return `TONE: ${TONE_INSTRUCTIONS[tone]}`;
}

function applicationBlock(app: ApplicationContext): string {
  return [
    `Role: ${app.applicationTitle}`,
    app.company ? `Company: ${app.company}` : null,
    `Current Stage: ${app.stage}`,
    app.jobDescription ? `Job Description (excerpt):\n${app.jobDescription.slice(0, 1500)}` : null,
    app.notes ? `Candidate Notes: ${app.notes}` : null,
  ].filter(Boolean).join("\n");
}

function cvBlock(cv: CvContext): string {
  const parts: string[] = [];
  if (cv.candidateName) parts.push(`Candidate Name: ${cv.candidateName}`);
  if (cv.tailoredCvText) parts.push(`Tailored CV (excerpt):\n${cv.tailoredCvText.slice(0, 1200)}`);
  else if (cv.coverLetterText) parts.push(`Cover Letter (excerpt):\n${cv.coverLetterText.slice(0, 800)}`);
  return parts.length ? parts.join("\n") : "No CV context available.";
}

export function buildEmailPrompt(opts: BuildEmailPromptOpts): string {
  const { draftType, application, cv, interview, extraContext, tone } = opts;

  const base = [
    "You are an expert career communications coach drafting a professional email for a job candidate.",
    "",
    "APPLICATION CONTEXT:",
    applicationBlock(application),
    "",
    "CANDIDATE CONTEXT:",
    cvBlock(cv),
  ];

  if (interview) {
    base.push(
      "",
      "INTERVIEW DETAILS:",
      `Title: ${interview.title}`,
      `Type: ${interview.interviewType}`,
      `Scheduled: ${interview.scheduledAt}`,
      interview.location ? `Location: ${interview.location}` : "",
      interview.meetingUrl ? `Meeting URL: ${interview.meetingUrl}` : "",
    );
  }

  if (extraContext?.trim()) {
    base.push("", "EXTRA CONTEXT FROM CANDIDATE:", extraContext.trim());
  }

  base.push("", toneBlock(tone), "");

  const taskInstructions: Record<DraftType, string[]> = {
    follow_up: [
      "TASK: Write a polished follow-up email for this job application.",
      "RULES:",
      "- Sound natural, not robotic or scripted",
      "- Reiterate genuine interest in the role",
      "- Do not invent conversations or meetings that haven't happened",
      "- Include one specific reason the candidate is excited about this role/company if evident from the context",
      "- End with a clear but soft CTA (e.g. happy to provide anything else you need)",
      "- Length: 120–180 words in the body",
    ],
    thank_you: [
      "TASK: Write a thank-you email to send after an interview.",
      "RULES:",
      "- Thank the interviewer(s) sincerely",
      "- Reference the specific interview type/stage if known",
      "- Briefly reinforce why the candidate is a strong fit — but only based on real context",
      "- Do not fabricate what was discussed in the interview",
      "- Express enthusiasm for next steps",
      "- Length: 120–200 words in the body",
    ],
    networking: [
      "TASK: Write a networking email related to this job opportunity.",
      "RULES:",
      "- Introduce the candidate naturally",
      "- Explain the connection or reason for outreach honestly",
      "- Do not exaggerate achievements or invent connections",
      "- Be direct about intent (interested in learning more / exploring opportunities)",
      "- Length: 90–160 words in the body",
    ],
    interview_confirmation: [
      "TASK: Write a brief email to confirm an upcoming interview.",
      "RULES:",
      "- Confirm the time, date, and format (if available)",
      "- Express appreciation and enthusiasm",
      "- Keep it short — this is a confirmation, not a pitch",
      "- Length: 60–120 words in the body",
    ],
  };

  base.push(...taskInstructions[draftType]);
  base.push(
    "",
    "OUTPUT FORMAT — respond with ONLY valid JSON:",
    '{ "subject": "...", "body_text": "..." }',
    "",
    "The body_text should be plain text suitable for an email client.",
    "Do not include [placeholder] tokens — use the real context or omit the detail.",
    "Do not add markdown, headers, or explanation. Return ONLY the JSON object.",
  );

  return base.filter(s => s !== undefined).join("\n");
}
