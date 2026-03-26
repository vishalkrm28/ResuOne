# ParsePilot AI — Setup Guide

This guide walks you through getting ParsePilot AI running from scratch, including all third-party services.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 or 22 | Managed by Replit automatically |
| pnpm | 9+ | Run `npm install -g pnpm` if needed |
| PostgreSQL | 14+ | Provisioned automatically by Replit |

---

## 1 — Clone and install

```bash
git clone <your-repo-url>
cd workspace
pnpm install
```

---

## 2 — Environment variables

All secrets are stored in Replit's Secrets panel (or a `.env` file locally).
**Never commit secrets to version control.**

### Required

| Variable | Where to find it | Notes |
|----------|-----------------|-------|
| `PORT` | Set automatically by Replit | Do not set manually |
| `DATABASE_URL` | Replit PostgreSQL panel | Auto-provisioned on Replit |
| `REPL_ID` | Set automatically by Replit | Used by OIDC auth |

### AI (required for CV analysis)

| Variable | Where to find it |
|----------|-----------------|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) — or use the Replit OpenAI integration |

### Stripe Billing (required for Pro subscriptions)

| Variable | Where to find it |
|----------|-----------------|
| `STRIPE_SECRET_KEY` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Created in step 4 below |
| `STRIPE_PRICE_PARSEPILOT_PRO` | Created in step 3 below |

### Optional

| Variable | Default | Notes |
|----------|---------|-------|
| `STRIPE_CUSTOMER_PORTAL_RETURN_URL` | `<origin>/settings` | Override if your domain is fixed |
| `ISSUER_URL` | `https://replit.com/oidc` | Override only in non-Replit environments |
| `LOG_LEVEL` | `info` | Use `debug` for verbose output |

---

## 3 — Create the Stripe product and price

> **Skip this section** if you don't need billing (free-tier-only mode).

1. Log in to the [Stripe Dashboard](https://dashboard.stripe.com).
2. Go to **Products** → **Add product**.
3. Name it **ParsePilot Pro**.
4. Add a **Recurring price** (e.g. $12/month).
5. Click the price row to copy the **Price ID** (`price_xxxxxxxx…`).
6. Set `STRIPE_PRICE_PARSEPILOT_PRO=price_xxxxxxxx` in your secrets.

Use **Test mode** while developing — prefix secret keys are `sk_test_…`.

---

## 4 — Set up the Stripe webhook

Stripe sends billing events (subscription activated, payment failed, etc.) to your server. The webhook handler is at `POST /api/stripe/webhook`.

### Option A — Replit / cloud deployment (recommended)

1. In the Stripe Dashboard, go to **Developers → Webhooks** → **Add endpoint**.
2. Set the **Endpoint URL** to:
   ```
   https://<your-app>.replit.app/api/stripe/webhook
   ```
3. Select these events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Click **Add endpoint**, then reveal and copy the **Signing secret** (`whsec_…`).
5. Set `STRIPE_WEBHOOK_SECRET=whsec_…` in your secrets.

### Option B — Local development (Stripe CLI)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

The CLI prints a webhook signing secret — set it as `STRIPE_WEBHOOK_SECRET`.

---

## 5 — Database setup

The database schema is managed by Drizzle ORM. Push the schema to your database:

```bash
pnpm --filter @workspace/db run push
```

This is safe to run multiple times (idempotent).

---

## 6 — Run locally

Start both services in separate terminal tabs:

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port auto-assigned)
pnpm --filter @workspace/parse-pilot run dev
```

Or use Replit's built-in workflow runner — both workflows start automatically.

---

## 7 — Deploy to production

1. Click **Deploy** in the Replit toolbar (or use `suggest_deploy`).
2. Set all production secrets (use live Stripe keys `sk_live_…`, not test keys).
3. Update the Stripe webhook endpoint URL to your `.replit.app` domain.
4. Replit automatically handles TLS, health checks, and zero-downtime deploys.

---

## Architecture overview

```
artifacts/
├── api-server/           Express API (port $PORT)
│   └── src/
│       ├── lib/          stripe.ts, billing.ts, auth.ts, env.ts, logger.ts
│       ├── middlewares/  authMiddleware.ts, requirePro.ts
│       └── routes/       applications.ts, upload.ts, export.ts, billing.ts, webhook.ts
└── parse-pilot/          React + Vite frontend
    └── src/
        ├── pages/        landing, dashboard, new-application, application-detail, settings
        ├── components/   billing/ (ProGate, UpgradeButton, SubscriptionCard)
        └── hooks/        use-billing-status.ts, use-toast.ts
lib/
├── db/                   Drizzle ORM schema + client
├── api-spec/             OpenAPI spec (source of truth for API types)
└── api-client-react/     Generated React Query hooks (from OpenAPI)
```

---

## Free vs Pro tiers

| Feature | Free | Pro |
|---------|------|-----|
| Upload & parse CV | ✓ | ✓ |
| ATS keyword analysis | ✓ | ✓ |
| 1 saved application | ✓ | — |
| Unlimited applications | — | ✓ |
| AI-tailored CV output | — | ✓ |
| Missing info questions | — | ✓ |
| Section suggestions | — | ✓ |
| Cover letter generation | — | ✓ |
| DOCX export | — | ✓ |
| PDF export | — | ✓ |

---

## Troubleshooting

### Server won't start
Check the startup logs — the env validator logs exactly which variables are missing.

### Webhook signature fails
- Ensure `STRIPE_WEBHOOK_SECRET` matches the signing secret shown in the Stripe Dashboard for that endpoint.
- If using the Stripe CLI locally, restart it — the secret rotates on reconnect.
- The webhook route **must** receive the raw request body — do not add body-parsing middleware before it.

### Billing routes return 503
`STRIPE_PRICE_PARSEPILOT_PRO` is not set. Create a price in the Stripe Dashboard (step 3) and add the price ID to your secrets.

### Checkout redirect doesn't activate Pro
1. Confirm the webhook endpoint is registered and receiving events.
2. Check server logs for `checkout.session.completed` — it should log `"Pro subscription activated via checkout"`.
3. In Stripe Dashboard → Events, find the event and use "Resend" to replay it.

### isUserPro returns false despite active subscription
- The webhook may not have fired — replay `customer.subscription.updated` from the Stripe Dashboard.
- Check that `currentPeriodEnd` in the DB is in the future.
- If using test mode, make sure `STRIPE_SECRET_KEY` is a test key (`sk_test_…`).
