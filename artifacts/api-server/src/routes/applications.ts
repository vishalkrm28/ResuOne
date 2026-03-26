import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, applicationsTable } from "@workspace/db";
import {
  CreateApplicationBody,
  UpdateApplicationBody,
  AnalyzeApplicationBody,
  GenerateCoverLetterBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { analyzeCvForJob, generateCoverLetter, parseJobDescription } from "../services/ai.js";
import { logger } from "../lib/logger.js";
import { requirePro } from "../middlewares/requirePro.js";
import { isUserPro } from "../lib/billing.js";
import { spendCredits, getUserCredits, CREDIT_COSTS } from "../lib/credits.js";

const router: IRouter = Router();

// ─── GET /applications ───────────────────────────────────────────────────────

router.get("/applications", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId query param is required", code: "MISSING_USER_ID" });
    return;
  }
  try {
    const apps = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.userId, userId))
      .orderBy(desc(applicationsTable.createdAt));
    res.json(apps);
  } catch (err) {
    logger.error({ err }, "Failed to list applications");
    res.status(500).json({ error: "Failed to retrieve applications", code: "DB_ERROR" });
  }
});

// ─── POST /applications ──────────────────────────────────────────────────────

router.post("/applications", async (req, res) => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }

  // ── Free-tier gate: limit to 1 application ───────────────────────────────
  // Use req.user.id when available (auth session), else fall back to body userId.
  const ownerUserId = req.user?.id ?? parsed.data.userId;
  try {
    const pro = await isUserPro(ownerUserId);
    if (!pro) {
      const [{ value: appCount }] = await db
        .select({ value: count() })
        .from(applicationsTable)
        .where(eq(applicationsTable.userId, ownerUserId));

      if (appCount >= 1) {
        res.status(403).json({
          error: "Free plan is limited to 1 application. Upgrade to Pro for unlimited applications.",
          code: "PRO_REQUIRED",
        });
        return;
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to check Pro status on application create");
    res.status(500).json({ error: "Could not verify subscription", code: "BILLING_CHECK_ERROR" });
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const [app] = await db
      .insert(applicationsTable)
      .values({
        userId: parsed.data.userId,
        jobTitle: parsed.data.jobTitle,
        company: parsed.data.company,
        jobDescription: parsed.data.jobDescription,
        originalCvText: parsed.data.originalCvText,
        parsedCvJson: (parsed.data.parsedCvJson as any) ?? null,
        missingKeywords: [],
        matchedKeywords: [],
        missingInfoQuestions: [],
        sectionSuggestions: [],
      })
      .returning();
    res.status(201).json(app);
  } catch (err) {
    logger.error({ err }, "Failed to create application");
    res.status(500).json({ error: "Failed to create application", code: "DB_ERROR" });
  }
});

// ─── GET /applications/:id ───────────────────────────────────────────────────

router.get("/applications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to get application");
    res.status(500).json({ error: "Failed to retrieve application", code: "DB_ERROR" });
  }
});

// ─── PUT /applications/:id ───────────────────────────────────────────────────

router.put("/applications/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }
  try {
    const [app] = await db
      .update(applicationsTable)
      .set({ ...parsed.data, parsedCvJson: (parsed.data.parsedCvJson as any) ?? undefined, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to update application");
    res.status(500).json({ error: "Failed to update application", code: "DB_ERROR" });
  }
});

// ─── DELETE /applications/:id ────────────────────────────────────────────────

router.delete("/applications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(applicationsTable).where(eq(applicationsTable.id, id));
    res.status(204).end();
  } catch (err) {
    logger.error({ err, id }, "Failed to delete application");
    res.status(500).json({ error: "Failed to delete application", code: "DB_ERROR" });
  }
});

// ─── PATCH /applications/:id/tailored-cv ─────────────────────────────────────

const SaveTailoredCvBody = z.object({
  tailoredCvText: z.string().min(1, "Tailored CV text cannot be empty"),
});

router.patch("/applications/:id/tailored-cv", async (req, res) => {
  const { id } = req.params;
  const parsed = SaveTailoredCvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }
  try {
    const [app] = await db
      .update(applicationsTable)
      .set({ tailoredCvText: parsed.data.tailoredCvText, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to save tailored CV");
    res.status(500).json({ error: "Failed to save tailored CV", code: "DB_ERROR" });
  }
});

// ─── PATCH /applications/:id/cover-letter ────────────────────────────────────

const SaveCoverLetterBody = z.object({
  coverLetterText: z.string().min(1, "Cover letter text cannot be empty"),
});

router.patch("/applications/:id/cover-letter-save", async (req, res) => {
  const { id } = req.params;
  const parsed = SaveCoverLetterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }
  try {
    const [app] = await db
      .update(applicationsTable)
      .set({ coverLetterText: parsed.data.coverLetterText, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to save cover letter");
    res.status(500).json({ error: "Failed to save cover letter", code: "DB_ERROR" });
  }
});

// ─── POST /applications/:id/analyze ─────────────────────────────────────────

router.post("/applications/:id/analyze", async (req, res) => {
  const { id } = req.params;
  const parsed = AnalyzeApplicationBody.safeParse(req.body);
  const confirmedAnswers = parsed.success
    ? (parsed.data.confirmedAnswers as Record<string, string> | undefined)
    : undefined;

  // ── Credit gate ───────────────────────────────────────────────────────────
  const ownerUserId = req.user?.id;
  if (ownerUserId) {
    const cost = CREDIT_COSTS.cv_optimization;
    if (cost > 0) {
      const spend = await spendCredits(ownerUserId, cost, "cv_optimization", { applicationId: id });
      if (!spend.success) {
        const balance = await getUserCredits(ownerUserId);
        res.status(402).json({
          error: "You've used all your optimization credits.",
          code: "CREDITS_EXHAUSTED",
          remainingCredits: balance?.availableCredits ?? 0,
        });
        return;
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    // Parse the job description first (for richer analysis context)
    let parsedJd = app.parsedJdJson ?? null;
    if (!parsedJd) {
      try {
        parsedJd = await parseJobDescription(app.jobDescription);
      } catch (err) {
        logger.warn({ err, id }, "JD parse failed (non-fatal) — continuing without parsed JD");
      }
    }

    // Analyze CV against job description (using parsed JD for extra context)
    const result = await analyzeCvForJob({
      originalCvText: app.originalCvText,
      jobDescription: app.jobDescription,
      jobTitle: app.jobTitle,
      company: app.company,
      parsedJd,
      confirmedAnswers,
    });

    // Save everything
    await db
      .update(applicationsTable)
      .set({
        tailoredCvText: result.tailoredCvText,
        keywordMatchScore: result.keywordMatchScore,
        missingKeywords: result.missingKeywords,
        matchedKeywords: result.matchedKeywords,
        missingInfoQuestions: result.missingInfoQuestions,
        sectionSuggestions: result.sectionSuggestions,
        parsedJdJson: parsedJd as any,
        status: "analyzed",
        updatedAt: new Date(),
      })
      .where(eq(applicationsTable.id, id));

    res.json({ ...result, parsedJd });
  } catch (err) {
    logger.error({ err, id }, "Failed to analyze application");
    res.status(500).json({ error: "Analysis failed. Please try again.", code: "ANALYSIS_ERROR" });
  }
});

// ─── POST /applications/:id/cover-letter ─────────────────────────────────────

router.post("/applications/:id/cover-letter", requirePro, async (req, res) => {
  const { id } = req.params;
  const parsed = GenerateCoverLetterBody.safeParse(req.body);
  const tone = parsed.success && parsed.data.tone ? parsed.data.tone : "professional";
  const additionalContext = parsed.success ? parsed.data.additionalContext : undefined;

  // ── Credit gate ───────────────────────────────────────────────────────────
  const ownerUserId = req.user?.id;
  if (ownerUserId) {
    const cost = CREDIT_COSTS.cover_letter;
    if (cost > 0) {
      const spend = await spendCredits(ownerUserId, cost, "cover_letter", { applicationId: id });
      if (!spend.success) {
        res.status(402).json({
          error: "You've used all your Pro credits for this billing period.",
          code: "CREDITS_EXHAUSTED",
          remainingCredits: 0,
        });
        return;
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    if (!app.tailoredCvText) {
      res.status(400).json({
        error: "Run CV analysis before generating a cover letter",
        code: "ANALYSIS_REQUIRED",
      });
      return;
    }

    const coverLetterText = await generateCoverLetter({
      originalCvText: app.originalCvText,
      tailoredCvText: app.tailoredCvText,
      jobDescription: app.jobDescription,
      jobTitle: app.jobTitle,
      company: app.company,
      tone,
      additionalContext,
    });

    await db
      .update(applicationsTable)
      .set({ coverLetterText, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id));

    res.json({ coverLetterText });
  } catch (err) {
    logger.error({ err, id }, "Failed to generate cover letter");
    res.status(500).json({ error: "Cover letter generation failed. Please try again.", code: "GENERATION_ERROR" });
  }
});

export default router;
