const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) {
  return `${BASE}${path}`;
}

export type DraftType = "follow_up" | "thank_you" | "networking" | "interview_confirmation";
export type EmailTone = "professional" | "warm" | "concise" | "confident";
export type DraftStatus = "draft" | "copied" | "archived";

export interface EmailDraft {
  id: string;
  applicationId: string | null;
  draftType: DraftType;
  subject: string;
  bodyText: string;
  tone: EmailTone;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  applicationTitle?: string | null;
  company?: string | null;
}

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  follow_up: "Follow-up",
  thank_you: "Thank-you",
  networking: "Networking",
  interview_confirmation: "Interview Confirmation",
};

export const DRAFT_TYPE_DESCRIPTIONS: Record<DraftType, string> = {
  follow_up: "Follow up after submitting an application",
  thank_you: "Thank the interviewer after an interview",
  networking: "Reach out to a contact related to this role",
  interview_confirmation: "Confirm an upcoming interview",
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

export async function generateEmailDraft(body: {
  applicationId: string;
  draftType: DraftType;
  tone?: EmailTone;
  extraContext?: string;
}): Promise<{ draft: EmailDraft }> {
  return request("/api/emails/generate-draft", { method: "POST", body: JSON.stringify(body) });
}

export async function listEmailDrafts(applicationId?: string): Promise<{ drafts: EmailDraft[] }> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";
  return request(`/api/emails/list-drafts${qs}`);
}

export async function updateDraftStatus(draftId: string, status: DraftStatus): Promise<{ draft: EmailDraft }> {
  return request("/api/emails/update-draft-status", {
    method: "PATCH",
    body: JSON.stringify({ draftId, status }),
  });
}
