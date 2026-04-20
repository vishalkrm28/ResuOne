import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  applicationEmailDraftsTable,
  trackedApplicationsTable,
  tailoredCvsTable,
  coverLettersTable,
  applicationsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { spendCredits, canSpendCredits } from "../lib/credits.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { AI_MODELS } from "../services/ai.js";
import {
  GenerateEmailDraftBody,
  UpdateDraftStatusBody,
  EmailDraftOutputSchema,
} from "../lib/emails/email-schemas.js";
import { buildEmailPrompt } from "../lib/emails/email-prompts.js";

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

// ─── POST /api/emails/generate-draft ─────────────────────────────────────────

router.post("/emails/generate-draft", authMiddleware, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(GenerateEmailDraftBody, req.body, res);
  if (!body) return;

  const [app] = await db
    .select()
    .from(trackedApplicationsTable)
    .where(and(eq(trackedApplicationsTable.id, body.applicationId), eq(trackedApplicationsTable.userId, userId)))
    .limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  const affordable = await canSpendCredits(userId, 1);
  if (!affordable) { res.status(402).json({ error: "Insufficient credits" }); return; }

  const spendResult = await spendCredits(userId, 1, "email_draft");
  if (!spendResult.success) { res.status(402).json({ error: "Insufficient credits" }); return; }

  let tailoredCvText: string | null = null;
  let coverLetterText: string | null = null;
  let candidateName: string | null = null;

  if (app.tailoredCvId) {
    const [tcv] = await db.select().from(tailoredCvsTable).where(eq(tailoredCvsTable.id, app.tailoredCvId)).limit(1);
    if (tcv) tailoredCvText = JSON.stringify(tcv.tailoredCvJson ?? "");
  }
  if (app.coverLetterId) {
    const [cl] = await db.select().from(coverLettersTable).where(eq(coverLettersTable.id, app.coverLetterId)).limit(1);
    if (cl) coverLetterText = cl.coverLetterText;
  }
  if (app.sourceApplicationId) {
    const [srcApp] = await db.select({ parsedCvJson: applicationsTable.parsedCvJson }).from(applicationsTable).where(eq(applicationsTable.id, app.sourceApplicationId)).limit(1);
    const p = srcApp?.parsedCvJson as Record<string, unknown> | null;
    if (p?.name && typeof p.name === "string") candidateName = p.name;
  }

  let jobDescription: string | null = null;
  const snap = app.jobSnapshot as Record<string, unknown> | null;
  if (snap?.description && typeof snap.description === "string") {
    jobDescription = snap.description;
  }

  const prompt = buildEmailPrompt({
    draftType: body.draftType,
    application: {
      applicationTitle: app.applicationTitle,
      company: app.company,
      stage: app.stage,
      jobDescription,
      notes: app.notes,
    },
    cv: { candidateName, tailoredCvText, coverLetterText },
    extraContext: body.extraContext,
    tone: body.tone,
  });

  let aiOutput: { subject: string; body_text: string };
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.FAST,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 900,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = EmailDraftOutputSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      logger.error({ err: parsed.error }, "Email draft AI output failed validation");
      res.status(500).json({ error: "AI returned unexpected output" });
      return;
    }
    aiOutput = parsed.data;
  } catch (err: any) {
    logger.error({ err }, "Email draft generation failed");
    res.status(500).json({ error: "AI generation failed" });
    return;
  }

  const [draft] = await db.insert(applicationEmailDraftsTable).values({
    userId,
    applicationId: app.id,
    draftType: body.draftType,
    subject: aiOutput.subject,
    bodyText: aiOutput.body_text,
    tone: body.tone,
    status: "draft",
  }).returning();

  res.json({ draft });
});

// ─── GET /api/emails/list-drafts ──────────────────────────────────────────────

router.get("/emails/list-drafts", authMiddleware, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const applicationId = req.query.applicationId as string | undefined;

  const conditions = [eq(applicationEmailDraftsTable.userId, userId)];
  if (applicationId) conditions.push(eq(applicationEmailDraftsTable.applicationId, applicationId));

  const drafts = await db
    .select({
      id: applicationEmailDraftsTable.id,
      applicationId: applicationEmailDraftsTable.applicationId,
      draftType: applicationEmailDraftsTable.draftType,
      subject: applicationEmailDraftsTable.subject,
      bodyText: applicationEmailDraftsTable.bodyText,
      tone: applicationEmailDraftsTable.tone,
      status: applicationEmailDraftsTable.status,
      createdAt: applicationEmailDraftsTable.createdAt,
      updatedAt: applicationEmailDraftsTable.updatedAt,
      applicationTitle: trackedApplicationsTable.applicationTitle,
      company: trackedApplicationsTable.company,
    })
    .from(applicationEmailDraftsTable)
    .leftJoin(trackedApplicationsTable, eq(applicationEmailDraftsTable.applicationId, trackedApplicationsTable.id))
    .where(and(...conditions))
    .orderBy(desc(applicationEmailDraftsTable.createdAt))
    .limit(100);

  res.json({ drafts });
});

// ─── PATCH /api/emails/update-draft-status ────────────────────────────────────

router.patch("/emails/update-draft-status", authMiddleware, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(UpdateDraftStatusBody, req.body, res);
  if (!body) return;

  const [draft] = await db
    .select({ id: applicationEmailDraftsTable.id })
    .from(applicationEmailDraftsTable)
    .where(and(eq(applicationEmailDraftsTable.id, body.draftId), eq(applicationEmailDraftsTable.userId, userId)))
    .limit(1);
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }

  const [updated] = await db
    .update(applicationEmailDraftsTable)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(applicationEmailDraftsTable.id, body.draftId))
    .returning();

  res.json({ draft: updated });
});

export default router;
