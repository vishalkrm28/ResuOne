import { logger } from "./logger.js";

export interface EnvCheckResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
  billingConfigured: boolean;
}

// ── Required — server won't start without these ───────────────────────────────
const REQUIRED_VARS = ["PORT", "DATABASE_URL", "REPL_ID"] as const;

// ── Billing — all must be set together, or none ──────────────────────────────
const BILLING_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PARSEPILOT_PRO",
  "STRIPE_PRICE_PARSEPILOT_SINGLE_UNLOCK",
  "STRIPE_PRICE_PARSEPILOT_BULK_10",
  "STRIPE_PRICE_PARSEPILOT_BULK_25",
  "STRIPE_PRICE_PARSEPILOT_BULK_50",
] as const;

// ── Optional — warn if missing, but don't block startup ──────────────────────
const OPTIONAL_VARS: { name: string; hint: string }[] = [
  {
    name: "AI_INTEGRATIONS_OPENAI_API_KEY",
    hint: "AI CV analysis will fail without the OpenAI integration. Add it via the Integrations panel.",
  },
  {
    name: "ISSUER_URL",
    hint: "Defaulting to https://replit.com/oidc — only override in non-Replit environments.",
  },
  {
    name: "STRIPE_CUSTOMER_PORTAL_RETURN_URL",
    hint: "Billing portal will fall back to the request's Origin header.",
  },
];

/**
 * Validates environment variables at server startup.
 *
 * - Logs actionable errors for every missing required variable.
 * - Warns about partial billing config (some STRIPE_* vars set, not all).
 * - Warns about missing optional variables with a hint on the impact.
 * - Returns a result object; does NOT throw — `index.ts` decides whether to exit.
 */
export function validateEnv(): EnvCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // ── Required ──────────────────────────────────────────────────────────────
  for (const name of REQUIRED_VARS) {
    if (!process.env[name]) {
      missing.push(name);
      logger.error(`  ✗ ${name} — required but not set`);
    }
  }

  // ── Billing ───────────────────────────────────────────────────────────────
  const presentBilling = BILLING_VARS.filter((name) => !!process.env[name]);
  const missingBilling = BILLING_VARS.filter((name) => !process.env[name]);
  const billingConfigured = missingBilling.length === 0;

  if (presentBilling.length > 0 && !billingConfigured) {
    // Partial config — likely a copy-paste mistake
    const msg =
      `Partial Stripe config detected — missing: ${missingBilling.join(", ")}. ` +
      "Set ALL three STRIPE_* billing vars to enable billing, or clear all to disable it.";
    warnings.push(msg);
    logger.warn(msg);
  }

  if (!billingConfigured && missingBilling.length === BILLING_VARS.length) {
    // All billing vars absent — billing intentionally disabled
    logger.info("Billing is disabled (no STRIPE_* env vars set). Billing routes will return 503.");
  }

  // ── Optional ──────────────────────────────────────────────────────────────
  for (const { name, hint } of OPTIONAL_VARS) {
    // Skip ISSUER_URL warning (has a safe default) unless truly absent in prod
    if (name === "ISSUER_URL") continue;
    if (!process.env[name]) {
      const msg = `${name} is not set — ${hint}`;
      warnings.push(msg);
      logger.warn(msg);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (missing.length === 0) {
    logger.info(
      {
        billingEnabled: billingConfigured,
        aiEnabled: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV ?? "development",
      },
      "Environment validated successfully",
    );
  } else {
    logger.error(
      { missing },
      `Environment validation failed: ${missing.length} required variable(s) missing`,
    );
  }

  return { valid: missing.length === 0, missing, warnings, billingConfigured };
}
