# ParsePilot AI (ResuOne)

## Overview

ResuOne is a production-ready SaaS web application designed to help users tailor their CVs to job descriptions using AI. The platform generates ATS-optimized CVs, performs keyword analysis, creates cover letters, and includes a global job discovery engine. It supports PDF/DOCX CV uploads, job description pasting, and outputs tailored CVs, keyword analysis, missing information prompts, and optional cover letters, all while strictly avoiding the invention of fake experience. The project aims to provide a comprehensive tool for job seekers to enhance their application materials and has a clear business vision with tiered pricing models for individual and recruiter use.

## User Preferences

*   I prefer detailed explanations.
*   I want iterative development.
*   Ask before making major changes.
*   Do not make changes to the folder `artifacts/parse-pilot/src/pages/marketing/`.
*   Do not make changes to the file `artifacts/parse-pilot/vite.config.ts`.
*   Do not make changes to the file `artifacts/api-server/src/lib/env.ts`.
*   Do not make changes to the file `artifacts/api-server/src/routes/webhook.ts`.

## Relocation Intelligence (Phase A — complete, deterministic)

**DB tables created:** `city_cost_profiles` (40 cities seeded), `salary_benchmarks`, `job_relocation_scores`, `relocation_analysis_cache`
**Columns added:** `jobs` + `internal_jobs` each gained `relocation_score`, `relocation_recommendation`, `estimated_monthly_surplus`, `salary_quality_signal`, `cost_of_living_signal`

**Backend lib files** (`api-server/src/lib/relocation/`):
- `relocation-schemas.ts`: All Zod types — enums (SalaryQualitySignal, CostOfLivingSignal, RelocationRecommendation, Lifestyle), risk flags, positive factors, full result schema + disclaimer constant
- `relocation-helpers.ts`: normalizeCityName, normalizeCountryName, normalizeJobTitle, clamp, round, toNumber
- `salary-analysis.ts`: detectSalaryPeriod, annualizeSalary, detectCurrency, estimateMonthlyGrossSalary, compareSalaryToBenchmark, inferSalaryQualitySignal, normalizeSalary
- `tax-estimate.ts`: per-country rough effective rates for 25+ countries; estimateMonthlyNetSalary + disclaimer
- `cost-of-living.ts`: getCityCostProfile (DB lookup), estimateMonthlyCost (lifestyle: low/moderate/high), costOfLivingSignal, calculateMonthlySurplus, buildCostProfileResult, compareCurrentVsTargetCity
- `relocation-score.ts`: calculateRelocationScore (salary 0-25, CoL 0-25, visa 0-20, language 0-20, relocation-support 0-10 = 100 total); risk flags + positive factor collectors
- `relocation-cache.ts`: SHA-256 cache key, 24hr TTL, upsert, purge stale
- `relocation-prompts.ts`: deterministic summary stub — Phase B will swap for AI router (OpenAI → Claude → Gemini)
- `relocation-pipeline.ts`: full 14-step orchestrator — cache check, job fetch, visa/language signals, salary, tax, CoL, scoring, summary, DB persist, cache save

**Route** (`routes/relocation.ts`): `POST /relocation/analyze-job`, `GET/POST /relocation/city-cost-profile`, `GET/POST /relocation/salary-benchmark`, `POST /relocation/filter-jobs`, `POST /relocation/recalculate`

**UI components** (`parse-pilot/src/components/relocation/`):
- `relocation-score-badge.tsx`: 5-state badge with tooltip (strong_move → not_recommended)
- `relocation-breakdown.tsx`: per-component score bars with colour coding
- `relocation-insight-card.tsx`: full card with financials grid, fit signals, risk/positive lists, AI summary panel, score breakdown toggle, disclaimer

**Job cards** (`jobs/exclusive.tsx`): relocation badge renders after language badge when signal ≠ unknown
**City seed data**: 40 major cities across 20+ countries with realistic monthly cost breakdowns
**Phase B — AI router (complete)**: 5 files in `api-server/src/lib/ai-router/`:
- `ai-router-schemas.ts`: task type enum, provider names, `RelocationSummaryInput/Output` Zod schemas, `AiRouterResult` wrapper
- `openai-provider.ts`: `generateRelocationSummaryWithOpenAI` — calls `gpt-5.2` with `json_object` response format; returns `null` on any error
- `anthropic-provider.ts`: `generateRelocationSummaryWithClaude` — calls `claude-sonnet-4-6`; cleans markdown fence; returns `null` on any error
- `ai-router.ts`: `routeRelocationSummary(input, deterministicFallback)` — OpenAI → Claude → deterministic, records `provider`, `model`, `latencyMs`, `fromFallback`
- `index.ts`: barrel export
- `relocation-prompts.ts` updated: now calls `routeRelocationSummary`; deterministic builder is passed as safety fallback; logs provider/model/latency on every call
**Phase C pending**: recommendations boost, pre-apply analysis integration, notifications

## Language Requirement Intelligence (Phase 1 — complete)

- **Keyword detector** (`api-server/src/lib/language/language-keyword-detector.ts`): explicit phrase matching across English-friendly, local_required, local_preferred, multilingual categories; handles English-as-local-language correctly for US/UK/AU/CA/IE/NZ/SG
- **Country rules** (`language-country-rules.ts`): conservative defaults for 20+ countries; never assumes local language without text evidence
- **Scoring engine** (`language-scoring.ts`): recruiter-declared > keyword detection > country rules; strict signal hierarchy (multilingual > local_required > local_preferred > english_friendly > unknown)
- **Pipeline** (`language-pipeline.ts`): no Claude (deterministic detection); persists `language_requirement_signal` + `language_confidence` to DB after analysis; fires async after every job create/PATCH
- **Language fit engine** (`language-fit.ts`): pure function compares candidate known languages against job requirements → good/risky/poor/unknown; never penalises empty profiles
- **Language route** (`routes/language.ts`): `POST /language/analyze-internal-job`, `POST /language/analyze-discovered-job`, `GET/POST /language/preferences`, `POST /language/fit`
- **LanguageSignalBadge + LanguageFitBadge** (`components/language/language-signal-badge.tsx`): 5-state badges with tooltips
- **Job cards**: language badge appears after visa badge for any signal ≠ unknown
- **Recruiter form**: "Language & Working Environment" section with required, preferred, working language, and notes fields
- **DB**: `jobs` + `internal_jobs` extended with language columns; `candidate_visa_preferences` extended with `known_languages` + `preferred_working_languages`

## Visa Intelligence System (Phase 1 — complete)

- **Keyword detector** (`api-server/src/lib/visa/keyword-detector.ts`): 40+ phrase library, positive / strong-negative / soft-negative / relocation / work-auth signal detection
- **Country rules** (`country-rules.ts`): per-country sponsorship boost / penalty for 20+ countries
- **Scoring engine** (`scoring.ts`): weighted combination of recruiter-declared fields + keyword hits + country rules → signal (high / medium / low / no / unknown) + confidence
- **Claude AI validation** (`ai-validation.ts`): fires only on ambiguous scores (medium/low with conflicting signals); uses `claude-sonnet-4-6` via Replit-managed Anthropic integration
- **Pipeline** (`pipeline.ts`): orchestrates all layers for internal jobs and discovered jobs; persists `sponsorship_signal` + `sponsorship_confidence` to DB after each analysis
- **Visa route** (`routes/visa.ts`): `POST /visa/analyze-internal-job`, `POST /visa/analyze-discovered-job`, `GET /visa/preferences`, `POST /visa/preferences`
- **VisaSignalBadge** (`components/visa/visa-signal-badge.tsx`): pill badges for high/medium/low/no/unknown signals with tooltip disclaimer
- **Job cards**: visa badge appears on `ExclusiveJobCard` for any signal ≠ unknown
- **Recruiter form**: "Visa & Work Authorization" section with sponsorship toggle, relocation toggle, work-auth requirement field, sponsorship notes
- **DB**: `internal_jobs` + `jobs` tables extended with visa columns; `candidate_visa_preferences` table created
- **Auto-analysis**: visa pipeline fires async after every job create and PATCH (if relevant fields changed)

## System Architecture

The ParsePilot AI project is structured as a monorepo using pnpm workspaces. It utilizes Node.js 24 and TypeScript 5.9.

**Frontend:**
*   Built with React and Vite, styled with Tailwind CSS, and uses shadcn-inspired components.
*   Key pages include a landing page, user dashboard, application management, terms, privacy, and bulk pricing sections.
*   Features include user authentication, CV upload (PDF/DOCX), JD parsing, AI analysis and keyword matching, section suggestions, missing information prompts, cover letter generation, editing and saving tailored documents, and export functionality.
*   The UI/UX differentiates between free and pro users, offering a detailed preview for free users with clear calls to action for unlocking full content or upgrading. This includes a `FreeResultsView` for conversion optimization.
*   Marketing pages are dynamically generated and supported by dedicated components for lead capture, waitlists, and feature showcases.

**Backend (API Server):**
*   Developed with Express 5, managing API routes for authentication, applications, billing, and marketing.
*   It includes middleware for authentication and authorization (`clerkMiddleware`, `requirePro`).
*   Core services handle AI interactions, file parsing, and document export.
*   AI prompts strictly enforce rules against fabricating experience and focus on rewriting based on existing CV content.
*   Content gating ensures free users receive stripped-down responses, while pro users or those with one-time unlocks get full content.
*   A credit system tracks usage for AI analysis and cover letter generation, with specific costs and a mechanism for awarding free and pro credits.
*   An identity and anti-abuse system prevents misuse by charging additional credits for multiple distinct identities on a single account, applying friction rather than hard blocks.
*   A one-time unlock feature allows users to pay for full access to a single application result.
*   Environment variables are validated on startup, with specific configurations for billing, AI, and marketing features.
*   Webhooks are designed for safety and idempotency, handling Stripe events for subscriptions and one-time unlocks.

**Database:**
*   PostgreSQL is used with Drizzle ORM.
*   Schemas include `applications` (for tailored CVs, JDs, analysis results), `user_identity_profiles` (for anti-abuse), `sessions`, `users`, `usage_balances`, `usage_events` (for AI credits), `unlock_purchases` (for one-time unlocks), `marketing_leads`, `waitlist_signups`, `funnel_events`, and `seo_pages`.
*   **Milestone 41 — Internal Job Marketplace**: 7 new tables in `lib/db/src/schema/internal-jobs.ts`: `internal_jobs`, `internal_job_applications`, `internal_job_candidate_analyses`, `internal_job_application_events`, `internal_job_notifications`, `internal_job_messages`, `internal_job_interview_invites`.

**Monorepo Structure:**
*   `artifacts/api-server`: Express API server.
*   `artifacts/parse-pilot`: React + Vite frontend.
*   `lib/api-spec`: OpenAPI specification and Orval codegen configuration.
*   `lib/api-client-react`: Generated React Query hooks.
*   `lib/api-zod`: Generated Zod schemas.
*   `lib/replit-auth-web`: Authentication hooks.
*   `lib/db`: Drizzle ORM schema and connection.
*   `lib/integrations-openai-ai-server`: Replit AI Integration client.

## User Mode Separation

Users choose their mode at first sign-in via `/onboarding` (job seeker vs recruiter). The `user_mode` column (`job_seeker | recruiter | null`) on the `users` table drives the experience:

- **OnboardingGate** in `App.tsx` redirects users with `null` mode to `/onboarding` before they can access any app page.
- `POST /user/mode` endpoint sets the mode; billing status response includes `userMode`.
- **Sidebar branches** on `isRecruiterMode` (recruiter-mode users see only recruiter nav; job-seeker-mode users see the full job-seeker nav with no recruiter links).
- Route guards: `RECRUITER_ONLY_PATHS` redirect job-seeker users; `JOB_SEEKER_ONLY_PATHS` redirect recruiter users.
- Active recruiters always resolve to recruiter mode regardless of stored `user_mode`.

Key files: `artifacts/parse-pilot/src/pages/onboarding/index.tsx`, `artifacts/parse-pilot/src/App.tsx`, `artifacts/parse-pilot/src/components/layout/sidebar.tsx`, `artifacts/api-server/src/routes/billing.ts`, `lib/db/src/schema/auth.ts`.

## Internal Job Marketplace (M41)

Seven tables live in `lib/db/src/schema/internal-jobs.ts` and are fully pushed to the live database:
`internal_jobs`, `internal_job_applications`, `internal_job_candidate_analyses`,
`internal_job_application_events`, `internal_job_notifications`, `internal_job_messages`,
`internal_job_interview_invites`.

Schema files that reference other schema files in the same package must use extension-less imports
(e.g., `from "./jobs-core"` not `from "./jobs-core.js"`) so drizzle-kit can resolve them at
push time.

## External Dependencies

*   **AI Service**: OpenAI via Replit AI Integrations proxy (specifically gpt-5.2).
*   **Authentication**: Clerk (`@clerk/clerk-react`, `@clerk/express`).
*   **Database**: PostgreSQL.
*   **ORM**: Drizzle ORM.
*   **Validation**: Zod.
*   **API Codegen**: Orval.
*   **File Parsing**: mammoth (DOCX), pdfjs-dist (PDF).
*   **File Export**: docx (DOCX generation).
*   **Payment Processing**: Stripe (for billing, one-time unlocks, bulk purchases, and webhooks).