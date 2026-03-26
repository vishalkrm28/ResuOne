import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { z } from "zod";
import type Stripe from "stripe";
import { getStripe } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";
import { getUserCredits, FREE_CREDIT_ALLOWANCE, PRO_CREDIT_ALLOWANCE } from "../lib/credits.js";
import { subscriptionIsActive } from "../lib/billing.js";

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

    // Load current Stripe customer ID from DB
    const [dbUser] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!dbUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    // Create Stripe customer on first checkout, then persist the ID
    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, userId));
    }

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
        // 7-day free trial — Stripe sets status to "trialing" until trial_end.
        // Access is granted by the webhook when status becomes "trialing" or "active";
        // it is NEVER granted from this redirect URL.
        trial_period_days: 7,
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
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const isPro =
      (dbUser.subscriptionStatus === "active" || dbUser.subscriptionStatus === "trialing") &&
      (!dbUser.currentPeriodEnd || dbUser.currentPeriodEnd > new Date());

    res.json({
      isPro,
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

export default router;
