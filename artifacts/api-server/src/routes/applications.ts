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

const router: IRouter = Router();

router.get("/applications", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId query param is required" });
    return;
  }
  const apps = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.userId, userId))
    .orderBy(applicationsTable.createdAt);
  res.json(apps);
});

router.post("/applications", async (req, res) => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const [app] = await db
    .insert(applicationsTable)
    .values({
      ...parsed.data,
      missingKeywords: [],
      matchedKeywords: [],
      missingInfoQuestions: [],
    })
    .returning();
  res.status(201).json(app);
});

router.get("/applications/:id", async (req, res) => {
  const { id } = req.params;
  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id));
  if (!app) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(app);
});

router.put("/applications/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const [app] = await db
    .update(applicationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(applicationsTable.id, id))
    .returning();
  if (!app) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(app);
});

router.delete("/applications/:id", async (req, res) => {
  const { id } = req.params;
  await db.delete(applicationsTable).where(eq(applicationsTable.id, id));
  res.status(204).end();
});

router.post("/applications/:id/analyze", async (req, res) => {
  const { id } = req.params;
  const parsed = AnalyzeApplicationBody.safeParse(req.body);
  const confirmedAnswers = parsed.success ? (parsed.data.confirmedAnswers as Record<string, string> | undefined) : undefined;

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id));

  if (!app) {
    res.status(404).json({ error: "Application not found" });
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
});

router.post("/applications/:id/cover-letter", async (req, res) => {
  const { id } = req.params;
  const parsed = GenerateCoverLetterBody.safeParse(req.body);
  const tone = (parsed.success && parsed.data.tone) ? parsed.data.tone : "professional";
  const additionalContext = parsed.success ? parsed.data.additionalContext : undefined;

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id));

  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (!app.tailoredCvText) {
    res.status(400).json({ error: "Run CV analysis before generating a cover letter" });
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
});

export default router;
