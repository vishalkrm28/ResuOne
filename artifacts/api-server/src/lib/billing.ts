import { db, usersTable, unlockPurchasesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { hasBulkAccess } from "./bulk.js";

/**
 * Returns true if the user has an active Recruiter Solo or Team subscription.
 * Recruiter plan holders get batch CV analysis included — no Bulk Pass needed.
 */
export async function isUserRecruiter(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return !!(user?.recruiterSubscriptionStatus);
}

/**
 * Returns true if the given Stripe subscription status is considered active.
 * "trialing" is treated as active so trial users retain access.
 */
export function subscriptionIsActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Returns true if the given recruiter subscription status represents an active
 * recruiter plan.
 *
 * Handles both Stripe-managed statuses ("active", "trialing") and the
 * admin-granted values ("solo", "team") set by the /_admin/grant-recruiter
 * endpoint.
 */
export function recruiterStatusIsActive(status: string | null | undefined): boolean {
  if (!status) return false;
  return status === "active" || status === "trialing" || status === "solo" || status === "team";
}

/**
 * Looks up a ParsePilot user by their internal user ID (from Replit Auth)
 * and returns whether they have an active Pro subscription.
 *
 * Trusts Stripe's subscriptionStatus as the source of truth. Stripe only marks
 * a subscription "active" when payment has succeeded; it transitions to
 * "past_due" or "canceled" when payment fails or the subscription ends. We do
 * NOT apply a secondary currentPeriodEnd date guard here because that causes
 * false negatives when a webhook is delayed after a successful renewal.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ subscriptionStatus: usersTable.subscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return false;
  return subscriptionIsActive(user.subscriptionStatus);
}

/**
 * Returns true if the given user has a completed one-time unlock purchase
 * for the specified application. This is per-result — not account-wide.
 */
export async function hasUnlockedResult(
  userId: string,
  applicationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: unlockPurchasesTable.id })
    .from(unlockPurchasesTable)
    .where(
      and(
        eq(unlockPurchasesTable.userId, userId),
        eq(unlockPurchasesTable.applicationId, applicationId),
        eq(unlockPurchasesTable.status, "paid"),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Central access check for full result content.
 * Returns true if the user may see the full tailored CV and exports for the
 * given application. This is the single authoritative place for that decision.
 *
 *   Pro user          → true  (subscription grants all results)
 *   One-time unlock   → true  (for that specific application only)
 *   Free, no unlock   → false
 */
export async function userCanAccessFullResult(
  userId: string,
  applicationId: string,
): Promise<boolean> {
  const [pro, unlocked, bulk] = await Promise.all([
    isUserPro(userId),
    hasUnlockedResult(userId, applicationId),
    hasBulkAccess(userId),
  ]);
  return pro || unlocked || bulk;
}

/**
 * Returns the full billing profile for a user, or null if not found.
 * Useful for building the customer portal redirect and showing plan info.
 */
export async function getUserBillingProfile(userId: string) {
  const [user] = await db
    .select({
      stripeCustomerId: usersTable.stripeCustomerId,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
      subscriptionStatus: usersTable.subscriptionStatus,
      subscriptionPriceId: usersTable.subscriptionPriceId,
      currentPeriodEnd: usersTable.currentPeriodEnd,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return null;

  return {
    ...user,
    isPro: subscriptionIsActive(user.subscriptionStatus),
  };
}
