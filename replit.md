# ParsePilot AI

## Overview

ParsePilot AI is a production-ready SaaS web app that helps users tailor their CVs to job descriptions using AI. Users upload their CV (PDF/DOCX), paste a job description, and get back an ATS-optimized CV, keyword analysis, missing info questions, and an optional cover letter — all without ever inventing fake experience.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/parse-pilot), Tailwind CSS, shadcn-inspired components
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in lib/api-spec)
- **AI**: OpenAI via Replit AI Integrations proxy (gpt-5.2)
- **Auth**: Replit Auth (OIDC) — `@workspace/replit-auth-web` on the frontend, `lib/auth.ts` + `authMiddleware.ts` on the server
- **File parsing**: mammoth (DOCX), pdfjs-dist (PDF)
- **File export**: docx (DOCX generation)
- **Build**: esbuild (CJS bundle for API server)

## Architecture

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/        # auth.ts (OIDC), logger.ts
│   │       ├── middlewares/ # authMiddleware.ts
│   │       ├── routes/     # health.ts, auth.ts, applications.ts, upload.ts, export.ts
│   │       └── services/   # ai.ts, fileParser.ts, exporter.ts
│   └── parse-pilot/        # React + Vite frontend (served at /)
│       └── src/
│           ├── pages/      # landing.tsx, dashboard.tsx, new-application.tsx, application-detail.tsx
│           ├── components/ # Button, Card, Badge, Input, Textarea, layout/
│           └── hooks/      # use-toast.ts
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── replit-auth-web/    # useAuth() hook for browser auth
│   ├── db/                 # Drizzle ORM schema + DB connection
│   │   └── src/schema/     # applications.ts, auth.ts (sessions, users)
│   └── integrations-openai-ai-server/  # Replit AI Integration client
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## Key Features

1. **Auth** - Replit OIDC login; landing page for unauthenticated users, dashboard for signed-in users
2. **CV Upload** - PDF and DOCX file upload with text extraction, or manual paste
3. **JD Parsing** - Job description parsed into structured JSON (`parseJobDescription()` via Responses API): required_skills, preferred_skills, key_responsibilities, must_have, nice_to_have, experience_years, job_type, location_type
4. **AI Analysis** - GPT-5.2 analyzes CV vs parsed JD (Responses API), returns ATS-optimized rewrite; fabrication strictly forbidden in prompts; `parsedJdJson` + `sectionSuggestions` saved to DB
5. **Keyword Match** - Shows match score %, matched/missing keywords as visual chips; score ring color-coded (green/amber/red)
6. **Section Suggestions** - 5th tab: AI structural suggestions based only on existing CV content
7. **Missing Info** - AI surfaces questions if key info is absent; user can answer and re-analyze with confirmed context
8. **Cover Letter** - AI generates tone-controlled cover letter (professional/enthusiastic/concise); editable + saveable
9. **Edit & Save** - Tailored CV and cover letter are fully editable with unsaved-changes indicator and Save/Discard buttons
10. **Export** - Download tailored CV or cover letter as DOCX
11. **Saved Applications** - All applications saved per authenticated user with status tracking

## Critical Rules (enforced in AI prompts)

- NEVER invent fake work experience, skills, tools, degrees, certifications, or achievements
- Only rewrite and reorganize based on information present in the source CV
- If information is missing, surface it as a question (Missing Info tab)
- Keep output ATS-friendly

## API Routes

### Auth
- `GET  /api/auth/user` — get current auth user (from session)
- `GET  /api/login` — start OIDC browser login flow
- `GET  /api/callback` — OIDC callback
- `GET  /api/logout` — clear session, OIDC logout

### Applications
- `GET  /api/applications?userId=xxx` — list applications
- `POST /api/applications` — create application
- `GET  /api/applications/:id` — get application
- `PUT  /api/applications/:id` — update application
- `DELETE /api/applications/:id` — delete application
- `POST /api/applications/:id/analyze` — AI CV analysis
- `POST /api/applications/:id/cover-letter` — AI cover letter generation
- `PATCH /api/applications/:id/tailored-cv` — save edited tailored CV text
- `PATCH /api/applications/:id/cover-letter-save` — save edited cover letter text
- `POST /api/upload-cv` — multipart file upload (PDF/DOCX/DOC/TXT, max 10MB) → extracts text AND parses structured JSON with AI (non-fatal; returns parsedCv: null on parse failure)
- `POST /api/parse-cv` — parse raw CV text into structured JSON using OpenAI Responses API (Zod-validated body: `{ rawText: string }`)
- `GET  /api/export/application/:id/docx` — download DOCX (CV or cover letter via `?type=cover`); marks status as "exported"
- `GET  /api/export/application/:id/pdf` — returns print-optimized HTML with auto-print trigger (CV or cover letter via `?type=cover`); use `?noprint` to suppress auto-print
- `GET  /api/healthz` — health check

## Database Schema (Drizzle/PostgreSQL)

### `applications` table
- `id` (uuid, PK)
- `userId` (text) — Replit user ID from auth session
- `jobTitle`, `company` (text)
- `jobDescription` (text)
- `originalCvText` (text)
- `parsedCvJson` (jsonb, nullable) — structured CV data from AI parse: `{ name, email, phone, location, summary, work_experience[], education[], skills[], certifications[], languages[] }`
- `tailoredCvText` (text, nullable)
- `coverLetterText` (text, nullable)
- `keywordMatchScore` (real, nullable)
- `missingKeywords`, `matchedKeywords`, `missingInfoQuestions` (jsonb arrays)
- `status` (enum: draft | analyzed | exported)
- `createdAt`, `updatedAt` (timestamptz)

### `sessions` table
- `id` (text, PK) — session token
- `userId` (text)
- `expiresAt` (timestamptz)
- `createdAt` (timestamptz)

### `users` table
- `id` (text, PK) — Replit user ID
- `email`, `firstName`, `lastName`, `profileImageUrl` (text, nullable)
- `createdAt`, `updatedAt` (timestamptz)

## Running Locally

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/parse-pilot run dev

# Push DB schema
pnpm --filter @workspace/db run push

# Run codegen after OpenAPI spec changes
pnpm --filter @workspace/api-spec run codegen
```

## AI Credits System (Milestone 12)

**Tables:** `usage_balances` (one row per user), `usage_events` (append-only audit trail)

**Central service:** `artifacts/api-server/src/lib/credits.ts`
- `initFreeCredits(userId)` — idempotent (ON CONFLICT DO NOTHING); called on every login; awards 3 free credits to new users only
- `resetProCreditsIfNeeded(userId, periodStart, periodEnd)` — idempotent (compares `billingPeriodStart`); seeds 100 Pro credits only when billing period changes; called from `applySubscription` in webhook
- `spendCredits(userId, amount, type)` — atomic (`UPDATE ... WHERE available_credits >= amount`); returns `{success, remaining}`; no race condition possible
- `canSpendCredits` / `getUserCredits` — read helpers

**Credit costs:** cv_optimization=1, cover_letter=1, docx_export=0, pdf_export=0

**API endpoint:** `GET /api/billing/credits` → `{availableCredits, lifetimeCreditsUsed, billingPeriodEnd, planAllowance, isPro}`

**Frontend:**
- `hooks/use-credits.ts` — fetches /api/billing/credits
- `components/billing/credits-badge.tsx` — compact inline badge in dashboard header
- `components/billing/credits-card.tsx` — full card in Settings → AI Credits section

**Gated routes:**
- `POST /applications/:id/analyze` → 1 credit; returns 402 `CREDITS_EXHAUSTED` if blocked
- `POST /applications/:id/cover-letter` → 1 credit; returns 402 `CREDITS_EXHAUSTED` if blocked

## Environment Validation

`artifacts/api-server/src/lib/env.ts` — `validateEnv()` runs before `app.listen()` in `index.ts`.
- Required vars: `PORT`, `DATABASE_URL`, `REPL_ID` — server exits with code 1 if missing
- Billing vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PARSEPILOT_PRO` — all three must be set together; partial config logs a clear warning
- Optional vars: `OPENAI_API_KEY`, `STRIPE_CUSTOMER_PORTAL_RETURN_URL` — missing values log actionable hints
- Startup log includes `billingEnabled` and `aiEnabled` flags

## Webhook Safety

`artifacts/api-server/src/routes/webhook.ts`:
- Responds `{ received: true }` immediately after signature verification (before processing), so slow DB writes don't cause Stripe retries
- Each event handler wrapped in `safeHandle()` — a bug in one handler can't crash others
- Handles: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- `invoice.payment_failed` logs attempt count and next retry time; status downgrade handled by `customer.subscription.updated` from Stripe's dunning system
- Defensive null-guards on all Stripe object fields throughout

## Feature Gating (Free vs Pro)

**Backend (source of truth)** — `artifacts/api-server/src/middlewares/requirePro.ts`:
- `requirePro` middleware calls `isUserPro(req.user.id)` → returns 403 `{code: "PRO_REQUIRED"}` for free users
- Gated routes:
  - `POST /api/applications` → free users limited to 1 application (checks count before insert)
  - `POST /api/applications/:id/cover-letter` → Pro only (`requirePro` middleware)
  - `GET /api/export/application/:id/docx` → Pro only
  - `GET /api/export/application/:id/pdf` → Pro only

**Frontend (UX)** — no duplicated logic, gates driven by `GET /api/billing/status`:
- `artifacts/parse-pilot/src/hooks/use-billing-status.ts` — React hook, 30 s cache
- `artifacts/parse-pilot/src/components/billing/pro-gate.tsx` — `<ProGate isPro compact>` wrapper (compact = inline lock button, full = upgrade card)
- Dashboard (`dashboard.tsx`) — shows violet upgrade banner + "Upgrade for More" button when free user has ≥ 1 app
- Application detail (`application-detail.tsx`) — compact ProGate replaces export buttons; full ProGate covers Cover Letter tab

## Vite Config Note

`artifacts/parse-pilot/vite.config.ts` has `fs.allow` set to include the workspace root's `lib/` and `node_modules/` directories so that workspace packages (e.g. `@workspace/replit-auth-web`) can be resolved by Vite in development.

## esbuild / Zod Note

The API server is bundled by esbuild. `lib/db` exports TypeScript source directly (not compiled dist). Because `lib/db/src/schema/*.ts` uses `import { z } from "zod/v4"`, esbuild will fail to resolve this subpath if you import from `@workspace/db` in a way that forces esbuild to traverse into those schema files.

**Rule**: In `artifacts/api-server/src/**`, always `import { z } from "zod"` (not `"zod/v4"`). Only import *types* (not values) from `@workspace/db` schema exports that use `"zod/v4"`. Define local Zod schemas using regular `"zod"` imports for runtime use. `zod` must be listed as a direct dependency in `artifacts/api-server/package.json`.
