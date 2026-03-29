import { Router } from "express";
import { db, bulkPassesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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
    // 1. Copy stripe billing fields from old row into new row
    const copyResult = await db.execute(sql`
      UPDATE users
      SET
        stripe_customer_id     = (SELECT stripe_customer_id     FROM users WHERE id = ${old_id}),
        stripe_subscription_id = (SELECT stripe_subscription_id FROM users WHERE id = ${old_id}),
        subscription_status    = (SELECT subscription_status    FROM users WHERE id = ${old_id}),
        subscription_price_id  = (SELECT subscription_price_id  FROM users WHERE id = ${old_id}),
        current_period_end     = (SELECT current_period_end     FROM users WHERE id = ${old_id}),
        updated_at = NOW()
      WHERE id = ${new_id}
    `);

    // 2. Delete usage_balances seeded for the new (empty) user by initFreeCredits,
    //    so the old user's balance takes precedence after the move.
    await db.execute(sql`
      DELETE FROM usage_balances
      WHERE user_id = ${new_id}
        AND EXISTS (SELECT 1 FROM usage_balances WHERE user_id = ${old_id})
    `);

    // 3. Move all child rows still pointing to the old id
    await db.execute(sql`UPDATE applications           SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE bulk_sessions           SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE bulk_passes             SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE contact_messages        SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE unlock_purchases        SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE usage_balances          SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE usage_events            SET user_id = ${new_id} WHERE user_id = ${old_id}`);
    await db.execute(sql`UPDATE user_identity_profiles  SET user_id = ${new_id} WHERE user_id = ${old_id}`);

    // 4. Delete the old stale row
    const del = await db.execute(sql`DELETE FROM users WHERE id = ${old_id}`);

    logger.info({ old_id, new_id }, "Admin fix-user-migration: merge complete");
    res.json({ success: true, copyResult, deleted: del.rowCount });
  } catch (err: any) {
    logger.error({ err }, "Admin fix-user-migration failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
