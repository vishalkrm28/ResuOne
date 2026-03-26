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
3. **AI Analysis** - GPT-5.2 analyzes CV vs job description, returns ATS-optimized rewrite
4. **Keyword Match** - Shows match score %, matched/missing keywords as visual chips
5. **Missing Info** - AI surfaces questions if key info is absent; user can answer and re-analyze
6. **Cover Letter** - AI generates tone-controlled cover letter (professional/enthusiastic/concise)
7. **Export** - Download tailored CV or cover letter as DOCX
8. **Saved Applications** - All applications saved per authenticated user with status tracking

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
- `POST /api/upload-cv` — multipart file upload (PDF/DOCX/DOC/TXT, max 10MB) → extracts text AND parses structured JSON with AI (non-fatal; returns parsedCv: null on parse failure)
- `POST /api/parse-cv` — parse raw CV text into structured JSON using OpenAI Responses API (Zod-validated body: `{ rawText: string }`)
- `GET  /api/export/application/:id/docx` — download DOCX
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

## Vite Config Note

`artifacts/parse-pilot/vite.config.ts` has `fs.allow` set to include the workspace root's `lib/` and `node_modules/` directories so that workspace packages (e.g. `@workspace/replit-auth-web`) can be resolved by Vite in development.

## esbuild / Zod Note

The API server is bundled by esbuild. `lib/db` exports TypeScript source directly (not compiled dist). Because `lib/db/src/schema/*.ts` uses `import { z } from "zod/v4"`, esbuild will fail to resolve this subpath if you import from `@workspace/db` in a way that forces esbuild to traverse into those schema files.

**Rule**: In `artifacts/api-server/src/**`, always `import { z } from "zod"` (not `"zod/v4"`). Only import *types* (not values) from `@workspace/db` schema exports that use `"zod/v4"`. Define local Zod schemas using regular `"zod"` imports for runtime use. `zod` must be listed as a direct dependency in `artifacts/api-server/package.json`.
