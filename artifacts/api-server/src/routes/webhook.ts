import { Router, type IRouter } from "express";
import express from "express";
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db, usersTable, unlockPurchasesTable, bulkPassesTable, recruiterTeamInvitesTable } from "@workspace/db";
import { getStripe } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";
import { resetProCreditsIfNeeded, resetRecruiterCreditsIfNeeded, resetJobRecCreditsIfNeeded, grantJobRecCredits, JOB_REC_CREDITS_PER_PURCHASE } from "../lib/credits.js";
import { isValidTier, BULK_TIERS } from "../lib/bulk.js";

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

    // Fired when an async payment method (bank transfer, SEPA, etc.) settles.
    // For card payments this typically fires alongside checkout.session.completed,
    // so this handler is a safety net to activate unlocks that arrived with
    // payment_status != "paid" on the checkout event.
    case "payment_intent.succeeded":
      await safeHandle("payment_intent.succeeded", () =>
        onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent),
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
// Handles two purchase types:
//   subscription    → Pro activation (existing flow)
//   one_time_unlock → Per-result unlock purchase (new Milestone 17 flow)

async function onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // ── Dispatch by purchase type ──────────────────────────────────────────────
  if (session.metadata?.purchaseType === "one_time_unlock") {
    await onUnlockCheckoutCompleted(session);
    return;
  }

  if (session.metadata?.purchaseType === "bulk_pass") {
    await onBulkPassCheckoutCompleted(session);
    return;
  }

  // Recruiter add-on subscriptions — must be handled before the generic
  // subscription path so they write to recruiter fields, not Pro fields.
  if (session.metadata?.product === "recruiter") {
    await onRecruiterCheckoutCompleted(session);
    return;
  }

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

  // Route recruiter subscriptions to the correct offboarding path — never let
  // a recruiter deletion clobber the Pro subscription fields.
  if (subscription.metadata?.product === "recruiter") {
    await offboardRecruiterSubscription(user.id);
    logger.info({ userId: user.id, subscriptionId: subscription.id }, "Recruiter subscription deleted — offboarding complete");
    return;
  }

  // Pro subscription deletion
  await db
    .update(usersTable)
    .set({
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      // Keep stripeSubscriptionId and stripeCustomerId for audit trail
    })
    .where(eq(usersTable.id, user.id));

  logger.info(
    { userId: user.id, subscriptionId: subscription.id, status: subscription.status },
    "Pro subscription cancelled",
  );
}

// ─── Recruiter offboarding ─────────────────────────────────────────────────────
// Clears the owner's recruiter status, removes all team members from the team,
// and cancels any pending team invites. Safe to call from both the webhook and
// the cancel-recruiter billing endpoint.

async function offboardRecruiterSubscription(ownerId: string): Promise<void> {
  // 1. Clear the owner's recruiter plan status
  await db
    .update(usersTable)
    .set({ recruiterSubscriptionStatus: null })
    .where(eq(usersTable.id, ownerId));

  // 2. Detach all team members from this owner's team
  await db
    .update(usersTable)
    .set({ recruiterTeamId: null })
    .where(eq(usersTable.recruiterTeamId, ownerId));

  // 3. Cancel all pending team invites so new members can't join a dissolved team
  await db
    .update(recruiterTeamInvitesTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(recruiterTeamInvitesTable.teamOwnerId, ownerId),
        eq(recruiterTeamInvitesTable.status, "pending"),
      ),
    );

  logger.info({ ownerId }, "Recruiter offboarding complete — team cleared, invites cancelled");
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

// ─── one_time_unlock checkout ─────────────────────────────────────────────────
// Fired when a user completes a one-time $4 unlock payment.
// Creates (or idempotently updates) an UnlockPurchase row.
// This is the ONLY place that records a successful unlock — the success redirect
// page is cosmetic only and must never be trusted as the access gate.

async function onUnlockCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? null;
  const applicationId = session.metadata?.applicationId ?? null;

  if (!userId || !applicationId) {
    logger.error(
      { session_id: session.id, metadata: session.metadata },
      "one_time_unlock webhook: missing userId or applicationId in metadata — unlock NOT recorded",
    );
    return;
  }

  // Resolve payment intent ID (may be a string or expanded object)
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  const amountTotal = session.amount_total ?? null;
  const currency = session.currency ?? null;
  const paymentStatus = session.payment_status ?? "unpaid";

  // Upsert by stripeCheckoutSessionId — idempotent on duplicate webhook fires
  await db
    .insert(unlockPurchasesTable)
    .values({
      userId,
      applicationId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountPaid: amountTotal,
      currency,
      status: paymentStatus,
    })
    .onConflictDoUpdate({
      target: unlockPurchasesTable.stripeCheckoutSessionId,
      set: {
        stripePaymentIntentId: paymentIntentId,
        amountPaid: amountTotal,
        currency,
        status: paymentStatus,
        updatedAt: new Date(),
      },
    });

  logger.info(
    { userId, applicationId, sessionId: session.id, amountTotal, paymentStatus },
    "One-time unlock purchase recorded",
  );

  if (paymentStatus === "paid") {
    await grantJobRecCredits(userId, JOB_REC_CREDITS_PER_PURCHASE);
    logger.info({ userId }, `${JOB_REC_CREDITS_PER_PURCHASE} job recommendation credits granted for unlock purchase`);
  }
}

// ─── bulk_pass checkout ───────────────────────────────────────────────────────
// Fired when a user completes a bulk tier payment.
// Activates the bulk pass by setting status → "paid".

async function onBulkPassCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? null;
  const tier = session.metadata?.tier ?? null;
  const cvLimitStr = session.metadata?.cvLimit ?? null;

  if (!userId || !tier || !cvLimitStr) {
    logger.error(
      { session_id: session.id, metadata: session.metadata },
      "bulk_pass webhook: missing metadata — pass NOT activated",
    );
    return;
  }

  if (!isValidTier(tier)) {
    logger.error({ tier, session_id: session.id }, "bulk_pass webhook: invalid tier");
    return;
  }

  const cvLimit = BULK_TIERS[tier].cvLimit;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  await db
    .insert(bulkPassesTable)
    .values({
      userId,
      tier,
      cvLimit,
      cvsUsed: 0,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountPaid: session.amount_total ?? null,
      currency: session.currency ?? null,
      status: session.payment_status === "paid" ? "paid" : "pending",
    })
    .onConflictDoUpdate({
      target: bulkPassesTable.stripeCheckoutSessionId,
      set: {
        stripePaymentIntentId: paymentIntentId,
        amountPaid: session.amount_total ?? null,
        currency: session.currency ?? null,
        status: session.payment_status === "paid" ? "paid" : "pending",
        updatedAt: new Date(),
      },
    });

  logger.info(
    { userId, tier, cvLimit, sessionId: session.id, paymentStatus: session.payment_status },
    "Bulk pass activated",
  );
}

// ─── payment_intent.succeeded ─────────────────────────────────────────────────
// Activates unlock purchases that were inserted with status != "paid".
// This covers async payment methods (BACS, SEPA, etc.) where
// checkout.session.completed fires before the payment actually settles.
// We look up the row by stripePaymentIntentId and promote it to status "paid".
// This is a no-op for card payments (already "paid" from checkout event).

async function onPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Only act if a pending unlock row exists for this payment intent
  const [existing] = await db
    .select({ id: unlockPurchasesTable.id, status: unlockPurchasesTable.status })
    .from(unlockPurchasesTable)
    .where(eq(unlockPurchasesTable.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (!existing) {
    // Not an unlock payment — nothing to do (subscriptions handled elsewhere)
    logger.debug({ paymentIntentId: paymentIntent.id }, "payment_intent.succeeded: no unlock row found — ignored");
    return;
  }

  if (existing.status === "paid") {
    // Already activated — idempotent, nothing to update
    logger.debug({ paymentIntentId: paymentIntent.id }, "payment_intent.succeeded: unlock already paid — skipped");
    return;
  }

  await db
    .update(unlockPurchasesTable)
    .set({ status: "paid", updatedAt: new Date() })
    .where(eq(unlockPurchasesTable.id, existing.id));

  logger.info(
    { paymentIntentId: paymentIntent.id, unlockId: existing.id },
    "One-time unlock activated via payment_intent.succeeded (async payment settlement)",
  );
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
  // Route recruiter subscriptions to separate fields so they never clobber Pro.
  if (subscription.metadata?.product === "recruiter") {
    await applyRecruiterSubscription(userId, subscription);
    return;
  }

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

  // Reset Pro credits when the user is active or trialing.
  if (subscription.status === "active" || subscription.status === "trialing") {
    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : new Date();
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date();

    await resetProCreditsIfNeeded(userId, periodStart, periodEnd);
    await resetJobRecCreditsIfNeeded(userId, periodStart, periodEnd);
  }
}

// ─── Recruiter subscription helper ────────────────────────────────────────────
// Writes only the recruiter-specific columns — never touches Pro subscription fields.

async function applyRecruiterSubscription(userId: string, subscription: Stripe.Subscription): Promise<void> {
  const plan = (subscription.metadata?.plan ?? "solo") as "solo" | "team";
  const isActive = subscription.status === "active" || subscription.status === "trialing";
  await db
    .update(usersTable)
    .set({
      recruiterSubscriptionId: subscription.id,
      recruiterSubscriptionStatus: isActive ? plan : null,
    })
    .where(eq(usersTable.id, userId));

  // Grant/renew monthly CV tokens when the subscription is active or trialing.
  // 100 tokens for Solo, 400 for Team — reset each billing period.
  if (isActive) {
    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : new Date();
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date();
    await resetRecruiterCreditsIfNeeded(userId, plan, periodStart, periodEnd);
  }

  logger.info({ userId, plan, status: subscription.status }, "Recruiter subscription applied");
}

// ─── Recruiter checkout.session.completed ─────────────────────────────────────

async function onRecruiterCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? null;
  const plan = (session.metadata?.plan ?? "solo") as "solo" | "team";
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null;

  const user = await resolveUser({ userId, customerId });
  if (!user) {
    logger.error({ userId, customerId, session_id: session.id }, "recruiter checkout: could not resolve user");
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  await db
    .update(usersTable)
    .set({
      recruiterSubscriptionId: subscriptionId,
      recruiterSubscriptionStatus: plan,
    })
    .where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id, plan, subscriptionId }, "Recruiter subscription activated via checkout");
}

export default router;
