import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Returns the Stripe client, initialised lazily so the server can boot
 * without STRIPE_SECRET_KEY set (e.g. when billing routes are not enabled).
 * Throws only at the point where a billing operation is actually attempted.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. " +
        "Add it to your environment secrets before using billing features.",
    );
  }

  _stripe = new Stripe(key, {
    apiVersion: "2025-03-31.basil",
    typescript: true,
  });

  return _stripe;
}
