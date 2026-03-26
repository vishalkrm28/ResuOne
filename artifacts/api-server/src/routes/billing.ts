import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { z } from "zod";
import { getStripe } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";

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
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_ERROR" });
  }
});

export default router;
