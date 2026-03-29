import { Router } from "express";
import { db, bulkPassesTable, usersTable, usageBalancesTable, usageEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { logger } from "../lib/logger.js";

const router = Router();

const ADMIN_TOKEN = process.env["ADMIN_SEED_TOKEN"] ?? "parsepilot-admin-2026";

router.post("/_admin/seed-bulk", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }

  try {
    await db.insert(bulkPassesTable).values({
      userId,
      cvLimit: 25,
      cvsUsed: 0,
      tier: "25",
      status: "paid",
      amountPaid: 2900,
      currency: "gbp",
    });

    logger.info({ userId }, "Admin seeded bulk pass");
    res.json({ success: true, message: `Bulk pass (25 CVs) granted to ${userId}` });
  } catch (err: any) {
    logger.error({ err }, "Admin seed failed");
    res.status(500).json({ error: err.message });
  }
});

// ONE-TIME migration: merge a stale "migrating_*" row into the live user row.
// POST /_admin/fix-user-migration  { old_id, new_id }
router.post("/_admin/fix-user-migration", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { old_id, new_id } = req.body as { old_id?: string; new_id?: string };
  if (!old_id || !new_id) {
    res.status(400).json({ error: "old_id and new_id required" });
    return;
  }

  try {
    // Read both rows so we can see what state each is in
    const oldResult = await db.execute(sql`SELECT * FROM users WHERE id = ${old_id}`);
    const newResult = await db.execute(sql`SELECT * FROM users WHERE id = ${new_id}`);
    const oldRow = (oldResult.rows?.[0] ?? oldResult[0]) as Record<string, unknown> | undefined;
    const newRow = (newResult.rows?.[0] ?? newResult[0]) as Record<string, unknown> | undefined;

    if (!newRow) {
      res.status(404).json({ error: `new_id ${new_id} not found in users table` });
      return;
    }

    const report: Record<string, unknown> = { oldRow: oldRow ?? "not found", newRowBefore: newRow };

    // Always restore the real email on the new (active) user row
    const { real_email } = req.body as { real_email?: string };
    if (real_email) {
      await db.execute(sql`UPDATE users SET email = ${real_email} WHERE id = ${new_id}`);
      report["emailRestored"] = real_email;
    }

    // 1. If new row is missing stripe data but old row has it, copy it over.
    //    First null out the old row's stripe fields to release the unique constraint,
    //    then update the new row.
    if (oldRow) {
      const oldStripe = oldRow["stripe_customer_id"];
      const newStripe = newRow["stripe_customer_id"];

      if (oldStripe && !newStripe) {
        // New row needs stripe data — null old row first to release unique constraint
        await db.execute(sql`
          UPDATE users SET stripe_customer_id = NULL, stripe_subscription_id = NULL
          WHERE id = ${old_id}
        `);
        await db.execute(sql`
          UPDATE users SET
            stripe_customer_id     = ${oldStripe as string},
            stripe_subscription_id = ${(oldRow["stripe_subscription_id"] as string) ?? null},
            subscription_status    = ${(oldRow["subscription_status"] as string) ?? null},
            subscription_price_id  = ${(oldRow["subscription_price_id"] as string) ?? null},
            current_period_end     = ${(oldRow["current_period_end"] as string) ?? null},
            updated_at = NOW()
          WHERE id = ${new_id}
        `);
        report["stripeAction"] = "copied from old to new";
      } else if (oldStripe && newStripe) {
        // Both have stripe data — just null out old row's stripe fields so delete succeeds
        await db.execute(sql`
          UPDATE users SET stripe_customer_id = NULL, stripe_subscription_id = NULL
          WHERE id = ${old_id}
        `);
        report["stripeAction"] = "new row already had stripe data — old stripe fields nulled";
      } else {
        report["stripeAction"] = "no stripe data to migrate";
      }

      // 2. Delete stale initFreeCredits balance on new row if old row has a real balance
      await db.execute(sql`
        DELETE FROM usage_balances
        WHERE user_id = ${new_id}
          AND EXISTS (SELECT 1 FROM usage_balances WHERE user_id = ${old_id})
      `);

      // 3. Move all child rows still pointing to the old id
      const moved: Record<string, number> = {};
      for (const tbl of ["applications","bulk_sessions","bulk_passes","contact_messages",
                          "unlock_purchases","usage_balances","usage_events","user_identity_profiles"]) {
        const r = await db.execute(sql.raw(`UPDATE ${tbl} SET user_id = '${new_id}' WHERE user_id = '${old_id}'`));
        moved[tbl] = (r as any).rowCount ?? 0;
      }
      report["moved"] = moved;

      // 4. Delete the old stale row (no children point to it anymore)
      const del = await db.execute(sql`DELETE FROM users WHERE id = ${old_id}`);
      report["oldRowDeleted"] = (del as any).rowCount ?? 0;
    }

    logger.info({ old_id, new_id, report }, "Admin fix-user-migration: complete");
    res.json({ success: true, report });
  } catch (err: any) {
    logger.error({ err }, "Admin fix-user-migration failed");
    res.status(500).json({ error: err.message });
  }
});

// POST /_admin/seed-credits  { userId, credits }
// Sets the user's available credit balance directly (upsert).
router.post("/_admin/seed-credits", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) { res.status(403).json({ error: "Forbidden" }); return; }

  const { userId, credits } = req.body as { userId?: string; credits?: number };
  if (!userId || credits === undefined) {
    res.status(400).json({ error: "userId and credits required" });
    return;
  }

  try {
    const existing = await db.select().from(usageBalancesTable)
      .where(eq(usageBalancesTable.userId, userId)).limit(1);

    if (existing.length > 0) {
      await db.update(usageBalancesTable)
        .set({ availableCredits: credits })
        .where(eq(usageBalancesTable.userId, userId));
    } else {
      await db.insert(usageBalancesTable).values({ userId, availableCredits: credits });
    }

    await db.insert(usageEventsTable).values({
      userId,
      type: "admin_credit_grant",
      creditsDelta: credits,
      metadata: { reason: "admin seed", grantedAt: new Date().toISOString() },
    });

    logger.info({ userId, credits }, "Admin seeded credits");
    res.json({ success: true, message: `Set ${credits} credits for ${userId}` });
  } catch (err: any) {
    logger.error({ err }, "Admin seed-credits failed");
    res.status(500).json({ error: err.message });
  }
});

// POST /_admin/sync-stripe  { userId }
// Looks up the user's Stripe customer, finds their active subscription,
// and writes subscription_status + price + period into the DB.
router.post("/_admin/sync-stripe", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) { res.status(403).json({ error: "Forbidden" }); return; }

  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  if (!stripeKey) { res.status(500).json({ error: "STRIPE_SECRET_KEY not set" }); return; }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.stripeCustomerId) { res.status(400).json({ error: "User has no stripeCustomerId" }); return; }

    const stripe = new Stripe(stripeKey);
    const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 5 });
    const active = subs.data.find(s => s.status === "active") ?? subs.data[0];

    if (!active) {
      res.json({ success: true, message: "No subscriptions found for this customer", subs: subs.data.map(s => ({ id: s.id, status: s.status })) });
      return;
    }

    const priceId = active.items.data[0]?.price?.id ?? null;
    const periodEnd = active.current_period_end ? new Date(active.current_period_end * 1000) : null;

    await db.update(usersTable).set({
      stripeSubscriptionId: active.id,
      subscriptionStatus: active.status,
      subscriptionPriceId: priceId,
      currentPeriodEnd: periodEnd,
    }).where(eq(usersTable.id, userId));

    logger.info({ userId, subId: active.id, status: active.status }, "Admin synced Stripe subscription");
    res.json({ success: true, subscription: { id: active.id, status: active.status, priceId, periodEnd } });
  } catch (err: any) {
    logger.error({ err }, "Admin sync-stripe failed");
    res.status(500).json({ error: err.message });
  }
});

// GET /_admin/check-user/:userId  — show the user's current DB state
router.get("/_admin/check-user/:userId", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) { res.status(403).json({ error: "Forbidden" }); return; }

  const { userId } = req.params;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [balance] = await db.select().from(usageBalancesTable).where(eq(usageBalancesTable.userId, userId)).limit(1);
    const passes = await db.select().from(bulkPassesTable).where(eq(bulkPassesTable.userId, userId));
    res.json({ user: user ?? null, balance: balance ?? null, bulkPasses: passes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
