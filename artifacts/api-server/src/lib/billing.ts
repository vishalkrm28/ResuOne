import { db, usersTable, unlockPurchasesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { hasBulkAccess } from "./bulk.js";

/**
 * Returns true if the given Stripe subscription status is considered active.
 * "trialing" is treated as active so trial users retain access.
 */
export function subscriptionIsActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Looks up a ParsePilot user by their internal user ID (from Replit Auth)
 * and returns whether they have an active Pro subscription.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  const [user] = await db
    .select({
      subscriptionStatus: usersTable.subscriptionStatus,
      currentPeriodEnd: usersTable.currentPeriodEnd,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return false;

  if (!subscriptionIsActive(user.subscriptionStatus)) return false;

  // Guard against stale status: treat subscription as expired if the
  // period has ended and Stripe hasn't sent a webhook update yet.
  if (user.currentPeriodEnd && user.currentPeriodEnd < new Date()) return false;

  return true;
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
