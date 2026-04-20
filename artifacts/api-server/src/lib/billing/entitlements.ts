/**
 * Centralised entitlement checks — the single source of truth for
 * "can this user/workspace access this feature?".
 *
 * Derive the plan from the user's Stripe subscription status instead of
 * reading a separate subscriptions table so we stay consistent with the
 * existing billing flow.
 */

import { and, eq } from "drizzle-orm";
import { db, usersTable, plansTable, featureEntitlementsTable } from "@workspace/db";
import { subscriptionIsActive, recruiterStatusIsActive } from "../billing.js";
import { CREDIT_COSTS } from "../credits.js";
import { logger } from "../logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntitlementResult {
  allowed: boolean;
  planCode: string;
  featureValue: Record<string, unknown>;
  creditCost: number;
  reason?: string;
}

// Map Stripe subscription state → plan code
async function resolvePlanCodeForUser(userId: string): Promise<string> {
  const [user] = await db
    .select({
      subscriptionStatus: usersTable.subscriptionStatus,
      currentPeriodEnd: usersTable.currentPeriodEnd,
      recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
      recruiterTeamId: usersTable.recruiterTeamId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return "free";

  const recruiterActive = recruiterStatusIsActive(user.recruiterSubscriptionStatus);

  if (recruiterActive) {
    // Team members vs solo — distinguish by whether they have a teamId
    return user.recruiterTeamId ? "recruiter_team" : "recruiter_solo";
  }

  return subscriptionIsActive(user.subscriptionStatus ?? null) ? "pro" : "free";
}

// ─── getActivePlanForUser ─────────────────────────────────────────────────────

export async function getActivePlanForUser(userId: string) {
  const planCode = await resolvePlanCodeForUser(userId);
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.code, planCode))
    .limit(1);
  return plan ?? null;
}

// ─── getEntitlement ───────────────────────────────────────────────────────────
// Returns the entitlement row for (planCode, featureKey), or null.

export async function getEntitlement(
  planCode: string,
  featureKey: string,
): Promise<EntitlementResult | null> {
  const [plan] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(and(eq(plansTable.code, planCode), eq(plansTable.isActive, true)))
    .limit(1);

  if (!plan) return null;

  const [ent] = await db
    .select()
    .from(featureEntitlementsTable)
    .where(
      and(
        eq(featureEntitlementsTable.planId, plan.id),
        eq(featureEntitlementsTable.featureKey, featureKey),
      ),
    )
    .limit(1);

  if (!ent) {
    return { allowed: false, planCode, featureValue: {}, creditCost: 0, reason: "no_entitlement_row" };
  }

  const fv = (ent.featureValue as Record<string, unknown>) ?? {};
  const allowed = fv.enabled === true;
  const creditCost = getCreditCostForFeature(featureKey);

  return { allowed, planCode, featureValue: fv, creditCost };
}

// ─── checkEntitlementForUser ──────────────────────────────────────────────────
// Full check: resolve plan → look up entitlement.

export async function checkEntitlementForUser(
  userId: string,
  featureKey: string,
): Promise<EntitlementResult> {
  try {
    const planCode = await resolvePlanCodeForUser(userId);
    const result = await getEntitlement(planCode, featureKey);
    if (result) return result;
    // Feature not in DB — fall back to "allowed on pro+"
    const allowed = planCode !== "free";
    return { allowed, planCode, featureValue: {}, creditCost: getCreditCostForFeature(featureKey) };
  } catch (err) {
    logger.error({ err, userId, featureKey }, "entitlement check failed");
    return { allowed: false, planCode: "free", featureValue: {}, creditCost: 0, reason: "error" };
  }
}

// ─── getCreditCostForFeature ──────────────────────────────────────────────────
// Maps M38 feature keys to existing CREDIT_COSTS constants.

export function getCreditCostForFeature(featureKey: string): number {
  const MAP: Record<string, number> = {
    cv_parse: CREDIT_COSTS.cv_optimization,
    cv_analysis: CREDIT_COSTS.cv_optimization,
    job_match: CREDIT_COSTS.cv_optimization,
    job_recommendations: 1, // job_rec_credit_spent
    tailored_cv: CREDIT_COSTS.tailored_cv,
    cover_letter: CREDIT_COSTS.cover_letter,
    interview_prep: CREDIT_COSTS.interview_prep,
    mock_interview_generation: CREDIT_COSTS.mock_interview_session,
    mock_interview_session: CREDIT_COSTS.mock_interview_session,
    answer_evaluation: CREDIT_COSTS.mock_interview_evaluate,
    recruiter_batch_analysis: CREDIT_COSTS.cv_optimization,
    email_draft: CREDIT_COSTS.email_draft,
  };
  return MAP[featureKey] ?? 1;
}
