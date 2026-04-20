import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  applicationInterviewsTable,
  trackedApplicationsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { createTimelineEvent } from "../lib/tracker/tracker-helpers.js";
import {
  CreateInterviewBody,
  UpdateInterviewBody,
} from "../lib/mock-interview/mock-interview-schemas.js";

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

const STAGE_ORDER = [
  "saved", "preparing", "applied", "screening",
  "interview", "final_round", "offer", "rejected", "withdrawn",
];

function stageIndex(s: string): number {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

// ─── POST /api/interviews/create ──────────────────────────────────────────────

router.post("/interviews/create", authMiddleware, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(CreateInterviewBody, req.body, res);
  if (!body) return;

  const [app] = await db
    .select()
    .from(trackedApplicationsTable)
    .where(and(eq(trackedApplicationsTable.id, body.applicationId), eq(trackedApplicationsTable.userId, userId)))
    .limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  const [interview] = await db.insert(applicationInterviewsTable).values({
    userId,
    applicationId: app.id,
    interviewType: body.interviewType,
    title: body.title,
    scheduledAt: new Date(body.scheduledAt),
    timezone: body.timezone ?? null,
    location: body.location ?? null,
    meetingUrl: body.meetingUrl ?? null,
    notes: body.notes ?? null,
    status: "scheduled",
  }).returning();

  await createTimelineEvent({
    applicationId: app.id,
    userId,
    eventType: "interview_scheduled",
    title: `Interview scheduled: ${body.title}`,
    description: `${body.interviewType.replace(/_/g, " ")} interview on ${new Date(body.scheduledAt).toLocaleDateString()}`,
    metadata: { interviewId: interview.id, interviewType: body.interviewType },
  });

  if (stageIndex(app.stage) < stageIndex("interview")) {
    await db.update(trackedApplicationsTable)
      .set({ stage: "interview", updatedAt: new Date() })
      .where(eq(trackedApplicationsTable.id, app.id));

    await createTimelineEvent({
      applicationId: app.id,
      userId,
      eventType: "stage_changed",
      title: "Stage advanced to Interview",
      metadata: { fromStage: app.stage, toStage: "interview" },
    });
  }

  res.json({ interview });
});

// ─── GET /api/interviews/list ─────────────────────────────────────────────────

router.get("/interviews/list", authMiddleware, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const applicationId = req.query.applicationId as string | undefined;

  const conditions = [eq(applicationInterviewsTable.userId, userId)];
  if (applicationId) conditions.push(eq(applicationInterviewsTable.applicationId, applicationId));

  const interviews = await db
    .select({
      id: applicationInterviewsTable.id,
      applicationId: applicationInterviewsTable.applicationId,
      interviewType: applicationInterviewsTable.interviewType,
      title: applicationInterviewsTable.title,
      scheduledAt: applicationInterviewsTable.scheduledAt,
      timezone: applicationInterviewsTable.timezone,
      location: applicationInterviewsTable.location,
      meetingUrl: applicationInterviewsTable.meetingUrl,
      notes: applicationInterviewsTable.notes,
      status: applicationInterviewsTable.status,
      createdAt: applicationInterviewsTable.createdAt,
      applicationTitle: trackedApplicationsTable.applicationTitle,
      company: trackedApplicationsTable.company,
    })
    .from(applicationInterviewsTable)
    .leftJoin(trackedApplicationsTable, eq(applicationInterviewsTable.applicationId, trackedApplicationsTable.id))
    .where(and(...conditions))
    .orderBy(asc(applicationInterviewsTable.scheduledAt))
    .limit(100);

  res.json({ interviews });
});

// ─── PATCH /api/interviews/:id ────────────────────────────────────────────────

router.patch("/interviews/:id", authMiddleware, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;

  const body = parsedOrFail(UpdateInterviewBody, req.body, res);
  if (!body) return;

  const [existing] = await db
    .select()
    .from(applicationInterviewsTable)
    .where(and(eq(applicationInterviewsTable.id, id), eq(applicationInterviewsTable.userId, userId)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Interview not found" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.interviewType !== undefined) updates.interviewType = body.interviewType;
  if (body.scheduledAt !== undefined) updates.scheduledAt = new Date(body.scheduledAt);
  if (body.timezone !== undefined) updates.timezone = body.timezone;
  if (body.location !== undefined) updates.location = body.location;
  if (body.meetingUrl !== undefined) updates.meetingUrl = body.meetingUrl;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.status !== undefined) updates.status = body.status;

  const [updated] = await db
    .update(applicationInterviewsTable)
    .set(updates as any)
    .where(eq(applicationInterviewsTable.id, id))
    .returning();

  if (body.status === "completed" && existing.applicationId) {
    await createTimelineEvent({
      applicationId: existing.applicationId,
      userId,
      eventType: "interview_completed",
      title: `Interview completed: ${updated.title}`,
      metadata: { interviewId: updated.id },
    });
  }

  res.json({ interview: updated });
});

export default router;
