import { z } from "zod";

export const InterviewTypeEnum = z.enum([
  "recruiter_screen",
  "hiring_manager",
  "technical",
  "case_study",
  "final_round",
  "general",
]);
export type InterviewType = z.infer<typeof InterviewTypeEnum>;

export const InterviewStatusEnum = z.enum([
  "scheduled",
  "completed",
  "cancelled",
]);
export type InterviewStatus = z.infer<typeof InterviewStatusEnum>;

export const SessionTypeEnum = z.enum([
  "role_specific",
  "behavioral",
  "technical",
  "mixed",
]);
export type SessionType = z.infer<typeof SessionTypeEnum>;

export const MockSessionStatusEnum = z.enum([
  "active",
  "completed",
  "archived",
]);
export type MockSessionStatus = z.infer<typeof MockSessionStatusEnum>;

export const MockAnswerTypeEnum = z.enum([
  "behavioral",
  "technical",
  "role_fit",
  "motivation",
  "culture",
  "leadership",
  "experience",
  "communication",
  "general",
]);
export type MockAnswerType = z.infer<typeof MockAnswerTypeEnum>;

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  recruiter_screen: "Recruiter Screen",
  hiring_manager: "Hiring Manager",
  technical: "Technical",
  case_study: "Case Study",
  final_round: "Final Round",
  general: "General",
};

// ─── Request Bodies ───────────────────────────────────────────────────────────

export const CreateInterviewBody = z.object({
  applicationId: z.string().min(1),
  interviewType: InterviewTypeEnum.default("general"),
  title: z.string().min(1),
  scheduledAt: z.string().datetime(),
  timezone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateInterviewBody = z.object({
  interviewType: InterviewTypeEnum.optional(),
  title: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: InterviewStatusEnum.optional(),
});

export const CreateMockSessionBody = z.object({
  applicationId: z.string().min(1),
  interviewPrepId: z.string().optional().nullable(),
  sessionType: SessionTypeEnum.default("mixed"),
  questionCount: z.union([z.literal(5), z.literal(8), z.literal(10)]).default(8),
});

export const SaveMockAnswerBody = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  answerText: z.string(),
});

export const EvaluateMockAnswerBody = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  answerText: z.string().min(1, "Answer cannot be empty"),
});

export const CompleteSessionBody = z.object({
  sessionId: z.string().min(1),
});

// ─── AI output schemas ────────────────────────────────────────────────────────

export const MockQuestionSchema = z.object({
  question: z.string(),
  answer_type: MockAnswerTypeEnum,
  why_it_matters: z.string(),
  suggested_points: z.array(z.string()),
});

export const MockInterviewOutputSchema = z.object({
  session_title: z.string(),
  questions: z.array(MockQuestionSchema),
});
export type MockInterviewOutput = z.infer<typeof MockInterviewOutputSchema>;

export const AnswerFeedbackSchema = z.object({
  score: z.number().int().min(1).max(10),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missing_points: z.array(z.string()),
  improved_answer: z.string(),
  delivery_tips: z.array(z.string()),
  overall_feedback: z.string(),
});
export type AnswerFeedback = z.infer<typeof AnswerFeedbackSchema>;
