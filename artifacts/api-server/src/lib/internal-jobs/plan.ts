import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recruiterStatusIsActive, subscriptionIsActive } from "../billing.js";

export type UserPlan = "free" | "pro" | "recruiter";

export async function resolveUserPlan(userId: string): Promise<UserPlan> {
  const [user] = await db
    .select({
      subscriptionStatus: usersTable.subscriptionStatus,
      recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return "free";
  if (recruiterStatusIsActive(user.recruiterSubscriptionStatus)) return "recruiter";
  if (subscriptionIsActive(user.subscriptionStatus ?? null)) return "pro";
  return "free";
}

export function canSeeProOnlyJobs(plan: UserPlan): boolean {
  return plan === "pro" || plan === "recruiter";
}

export function canPostJobs(plan: UserPlan): boolean {
  return plan === "recruiter";
}

export function canApplyToProOnlyJob(plan: UserPlan): boolean {
  return plan === "pro" || plan === "recruiter";
}
