import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  applicationsTable,
  externalJobsCacheTable,
  tailoredCvsTable,
  coverLettersTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { spendCredits, CREDIT_COSTS, canSpendCredits } from "../lib/credits.js";
import { logFeatureUsage } from "../lib/billing/feature-usage.js";
import { tailorCv, generateCoverLetter, generateAtsImprovements } from "../services/tailoring-ai.js";
import {
  buildDefaultTailoredCvVersionName,
  buildDefaultCoverLetterVersionName,
} from "../lib/application/versioning.js";
import { buildCombinedExportPayload } from "../lib/application/export.js";
import type { TailoredCvJson } from "../lib/ai/tailoring-schemas.js";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve job info string from various sources. */
async function resolveJobInfo(opts: {
  externalJobCacheId?: string | null;
  jobText?: string | null;
  sourceApplicationId?: string | null;
  userId: string;
}): Promise<{ jobInfo: string; jobTitle: string | null; jobCompany: string | null }> {
  const { externalJobCacheId, jobText, sourceApplicationId, userId } = opts;

  // 1. External jobs cache (recommended job from Find Jobs feature)
  if (externalJobCacheId) {
    const [cached] = await db
      .select()
      .from(externalJobsCacheTable)
      .where(eq(externalJobsCacheTable.id, externalJobCacheId))
      .limit(1);

    if (cached) {
      const parts = [
        `Job Title: ${cached.title}`,
        cached.company ? `Company: ${cached.company}` : null,
        cached.location ? `Location: ${cached.location}` : null,
        cached.employmentType ? `Employment Type: ${cached.employmentType}` : null,
        cached.description ? `\nDescription:\n${cached.description}` : null,
      ].filter(Boolean);
      return {
        jobInfo: parts.join("\n"),
        jobTitle: cached.title,
        jobCompany: cached.company ?? null,
      };
    }
  }

  // 2. Pasted job description text
  if (jobText?.trim()) {
    return { jobInfo: jobText.trim(), jobTitle: null, jobCompany: null };
  }

  // 3. Fallback: job description stored in the source application
  if (sourceApplicationId) {
    const [app] = await db
      .select({
        jobTitle: applicationsTable.jobTitle,
        company: applicationsTable.company,
        jobDescription: applicationsTable.jobDescription,
      })
      .from(applicationsTable)
      .where(and(eq(applicationsTable.id, sourceApplicationId), eq(applicationsTable.userId, userId)))
      .limit(1);

    if (app?.jobDescription) {
      const parts = [
        `Job Title: ${app.jobTitle}`,
        `Company: ${app.company}`,
        `\nJob Description:\n${app.jobDescription}`,
      ];
      return {
        jobInfo: parts.join("\n"),
        jobTitle: app.jobTitle,
        jobCompany: app.company,
      };
    }
  }

  return { jobInfo: "", jobTitle: null, jobCompany: null };
}

/** Resolve original parsed CV JSON from source application. */
async function resolveParsedCv(
  sourceApplicationId: string | null | undefined,
  userId: string,
): Promise<{ parsedCvJson: string; found: boolean }> {
  if (!sourceApplicationId) {
    // Use most recent analyzed application
    const [latest] = await db
      .select({ parsedCvJson: applicationsTable.parsedCvJson })
      .from(applicationsTable)
      .where(and(eq(applicationsTable.userId, userId)))
      .orderBy(desc(applicationsTable.createdAt))
      .limit(1);

    if (!latest?.parsedCvJson) return { parsedCvJson: "", found: false };
    return { parsedCvJson: JSON.stringify(latest.parsedCvJson), found: true };
  }

  const [app] = await db
    .select({ parsedCvJson: applicationsTable.parsedCvJson })
    .from(applicationsTable)
    .where(and(eq(applicationsTable.id, sourceApplicationId), eq(applicationsTable.userId, userId)))
    .limit(1);

  if (!app?.parsedCvJson) return { parsedCvJson: "", found: false };
  return { parsedCvJson: JSON.stringify(app.parsedCvJson), found: true };
}

// ─── POST /api/application/tailor-cv ─────────────────────────────────────────
// Tailors a CV for a specific job. Costs 1 AI credit.

router.post("/application/tailor-cv", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    sourceApplicationId,
    externalJobCacheId,
    jobText,
    jobTitle: inputJobTitle,
    jobCompany: inputJobCompany,
    versionName: inputVersionName,
  } = req.body as {
    sourceApplicationId?: string;
    externalJobCacheId?: string;
    jobText?: string;
    jobTitle?: string;
    jobCompany?: string;
    versionName?: string;
  };

  // ── Credit check ─────────────────────────────────────────────────────────────
  const hasCredits = await canSpendCredits(userId, CREDIT_COSTS.tailored_cv);
  if (!hasCredits) {
    res.status(402).json({
      error: "Not enough credits to tailor a CV. Please upgrade to Pro or purchase more credits.",
      code: "INSUFFICIENT_CREDITS",
    });
    return;
  }

  // ── Resolve original CV ───────────────────────────────────────────────────
  const { parsedCvJson, found } = await resolveParsedCv(sourceApplicationId, userId);
  if (!found) {
    res.status(422).json({
      error: "No parsed CV found. Please analyse a CV first.",
      code: "NO_CV",
    });
    return;
  }

  // ── Resolve job info ──────────────────────────────────────────────────────
  const { jobInfo, jobTitle, jobCompany } = await resolveJobInfo({
    externalJobCacheId,
    jobText,
    sourceApplicationId,
    userId,
  });

  if (!jobInfo.trim()) {
    res.status(422).json({
      error: "No job description provided. Please paste a job description or select a job.",
      code: "NO_JOB_INFO",
    });
    return;
  }

  // ── Tailor CV via AI ──────────────────────────────────────────────────────
  let tailoredCvJson: TailoredCvJson;
  try {
    tailoredCvJson = await tailorCv(parsedCvJson, jobInfo);
  } catch (err) {
    logger.error({ err, userId }, "CV tailoring AI failed");
    res.status(500).json({ error: "Failed to tailor CV. Please try again.", code: "AI_ERROR" });
    return;
  }

  // ── Count existing tailored CVs for version naming ────────────────────────
  const existing = await db
    .select({ id: tailoredCvsTable.id })
    .from(tailoredCvsTable)
    .where(eq(tailoredCvsTable.userId, userId));

  const versionNumber = existing.length + 1;
  const resolvedJobTitle = inputJobTitle ?? jobTitle;
  const resolvedJobCompany = inputJobCompany ?? jobCompany;
  const versionName = inputVersionName ?? buildDefaultTailoredCvVersionName({
    versionNumber,
    jobTitle: resolvedJobTitle,
    company: resolvedJobCompany,
  });

  // ── Spend credit ──────────────────────────────────────────────────────────
  const { success: creditSpent } = await spendCredits(userId, CREDIT_COSTS.tailored_cv, "tailored_cv", {
    jobTitle: resolvedJobTitle,
    sourceApplicationId,
  });

  if (!creditSpent) {
    res.status(402).json({ error: "Credit spend failed. Please try again.", code: "CREDIT_SPEND_FAILED" });
    return;
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  const [saved] = await db
    .insert(tailoredCvsTable)
    .values({
      userId,
      sourceApplicationId: sourceApplicationId ?? null,
      externalJobCacheId: externalJobCacheId ?? null,
      versionName,
      originalParsedCv: JSON.parse(parsedCvJson) as Record<string, unknown>,
      tailoredCvJson: tailoredCvJson as unknown as Record<string, unknown>,
      atsKeywordsAdded: tailoredCvJson.ats_keywords_added as unknown as Record<string, unknown>,
      tailoringSummary: tailoredCvJson.tailoring_summary ?? null,
      jobText: jobText ?? null,
      jobTitle: resolvedJobTitle ?? null,
      jobCompany: resolvedJobCompany ?? null,
    })
    .returning();

  res.status(201).json(formatTailoredCvDetail(saved));
  void logFeatureUsage({
    userId,
    featureKey: "tailored_cv",
    referenceType: "tailored_cv",
    referenceId: saved.id,
    creditsUsed: CREDIT_COSTS.tailored_cv,
    metadata: { jobTitle: resolvedJobTitle, jobCompany: resolvedJobCompany },
  });
});

// ─── POST /api/application/cover-letter ──────────────────────────────────────
// Generates a cover letter from tailored CV + job info.

router.post("/application/cover-letter", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    tailoredCvId,
    sourceApplicationId,
    externalJobCacheId,
    jobText,
    jobTitle: inputJobTitle,
    jobCompany: inputJobCompany,
    tone = "professional",
  } = req.body as {
    tailoredCvId?: string;
    sourceApplicationId?: string;
    externalJobCacheId?: string;
    jobText?: string;
    jobTitle?: string;
    jobCompany?: string;
    tone?: string;
  };

  const validTones = ["professional", "confident", "warm", "concise"];
  const resolvedTone = validTones.includes(tone) ? tone : "professional";

  // ── Resolve tailored CV (if linked) ──────────────────────────────────────
  let tailoredCvJsonString: string | null = null;
  let resolvedSourceAppId = sourceApplicationId;
  let resolvedExtJobId = externalJobCacheId;

  if (tailoredCvId) {
    const [tcv] = await db
      .select()
      .from(tailoredCvsTable)
      .where(and(eq(tailoredCvsTable.id, tailoredCvId), eq(tailoredCvsTable.userId, userId)))
      .limit(1);

    if (!tcv) {
      res.status(404).json({ error: "Tailored CV not found" });
      return;
    }

    tailoredCvJsonString = JSON.stringify(tcv.tailoredCvJson);
    resolvedSourceAppId = resolvedSourceAppId ?? tcv.sourceApplicationId ?? undefined;
    resolvedExtJobId = resolvedExtJobId ?? tcv.externalJobCacheId ?? undefined;
  }

  // ── Resolve original CV ───────────────────────────────────────────────────
  const { parsedCvJson, found } = await resolveParsedCv(resolvedSourceAppId, userId);
  if (!found) {
    res.status(422).json({ error: "No parsed CV found.", code: "NO_CV" });
    return;
  }

  // ── Resolve job info ──────────────────────────────────────────────────────
  const { jobInfo, jobTitle, jobCompany } = await resolveJobInfo({
    externalJobCacheId: resolvedExtJobId,
    jobText,
    sourceApplicationId: resolvedSourceAppId,
    userId,
  });

  if (!jobInfo.trim()) {
    res.status(422).json({ error: "No job description provided.", code: "NO_JOB_INFO" });
    return;
  }

  // ── Generate cover letter via AI ──────────────────────────────────────────
  let coverLetterText: string;
  try {
    coverLetterText = await generateCoverLetter({
      parsedCvJson,
      tailoredCvJson: tailoredCvJsonString,
      jobInfo,
      tone: resolvedTone,
    });
  } catch (err) {
    logger.error({ err, userId }, "Cover letter generation failed");
    res.status(500).json({ error: "Failed to generate cover letter. Please try again.", code: "AI_ERROR" });
    return;
  }

  const resolvedJobTitle = inputJobTitle ?? jobTitle;
  const resolvedJobCompany = inputJobCompany ?? jobCompany;

  // ── Save to DB ────────────────────────────────────────────────────────────
  const [saved] = await db
    .insert(coverLettersTable)
    .values({
      userId,
      tailoredCvId: tailoredCvId ?? null,
      sourceApplicationId: resolvedSourceAppId ?? null,
      externalJobCacheId: resolvedExtJobId ?? null,
      tone: resolvedTone,
      coverLetterText,
      jobTitle: resolvedJobTitle ?? null,
      jobCompany: resolvedJobCompany ?? null,
      jobText: jobText ?? null,
    })
    .returning();

  res.status(201).json(formatCoverLetter(saved));
  void logFeatureUsage({
    userId,
    featureKey: "cover_letter",
    referenceType: "cover_letter",
    referenceId: saved.id,
    creditsUsed: CREDIT_COSTS.cover_letter,
    metadata: { jobTitle: resolvedJobTitle, jobCompany: resolvedJobCompany, tone: resolvedTone },
  });
});

// ─── GET /api/application/tailored-cvs ───────────────────────────────────────

router.get("/application/tailored-cvs", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(tailoredCvsTable)
    .where(eq(tailoredCvsTable.userId, userId))
    .orderBy(desc(tailoredCvsTable.createdAt));

  res.json({ tailoredCvs: rows.map(formatTailoredCvSummary) });
});

// ─── GET /api/application/tailored-cvs/:id ───────────────────────────────────

router.get("/application/tailored-cvs/:id", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [row] = await db
    .select()
    .from(tailoredCvsTable)
    .where(and(eq(tailoredCvsTable.id, req.params.id), eq(tailoredCvsTable.userId, userId)))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Tailored CV not found" }); return; }

  res.json(formatTailoredCvDetail(row));
});

// ─── PATCH /api/application/tailored-cvs/:id/rename ──────────────────────────

router.patch("/application/tailored-cvs/:id/rename", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { versionName } = req.body as { versionName?: string };
  if (!versionName?.trim()) { res.status(400).json({ error: "versionName is required" }); return; }

  const [updated] = await db
    .update(tailoredCvsTable)
    .set({ versionName: versionName.trim() })
    .where(and(eq(tailoredCvsTable.id, req.params.id), eq(tailoredCvsTable.userId, userId)))
    .returning({ id: tailoredCvsTable.id });

  if (!updated) { res.status(404).json({ error: "Tailored CV not found" }); return; }

  res.json({ success: true });
});

// ─── POST /api/application/tailored-cvs/:id/duplicate ────────────────────────

router.post("/application/tailored-cvs/:id/duplicate", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [original] = await db
    .select()
    .from(tailoredCvsTable)
    .where(and(eq(tailoredCvsTable.id, req.params.id), eq(tailoredCvsTable.userId, userId)))
    .limit(1);

  if (!original) { res.status(404).json({ error: "Tailored CV not found" }); return; }

  const existing = await db
    .select({ id: tailoredCvsTable.id })
    .from(tailoredCvsTable)
    .where(eq(tailoredCvsTable.userId, userId));

  const versionNumber = existing.length + 1;
  const duplicateName = buildDefaultTailoredCvVersionName({
    versionNumber,
    jobTitle: original.jobTitle,
    company: original.jobCompany,
  }) + " (copy)";

  const [duplicate] = await db
    .insert(tailoredCvsTable)
    .values({
      userId,
      sourceApplicationId: original.sourceApplicationId,
      externalJobCacheId: original.externalJobCacheId,
      versionName: duplicateName,
      originalParsedCv: original.originalParsedCv as Record<string, unknown>,
      tailoredCvJson: original.tailoredCvJson as Record<string, unknown>,
      atsKeywordsAdded: original.atsKeywordsAdded as Record<string, unknown>,
      tailoringSummary: original.tailoringSummary,
      jobText: original.jobText,
      jobTitle: original.jobTitle,
      jobCompany: original.jobCompany,
    })
    .returning();

  res.status(201).json(formatTailoredCvSummary(duplicate));
});

// ─── GET /api/application/cover-letters ──────────────────────────────────────

router.get("/application/cover-letters", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(coverLettersTable)
    .where(eq(coverLettersTable.userId, userId))
    .orderBy(desc(coverLettersTable.createdAt));

  res.json({ coverLetters: rows.map(formatCoverLetter) });
});

// ─── POST /api/application/export ────────────────────────────────────────────

router.post("/application/export", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { tailoredCvId, coverLetterId } = req.body as {
    tailoredCvId?: string;
    coverLetterId?: string;
  };

  let tailoredCvJson: TailoredCvJson | null = null;
  let coverLetterText: string | null = null;

  if (tailoredCvId) {
    const [tcv] = await db
      .select({ tailoredCvJson: tailoredCvsTable.tailoredCvJson })
      .from(tailoredCvsTable)
      .where(and(eq(tailoredCvsTable.id, tailoredCvId), eq(tailoredCvsTable.userId, userId)))
      .limit(1);
    if (tcv) tailoredCvJson = tcv.tailoredCvJson as unknown as TailoredCvJson;
  }

  if (coverLetterId) {
    const [cl] = await db
      .select({ coverLetterText: coverLettersTable.coverLetterText })
      .from(coverLettersTable)
      .where(and(eq(coverLettersTable.id, coverLetterId), eq(coverLettersTable.userId, userId)))
      .limit(1);
    if (cl) coverLetterText = cl.coverLetterText;
  }

  res.json(buildCombinedExportPayload({ tailoredCvJson, coverLetterText }));
});

// ─── POST /api/application/ats-improvements ──────────────────────────────────

router.post("/application/ats-improvements", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { sourceApplicationId, jobText } = req.body as {
    sourceApplicationId?: string;
    jobText?: string;
  };

  const { parsedCvJson, found } = await resolveParsedCv(sourceApplicationId, userId);
  if (!found) {
    res.status(422).json({ error: "No parsed CV found.", code: "NO_CV" });
    return;
  }

  const { jobInfo } = await resolveJobInfo({
    jobText,
    sourceApplicationId,
    userId,
  });

  if (!jobInfo.trim()) {
    res.status(422).json({ error: "No job description provided.", code: "NO_JOB_INFO" });
    return;
  }

  try {
    const improvements = await generateAtsImprovements(parsedCvJson, jobInfo);
    res.json(improvements);
  } catch (err) {
    logger.error({ err, userId }, "ATS improvements generation failed");
    res.status(500).json({ error: "Failed to generate ATS improvements.", code: "AI_ERROR" });
  }
});

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatTailoredCvSummary(row: typeof tailoredCvsTable.$inferSelect) {
  return {
    id: row.id,
    versionName: row.versionName,
    jobTitle: row.jobTitle,
    jobCompany: row.jobCompany,
    tailoringSummary: row.tailoringSummary,
    atsKeywordsAdded: Array.isArray(row.atsKeywordsAdded) ? row.atsKeywordsAdded : [],
    sourceApplicationId: row.sourceApplicationId,
    externalJobCacheId: row.externalJobCacheId,
    createdAt: row.createdAt,
  };
}

function formatTailoredCvDetail(row: typeof tailoredCvsTable.$inferSelect) {
  return {
    ...formatTailoredCvSummary(row),
    originalParsedCv: row.originalParsedCv,
    tailoredCvJson: row.tailoredCvJson,
    jobText: row.jobText,
  };
}

function formatCoverLetter(row: typeof coverLettersTable.$inferSelect) {
  return {
    id: row.id,
    tailoredCvId: row.tailoredCvId,
    sourceApplicationId: row.sourceApplicationId,
    jobTitle: row.jobTitle,
    jobCompany: row.jobCompany,
    tone: row.tone,
    coverLetterText: row.coverLetterText,
    createdAt: row.createdAt,
  };
}

export default router;
