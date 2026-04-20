import { authedFetch } from "@/lib/authed-fetch";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export async function getRecruiterAnalytics() {
  const res = await authedFetch(`${BASE}/recruiter/analytics`);
  if (!res.ok) throw new Error("Failed to load analytics");
  return res.json();
}

export async function getCandidates() {
  const res = await authedFetch(`${BASE}/recruiter/candidates`);
  if (!res.ok) throw new Error("Failed to load candidates");
  return res.json();
}

export async function createCandidate(data: {
  name: string; email: string; score?: number; skills?: string[];
  experience?: string; jobTitle?: string; company?: string; notes?: string;
}) {
  const res = await authedFetch(`${BASE}/recruiter/candidates`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

export async function getCandidate(id: string) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${id}`);
  if (!res.ok) throw new Error("Candidate not found");
  return res.json();
}

export async function updateCandidateStatus(id: string, status: string) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

export async function deleteCandidate(id: string) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
  return res.json();
}

export async function sendInvite(candidateId: string, data: {
  type: "interview" | "test"; message: string;
  scheduledAt?: string | null; meetingLink?: string | null;
  recruiterName?: string; recruiterOrg?: string;
}) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${candidateId}/invite`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to send invite"); }
  return res.json();
}

export async function bulkInvite(data: {
  candidateIds: string[]; type: "interview" | "test"; message: string;
  scheduledAt?: string | null; meetingLink?: string | null;
  recruiterName?: string; recruiterOrg?: string;
}) {
  const res = await authedFetch(`${BASE}/recruiter/bulk-invite`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function getCandidateNotes(candidateId: string) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${candidateId}/notes`);
  if (!res.ok) throw new Error("Failed to load notes");
  return res.json();
}

export async function addCandidateNote(candidateId: string, text: string) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${candidateId}/notes`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

export async function deleteCandidateNote(candidateId: string, noteId: string) {
  const res = await authedFetch(`${BASE}/recruiter/candidates/${candidateId}/notes/${noteId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete note");
  return res.json();
}

// ─── Import from analyses ─────────────────────────────────────────────────────

export async function getImportSources() {
  const res = await authedFetch(`${BASE}/recruiter/import-sources`);
  if (!res.ok) throw new Error("Failed to load import sources");
  return res.json();
}

export async function importFromAnalyses(applicationIds: string[]) {
  const res = await authedFetch(`${BASE}/recruiter/import-from-analyses`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationIds }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to import"); }
  return res.json();
}

// ─── Access check ─────────────────────────────────────────────────────────────

export async function getRecruiterAccess() {
  const res = await authedFetch(`${BASE}/recruiter/access`);
  if (!res.ok) return { hasAccess: false, plan: null, isTeamOwner: false, isMember: false };
  return res.json();
}

// ─── Recruiter checkout ───────────────────────────────────────────────────────

export async function startRecruiterCheckout(plan: "solo" | "team", successUrl: string, cancelUrl: string) {
  const res = await authedFetch(`${BASE}/billing/checkout-recruiter`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, successUrl, cancelUrl }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Checkout failed"); }
  return res.json();
}

export async function cancelRecruiterPlan(): Promise<{ success: boolean; periodEnd: string | null; message: string }> {
  const res = await authedFetch(`${BASE}/billing/cancel-recruiter`, {
    method: "POST", headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Cancellation failed"); }
  return res.json();
}

// ─── Public invite (candidate respond) ────────────────────────────────────────

export async function getInvitePublic(id: string) {
  const res = await fetch(`${BASE}/invite/${id}`);
  if (!res.ok) throw new Error("Invite not found");
  return res.json();
}

export async function respondToInvite(id: string, action: "accept" | "decline", token: string) {
  const res = await fetch(`${BASE}/invite/${id}/respond`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token }),
  });
  if (!res.ok) throw new Error("Failed to respond");
  return res.json();
}

// ─── Team management ─────────────────────────────────────────────────────────

export async function getTeam() {
  const res = await authedFetch(`${BASE}/recruiter/team`);
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to load team"); }
  return res.json();
}

export async function inviteTeamMember(email: string) {
  const res = await authedFetch(`${BASE}/recruiter/team/invite`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to invite"); }
  return res.json();
}

export async function cancelTeamInvite(inviteId: string) {
  const res = await authedFetch(`${BASE}/recruiter/team/invites/${inviteId}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

export async function removeTeamMember(userId: string) {
  const res = await authedFetch(`${BASE}/recruiter/team/members/${userId}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

export async function leaveTeam() {
  const res = await authedFetch(`${BASE}/recruiter/team/leave`, { method: "POST" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

// ─── Public: team invite join ─────────────────────────────────────────────────

export async function getTeamInvite(token: string) {
  const res = await fetch(`${BASE}/recruiter/team/join/${token}`);
  if (!res.ok) throw new Error("Invite not found");
  return res.json();
}

export async function acceptTeamInvite(token: string) {
  const res = await authedFetch(`${BASE}/recruiter/team/join/${token}/accept`, { method: "POST" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to accept"); }
  return res.json();
}

// ─── Recruiter Jobs (Ranking Dashboard) ──────────────────────────────────────

export async function listRecruiterJobs() {
  const res = await authedFetch(`${BASE}/recruiter/jobs`);
  if (!res.ok) throw new Error("Failed to load jobs");
  return res.json();
}

export async function createRecruiterJob(data: { title: string; company?: string; location?: string; rawDescription: string }) {
  const res = await authedFetch(`${BASE}/recruiter/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to create job"); }
  return res.json();
}

export async function getRecruiterJob(jobId: string) {
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}`);
  if (!res.ok) throw new Error("Failed to load job");
  return res.json();
}

export async function deleteRecruiterJob(jobId: string) {
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete job");
}

export async function uploadCandidateFiles(jobId: string, files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append("files", f));
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}/upload`, { method: "POST", body: form });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
  return res.json();
}

export async function analyzeCandidates(jobId: string, candidateIds?: string[]) {
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Analysis failed"); }
  return res.json();
}

export async function rankCandidates(jobId: string) {
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}/rank`, { method: "POST" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Ranking failed"); }
  return res.json();
}

export async function getJobRanking(jobId: string, filters?: { minScore?: number; recommendation?: string; status?: string; missingSkill?: string }) {
  const params = new URLSearchParams();
  if (filters?.minScore != null) params.set("minScore", String(filters.minScore));
  if (filters?.recommendation) params.set("recommendation", filters.recommendation);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.missingSkill) params.set("missingSkill", filters.missingSkill);
  const qs = params.toString();
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}/ranking${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load ranking");
  return res.json();
}

export async function updateJobCandidateStatus(jobId: string, candidateId: string, status: string) {
  const res = await authedFetch(`${BASE}/recruiter/jobs/${jobId}/candidates/${candidateId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to update status"); }
  return res.json();
}
