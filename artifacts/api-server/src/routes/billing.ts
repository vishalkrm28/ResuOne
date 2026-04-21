import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, applicationsTable, plansTable, featureEntitlementsTable, usageEventsTable } from "@workspace/db";
import { z } from "zod";
import type Stripe from "stripe";
import { getStripe, ensureStripeCustomer } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";
import { getUserCredits, FREE_CREDIT_ALLOWANCE, PRO_CREDIT_ALLOWANCE } from "../lib/credits.js";
import { subscriptionIsActive, recruiterStatusIsActive, hasUnlockedResult } from "../lib/billing.js";
import { hasBulkAccess } from "../lib/bulk.js";
import { checkEntitlementForUser, getCreditCostForFeature, resolvePlanCodeForUser } from "../lib/billing/entitlements.js";

/**
 * Extract a structured log context from a Stripe SDK error so we get
 * the Stripe error type, code, and decline code alongside the message.
 */
function stripeErrContext(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object" && "type" in err) {
    const e = err as Stripe.errors.StripeError;
    return {
      stripeType: e.type,
      stripeCode: e.code ?? null,
      stripeMessage: e.message,
      stripeStatus: e.statusCode ?? null,
      declineCode: (e as Stripe.errors.StripeCardError).decline_code ?? null,
    };
  }
  return { err };
}

const router: IRouter = Router();

const CheckoutBody = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ─── POST /billing/checkout ───────────────────────────────────────────────────
// Creates (or reuses) a Stripe customer for the authenticated user, then
// starts a Checkout session for the Pro subscription.
// Pro access is NOT granted here — that happens via the webhook in Milestone 7.

router.post("/billing/checkout", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "successUrl and cancelUrl (absolute URLs) are required", code: "VALIDATION_ERROR" });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_PARSEPILOT_PRO;
  if (!priceId) {
    logger.error("STRIPE_PRICE_PARSEPILOT_PRO is not configured");
    res.status(503).json({ error: "Billing is not configured yet", code: "BILLING_NOT_CONFIGURED" });
    return;
  }

  try {
    const stripe = getStripe();
    const userId = req.user.id;

    const customerId = await ensureStripeCustomer(userId, req.user.email ?? null);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      // Append Stripe's session ID so the success page can retrieve it later
      success_url: `${parsed.data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: parsed.data.cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId },
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    res.json({ url: session.url });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_ERROR" });
  }
});

// ─── GET /billing/status ──────────────────────────────────────────────────────
// Returns the authenticated user's subscription info for the settings UI.

router.get("/billing/status", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const [dbUser] = await db
      .select({
        stripeCustomerId: usersTable.stripeCustomerId,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        subscriptionStatus: usersTable.subscriptionStatus,
        subscriptionPriceId: usersTable.subscriptionPriceId,
        currentPeriodEnd: usersTable.currentPeriodEnd,
        recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    // Trust Stripe's subscriptionStatus as the source of truth.
    // Stripe only marks a subscription "active" when payment has succeeded.
    // We do NOT apply a date guard here because a delayed webhook after a
    // successful Stripe renewal would incorrectly strip Pro access.
    const isPro = subscriptionIsActive(dbUser.subscriptionStatus);
    const isRecruiter = recruiterStatusIsActive(dbUser.recruiterSubscriptionStatus);
    const planCode = await resolvePlanCodeForUser(req.user.id);

    const bulkAccess = await hasBulkAccess(req.user.id);

    res.json({
      isPro,
      isRecruiter,
      planCode,
      hasBulkAccess: bulkAccess,
      subscriptionStatus: dbUser.subscriptionStatus ?? null,
      subscriptionPriceId: dbUser.subscriptionPriceId ?? null,
      currentPeriodEnd: dbUser.currentPeriodEnd?.toISOString() ?? null,
      hasCustomer: !!dbUser.stripeCustomerId,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch billing status");
    // Don't expose DB errors to the client; return a safe degraded response
    res.status(500).json({ error: "Could not load billing status", code: "DB_ERROR" });
  }
});

// ─── GET /billing/credits ─────────────────────────────────────────────────────
// Returns the authenticated user's credit balance and plan allowance.

router.get("/billing/credits", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const [dbUser] = await db
      .select({ subscriptionStatus: usersTable.subscriptionStatus })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    const isPro = subscriptionIsActive(dbUser?.subscriptionStatus ?? null);
    const balance = await getUserCredits(req.user.id);

    res.json({
      availableCredits: balance?.availableCredits ?? 0,
      lifetimeCreditsUsed: balance?.lifetimeCreditsUsed ?? 0,
      billingPeriodEnd: balance?.billingPeriodEnd?.toISOString() ?? null,
      planAllowance: isPro ? PRO_CREDIT_ALLOWANCE : FREE_CREDIT_ALLOWANCE,
      isPro,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch credit balance");
    res.status(500).json({ error: "Could not load credit balance", code: "DB_ERROR" });
  }
});

// ─── POST /billing/unlock ─────────────────────────────────────────────────────
// Creates a one-time Stripe Checkout session (mode: "payment") so the user can
// unlock the full tailored CV + exports for a single specific result.
// Access is NEVER granted here — the webhook is the source of truth.

const UnlockBody = z.object({
  applicationId: z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post("/billing/unlock", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const parsed = UnlockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "applicationId, successUrl and cancelUrl are required", code: "VALIDATION_ERROR" });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_PARSEPILOT_SINGLE_UNLOCK;
  if (!priceId) {
    logger.error("STRIPE_PRICE_PARSEPILOT_SINGLE_UNLOCK is not configured");
    res.status(503).json({ error: "One-time unlock is not configured yet", code: "BILLING_NOT_CONFIGURED" });
    return;
  }

  const { applicationId, successUrl, cancelUrl } = parsed.data;
  const userId = req.user.id;

  try {
    const stripe = getStripe();

    // Verify the application exists and belongs to the requesting user
    const [app] = await db
      .select({ id: applicationsTable.id, userId: applicationsTable.userId })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId))
      .limit(1);

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    if (app.userId !== userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // ── Double-purchase guard ──────────────────────────────────────────────
    // Prevent charging the user a second time if the webhook has already
    // recorded a paid unlock for this result. Handles the race condition
    // where a webhook-delayed user clicks "Unlock" again on the success page.
    const alreadyUnlocked = await hasUnlockedResult(userId, applicationId);
    if (alreadyUnlocked) {
      res.status(409).json({
        error: "This result is already unlocked. Refresh the page to see your full resume.",
        code: "ALREADY_UNLOCKED",
      });
      return;
    }

    const customerId = await ensureStripeCustomer(userId, req.user?.email ?? null);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId,
        applicationId,
        purchaseType: "one_time_unlock",
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&application_id=${applicationId}`,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    res.json({ url: session.url });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to create Stripe unlock checkout session");
    res.status(500).json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_ERROR" });
  }
});

// ─── POST /billing/portal ─────────────────────────────────────────────────────
// Creates a Stripe Customer Portal session so the user can manage their
// subscription (cancel, change plan, update payment method, view invoices).

router.post("/billing/portal", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const [dbUser] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    if (!dbUser.stripeCustomerId) {
      res.status(400).json({
        error: "No billing account found. Upgrade to Pro first.",
        code: "NO_CUSTOMER",
      });
      return;
    }

    const returnUrl =
      process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL ??
      (req.headers.origin ? `${req.headers.origin}/settings` : "");

    if (!returnUrl) {
      logger.error("Could not determine portal return URL");
      res.status(500).json({ error: "Portal return URL not configured", code: "CONFIG_ERROR" });
      return;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to create Stripe portal session");
    res.status(500).json({ error: "Could not open billing portal. Please try again.", code: "PORTAL_ERROR" });
  }
});

// ─── POST /billing/cancel-subscription ───────────────────────────────────────
// Cancels the user's Pro subscription at period end (they keep access until
// the period they already paid for runs out).

router.post("/billing/cancel-subscription", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const [dbUser] = await db
      .select({
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        subscriptionStatus: usersTable.subscriptionStatus,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!dbUser?.stripeSubscriptionId) {
      res.status(400).json({ error: "No active subscription found.", code: "NO_SUBSCRIPTION" });
      return;
    }

    if (dbUser.subscriptionStatus === "canceled") {
      res.status(400).json({ error: "Subscription is already cancelled.", code: "ALREADY_CANCELED" });
      return;
    }

    // Cancel at period end — user keeps access until the period they paid for ends
    await getStripe().subscriptions.update(dbUser.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Reflect immediately in DB so UI updates without waiting for webhook
    await db
      .update(usersTable)
      .set({ subscriptionStatus: "canceled", updatedAt: new Date() })
      .where(eq(usersTable.id, req.user.id));

    logger.info({ userId: req.user.id, subscriptionId: dbUser.stripeSubscriptionId }, "Subscription cancelled at period end");
    res.json({ success: true, message: "Subscription cancelled. You'll retain Pro access until the end of your current billing period." });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to cancel subscription");
    res.status(500).json({ error: "Could not cancel subscription. Please try again.", code: "CANCEL_ERROR" });
  }
});

// ─── GET /billing/recruiter-detail ───────────────────────────────────────────
// Returns the authenticated user's recruiter subscription details (plan name,
// period end, cancel_at_period_end). Fetches live from Stripe so the data is
// always fresh.

router.get("/billing/recruiter-detail", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" }); return;
  }

  try {
    const [dbUser] = await db
      .select({
        recruiterSubscriptionId: usersTable.recruiterSubscriptionId,
        recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!dbUser?.recruiterSubscriptionId || !dbUser.recruiterSubscriptionStatus) {
      res.json({ active: false });
      return;
    }

    const sub = await getStripe().subscriptions.retrieve(dbUser.recruiterSubscriptionId);
    res.json({
      active: true,
      plan: dbUser.recruiterSubscriptionStatus as string, // "solo" | "team"
      periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to fetch recruiter subscription detail");
    res.status(500).json({ error: "Could not load recruiter plan details.", code: "FETCH_ERROR" });
  }
});

// ─── POST /billing/cancel-recruiter ──────────────────────────────────────────
// Cancels the recruiter plan at period end. The user keeps access until the
// period they've already paid for expires; the webhook clears the status
// and offboards team members once Stripe fires subscription.deleted.

router.post("/billing/cancel-recruiter", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" }); return;
  }

  try {
    const [dbUser] = await db
      .select({
        recruiterSubscriptionId: usersTable.recruiterSubscriptionId,
        recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!dbUser?.recruiterSubscriptionId) {
      res.status(400).json({ error: "No active recruiter subscription found.", code: "NO_SUBSCRIPTION" }); return;
    }
    if (!dbUser.recruiterSubscriptionStatus) {
      res.status(400).json({ error: "Recruiter plan is already cancelled.", code: "ALREADY_CANCELED" }); return;
    }

    // Fetch the subscription to check it isn't already set to cancel
    const sub = await getStripe().subscriptions.retrieve(dbUser.recruiterSubscriptionId);
    if (sub.cancel_at_period_end) {
      res.status(400).json({ error: "Recruiter plan is already scheduled for cancellation.", code: "ALREADY_CANCELING" }); return;
    }

    await getStripe().subscriptions.update(dbUser.recruiterSubscriptionId, {
      cancel_at_period_end: true,
    });

    logger.info({ userId: req.user.id, subscriptionId: dbUser.recruiterSubscriptionId }, "Recruiter plan cancellation scheduled at period end");
    res.json({
      success: true,
      cancelAtPeriodEnd: true,
      periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      message: "Your recruiter plan will cancel at the end of the current billing period. You'll keep full access until then.",
    });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to cancel recruiter subscription");
    res.status(500).json({ error: "Could not cancel recruiter plan. Please try again.", code: "CANCEL_ERROR" });
  }
});

// ─── POST /billing/checkout-recruiter ────────────────────────────────────────
router.post("/billing/checkout-recruiter", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" }); return;
  }

  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "successUrl and cancelUrl required", code: "VALIDATION_ERROR" }); return;
  }

  const { plan = "solo" } = req.body as { plan?: string };
  const priceId = plan === "team"
    ? process.env.STRIPE_PRICE_RECRUITER_TEAM
    : process.env.STRIPE_PRICE_RECRUITER_SOLO;

  if (!priceId) {
    logger.error({ plan }, "Recruiter Stripe price not configured");
    res.status(503).json({ error: "Recruiter billing not configured yet", code: "BILLING_NOT_CONFIGURED" }); return;
  }

  try {
    const stripe = getStripe();
    const userId = req.user.id;
    const customerId = await ensureStripeCustomer(userId, req.user.email ?? null);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, plan, product: "recruiter" },
      success_url: `${parsed.data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: parsed.data.cancelUrl,
      allow_promotion_codes: true,
      subscription_data: { metadata: { userId, plan, product: "recruiter" } },
    });

    if (!session.url) throw new Error("No checkout URL returned");
    res.json({ url: session.url });
  } catch (err) {
    logger.error(stripeErrContext(err), "Failed to create recruiter checkout session");
    res.status(500).json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_ERROR" });
  }
});

// ─── GET /billing/plans ───────────────────────────────────────────────────────
// Returns all active plans with their feature entitlements (no auth required).

router.get("/billing/plans", async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.isActive, true));

    const enriched = await Promise.all(
      plans.map(async (plan) => {
        const entitlements = await db
          .select({ featureKey: featureEntitlementsTable.featureKey, featureValue: featureEntitlementsTable.featureValue })
          .from(featureEntitlementsTable)
          .where(eq(featureEntitlementsTable.planId, plan.id));
        return { ...plan, entitlements };
      }),
    );

    res.json({ plans: enriched });
  } catch (err) {
    logger.error({ err }, "Failed to list plans");
    res.status(500).json({ error: "Could not load plans" });
  }
});

// ─── GET /billing/credit-balance ──────────────────────────────────────────────
// Richer credit balance including lifetime totals and recent transactions.

router.get("/billing/credit-balance", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const balance = await getUserCredits(req.user.id);
    const recentEvents = await db
      .select()
      .from(usageEventsTable)
      .where(eq(usageEventsTable.userId, req.user.id))
      .orderBy(desc(usageEventsTable.createdAt))
      .limit(20);

    res.json({
      balance: balance?.availableCredits ?? 0,
      jobRecCredits: balance?.jobRecCredits ?? 0,
      lifetimeAllocated: null,
      lifetimeUsed: balance?.lifetimeCreditsUsed ?? 0,
      billingPeriodEnd: balance?.billingPeriodEnd?.toISOString() ?? null,
      recentTransactions: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        creditsDelta: e.creditsDelta,
        createdAt: e.createdAt,
        metadata: e.metadata,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch credit balance");
    res.status(500).json({ error: "Could not load credit balance" });
  }
});

// ─── POST /billing/check-entitlement ─────────────────────────────────────────
// Check whether the authenticated user can access a given feature.

const CheckEntitlementBody = z.object({
  featureKey: z.string().min(1),
  workspaceId: z.string().optional(),
});

router.post("/billing/check-entitlement", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = CheckEntitlementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "featureKey is required" }); return; }

  try {
    const result = await checkEntitlementForUser(req.user.id, parsed.data.featureKey);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Entitlement check failed");
    res.status(500).json({ error: "Could not check entitlement" });
  }
});

export default router;
