const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) {
  return `${BASE}${path}`;
}

export type InterviewType = "recruiter_screen" | "hiring_manager" | "technical" | "case_study" | "final_round" | "general";
export type InterviewStatus = "scheduled" | "completed" | "cancelled";
export type SessionType = "role_specific" | "behavioral" | "technical" | "mixed";
export type MockAnswerType = "behavioral" | "technical" | "role_fit" | "motivation" | "culture" | "leadership" | "experience" | "communication" | "general";

export interface ApplicationInterview {
  id: string;
  applicationId: string | null;
  interviewType: InterviewType;
  title: string;
  scheduledAt: string;
  timezone: string | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  status: InterviewStatus;
  createdAt: string;
  applicationTitle?: string | null;
  company?: string | null;
}

export interface MockSession {
  id: string;
  applicationId: string | null;
  interviewPrepId: string | null;
  sessionType: SessionType;
  sessionTitle: string | null;
  questionCount: number;
  overallScore: number | null;
  status: "active" | "completed" | "archived";
  createdAt: string;
  completedAt: string | null;
  applicationTitle?: string | null;
  company?: string | null;
}

export interface MockQuestion {
  id: string;
  sessionId: string;
  question: string;
  answerType: MockAnswerType;
  whyItMatters: string | null;
  suggestedPoints: string[];
  displayOrder: number;
}

export interface MockAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  answerText: string;
  aiFeedback: AnswerFeedback | null;
  score: number | null;
  updatedAt: string;
}

export interface AnswerFeedback {
  score: number;
  strengths: string[];
  weaknesses: string[];
  missing_points: string[];
  improved_answer: string;
  delivery_tips: string[];
  overall_feedback: string;
}

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  recruiter_screen: "Recruiter Screen",
  hiring_manager: "Hiring Manager",
  technical: "Technical",
  case_study: "Case Study",
  final_round: "Final Round",
  general: "General",
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  role_specific: "Role-specific",
  behavioral: "Behavioral",
  technical: "Technical",
  mixed: "Mixed",
};

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

// ─── Interviews ───────────────────────────────────────────────────────────────

export async function createInterview(body: {
  applicationId: string;
  interviewType: InterviewType;
  title: string;
  scheduledAt: string;
  timezone?: string;
  location?: string;
  meetingUrl?: string;
  notes?: string;
}): Promise<{ interview: ApplicationInterview }> {
  return request("/api/interviews/create", { method: "POST", body: JSON.stringify(body) });
}

export async function listInterviews(applicationId?: string): Promise<{ interviews: ApplicationInterview[] }> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";
  return request(`/api/interviews/list${qs}`);
}

export async function updateInterview(id: string, body: {
  status?: InterviewStatus;
  title?: string;
  scheduledAt?: string;
  timezone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
}): Promise<{ interview: ApplicationInterview }> {
  return request(`/api/interviews/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

// ─── Mock Interview Sessions ──────────────────────────────────────────────────

export async function createMockSession(body: {
  applicationId: string;
  interviewPrepId?: string;
  sessionType: SessionType;
  questionCount: 5 | 8 | 10;
}): Promise<{ session: MockSession; questions: MockQuestion[] }> {
  return request("/api/mock-interview/create-session", { method: "POST", body: JSON.stringify(body) });
}

export async function listMockSessions(applicationId?: string): Promise<{ sessions: MockSession[] }> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";
  return request(`/api/mock-interview/list-sessions${qs}`);
}

export async function getMockSession(id: string): Promise<{
  session: MockSession;
  questions: MockQuestion[];
  answers: MockAnswer[];
}> {
  return request(`/api/mock-interview/${id}`);
}

export async function saveMockAnswer(body: {
  sessionId: string;
  questionId: string;
  answerText: string;
}): Promise<{ answer: MockAnswer }> {
  return request("/api/mock-interview/save-answer", { method: "POST", body: JSON.stringify(body) });
}

export async function evaluateMockAnswer(body: {
  sessionId: string;
  questionId: string;
  answerText: string;
}): Promise<{ answer: MockAnswer; feedback: AnswerFeedback }> {
  return request("/api/mock-interview/evaluate-answer", { method: "POST", body: JSON.stringify(body) });
}

export async function completeMockSession(sessionId: string): Promise<{ session: MockSession }> {
  return request("/api/mock-interview/complete-session", { method: "POST", body: JSON.stringify({ sessionId }) });
}
