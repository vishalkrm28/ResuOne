import { Router } from "express";
import { db, bulkPassesTable, usersTable, usageBalancesTable, usageEventsTable, applicationsTable, contactMessagesTable } from "@workspace/db";
import { eq, sql, ilike, or, desc, count } from "drizzle-orm";
import Stripe from "stripe";
import { logger } from "../lib/logger.js";

const PRO_PRICE = 14.99;
const RECRUITER_SOLO_PRICE = 29.99;
const RECRUITER_TEAM_PRICE = 79.00;

const router = Router();

const ADMIN_TOKEN = process.env["ADMIN_SEED_TOKEN"];

function authAdmin(req: any, res: any): boolean {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin access not configured" });
    return false;
  }
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

// ── GET /_admin/stats ──────────────────────────────────────────────────────
router.get("/_admin/stats", async (req, res) => {
  if (!authAdmin(req, res)) return;
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [appCount] = await db.select({ count: count() }).from(applicationsTable);
    const [passCount] = await db.select({ count: count() }).from(bulkPassesTable);
    const [msgCount] = await db.select({ count: count() }).from(contactMessagesTable);
    const proResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'`);
    const recruiterSoloResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE recruiter_subscription_status = 'solo'`);
    const recruiterTeamResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE recruiter_subscription_status = 'team'`);
    const proCount = Number((proResult.rows?.[0] as any)?.count ?? 0);
    const soloCount = Number((recruiterSoloResult.rows?.[0] as any)?.count ?? 0);
    const teamCount = Number((recruiterTeamResult.rows?.[0] as any)?.count ?? 0);
    const mrr = +(proCount * PRO_PRICE + soloCount * RECRUITER_SOLO_PRICE + teamCount * RECRUITER_TEAM_PRICE).toFixed(2);
    res.json({
      totalUsers: Number(userCount?.count ?? 0),
      totalApplications: Number(appCount?.count ?? 0),
      totalBulkPasses: Number(passCount?.count ?? 0),
      totalMessages: Number(msgCount?.count ?? 0),
      proUsers: proCount,
      recruiterSoloUsers: soloCount,
      recruiterTeamUsers: teamCount,
      mrr,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /_admin/users ──────────────────────────────────────────────────────
router.get("/_admin/users", async (req, res) => {
  if (!authAdmin(req, res)) return;
  try {
    const search = (req.query.search as string) ?? "";
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const offset = Number(req.query.offset ?? 0);

    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        subscriptionStatus: usersTable.subscriptionStatus,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(
        search
          ? or(
              ilike(usersTable.email, `%${search}%`),
              ilike(usersTable.firstName, `%${search}%`),
              ilike(usersTable.lastName, `%${search}%`),
              ilike(usersTable.id, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ users: rows, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /_admin/check-user/:userId ─────────────────────────────────────────
router.get("/_admin/check-user/:userId", async (req, res) => {
  if (!authAdmin(req, res)) return;
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

// ── GET /_admin/user/:userId/applications ──────────────────────────────────
router.get("/_admin/user/:userId/applications", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { userId } = req.params;
  try {
    const apps = await db
      .select({
        id: applicationsTable.id,
        jobTitle: applicationsTable.jobTitle,
        company: applicationsTable.company,
        keywordMatchScore: applicationsTable.keywordMatchScore,
        status: applicationsTable.status,
        createdAt: applicationsTable.createdAt,
        ipAddress: applicationsTable.ipAddress,
      })
      .from(applicationsTable)
      .where(eq(applicationsTable.userId, userId))
      .orderBy(desc(applicationsTable.createdAt));
    res.json({ applications: apps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /_admin/user/:userId ────────────────────────────────────────────
// Deletes the user + ALL their data. Irreversible.
router.delete("/_admin/user/:userId", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { userId } = req.params;
  try {
    // 1. Delete applications (cascades to unlock_purchases)
    const delApps = await db.delete(applicationsTable).where(eq(applicationsTable.userId, userId));
    // 2. Delete contact messages (no FK cascade)
    await db.execute(sql`DELETE FROM contact_messages WHERE user_id = ${userId}`);
    // 3. Delete the user row (cascades: bulk_passes, bulk_sessions, usage_balances, usage_events, user_identity_profiles)
    const delUser = await db.delete(usersTable).where(eq(usersTable.id, userId));

    logger.info({ userId }, "Admin deleted user + all data");
    res.json({
      success: true,
      deleted: {
        applicationsDeleted: (delApps as any).rowCount ?? 0,
        userDeleted: (delUser as any).rowCount ?? 0,
      },
    });
  } catch (err: any) {
    logger.error({ err, userId }, "Admin delete user failed");
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /_admin/application/:appId ─────────────────────────────────────
router.delete("/_admin/application/:appId", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { appId } = req.params;
  try {
    await db.delete(applicationsTable).where(eq(applicationsTable.id, appId));
    logger.info({ appId }, "Admin deleted application");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /_admin/bulk-pass/:passId ──────────────────────────────────────
router.delete("/_admin/bulk-pass/:passId", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { passId } = req.params;
  try {
    await db.delete(bulkPassesTable).where(eq(bulkPassesTable.id, passId));
    logger.info({ passId }, "Admin revoked bulk pass");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /_admin/seed-bulk ─────────────────────────────────────────────────
router.post("/_admin/seed-bulk", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { userId, tier } = req.body as { userId?: string; tier?: string };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const cvLimit = tier === "10" ? 10 : tier === "50" ? 50 : 25;
  try {
    await db.insert(bulkPassesTable).values({
      userId,
      cvLimit,
      cvsUsed: 0,
      tier: tier ?? "25",
      status: "paid",
      amountPaid: 0,
      currency: "usd",
    });
    logger.info({ userId, tier }, "Admin seeded bulk pass");
    res.json({ success: true, message: `Bulk pass (${cvLimit} CVs) granted to ${userId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /_admin/seed-credits ──────────────────────────────────────────────
router.post("/_admin/seed-credits", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { userId, credits } = req.body as { userId?: string; credits?: number };
  if (!userId || credits === undefined) { res.status(400).json({ error: "userId and credits required" }); return; }

  try {
    const existing = await db.select().from(usageBalancesTable).where(eq(usageBalancesTable.userId, userId)).limit(1);
    if (existing.length > 0) {
      await db.update(usageBalancesTable).set({ availableCredits: credits }).where(eq(usageBalancesTable.userId, userId));
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
    res.status(500).json({ error: err.message });
  }
});

// ── POST /_admin/sync-stripe ───────────────────────────────────────────────
router.post("/_admin/sync-stripe", async (req, res) => {
  if (!authAdmin(req, res)) return;
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
      res.json({ success: true, message: "No subscriptions found", subs: subs.data.map(s => ({ id: s.id, status: s.status })) });
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

    logger.info({ userId, subId: active.id }, "Admin synced Stripe subscription");
    res.json({ success: true, subscription: { id: active.id, status: active.status, priceId, periodEnd } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /_admin/grant-pro ─────────────────────────────────────────────────
// Grant or revoke Pro subscription manually (no Stripe required)
router.post("/_admin/grant-pro", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { userId, revoke } = req.body as { userId?: string; revoke?: boolean };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  try {
    const newStatus = revoke ? null : "active";
    const periodEnd = revoke ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    await db.update(usersTable).set({
      subscriptionStatus: newStatus,
      currentPeriodEnd: periodEnd,
    }).where(eq(usersTable.id, userId));

    logger.info({ userId, revoke }, `Admin ${revoke ? "revoked" : "granted"} Pro subscription`);
    res.json({ success: true, message: revoke ? "Pro revoked" : "Pro granted (1 year)", subscriptionStatus: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /_admin/contact-messages ──────────────────────────────────────────
router.get("/_admin/contact-messages", async (req, res) => {
  if (!authAdmin(req, res)) return;
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const offset = Number(req.query.offset ?? 0);
    const messages = await db
      .select()
      .from(contactMessagesTable)
      .orderBy(desc(contactMessagesTable.createdAt))
      .limit(limit)
      .offset(offset);
    const [total] = await db.select({ count: count() }).from(contactMessagesTable);
    res.json({ messages, total: Number(total?.count ?? 0), limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /_admin/contact-message/:id ─────────────────────────────────────
router.delete("/_admin/contact-message/:id", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { id } = req.params;
  try {
    await db.delete(contactMessagesTable).where(eq(contactMessagesTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /_admin/grant-recruiter ───────────────────────────────────────────
router.post("/_admin/grant-recruiter", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { userId, plan, revoke } = req.body as { userId?: string; plan?: "solo" | "team"; revoke?: boolean };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  if (!revoke && !plan) { res.status(400).json({ error: "plan required (solo|team)" }); return; }
  try {
    await db.update(usersTable).set({
      recruiterSubscriptionStatus: revoke ? null : plan!,
    }).where(eq(usersTable.id, userId));
    logger.info({ userId, plan, revoke }, `Admin ${revoke ? "revoked" : "granted"} recruiter plan`);
    res.json({ success: true, message: revoke ? "Recruiter access revoked" : `Recruiter ${plan} granted` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /_admin/fix-user-migration ───────────────────────────────────────
router.post("/_admin/fix-user-migration", async (req, res) => {
  if (!authAdmin(req, res)) return;
  const { old_id, new_id } = req.body as { old_id?: string; new_id?: string };
  if (!old_id || !new_id) { res.status(400).json({ error: "old_id and new_id required" }); return; }

  try {
    const oldResult = await db.execute(sql`SELECT * FROM users WHERE id = ${old_id}`);
    const newResult = await db.execute(sql`SELECT * FROM users WHERE id = ${new_id}`);
    const oldRow = (oldResult.rows?.[0] ?? oldResult[0]) as Record<string, unknown> | undefined;
    const newRow = (newResult.rows?.[0] ?? newResult[0]) as Record<string, unknown> | undefined;

    if (!newRow) { res.status(404).json({ error: `new_id ${new_id} not found` }); return; }

    const report: Record<string, unknown> = { oldRow: oldRow ?? "not found", newRowBefore: newRow };

    const { real_email } = req.body as { real_email?: string };
    if (real_email) {
      await db.execute(sql`UPDATE users SET email = ${real_email} WHERE id = ${new_id}`);
      report["emailRestored"] = real_email;
    }

    if (oldRow) {
      const oldStripe = oldRow["stripe_customer_id"];
      const newStripe = newRow["stripe_customer_id"];

      if (oldStripe && !newStripe) {
        await db.execute(sql`UPDATE users SET stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE id = ${old_id}`);
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
        await db.execute(sql`UPDATE users SET stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE id = ${old_id}`);
        report["stripeAction"] = "new row already had stripe data";
      } else {
        report["stripeAction"] = "no stripe data to migrate";
      }

      await db.execute(sql`DELETE FROM usage_balances WHERE user_id = ${new_id} AND EXISTS (SELECT 1 FROM usage_balances WHERE user_id = ${old_id})`);

      const moved: Record<string, number> = {};
      for (const tbl of ["applications","bulk_sessions","bulk_passes","contact_messages","unlock_purchases","usage_balances","usage_events","user_identity_profiles"]) {
        const r = await db.execute(sql`UPDATE ${sql.raw(tbl)} SET user_id = ${new_id} WHERE user_id = ${old_id}`);
        moved[tbl] = (r as any).rowCount ?? 0;
      }
      report["moved"] = moved;

      const del = await db.execute(sql`DELETE FROM users WHERE id = ${old_id}`);
      report["oldRowDeleted"] = (del as any).rowCount ?? 0;
    }

    logger.info({ old_id, new_id }, "Admin fix-user-migration complete");
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
