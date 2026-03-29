import { Router, type IRouter } from "express";
import { and, eq, desc, count, max, avg, sql, inArray } from "drizzle-orm";
import { db, usersTable, bulkPassesTable, bulkSessionsTable, applicationsTable } from "@workspace/db";
import { z } from "zod";
import type Stripe from "stripe";
import { getStripe } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";
import {
  BULK_TIERS,
  isValidTier,
  getActiveBulkPass,
  getBulkPassCount,
} from "../lib/bulk.js";
import { isUserPro, getUserBillingProfile } from "../lib/billing.js";
import { spendCredits } from "../lib/credits.js";

function stripeErrContext(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object" && "type" in err) {
    const e = err as Stripe.errors.StripeError;
    return { stripeType: e.type, stripeCode: e.code ?? null, stripeMessage: e.message };
  }
  return { err };
}

const router: IRouter = Router();

// ─── GET /billing/bulk-status ─────────────────────────────────────────────────
// Returns the user's active bulk pass (if any) and whether they are Pro.
// Used by the pricing page and session page to know what the user has access to.

router.get("/billing/bulk-status", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const [pro, activePass, passCount] = await Promise.all([
      isUserPro(req.user.id),
      getActiveBulkPass(req.user.id),
      getBulkPassCount(req.user.id),
    ]);

    res.json({
      isPro: pro,
      activePass: activePass
        ? {
            id: activePass.id,
            tier: activePass.tier,
            cvLimit: activePass.cvLimit,
            cvsUsed: activePass.cvsUsed,
            remaining: activePass.cvLimit - activePass.cvsUsed,
            status: activePass.status,
          }
        : null,
      totalPassesPurchased: passCount,
      // Signal whether to show the Pro subscription upsell
      showProUpsell: passCount >= 2 || (activePass?.tier === "50"),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch bulk status");
    res.status(500).json({ error: "Could not load bulk status", code: "DB_ERROR" });
  }
});

// ─── POST /billing/bulk-checkout ──────────────────────────────────────────────
// Creates a Stripe Checkout session for the selected bulk tier.
// Pro users: skip payment, consume credits directly.

const BulkCheckoutBody = z.object({
  tier: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post("/billing/bulk-checkout", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const parsed = BulkCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "tier, successUrl, and cancelUrl are required", code: "VALIDATION_ERROR" });
    return;
  }

  const { tier, successUrl, cancelUrl } = parsed.data;

  if (!isValidTier(tier)) {
    res.status(400).json({ error: `Invalid tier. Must be one of: ${Object.keys(BULK_TIERS).join(", ")}`, code: "INVALID_TIER" });
    return;
  }

  const tierConfig = BULK_TIERS[tier];
  const userId = req.user.id;

  // ── Pro override: use credits instead of Stripe checkout ──────────────────
  const isPro = await isUserPro(userId);
  if (isPro) {
    const creditCost = tierConfig.cvLimit;
    const result = await spendCredits(userId, creditCost, "cv_optimization", {
      bulkTier: tier,
      cvLimit: tierConfig.cvLimit,
      source: "bulk_pro_override",
    });

    if (!result.success) {
      res.status(402).json({
        error: `Not enough credits. This bulk tier requires ${creditCost} credits but you only have ${result.remaining} remaining.`,
        code: "CREDITS_EXHAUSTED",
        creditsRequired: creditCost,
        creditsAvailable: result.remaining,
      });
      return;
    }

    // Record a "paid" bulk pass directly (no Stripe session needed)
    const [pass] = await db
      .insert(bulkPassesTable)
      .values({
        userId,
        tier,
        cvLimit: tierConfig.cvLimit,
        cvsUsed: 0,
        status: "paid",
        amountPaid: 0,
        currency: "usd",
      })
      .returning();

    res.json({
      mode: "pro_credits",
      bulkPassId: pass.id,
      creditCost,
      remaining: result.remaining,
    });
    return;
  }

  // ── Standard Stripe checkout ──────────────────────────────────────────────
  const priceId = process.env[tierConfig.stripePriceEnvKey];
  if (!priceId) {
    logger.error(`${tierConfig.stripePriceEnvKey} is not configured`);
    res.status(503).json({
      error: `Bulk tier ${tier} is not configured for payment yet.`,
      code: "BILLING_NOT_CONFIGURED",
    });
    return;
  }

  try {
    const stripe = getStripe();

    const [dbUser] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!dbUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, userId));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId,
        purchaseType: "bulk_pass",
        tier,
        cvLimit: String(tierConfig.cvLimit),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    res.json({ url: session.url });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to create bulk checkout session");
    res.status(500).json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_ERROR" });
  }
});

// ─── GET /billing/bulk-tiers ──────────────────────────────────────────────────
// Returns the available tier definitions for the pricing UI.

router.get("/billing/bulk-tiers", (_req, res) => {
  const tiers = Object.entries(BULK_TIERS).map(([id, config]) => ({
    id,
    cvLimit: config.cvLimit,
    amountCents: config.amountCents,
    amountDollars: config.amountCents / 100,
    badge: config.badge,
    tagline: config.tagline,
    label: config.label,
  }));
  res.json({ tiers });
});

// ─── POST /bulk-sessions ──────────────────────────────────────────────────────
// Creates a new bulk session record and links the completed application IDs to it.

const CreateBulkSessionBody = z.object({
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  jobDescription: z.string().optional(),
  applicationIds: z.array(z.string()).min(1),
});

router.post("/bulk-sessions", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const parsed = CreateBulkSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "applicationIds array is required", code: "VALIDATION_ERROR" });
    return;
  }

  const { jobTitle, company, jobDescription, applicationIds } = parsed.data;

  try {
    const [session] = await db
      .insert(bulkSessionsTable)
      .values({
        userId: req.user.id,
        jobTitle: jobTitle?.trim() || "Bulk Analysis",
        company: company?.trim() || "—",
        jobDescription: jobDescription?.trim() || "",
      })
      .returning();

    // Link each application to this session
    if (applicationIds.length > 0) {
      await db
        .update(applicationsTable)
        .set({ bulkSessionId: session.id })
        .where(
          and(
            eq(applicationsTable.userId, req.user.id),
            inArray(applicationsTable.id, applicationIds)
          )
        );
    }

    res.status(201).json({ sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "Failed to create bulk session");
    res.status(500).json({ error: "Failed to create session", code: "DB_ERROR" });
  }
});

// ─── GET /bulk-sessions ───────────────────────────────────────────────────────
// Lists all bulk sessions for the user, with aggregated stats.

router.get("/bulk-sessions", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const sessions = await db
      .select({
        id: bulkSessionsTable.id,
        jobTitle: bulkSessionsTable.jobTitle,
        company: bulkSessionsTable.company,
        createdAt: bulkSessionsTable.createdAt,
        cvCount: count(applicationsTable.id),
        topScore: max(applicationsTable.keywordMatchScore),
        avgScore: avg(applicationsTable.keywordMatchScore),
      })
      .from(bulkSessionsTable)
      .leftJoin(
        applicationsTable,
        eq(applicationsTable.bulkSessionId, bulkSessionsTable.id)
      )
      .where(eq(bulkSessionsTable.userId, req.user.id))
      .groupBy(bulkSessionsTable.id)
      .having(sql`count(${applicationsTable.id}) > 0`)
      .orderBy(desc(bulkSessionsTable.createdAt));

    res.json(sessions);
  } catch (err) {
    logger.error({ err }, "Failed to list bulk sessions");
    res.status(500).json({ error: "Failed to list sessions", code: "DB_ERROR" });
  }
});

// ─── GET /bulk-sessions/:id ───────────────────────────────────────────────────
// Returns a single session with its full ranked applications list.

router.get("/bulk-sessions/:id", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const { id } = req.params;

  try {
    const [session] = await db
      .select()
      .from(bulkSessionsTable)
      .where(and(eq(bulkSessionsTable.id, id), eq(bulkSessionsTable.userId, req.user.id)));

    if (!session) {
      res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
      return;
    }

    const applications = await db
      .select({
        id: applicationsTable.id,
        keywordMatchScore: applicationsTable.keywordMatchScore,
        parsedCvJson: applicationsTable.parsedCvJson,
        matchedKeywords: applicationsTable.matchedKeywords,
        missingKeywords: applicationsTable.missingKeywords,
        status: applicationsTable.status,
        createdAt: applicationsTable.createdAt,
      })
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.bulkSessionId, id),
          eq(applicationsTable.userId, req.user.id)
        )
      )
      .orderBy(desc(applicationsTable.keywordMatchScore));

    res.json({ session, applications });
  } catch (err) {
    logger.error({ err, id }, "Failed to get bulk session");
    res.status(500).json({ error: "Failed to load session", code: "DB_ERROR" });
  }
});

// ─── DELETE /bulk-sessions/:id ────────────────────────────────────────────────
// Deletes a bulk session and all its linked application records.

router.delete("/bulk-sessions/:id", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const { id } = req.params;

  try {
    // Verify ownership
    const [session] = await db
      .select({ id: bulkSessionsTable.id })
      .from(bulkSessionsTable)
      .where(and(eq(bulkSessionsTable.id, id), eq(bulkSessionsTable.userId, req.user.id)));

    if (!session) {
      res.status(404).json({ error: "Session not found", code: "NOT_FOUND" });
      return;
    }

    // Delete all applications belonging to this session, then delete the session itself
    await db
      .delete(applicationsTable)
      .where(
        and(
          eq(applicationsTable.bulkSessionId, id),
          eq(applicationsTable.userId, req.user.id)
        )
      );

    await db
      .delete(bulkSessionsTable)
      .where(and(eq(bulkSessionsTable.id, id), eq(bulkSessionsTable.userId, req.user.id)));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to delete bulk session");
    res.status(500).json({ error: "Failed to delete session", code: "DB_ERROR" });
  }
});

export default router;
