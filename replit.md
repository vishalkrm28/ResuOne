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
- **File parsing**: mammoth (DOCX), pdfjs-dist (PDF)
- **File export**: docx (DOCX generation)
- **Build**: esbuild (CJS bundle for API server)

## Architecture

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── routes/     # health.ts, applications.ts, upload.ts, export.ts
│   │       └── services/   # ai.ts, fileParser.ts, exporter.ts
│   └── parse-pilot/        # React + Vite frontend (served at /)
│       └── src/
│           ├── pages/      # dashboard.tsx, new-application.tsx, application-detail.tsx
│           ├── components/ # Button, Card, Badge, Input, Textarea, layout/
│           └── hooks/      # use-local-auth.ts, use-toast.ts
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   │   └── src/schema/     # applications.ts
│   └── integrations-openai-ai-server/  # Replit AI Integration client
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## Key Features

1. **CV Upload** - PDF and DOCX file upload with text extraction, or manual paste
2. **AI Analysis** - GPT-5.2 analyzes CV vs job description, returns ATS-optimized rewrite
3. **Keyword Match** - Shows match score %, matched/missing keywords as visual chips
4. **Missing Info** - AI surfaces questions if key info is absent; user can answer and re-analyze
5. **Cover Letter** - AI generates tone-controlled cover letter (professional/enthusiastic/concise)
6. **Export** - Download tailored CV or cover letter as DOCX
7. **Saved Applications** - All applications saved per user (localStorage UUID) with status tracking

## Critical Rules (enforced in AI prompts)

- NEVER invent fake work experience, skills, tools, degrees, certifications, or achievements
- Only rewrite and reorganize based on information present in the source CV
- If information is missing, surface it as a question (Missing Info tab)
- Keep output ATS-friendly

## API Routes

- `GET  /api/healthz` — health check
- `GET  /api/applications?userId=xxx` — list applications
- `POST /api/applications` — create application
- `GET  /api/applications/:id` — get application
- `PUT  /api/applications/:id` — update application
- `DELETE /api/applications/:id` — delete application
- `POST /api/applications/:id/analyze` — AI CV analysis
- `POST /api/applications/:id/cover-letter` — AI cover letter generation
- `POST /api/upload-cv` — multipart file upload + text extraction
- `GET  /api/export/application/:id/docx` — download DOCX

## Database Schema (Drizzle/PostgreSQL)

### `applications` table
- `id` (uuid, PK)
- `userId` (text) — from localStorage UUID
- `jobTitle`, `company` (text)
- `jobDescription` (text)
- `originalCvText` (text)
- `tailoredCvText` (text, nullable)
- `coverLetterText` (text, nullable)
- `keywordMatchScore` (real, nullable)
- `missingKeywords`, `matchedKeywords`, `missingInfoQuestions` (jsonb arrays)
- `status` (enum: draft | analyzed | exported)
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

## Auth

No authentication required in the current version. A UUID is generated on first visit and persisted in localStorage as `parsepilot_user_id`. This scopes all data to the browser session. Adding Replit Auth is the natural next step for multi-device support.
