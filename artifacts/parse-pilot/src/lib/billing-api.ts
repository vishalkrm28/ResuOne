const BASE = "/api";

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// ─── Plan types ───────────────────────────────────────────────────────────────

export interface PlanEntitlement {
  featureKey: string;
  featureValue: Record<string, unknown>;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  billingType: string;
  monthlyPrice: string;
  yearlyPrice: string;
  includedCredits: number;
  maxTeamMembers: number;
  features: Record<string, unknown>;
  isActive: boolean;
  entitlements: PlanEntitlement[];
}

export interface CreditBalance {
  balance: number;
  jobRecCredits: number;
  lifetimeUsed: number;
  billingPeriodEnd: string | null;
  recentTransactions: {
    id: string;
    type: string;
    creditsDelta: number;
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
}

export interface EntitlementResult {
  allowed: boolean;
  planCode: string;
  featureValue: Record<string, unknown>;
  creditCost: number;
  reason?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listPlans(): Promise<Plan[]> {
  const data = await apiFetch<{ plans: Plan[] }>("/billing/plans");
  return data.plans;
}

export async function getCreditBalance(): Promise<CreditBalance> {
  return apiFetch<CreditBalance>("/billing/credit-balance");
}

export async function checkEntitlement(featureKey: string, workspaceId?: string): Promise<EntitlementResult> {
  return apiFetch<EntitlementResult>("/billing/check-entitlement", {
    method: "POST",
    body: JSON.stringify({ featureKey, workspaceId }),
  });
}

export async function getBillingStatus() {
  return apiFetch<{
    isPro: boolean;
    isRecruiter: boolean;
    hasBulkAccess: boolean;
    subscriptionStatus: string | null;
    subscriptionPriceId: string | null;
    currentPeriodEnd: string | null;
    hasCustomer: boolean;
  }>("/billing/status");
}

export async function getCredits() {
  return apiFetch<{
    availableCredits: number;
    lifetimeCreditsUsed: number;
    billingPeriodEnd: string | null;
    planAllowance: number;
    isPro: boolean;
  }>("/billing/credits");
}

// ─── Feature key → human label ────────────────────────────────────────────────

export const FEATURE_LABELS: Record<string, string> = {
  cv_analysis_enabled: "CV Analysis",
  tailored_cv_enabled: "Tailored CV Generation",
  cover_letter_enabled: "Cover Letter Generation",
  interview_prep_enabled: "Interview Preparation",
  mock_interview_enabled: "Mock Interview Sessions",
  open_jobs_enabled: "Job Recommendations",
  recruiter_ranking_enabled: "Recruiter Candidate Ranking",
  export_enabled: "PDF / DOCX Export",
  team_workspace_enabled: "Team Workspace",
  credits_rollover_enabled: "Credits Roll Over",
  admin_dashboard_enabled: "Admin Dashboard",
};
