import { and, eq, gte, sql } from "drizzle-orm";
import { db, usageBalancesTable, usageEventsTable } from "@workspace/db";
import { logger } from "./logger.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const FREE_CREDIT_ALLOWANCE = 3;
export const PRO_CREDIT_ALLOWANCE = 100;
export const RECRUITER_SOLO_CREDIT_ALLOWANCE = 100;
export const RECRUITER_TEAM_CREDIT_ALLOWANCE = 400;

export const CREDIT_COSTS = {
  cv_optimization: 1,
  cover_letter: 1,
  tailored_cv: 1,
  interview_prep: 1,
  email_draft: 1,
  mock_interview_session: 1,
  mock_interview_evaluate: 1,
  docx_export: 0,
  pdf_export: 0,
  // Charged when a CV for a different person is detected on the same account.
  // Applied in addition to cv_optimization (total cost: 2 credits).
  identity_switch_penalty: 1,
} as const;

export type CreditEventType =
  | keyof typeof CREDIT_COSTS
  | "credits_init"
  | "credits_reset_pro"
  | "credits_reset_recruiter"
  | "identity_switch"
  | "job_rec_credits_granted"
  | "job_rec_credit_spent";

// ─── getUserCredits ────────────────────────────────────────────────────────────
// Returns the user's current credit balance row, or null if not found.

export async function getUserCredits(userId: string) {
  const [balance] = await db
    .select()
    .from(usageBalancesTable)
    .where(eq(usageBalancesTable.userId, userId))
    .limit(1);
  return balance ?? null;
}

// ─── canSpendCredits ──────────────────────────────────────────────────────────
// Returns true if the user has at least `amount` credits available.
// NOTE: This is a snapshot check — use spendCredits() for the actual gate
// because it performs an atomic check-and-deduct.

export async function canSpendCredits(userId: string, amount: number): Promise<boolean> {
  if (amount === 0) return true;
  const balance = await getUserCredits(userId);
  return (balance?.availableCredits ?? 0) >= amount;
}

// ─── spendCredits ─────────────────────────────────────────────────────────────
// Atomically deducts `amount` credits from the user's balance.
// Uses a single UPDATE ... WHERE availableCredits >= amount so a concurrent
// second request cannot race-spend below zero.
//
// Returns { success: true, remaining } or { success: false, remaining }

export async function spendCredits(
  userId: string,
  amount: number,
  type: CreditEventType,
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; remaining: number }> {
  if (amount === 0) {
    const balance = await getUserCredits(userId);
    return { success: true, remaining: balance?.availableCredits ?? 0 };
  }

  // ── Safety net for users created before the credit system was deployed ───
  // Ensures a balance row always exists before we attempt the deduction.
  // initFreeCredits uses ON CONFLICT DO NOTHING, so it's safe to call here.
  await initFreeCredits(userId);

  // ── Atomic check-and-deduct ──────────────────────────────────────────────
  // The WHERE clause ensures this is a no-op (returns 0 rows) if credits are
  // insufficient. This prevents race conditions where two concurrent requests
  // both pass a separate "has credits?" check then both deduct.
  const [updated] = await db
    .update(usageBalancesTable)
    .set({
      availableCredits: sql`available_credits - ${amount}`,
      lifetimeCreditsUsed: sql`lifetime_credits_used + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageBalancesTable.userId, userId),
        gte(usageBalancesTable.availableCredits, amount),
      ),
    )
    .returning({
      availableCredits: usageBalancesTable.availableCredits,
    });

  if (!updated) {
    const balance = await getUserCredits(userId);
    const remaining = balance?.availableCredits ?? 0;
    logger.warn({ userId, type, amount, remaining }, "Credit spend blocked — insufficient credits");
    return { success: false, remaining };
  }

  // ── Audit trail ──────────────────────────────────────────────────────────
  await db.insert(usageEventsTable).values({
    userId,
    type,
    creditsDelta: -amount,
    metadata: metadata ?? null,
  });

  logger.info(
    { userId, type, amount, remaining: updated.availableCredits },
    "Credits spent",
  );

  return { success: true, remaining: updated.availableCredits };
}

// ─── initFreeCredits ──────────────────────────────────────────────────────────
// Creates the credit balance row for a new user with the Free allowance.
// Safe to call on every login — INSERT ... ON CONFLICT DO NOTHING is idempotent.

export async function initFreeCredits(userId: string): Promise<void> {
  const inserted = await db
    .insert(usageBalancesTable)
    .values({
      userId,
      availableCredits: FREE_CREDIT_ALLOWANCE,
      lastResetAt: new Date(),
    })
    .onConflictDoNothing({ target: usageBalancesTable.userId })
    .returning({ userId: usageBalancesTable.userId });

  if (inserted.length > 0) {
    // New user — record the initial credit award
    await db.insert(usageEventsTable).values({
      userId,
      type: "credits_init",
      creditsDelta: FREE_CREDIT_ALLOWANCE,
      metadata: { plan: "free" },
    });
    logger.info({ userId, credits: FREE_CREDIT_ALLOWANCE }, "Free credits initialized for new user");
  }
}

// ─── resetProCreditsIfNeeded ──────────────────────────────────────────────────
// Called from the webhook after a subscription becomes active or trialing.
// Resets the user to PRO_CREDIT_ALLOWANCE credits if this is a new billing
// period. Safe to call multiple times — the billingPeriodStart guard prevents
// a double-reset when the same webhook event fires more than once.

export async function resetProCreditsIfNeeded(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  // Load current balance (may not exist yet for brand-new subscribers)
  const [balance] = await db
    .select({
      billingPeriodStart: usageBalancesTable.billingPeriodStart,
    })
    .from(usageBalancesTable)
    .where(eq(usageBalancesTable.userId, userId))
    .limit(1);

  // Guard: same billing period already seeded — skip
  if (balance?.billingPeriodStart?.getTime() === periodStart.getTime()) {
    logger.debug({ userId, periodStart }, "Pro credits already seeded for this billing period — skipping reset");
    return;
  }

  const now = new Date();

  // Upsert: create the row if missing, or update if it exists
  await db
    .insert(usageBalancesTable)
    .values({
      userId,
      availableCredits: PRO_CREDIT_ALLOWANCE,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      lastResetAt: now,
    })
    .onConflictDoUpdate({
      target: usageBalancesTable.userId,
      set: {
        availableCredits: PRO_CREDIT_ALLOWANCE,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        lastResetAt: now,
        updatedAt: now,
      },
    });

  // Audit
  await db.insert(usageEventsTable).values({
    userId,
    type: "credits_reset_pro",
    creditsDelta: PRO_CREDIT_ALLOWANCE,
    metadata: {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    },
  });

  logger.info(
    { userId, periodStart, periodEnd, credits: PRO_CREDIT_ALLOWANCE },
    "Pro credits reset for new billing period",
  );
}

// ─── resetRecruiterCreditsIfNeeded ────────────────────────────────────────────
// Called from the webhook when a recruiter subscription becomes active or renews.
// Grants 100 tokens for Solo plan, 400 for Team plan — monthly, per billing period.
// Uses the same billingPeriodStart guard as resetProCreditsIfNeeded to prevent
// double-seeding if the same webhook event fires more than once.

export async function resetRecruiterCreditsIfNeeded(
  userId: string,
  plan: "solo" | "team",
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  const allowance =
    plan === "team" ? RECRUITER_TEAM_CREDIT_ALLOWANCE : RECRUITER_SOLO_CREDIT_ALLOWANCE;

  // Load current balance to check the guard
  const [balance] = await db
    .select({ billingPeriodStart: usageBalancesTable.billingPeriodStart })
    .from(usageBalancesTable)
    .where(eq(usageBalancesTable.userId, userId))
    .limit(1);

  if (balance?.billingPeriodStart?.getTime() === periodStart.getTime()) {
    logger.debug({ userId, plan, periodStart }, "Recruiter credits already seeded for this billing period — skipping");
    return;
  }

  const now = new Date();

  await db
    .insert(usageBalancesTable)
    .values({
      userId,
      availableCredits: allowance,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      lastResetAt: now,
    })
    .onConflictDoUpdate({
      target: usageBalancesTable.userId,
      set: {
        availableCredits: allowance,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        lastResetAt: now,
        updatedAt: now,
      },
    });

  await db.insert(usageEventsTable).values({
    userId,
    type: "credits_reset_recruiter",
    creditsDelta: allowance,
    metadata: {
      plan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    },
  });

  logger.info({ userId, plan, allowance, periodStart, periodEnd }, "Recruiter tokens reset for new billing period");
}

// ─── Job Recommendation Credits ───────────────────────────────────────────────
// Separate from AI analysis credits. Granted on every paid unlock or Pro
// subscription activation. Decremented on each recommendation run.

export const JOB_REC_CREDITS_PER_PURCHASE = 10;

export async function getJobRecCredits(userId: string): Promise<number> {
  await initFreeCredits(userId);
  const [balance] = await db
    .select({ jobRecCredits: usageBalancesTable.jobRecCredits })
    .from(usageBalancesTable)
    .where(eq(usageBalancesTable.userId, userId))
    .limit(1);
  return balance?.jobRecCredits ?? 0;
}

export async function grantJobRecCredits(userId: string, amount: number): Promise<void> {
  await initFreeCredits(userId);
  await db
    .update(usageBalancesTable)
    .set({
      jobRecCredits: sql`job_rec_credits + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(usageBalancesTable.userId, userId));

  await db.insert(usageEventsTable).values({
    userId,
    type: "job_rec_credits_granted",
    creditsDelta: amount,
    metadata: { amount },
  });

  logger.info({ userId, amount }, "Job recommendation credits granted");
}

export async function spendJobRecCredit(
  userId: string,
): Promise<{ success: boolean; remaining: number }> {
  await initFreeCredits(userId);

  const [updated] = await db
    .update(usageBalancesTable)
    .set({
      jobRecCredits: sql`job_rec_credits - 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageBalancesTable.userId, userId),
        gte(usageBalancesTable.jobRecCredits, 1),
      ),
    )
    .returning({ jobRecCredits: usageBalancesTable.jobRecCredits });

  if (!updated) {
    const remaining = await getJobRecCredits(userId);
    logger.warn({ userId, remaining }, "Job rec credit spend blocked — no credits");
    return { success: false, remaining };
  }

  await db.insert(usageEventsTable).values({
    userId,
    type: "job_rec_credit_spent",
    creditsDelta: -1,
    metadata: null,
  });

  logger.info({ userId, remaining: updated.jobRecCredits }, "Job rec credit spent");
  return { success: true, remaining: updated.jobRecCredits };
}

