import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
