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