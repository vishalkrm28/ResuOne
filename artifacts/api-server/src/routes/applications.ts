import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, applicationsTable } from "@workspace/db";
import {
  CreateApplicationBody,
  UpdateApplicationBody,
  AnalyzeApplicationBody,
  GenerateCoverLetterBody,
} from "@workspace/api-zod";
import { analyzeCvForJob, generateCoverLetter } from "../services/ai.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

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
      .orderBy(applicationsTable.createdAt);
    res.json(apps);
  } catch (err) {
    logger.error({ err }, "Failed to list applications");
    res.status(500).json({ error: "Failed to retrieve applications", code: "DB_ERROR" });
  }
});

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
      })
      .returning();
    res.status(201).json(app);
  } catch (err) {
    logger.error({ err }, "Failed to create application");
    res.status(500).json({ error: "Failed to create application", code: "DB_ERROR" });
  }
});

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

router.post("/applications/:id/analyze", async (req, res) => {
  const { id } = req.params;
  const parsed = AnalyzeApplicationBody.safeParse(req.body);
  const confirmedAnswers = parsed.success
    ? (parsed.data.confirmedAnswers as Record<string, string> | undefined)
    : undefined;

  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    const result = await analyzeCvForJob({
      originalCvText: app.originalCvText,
      jobDescription: app.jobDescription,
      jobTitle: app.jobTitle,
      company: app.company,
      confirmedAnswers,
    });

    await db
      .update(applicationsTable)
      .set({
        tailoredCvText: result.tailoredCvText,
        keywordMatchScore: result.keywordMatchScore,
        missingKeywords: result.missingKeywords,
        matchedKeywords: result.matchedKeywords,
        missingInfoQuestions: result.missingInfoQuestions,
        status: "analyzed",
        updatedAt: new Date(),
      })
      .where(eq(applicationsTable.id, id));

    res.json(result);
  } catch (err) {
    logger.error({ err, id }, "Failed to analyze application");
    res.status(500).json({ error: "Analysis failed. Please try again.", code: "ANALYSIS_ERROR" });
  }
});

router.post("/applications/:id/cover-letter", async (req, res) => {
  const { id } = req.params;
  const parsed = GenerateCoverLetterBody.safeParse(req.body);
  const tone = (parsed.success && parsed.data.tone) ? parsed.data.tone : "professional";
  const additionalContext = parsed.success ? parsed.data.additionalContext : undefined;

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
