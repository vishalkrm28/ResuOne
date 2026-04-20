import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  applicationsTable,
  trackedApplicationsTable,
  tailoredCvsTable,
  coverLettersTable,
  interviewPrepsTable,
  interviewQuestionAnswersTable,
  externalJobsCacheTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { spendCredits, canSpendCredits } from "../lib/credits.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { AI_MODELS } from "../services/ai.js";
import { buildInterviewPrepPrompt } from "../lib/tracker/interview-prep-prompts.js";
import {
  GenerateInterviewPrepBody,
  SaveAnswerBody,
  InterviewPrepJsonSchema,
} from "../lib/tracker/tracker-schemas.js";
import { assertAppOwnership } from "../lib/tracker/tracker-helpers.js";
import { createTimelineEvent } from "../lib/tracker/tracker-helpers.js";

const router: IRouter = Router();

// ─── POST /api/interview-prep/generate ───────────────────────────────────────

router.post("/interview-prep/generate", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = GenerateInterviewPrepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error });
    return;
  }
  const body = parsed.data;

  // ── Ownership check ────────────────────────────────────────────────────────
  const app = await assertAppOwnership(body.applicationId, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  // ── Credit gate: atomic check-and-deduct before any AI call ──────────────
  const affordable = await canSpendCredits(userId, 1);
  if (!affordable) {
    res.status(402).json({
      error: "Not enough credits to generate interview prep. Upgrade to Pro or unlock a CV.",
      code: "INSUFFICIENT_CREDITS",
    });
    return;
  }
  const spendResult = await spendCredits(userId, 1, "interview_prep", { source: "interview_prep_generate" });
  if (!spendResult.success) {
    logger.warn({ userId }, "Interview prep credit deduction failed (race or insufficient balance)");
    res.status(402).json({
      error: "Not enough credits to generate interview prep. Upgrade to Pro or unlock a CV.",
      code: "INSUFFICIENT_CREDITS",
    });
    return;
  }

  // ── Resolve job info ───────────────────────────────────────────────────────
  let jobInfo = body.jobText?.trim() ?? "";
  let jobSnapshot = app.jobSnapshot as Record<string, unknown>;

  if (!jobInfo) {
    // Try external job cache
    if (app.externalJobCacheId) {
      const [cached] = await db.select().from(externalJobsCacheTable)
        .where(eq(externalJobsCacheTable.id, app.externalJobCacheId)).limit(1);
      if (cached) {
        jobInfo = [
          `Job Title: ${cached.title}`,
          cached.company ? `Company: ${cached.company}` : null,
          cached.location ? `Location: ${cached.location}` : null,
          cached.employmentType ? `Employment Type: ${cached.employmentType}` : null,
          cached.description ? `\nDescription:\n${cached.description}` : null,
        ].filter(Boolean).join("\n");
      }
    }
    // Try source application job description
    if (!jobInfo && app.sourceApplicationId) {
      const [srcApp] = await db.select({
        jobTitle: applicationsTable.jobTitle,
        company: applicationsTable.company,
        jobDescription: applicationsTable.jobDescription,
      }).from(applicationsTable)
        .where(and(eq(applicationsTable.id, app.sourceApplicationId), eq(applicationsTable.userId, userId)))
        .limit(1);
      if (srcApp?.jobDescription) {
        jobInfo = `Job Title: ${srcApp.jobTitle}\nCompany: ${srcApp.company}\n\n${srcApp.jobDescription}`;
      }
    }
    // Fall back to snapshot
    if (!jobInfo && Object.keys(jobSnapshot).length > 0) {
      jobInfo = JSON.stringify(jobSnapshot, null, 2);
    }
  }

  if (!jobInfo) {
    res.status(400).json({ error: "No job description available. Provide jobText or link a job to the application." });
    return;
  }

  // ── Resolve tailored CV ────────────────────────────────────────────────────
  const tailoredCvIdToUse = body.tailoredCvId ?? app.tailoredCvId;
  let parsedCvJson = null;
  let tailoredCvText: string | null = null;

  if (tailoredCvIdToUse) {
    const [tcv] = await db.select().from(tailoredCvsTable)
      .where(and(eq(tailoredCvsTable.id, tailoredCvIdToUse), eq(tailoredCvsTable.userId, userId))).limit(1);
    if (tcv) {
      tailoredCvText = (tcv.tailoredCvJson as { fullText?: string })?.fullText ?? null;
      // Get original parsed CV from source application
      if (tcv.sourceApplicationId) {
        const [srcApp] = await db.select({ parsedCvJson: applicationsTable.parsedCvJson })
          .from(applicationsTable).where(eq(applicationsTable.id, tcv.sourceApplicationId)).limit(1);
        parsedCvJson = srcApp?.parsedCvJson ?? null;
      }
    }
  }

  // Fallback: get parsedCv from sourceApplicationId on the tracked app
  if (!parsedCvJson && app.sourceApplicationId) {
    const [srcApp] = await db.select({ parsedCvJson: applicationsTable.parsedCvJson })
      .from(applicationsTable).where(eq(applicationsTable.id, app.sourceApplicationId)).limit(1);
    parsedCvJson = srcApp?.parsedCvJson ?? null;
  }

  // ── Resolve cover letter ───────────────────────────────────────────────────
  const coverLetterIdToUse = body.coverLetterId ?? app.coverLetterId;
  let coverLetterText: string | null = null;
  if (coverLetterIdToUse) {
    const [cl] = await db.select({ coverLetterText: coverLettersTable.coverLetterText })
      .from(coverLettersTable)
      .where(and(eq(coverLettersTable.id, coverLetterIdToUse), eq(coverLettersTable.userId, userId))).limit(1);
    coverLetterText = cl?.coverLetterText ?? null;
  }

  // ── Build prompt + call AI ────────────────────────────────────────────────
  const prompt = buildInterviewPrepPrompt({
    parsedCvJson,
    tailoredCvText,
    coverLetterText,
    jobInfo,
    applicationNotes: app.notes ?? null,
    companyName: app.company ?? null,
    roleTitle: app.applicationTitle,
  });

  let prepJson;
  try {
    const aiRes = await openai.responses.create({
      model: AI_MODELS.MAIN,
      instructions: "You are an expert interview coach. Respond only with valid JSON.",
      input: prompt,
      text: { format: { type: "json_object" } },
    });
    const rawText = aiRes.output_text;
    const rawParsed = JSON.parse(rawText);
    const validated = InterviewPrepJsonSchema.safeParse(rawParsed);
    if (!validated.success) {
      logger.warn({ error: validated.error }, "Interview prep JSON failed validation — using raw");
      prepJson = rawParsed;
    } else {
      prepJson = validated.data;
    }
  } catch (aiErr) {
    logger.error({ aiErr }, "Interview prep AI call failed");
    res.status(500).json({ error: "AI generation failed. Please try again." });
    return;
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  const [prep] = await db.insert(interviewPrepsTable).values({
    userId,
    applicationId: app.id,
    tailoredCvId: tailoredCvIdToUse ?? null,
    coverLetterId: coverLetterIdToUse ?? null,
    prepSummary: prepJson.prep_summary ?? null,
    prepJson,
  }).returning();

  // ── Insert per-question rows ──────────────────────────────────────────────
  if (Array.isArray(prepJson.likely_questions) && prepJson.likely_questions.length > 0) {
    await db.insert(interviewQuestionAnswersTable).values(
      prepJson.likely_questions.map((q: { question: string; why_it_matters?: string; answer_strategy?: string; answer_type?: string }, i: number) => ({
        userId,
        interviewPrepId: prep.id,
        question: q.question,
        whyItMatters: q.why_it_matters ?? null,
        answerStrategy: q.answer_strategy ?? null,
        answerDraft: null,
        answerType: q.answer_type ?? "general",
        displayOrder: i,
      })),
    );
  }

  // ── Timeline event ────────────────────────────────────────────────────────
  await createTimelineEvent({
    applicationId: app.id,
    userId,
    eventType: "interview_prep_generated",
    title: "Interview prep generated",
    description: `${prepJson.likely_questions?.length ?? 0} practice questions created`,
  });

  // ── Return ────────────────────────────────────────────────────────────────
  const questions = await db.select()
    .from(interviewQuestionAnswersTable)
    .where(eq(interviewQuestionAnswersTable.interviewPrepId, prep.id))
    .orderBy(asc(interviewQuestionAnswersTable.displayOrder));

  res.status(201).json({ prep, questions });
});

// ─── GET /api/interview-prep/list ────────────────────────────────────────────

router.get("/interview-prep/list", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const preps = await db.select().from(interviewPrepsTable)
    .where(eq(interviewPrepsTable.userId, userId))
    .orderBy(desc(interviewPrepsTable.createdAt));

  // Enrich with application title
  const enriched = await Promise.all(preps.map(async (p) => {
    if (!p.applicationId) return { ...p, applicationTitle: null, company: null };
    const [app] = await db.select({
      applicationTitle: trackedApplicationsTable.applicationTitle,
      company: trackedApplicationsTable.company,
    }).from(trackedApplicationsTable).where(eq(trackedApplicationsTable.id, p.applicationId)).limit(1);
    return { ...p, applicationTitle: app?.applicationTitle ?? null, company: app?.company ?? null };
  }));

  res.json({ preps: enriched });
});

// ─── GET /api/interview-prep/:id ─────────────────────────────────────────────

router.get("/interview-prep/:id", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [prep] = await db.select().from(interviewPrepsTable)
    .where(and(eq(interviewPrepsTable.id, req.params.id), eq(interviewPrepsTable.userId, userId))).limit(1);
  if (!prep) { res.status(404).json({ error: "Interview prep not found" }); return; }

  const questions = await db.select().from(interviewQuestionAnswersTable)
    .where(eq(interviewQuestionAnswersTable.interviewPrepId, prep.id))
    .orderBy(asc(interviewQuestionAnswersTable.displayOrder));

  let application = null;
  if (prep.applicationId) {
    const [app] = await db.select().from(trackedApplicationsTable)
      .where(eq(trackedApplicationsTable.id, prep.applicationId)).limit(1);
    application = app ?? null;
  }

  res.json({ prep, questions, application });
});

// ─── PATCH /api/interview-prep/answers/:id ───────────────────────────────────

router.patch("/interview-prep/answers/:id", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SaveAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" }); return;
  }

  await db.update(interviewQuestionAnswersTable)
    .set({ answerDraft: parsed.data.answerDraft, updatedAt: new Date() })
    .where(and(eq(interviewQuestionAnswersTable.id, req.params.id), eq(interviewQuestionAnswersTable.userId, userId)));

  res.json({ ok: true });
});

export default router;
