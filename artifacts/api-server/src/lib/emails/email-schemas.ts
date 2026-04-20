import { z } from "zod";

export const DraftTypeEnum = z.enum([
  "follow_up",
  "thank_you",
  "networking",
  "interview_confirmation",
]);
export type DraftType = z.infer<typeof DraftTypeEnum>;

export const EmailToneEnum = z.enum([
  "professional",
  "warm",
  "concise",
  "confident",
]);
export type EmailTone = z.infer<typeof EmailToneEnum>;

export const DraftStatusEnum = z.enum(["draft", "copied", "archived"]);
export type DraftStatus = z.infer<typeof DraftStatusEnum>;

export const GenerateEmailDraftBody = z.object({
  applicationId: z.string().min(1),
  draftType: DraftTypeEnum,
  tone: EmailToneEnum.default("professional"),
  extraContext: z.string().max(1000).optional().nullable(),
});

export const UpdateDraftStatusBody = z.object({
  draftId: z.string().min(1),
  status: DraftStatusEnum,
});

export const EmailDraftOutputSchema = z.object({
  subject: z.string().min(1),
  body_text: z.string().min(1),
});
export type EmailDraftOutput = z.infer<typeof EmailDraftOutputSchema>;

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  follow_up: "Follow-up",
  thank_you: "Thank-you",
  networking: "Networking",
  interview_confirmation: "Interview Confirmation",
};
