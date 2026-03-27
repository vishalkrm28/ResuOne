import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, bulkPassesTable } from "@workspace/db";
import { logger } from "./logger.js";

// ─── Tier config ──────────────────────────────────────────────────────────────

export const BULK_TIERS = {
  "10": {
    label: "10 CVs",
    cvLimit: 10,
    amountCents: 1900,
    stripePriceEnvKey: "STRIPE_PRICE_BULK_10",
    badge: null,
    tagline: "Quick shortlist for small batches",
  },
  "25": {
    label: "25 CVs",
    cvLimit: 25,
    amountCents: 2900,
    stripePriceEnvKey: "STRIPE_PRICE_BULK_25",
    badge: "Most Popular",
    tagline: "Best balance of speed and value",
  },
  "50": {
    label: "50 CVs",
    cvLimit: 50,
    amountCents: 3900,
    stripePriceEnvKey: "STRIPE_PRICE_BULK_50",
    badge: "Best Value",
    tagline: "Process large batches efficiently",
  },
} as const;

export type BulkTierId = keyof typeof BULK_TIERS;

export function isValidTier(t: string): t is BulkTierId {
  return t in BULK_TIERS;
}

// ─── getActiveBulkPass ────────────────────────────────────────────────────────
// Returns the user's most recent paid bulk pass that still has capacity,
// or null if none exists.

export async function getActiveBulkPass(userId: string) {
  const [pass] = await db
    .select()
    .from(bulkPassesTable)
    .where(
      and(
        eq(bulkPassesTable.userId, userId),
        eq(bulkPassesTable.status, "paid"),
        // Still has capacity
        gt(
          sql`${bulkPassesTable.cvLimit} - ${bulkPassesTable.cvsUsed}`,
          sql`0`,
        ),
      ),
    )
    .orderBy(desc(bulkPassesTable.createdAt))
    .limit(1);

  return pass ?? null;
}

// ─── hasBulkAccess ────────────────────────────────────────────────────────────
// Returns true if user has a paid bulk pass with at least one slot remaining.

export async function hasBulkAccess(userId: string): Promise<boolean> {
  const pass = await getActiveBulkPass(userId);
  return pass !== null;
}

// ─── consumeBulkSlot ──────────────────────────────────────────────────────────
// Atomically increments cvsUsed on the user's active bulk pass.
// Returns false if no capacity is available.

export async function consumeBulkSlot(userId: string): Promise<boolean> {
  const pass = await getActiveBulkPass(userId);
  if (!pass) return false;

  const [updated] = await db
    .update(bulkPassesTable)
    .set({
      cvsUsed: sql`cvs_used + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bulkPassesTable.id, pass.id),
        // Prevent over-consumption via race condition
        gt(
          sql`${bulkPassesTable.cvLimit} - ${bulkPassesTable.cvsUsed}`,
          sql`0`,
        ),
      ),
    )
    .returning({ id: bulkPassesTable.id });

  if (!updated) {
    logger.warn({ userId, passId: pass.id }, "consumeBulkSlot: no capacity available");
    return false;
  }

  logger.info(
    { userId, passId: pass.id, cvsUsed: pass.cvsUsed + 1, cvLimit: pass.cvLimit },
    "Bulk slot consumed",
  );
  return true;
}

// ─── getBulkPassCount ─────────────────────────────────────────────────────────
// Returns total number of paid bulk passes the user has ever purchased.
// Used to decide whether to show the Pro subscription upsell.

export async function getBulkPassCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bulkPassesTable)
    .where(and(eq(bulkPassesTable.userId, userId), eq(bulkPassesTable.status, "paid")));
  return row?.count ?? 0;
}
