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

// Public (no auth)
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
