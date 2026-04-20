import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  trackedApplicationsTable,
  interviewPrepsTable,
  tailoredCvsTable,
  applicationsTable,
  mockInterviewSessionsTable,
  mockInterviewQuestionsTable,
  mockInterviewAnswersTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { spendCredits, canSpendCredits } from "../lib/credits.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { AI_MODELS } from "../services/ai.js";
import { createTimelineEvent } from "../lib/tracker/tracker-helpers.js";
import {
  CreateMockSessionBody,
  SaveMockAnswerBody,
  EvaluateMockAnswerBody,
  CompleteSessionBody,
  MockInterviewOutputSchema,
  AnswerFeedbackSchema,
} from "../lib/mock-interview/mock-interview-schemas.js";
import {
  buildMockInterviewPrompt,
  buildAnswerFeedbackPrompt,
} from "../lib/mock-interview/mock-interview-prompts.js";

const router: IRouter = Router();

function parsedOrFail(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: any; error?: unknown } },
  body: unknown,
  res: import("express").Response,
) {
  const r = schema.safeParse(body);
  if (!r.success) {
    res.status(400).json({ error: "Invalid request body", details: r.error });
    return null;
  }
  return r.data;
}

async function resolveApplicationContext(app: typeof trackedApplicationsTable.$inferSelect) {
  let tailoredCvText: string | null = null;
  let parsedCvJson: Record<string, unknown> | null = null;
  let jobDescription: string | null = null;

  const snap = app.jobSnapshot as Record<string, unknown> | null;
  if (snap?.description && typeof snap.description === "string") {
    jobDescription = snap.description;
  }

  if (app.tailoredCvId) {
    const [tcv] = await db.select().from(tailoredCvsTable).where(eq(tailoredCvsTable.id, app.tailoredCvId)).limit(1);
    if (tcv) {
      tailoredCvText = JSON.stringify(tcv.tailoredCvJson ?? "");
      jobDescription = jobDescription ?? tcv.jobText ?? null;
    }
  }
  if (app.sourceApplicationId) {
    const [srcApp] = await db.select({
      parsedCvJson: applicationsTable.parsedCvJson,
      jobDescription: applicationsTable.jobDescription,
    }).from(applicationsTable).where(eq(applicationsTable.id, app.sourceApplicationId)).limit(1);
    if (srcApp) {
      parsedCvJson = srcApp.parsedCvJson as Record<string, unknown> | null;
      jobDescription = jobDescription ?? srcApp.jobDescription ?? null;
    }
  }

  return { tailoredCvText, parsedCvJson, jobDescription };
}

// ─── POST /api/mock-interview/create-session ─────────────────────────────────

router.post("/mock-interview/create-session", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(CreateMockSessionBody, req.body, res);
  if (!body) return;

  const [app] = await db
    .select()
    .from(trackedApplicationsTable)
    .where(and(eq(trackedApplicationsTable.id, body.applicationId), eq(trackedApplicationsTable.userId, userId)))
    .limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  const affordable = await canSpendCredits(userId, 1);
  if (!affordable) { res.status(402).json({ error: "Insufficient credits" }); return; }
  const spendResult = await spendCredits(userId, 1, "mock_interview_session");
  if (!spendResult.success) { res.status(402).json({ error: "Insufficient credits" }); return; }

  const { tailoredCvText, parsedCvJson, jobDescription } = await resolveApplicationContext(app);

  let prepContext: { prepSummary?: string | null; likelyQuestions?: any[] } | null = null;
  if (body.interviewPrepId) {
    const [prep] = await db.select().from(interviewPrepsTable).where(
      and(eq(interviewPrepsTable.id, body.interviewPrepId), eq(interviewPrepsTable.userId, userId)),
    ).limit(1);
    if (prep) {
      const pj = prep.prepJson as Record<string, unknown>;
      prepContext = {
        prepSummary: prep.prepSummary,
        likelyQuestions: Array.isArray(pj?.likely_questions) ? (pj.likely_questions as any[]).slice(0, 5) : undefined,
      };
    }
  }

  const prompt = buildMockInterviewPrompt({
    application: {
      applicationTitle: app.applicationTitle,
      company: app.company,
      jobDescription,
    },
    candidate: { parsedCvJson, tailoredCvText },
    prep: prepContext,
    sessionType: body.sessionType,
    questionCount: body.questionCount,
  });

  let aiOutput: { session_title: string; questions: any[] };
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.MAIN,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2500,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = MockInterviewOutputSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      logger.error({ err: parsed.error }, "Mock interview AI output validation failed");
      res.status(500).json({ error: "AI returned unexpected output" });
      return;
    }
    aiOutput = parsed.data;
  } catch (err: any) {
    logger.error({ err }, "Mock interview session creation failed");
    res.status(500).json({ error: "AI generation failed" });
    return;
  }

  const [session] = await db.insert(mockInterviewSessionsTable).values({
    userId,
    applicationId: app.id,
    interviewPrepId: body.interviewPrepId ?? null,
    sessionType: body.sessionType,
    sessionTitle: aiOutput.session_title,
    status: "active",
  }).returning();

  const questionValues = aiOutput.questions.map((q, i) => ({
    sessionId: session.id,
    userId,
    question: q.question,
    answerType: q.answer_type,
    whyItMatters: q.why_it_matters ?? null,
    suggestedPoints: q.suggested_points ?? [],
    displayOrder: i,
  }));

  const questions = await db.insert(mockInterviewQuestionsTable).values(questionValues).returning();

  await createTimelineEvent({
    applicationId: app.id,
    userId,
    eventType: "mock_interview_started",
    title: `Mock interview started: ${aiOutput.session_title}`,
    metadata: { sessionId: session.id, sessionType: body.sessionType, questionCount: questions.length },
  });

  res.json({ session, questions });
});

// ─── GET /api/mock-interview/list-sessions ────────────────────────────────────

router.get("/mock-interview/list-sessions", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const applicationId = req.query.applicationId as string | undefined;

  const conditions = [eq(mockInterviewSessionsTable.userId, userId)];
  if (applicationId) conditions.push(eq(mockInterviewSessionsTable.applicationId, applicationId));

  const sessions = await db
    .select({
      id: mockInterviewSessionsTable.id,
      applicationId: mockInterviewSessionsTable.applicationId,
      interviewPrepId: mockInterviewSessionsTable.interviewPrepId,
      sessionType: mockInterviewSessionsTable.sessionType,
      sessionTitle: mockInterviewSessionsTable.sessionTitle,
      status: mockInterviewSessionsTable.status,
      createdAt: mockInterviewSessionsTable.createdAt,
      completedAt: mockInterviewSessionsTable.completedAt,
      applicationTitle: trackedApplicationsTable.applicationTitle,
      company: trackedApplicationsTable.company,
    })
    .from(mockInterviewSessionsTable)
    .leftJoin(trackedApplicationsTable, eq(mockInterviewSessionsTable.applicationId, trackedApplicationsTable.id))
    .where(and(...conditions))
    .orderBy(desc(mockInterviewSessionsTable.createdAt))
    .limit(50);

  res.json({ sessions });
});

// ─── GET /api/mock-interview/:id ──────────────────────────────────────────────

router.get("/mock-interview/:id", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;

  const [session] = await db
    .select()
    .from(mockInterviewSessionsTable)
    .where(and(eq(mockInterviewSessionsTable.id, id), eq(mockInterviewSessionsTable.userId, userId)))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const questions = await db
    .select()
    .from(mockInterviewQuestionsTable)
    .where(eq(mockInterviewQuestionsTable.sessionId, id))
    .orderBy(asc(mockInterviewQuestionsTable.displayOrder));

  const answers = await db
    .select()
    .from(mockInterviewAnswersTable)
    .where(eq(mockInterviewAnswersTable.sessionId, id));

  res.json({ session, questions, answers });
});

// ─── POST /api/mock-interview/save-answer ─────────────────────────────────────

router.post("/mock-interview/save-answer", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(SaveMockAnswerBody, req.body, res);
  if (!body) return;

  const [session] = await db
    .select({ id: mockInterviewSessionsTable.id })
    .from(mockInterviewSessionsTable)
    .where(and(eq(mockInterviewSessionsTable.id, body.sessionId), eq(mockInterviewSessionsTable.userId, userId)))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [existing] = await db
    .select({ id: mockInterviewAnswersTable.id })
    .from(mockInterviewAnswersTable)
    .where(and(
      eq(mockInterviewAnswersTable.questionId, body.questionId),
      eq(mockInterviewAnswersTable.sessionId, body.sessionId),
    ))
    .limit(1);

  let answer;
  if (existing) {
    [answer] = await db.update(mockInterviewAnswersTable)
      .set({ answerText: body.answerText, updatedAt: new Date() })
      .where(eq(mockInterviewAnswersTable.id, existing.id))
      .returning();
  } else {
    [answer] = await db.insert(mockInterviewAnswersTable).values({
      sessionId: body.sessionId,
      questionId: body.questionId,
      userId,
      answerText: body.answerText,
    }).returning();
  }

  res.json({ answer });
});

// ─── POST /api/mock-interview/evaluate-answer ─────────────────────────────────

router.post("/mock-interview/evaluate-answer", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(EvaluateMockAnswerBody, req.body, res);
  if (!body) return;

  const [session] = await db
    .select()
    .from(mockInterviewSessionsTable)
    .where(and(eq(mockInterviewSessionsTable.id, body.sessionId), eq(mockInterviewSessionsTable.userId, userId)))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [question] = await db
    .select()
    .from(mockInterviewQuestionsTable)
    .where(and(eq(mockInterviewQuestionsTable.id, body.questionId), eq(mockInterviewQuestionsTable.sessionId, body.sessionId)))
    .limit(1);
  if (!question) { res.status(404).json({ error: "Question not found" }); return; }

  const affordable = await canSpendCredits(userId, 1);
  if (!affordable) { res.status(402).json({ error: "Insufficient credits" }); return; }
  const spendResult = await spendCredits(userId, 1, "mock_interview_evaluate");
  if (!spendResult.success) { res.status(402).json({ error: "Insufficient credits" }); return; }

  let appContext: { applicationTitle: string; company: string | null; jobDescription: string | null } = {
    applicationTitle: "Unknown role",
    company: null,
    jobDescription: null,
  };
  let candidate = { parsedCvJson: null as Record<string, unknown> | null, tailoredCvText: null as string | null };

  if (session.applicationId) {
    const [app] = await db.select().from(trackedApplicationsTable).where(eq(trackedApplicationsTable.id, session.applicationId)).limit(1);
    if (app) {
      const resolved = await resolveApplicationContext(app);
      appContext = { applicationTitle: app.applicationTitle, company: app.company, jobDescription: resolved.jobDescription };
      candidate = { parsedCvJson: resolved.parsedCvJson, tailoredCvText: resolved.tailoredCvText };
    }
  }

  const prompt = buildAnswerFeedbackPrompt({
    question: question.question,
    answerType: question.answerType,
    whyItMatters: question.whyItMatters,
    answerText: body.answerText,
    application: appContext,
    candidate,
  });

  let feedback: ReturnType<typeof AnswerFeedbackSchema.parse>;
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.MAIN,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 1200,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = AnswerFeedbackSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      logger.error({ err: parsed.error }, "Answer feedback AI output validation failed");
      res.status(500).json({ error: "AI returned unexpected output" });
      return;
    }
    feedback = parsed.data;
  } catch (err: any) {
    logger.error({ err }, "Answer evaluation failed");
    res.status(500).json({ error: "AI evaluation failed" });
    return;
  }

  const [existing] = await db
    .select({ id: mockInterviewAnswersTable.id })
    .from(mockInterviewAnswersTable)
    .where(and(
      eq(mockInterviewAnswersTable.questionId, body.questionId),
      eq(mockInterviewAnswersTable.sessionId, body.sessionId),
    ))
    .limit(1);

  let answer;
  if (existing) {
    [answer] = await db.update(mockInterviewAnswersTable)
      .set({ answerText: body.answerText, aiFeedback: feedback, score: feedback.score, updatedAt: new Date() })
      .where(eq(mockInterviewAnswersTable.id, existing.id))
      .returning();
  } else {
    [answer] = await db.insert(mockInterviewAnswersTable).values({
      sessionId: body.sessionId,
      questionId: body.questionId,
      userId,
      answerText: body.answerText,
      aiFeedback: feedback,
      score: feedback.score,
    }).returning();
  }

  res.json({ answer, feedback });
});

// ─── POST /api/mock-interview/complete-session ────────────────────────────────

router.post("/mock-interview/complete-session", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(CompleteSessionBody, req.body, res);
  if (!body) return;

  const [session] = await db
    .select()
    .from(mockInterviewSessionsTable)
    .where(and(eq(mockInterviewSessionsTable.id, body.sessionId), eq(mockInterviewSessionsTable.userId, userId)))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [updated] = await db
    .update(mockInterviewSessionsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(mockInterviewSessionsTable.id, body.sessionId))
    .returning();

  if (session.applicationId) {
    await createTimelineEvent({
      applicationId: session.applicationId,
      userId,
      eventType: "mock_interview_completed",
      title: `Mock interview completed: ${session.sessionTitle ?? "Session"}`,
      metadata: { sessionId: session.id },
    });
  }

  res.json({ session: updated });
});

export default router;
