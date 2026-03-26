import { Router, type IRouter } from "express";
import express from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getStripe } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Stripe requires the exact raw bytes of the request body to verify the
// HMAC-SHA256 signature. This route uses express.raw() instead of express.json(),
// and MUST be mounted in app.ts BEFORE the global express.json() middleware.

router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      logger.error("STRIPE_WEBHOOK_SECRET is not configured — webhook ignored");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      logger.warn("Stripe webhook received without stripe-signature header");
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    // ── Signature verification ──────────────────────────────────────────────
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ msg }, "Stripe webhook signature verification failed — possible replay attack or misconfigured secret");
      res.status(400).json({ error: `Webhook signature invalid: ${msg}` });
      return;
    }

    logger.info({ type: event.type, id: event.id, apiVersion: event.api_version }, "Stripe webhook received");

    // ── Acknowledge immediately, then process ──────────────────────────────
    // Stripe expects a 2xx within 30 s. We respond first then process so
    // slow DB writes don't cause spurious retries — errors are logged.
    res.json({ received: true });

    // ── Event dispatch ─────────────────────────────────────────────────────
    // Each handler is wrapped so a bug in one handler can't crash others.
    try {
      await handleEvent(event);
    } catch (err) {
      // We already responded 200 to Stripe, so log only.
      logger.error(
        { err, type: event.type, eventId: event.id },
        "Webhook handler threw an unhandled error — event may need manual replay",
      );
    }
  },
);

// ─── Event dispatch ────────────────────────────────────────────────────────────

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await safeHandle("checkout.session.completed", () =>
        onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session),
      );
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await safeHandle(event.type, () =>
        onSubscriptionUpserted(event.data.object as Stripe.Subscription),
      );
      break;

    case "customer.subscription.deleted":
      await safeHandle("customer.subscription.deleted", () =>
        onSubscriptionDeleted(event.data.object as Stripe.Subscription),
      );
      break;

    case "invoice.paid":
    case "invoice.payment_succeeded":
      await safeHandle(event.type, () =>
        onInvoicePaid(event.data.object as Stripe.Invoice),
      );
      break;

    case "invoice.payment_failed":
      await safeHandle("invoice.payment_failed", () =>
        onInvoicePaymentFailed(event.data.object as Stripe.Invoice),
      );
      break;

    default:
      logger.debug({ type: event.type }, "Unhandled Stripe event type — ignored");
  }
}

/**
 * Wraps a handler so any thrown error is logged with context but does not
 * propagate upward (preventing one bad handler from crashing everything).
 */
async function safeHandle(eventType: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error({ err, eventType }, `Webhook handler '${eventType}' failed`);
  }
}

// ─── checkout.session.completed ───────────────────────────────────────────────
// Fired when the user completes the Stripe Checkout form and payment is confirmed.
// We retrieve the full Subscription object from Stripe so we have accurate
// status, period end, and price info before writing to the DB.

async function onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription") {
    logger.debug({ session_id: session.id }, "Ignoring non-subscription checkout session");
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  if (!subscriptionId) {
    logger.error({ session_id: session.id }, "checkout.session.completed missing subscription ID — cannot activate Pro");
    return;
  }

  // Retrieve the full subscription to get status, period, and price details
  let subscription: Stripe.Subscription;
  try {
    subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  } catch (err) {
    logger.error({ err, subscriptionId }, "Failed to retrieve subscription from Stripe");
    return;
  }

  // Resolve the user — prefer metadata.userId set during checkout creation
  const userId = session.metadata?.userId ?? subscription.metadata?.userId ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null;

  const user = await resolveUser({ userId, customerId });
  if (!user) {
    logger.error(
      { userId, customerId, session_id: session.id },
      "checkout.session.completed: could not resolve user — Pro not activated",
    );
    return;
  }

  await applySubscription(user.id, subscription);
  logger.info(
    { userId: user.id, subscriptionId, status: subscription.status },
    "Pro subscription activated via checkout",
  );
}

// ─── customer.subscription.created / updated ──────────────────────────────────
// Fired on any subscription change: plan switch, renewal, trial end, pause, etc.
// Always overwrite all fields — Stripe is the source of truth.

async function onSubscriptionUpserted(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId ?? null;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer as Stripe.Customer | Stripe.DeletedCustomer).id;

  if (!customerId) {
    logger.error({ subscriptionId: subscription.id }, "Subscription event missing customer ID");
    return;
  }

  const user = await resolveUser({ userId, customerId });
  if (!user) {
    logger.error(
      { userId, customerId, subscriptionId: subscription.id },
      "Subscription upsert: could not resolve user",
    );
    return;
  }

  await applySubscription(user.id, subscription);
  logger.info(
    { userId: user.id, subscriptionId: subscription.id, status: subscription.status },
    "Subscription upserted",
  );
}

// ─── customer.subscription.deleted ────────────────────────────────────────────
// Fired when a subscription is fully cancelled (not just paused).
// We keep the IDs in the DB for audit purposes but clear the active status.

async function onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId ?? null;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer as Stripe.Customer | Stripe.DeletedCustomer).id;

  if (!customerId) {
    logger.error({ subscriptionId: subscription.id }, "Subscription deleted event missing customer ID");
    return;
  }

  const user = await resolveUser({ userId, customerId });
  if (!user) {
    logger.error(
      { userId, customerId },
      "customer.subscription.deleted: could not resolve user",
    );
    return;
  }

  await db
    .update(usersTable)
    .set({
      // Use the event's actual status (always "canceled" for deleted events, but be explicit)
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      // Keep stripeSubscriptionId and stripeCustomerId for audit trail
    })
    .where(eq(usersTable.id, user.id));

  logger.info(
    { userId: user.id, subscriptionId: subscription.id, status: subscription.status },
    "Subscription cancelled",
  );
}

// ─── invoice.paid / invoice.payment_succeeded ─────────────────────────────────
// Fired every time a payment succeeds (initial + renewals).
// We refresh the subscription to keep period_end accurate after auto-renewal.

async function onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;

  if (!subscriptionId) {
    // One-time invoice, not a subscription — nothing to do
    logger.debug({ invoice_id: invoice.id }, "invoice.paid: no subscription — ignored");
    return;
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  } catch (err) {
    logger.error({ err, subscriptionId }, "invoice.paid: failed to retrieve subscription");
    return;
  }

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null;

  const userId = subscription.metadata?.userId ?? null;
  const user = await resolveUser({ userId, customerId });

  if (!user) {
    logger.warn(
      { customerId, subscriptionId },
      "invoice.paid: could not resolve user — subscription period not refreshed",
    );
    return;
  }

  await applySubscription(user.id, subscription);
  logger.info(
    {
      userId: user.id,
      subscriptionId,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    },
    "Subscription renewed (invoice paid)",
  );
}

// ─── invoice.payment_failed ────────────────────────────────────────────────────
// Fired when Stripe cannot charge the customer (card declined, insufficient funds, etc.).
// Stripe will retry automatically; we log the event for ops visibility.
// We do NOT downgrade the user here — Stripe's subscription status will change
// to "past_due" or "unpaid", and we'll pick that up via customer.subscription.updated.

async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null;

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;

  const attemptCount = invoice.attempt_count ?? 1;
  const nextAttempt = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000).toISOString()
    : null;

  logger.warn(
    {
      invoice_id: invoice.id,
      customerId,
      subscriptionId,
      attemptCount,
      nextAttempt,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
    },
    `Payment failed (attempt ${attemptCount})${nextAttempt ? ` — next retry: ${nextAttempt}` : " — no further retries"}`,
  );

  // If this is the final retry, subscription status will go to "unpaid" or "canceled"
  // via customer.subscription.updated — no manual action needed here.
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface UserResolutionParams {
  userId: string | null;
  customerId: string | null;
}

/** Find the DB user by userId metadata first, then fall back to stripeCustomerId. */
async function resolveUser(params: UserResolutionParams): Promise<{ id: string } | null> {
  if (params.userId) {
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, params.userId))
      .limit(1);
    if (row) return row;
    // userId in metadata didn't match — fall through to customerId lookup
    logger.warn(
      { userId: params.userId },
      "resolveUser: metadata userId not found in DB — trying stripeCustomerId fallback",
    );
  }

  if (params.customerId) {
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, params.customerId))
      .limit(1);
    if (row) return row;
  }

  return null;
}

/** Write all subscription fields to the DB from a Stripe Subscription object. */
async function applySubscription(userId: string, subscription: Stripe.Subscription): Promise<void> {
  // Defensive: use first item's price if present
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

  if (!priceId) {
    logger.warn({ userId, subscriptionId: subscription.id }, "applySubscription: no price ID found on subscription items");
  }

  await db
    .update(usersTable)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPriceId: priceId,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    })
    .where(eq(usersTable.id, userId));
}

export default router;
