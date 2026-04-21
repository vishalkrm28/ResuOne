import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  calendarSyncConnectionsTable,
  calendarSyncEventsTable,
  applicationInterviewsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";
import { CreateCalendarEventBody } from "../lib/notifications/notification-schemas.js";
import {
  buildCalendarEventPayload,
  createGoogleCalendarEvent,
} from "../lib/integrations/calendar-helpers.js";

const router: IRouter = Router();

function fail(schema: { safeParse: (v: unknown) => { success: boolean; data?: any; error?: unknown } }, body: unknown, res: import("express").Response) {
  const r = schema.safeParse(body);
  if (!r.success) { res.status(400).json({ error: "Invalid request", details: r.error }); return null; }
  return r.data;
}

// ─── GET /api/calendar/connect-status ────────────────────────────────────────
// Google Calendar is connected at the workspace level via Replit connectors.

router.get("/calendar/connect-status", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Ensure a "connected" row exists for google in the DB so the UI reflects it
  const [existing] = await db
    .select()
    .from(calendarSyncConnectionsTable)
    .where(
      and(
        eq(calendarSyncConnectionsTable.userId, userId),
        eq(calendarSyncConnectionsTable.provider, "google"),
      ),
    )
    .limit(1);

  if (!existing) {
    await db
      .insert(calendarSyncConnectionsTable)
      .values({ userId, provider: "google", status: "connected", providerEmail: null })
      .onConflictDoNothing();
  } else if (existing.status !== "connected") {
    await db
      .update(calendarSyncConnectionsTable)
      .set({ status: "connected" })
      .where(eq(calendarSyncConnectionsTable.id, existing.id));
  }

  res.json({
    connections: {
      google: { status: "connected", providerEmail: existing?.providerEmail ?? null },
      outlook: { status: "not_connected", providerEmail: null },
    },
  });
});

// ─── POST /api/calendar/create-event ─────────────────────────────────────────

router.post("/calendar/create-event", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = fail(CreateCalendarEventBody, req.body, res);
  if (!body) return;

  if (body.provider !== "google") {
    res.status(400).json({ error: "Only Google Calendar is supported right now." });
    return;
  }

  // Verify interview belongs to user
  const [interview] = await db
    .select()
    .from(applicationInterviewsTable)
    .where(and(eq(applicationInterviewsTable.id, body.interviewId), eq(applicationInterviewsTable.userId, userId)))
    .limit(1);
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  const payload = buildCalendarEventPayload({
    title: body.title,
    scheduledAt: body.scheduledAt,
    timezone: body.timezone,
    location: body.location,
    meetingUrl: body.meetingUrl,
    notes: body.notes,
    interviewId: body.interviewId,
    applicationId: body.applicationId,
  });

  logger.info({ userId, interviewId: body.interviewId }, "Creating Google Calendar event");

  const { externalEventId, synced, error } = await createGoogleCalendarEvent(payload);

  if (!synced) {
    logger.warn({ userId, error }, "Google Calendar sync failed — storing as pending");
  }

  const [syncEvent] = await db
    .insert(calendarSyncEventsTable)
    .values({
      userId,
      applicationId: body.applicationId ?? null,
      interviewId: body.interviewId,
      provider: "google",
      externalEventId,
      syncStatus: synced ? "synced" : "pending",
      payload: payload as Record<string, unknown>,
    })
    .returning();

  res.status(201).json({
    syncEvent,
    synced,
    message: synced
      ? "Interview added to your Google Calendar."
      : "Could not reach Google Calendar right now — we'll retry shortly.",
  });
});

// ─── GET /api/calendar/events ─────────────────────────────────────────────────

router.get("/calendar/events", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const applicationId = req.query.applicationId as string | undefined;

  const conditions = [eq(calendarSyncEventsTable.userId, userId)];
  if (applicationId) {
    conditions.push(eq(calendarSyncEventsTable.applicationId, applicationId));
  }

  const events = await db
    .select()
    .from(calendarSyncEventsTable)
    .where(and(...conditions))
    .orderBy(desc(calendarSyncEventsTable.createdAt))
    .limit(50);

  res.json({ events });
});

export default router;
