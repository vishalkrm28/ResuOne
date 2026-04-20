import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  savedJobsTable,
  trackedApplicationsTable,
  applicationTimelineEventsTable,
  applicationRemindersTable,
  tailoredCvsTable,
  coverLettersTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  SaveJobBody,
  CreateTrackedAppBody,
  UpdateStageBody,
  UpdateNotesBody,
  LinkAssetsBody,
  AddTimelineEventBody,
  CreateReminderBody,
  type ApplicationStage,
} from "../lib/tracker/tracker-schemas.js";
import {
  createTimelineEvent,
  buildJobSnapshot,
  assertAppOwnership,
} from "../lib/tracker/tracker-helpers.js";

const router: IRouter = Router();

// ─── Helper: parse & respond on Zod failure ──────────────────────────────────

function parsedOrFail(schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: unknown } }, body: unknown, res: import("express").Response) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body", details: result.error });
    return null;
  }
  return result.data;
}

// ─── POST /api/tracker/saved-jobs ─────────────────────────────────────────────

router.post("/tracker/saved-jobs", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(SaveJobBody, req.body, res);
  if (!body) return;

  // Deduplicate: same user + same externalJobCacheId
  if (body.externalJobCacheId) {
    const [existing] = await db
      .select({ id: savedJobsTable.id })
      .from(savedJobsTable)
      .where(and(eq(savedJobsTable.userId, userId), eq(savedJobsTable.externalJobCacheId, body.externalJobCacheId)))
      .limit(1);
    if (existing) {
      res.status(200).json({ savedJob: existing, alreadySaved: true });
      return;
    }
  }

  const [savedJob] = await db.insert(savedJobsTable).values({
    userId,
    externalJobCacheId: body.externalJobCacheId ?? null,
    sourceApplicationId: body.sourceApplicationId ?? null,
    jobTitle: body.jobTitle,
    company: body.company ?? null,
    location: body.location ?? null,
    employmentType: body.employmentType ?? null,
    remoteType: body.remoteType ?? null,
    salaryMin: body.salaryMin?.toString() ?? null,
    salaryMax: body.salaryMax?.toString() ?? null,
    currency: body.currency ?? null,
    applyUrl: body.applyUrl ?? null,
    jobSnapshot: buildJobSnapshot({
      title: body.jobTitle,
      company: body.company,
      location: body.location,
      employmentType: body.employmentType,
      remoteType: body.remoteType,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      currency: body.currency,
      applyUrl: body.applyUrl,
    }),
  }).returning();

  res.status(201).json({ savedJob, alreadySaved: false });
});

// ─── GET /api/tracker/saved-jobs ──────────────────────────────────────────────

router.get("/tracker/saved-jobs", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const jobs = await db
    .select()
    .from(savedJobsTable)
    .where(eq(savedJobsTable.userId, userId))
    .orderBy(desc(savedJobsTable.createdAt));

  res.json({ savedJobs: jobs });
});

// ─── DELETE /api/tracker/saved-jobs/:id ───────────────────────────────────────

router.delete("/tracker/saved-jobs/:id", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.delete(savedJobsTable).where(
    and(eq(savedJobsTable.id, req.params.id), eq(savedJobsTable.userId, userId)),
  );
  res.json({ ok: true });
});

// ─── POST /api/tracker/apps ───────────────────────────────────────────────────

router.post("/tracker/apps", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(CreateTrackedAppBody, req.body, res) as import("../lib/tracker/tracker-schemas.js").CreateTrackedAppBody | null;
  if (!body) return;

  // Derive initial stage: if assets already linked → preparing, else saved
  const initialStage = body.tailoredCvId || body.coverLetterId ? "preparing" : "saved";

  // Build job snapshot from saved job if available
  let jobSnapshot = body.jobSnapshot ?? {};
  if (body.savedJobId && Object.keys(jobSnapshot).length === 0) {
    const [sj] = await db.select().from(savedJobsTable).where(
      and(eq(savedJobsTable.id, body.savedJobId), eq(savedJobsTable.userId, userId)),
    ).limit(1);
    if (sj) jobSnapshot = sj.jobSnapshot as Record<string, unknown>;
  }

  const [app] = await db.insert(trackedApplicationsTable).values({
    userId,
    savedJobId: body.savedJobId ?? null,
    externalJobCacheId: body.externalJobCacheId ?? null,
    sourceApplicationId: body.sourceApplicationId ?? null,
    tailoredCvId: body.tailoredCvId ?? null,
    coverLetterId: body.coverLetterId ?? null,
    applicationTitle: body.applicationTitle,
    company: body.company ?? null,
    location: body.location ?? null,
    applyUrl: body.applyUrl ?? null,
    stage: initialStage,
    status: "active",
    notes: body.notes ?? null,
    jobSnapshot,
  }).returning();

  await createTimelineEvent({
    applicationId: app.id,
    userId,
    eventType: "application_created",
    title: "Application created",
    description: `Started tracking application for ${app.applicationTitle}`,
  });

  res.status(201).json({ app });
});

// ─── GET /api/tracker/apps ────────────────────────────────────────────────────

router.get("/tracker/apps", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const status = (req.query.status as string) || "active";

  const apps = await db
    .select()
    .from(trackedApplicationsTable)
    .where(and(eq(trackedApplicationsTable.userId, userId), eq(trackedApplicationsTable.status, status)))
    .orderBy(desc(trackedApplicationsTable.updatedAt));

  res.json({ apps });
});

// ─── GET /api/tracker/apps/:id ────────────────────────────────────────────────

router.get("/tracker/apps/:id", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [app] = await db
    .select()
    .from(trackedApplicationsTable)
    .where(and(eq(trackedApplicationsTable.id, req.params.id), eq(trackedApplicationsTable.userId, userId)))
    .limit(1);

  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  // Fetch linked assets
  const [tailoredCv, coverLetter] = await Promise.all([
    app.tailoredCvId
      ? db.select({ id: tailoredCvsTable.id, versionName: tailoredCvsTable.versionName })
          .from(tailoredCvsTable).where(eq(tailoredCvsTable.id, app.tailoredCvId)).limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    app.coverLetterId
      ? db.select({ id: coverLettersTable.id, jobTitle: coverLettersTable.jobTitle, tone: coverLettersTable.tone })
          .from(coverLettersTable).where(eq(coverLettersTable.id, app.coverLetterId)).limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  // Fetch timeline
  const timeline = await db
    .select()
    .from(applicationTimelineEventsTable)
    .where(eq(applicationTimelineEventsTable.applicationId, app.id))
    .orderBy(desc(applicationTimelineEventsTable.eventAt));

  // Fetch upcoming reminders
  const reminders = await db
    .select()
    .from(applicationRemindersTable)
    .where(and(eq(applicationRemindersTable.applicationId, app.id), eq(applicationRemindersTable.isCompleted, false)))
    .orderBy(applicationRemindersTable.reminderAt);

  res.json({ app, tailoredCv, coverLetter, timeline, reminders });
});

// ─── PATCH /api/tracker/apps/:id/stage ───────────────────────────────────────

router.patch("/tracker/apps/:id/stage", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(UpdateStageBody, req.body, res) as { stage: import("../lib/tracker/tracker-schemas.js").ApplicationStage } | null;
  if (!body) return;

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  const now = new Date();
  const setApplied = body.stage === "applied" && !app.appliedAt;

  await db.update(trackedApplicationsTable)
    .set({
      stage: body.stage,
      updatedAt: now,
      ...(setApplied ? { appliedAt: now } : {}),
    })
    .where(eq(trackedApplicationsTable.id, app.id));

  await createTimelineEvent({
    applicationId: app.id,
    userId,
    eventType: "stage_changed",
    title: `Stage updated to ${body.stage.replace(/_/g, " ")}`,
    metadata: { previousStage: app.stage, newStage: body.stage },
  });

  res.json({ ok: true, stage: body.stage });
});

// ─── PATCH /api/tracker/apps/:id/notes ───────────────────────────────────────

router.patch("/tracker/apps/:id/notes", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(UpdateNotesBody, req.body, res);
  if (!body) return;

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  await db.update(trackedApplicationsTable)
    .set({ notes: (body as { notes: string }).notes, updatedAt: new Date() })
    .where(eq(trackedApplicationsTable.id, app.id));

  res.json({ ok: true });
});

// ─── PATCH /api/tracker/apps/:id/assets ──────────────────────────────────────

router.patch("/tracker/apps/:id/assets", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(LinkAssetsBody, req.body, res);
  if (!body) return;

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  const b = body as { tailoredCvId?: string | null; coverLetterId?: string | null };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (b.tailoredCvId !== undefined) updates.tailoredCvId = b.tailoredCvId;
  if (b.coverLetterId !== undefined) updates.coverLetterId = b.coverLetterId;

  await db.update(trackedApplicationsTable)
    .set(updates as Parameters<typeof db.update>[0])
    .where(eq(trackedApplicationsTable.id, app.id));

  if (b.tailoredCvId !== undefined || b.coverLetterId !== undefined) {
    await createTimelineEvent({
      applicationId: app.id,
      userId,
      eventType: "assets_linked",
      title: "Application assets updated",
      description: [
        b.tailoredCvId ? "Tailored CV linked" : null,
        b.coverLetterId ? "Cover letter linked" : null,
      ].filter(Boolean).join(", "),
    });
  }

  res.json({ ok: true });
});

// ─── PATCH /api/tracker/apps/:id/status ──────────────────────────────────────

router.patch("/tracker/apps/:id/status", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { status } = req.body;
  if (!["active", "archived", "closed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  await db.update(trackedApplicationsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(trackedApplicationsTable.id, app.id));

  res.json({ ok: true, status });
});

// ─── POST /api/tracker/apps/:id/timeline ─────────────────────────────────────

router.post("/tracker/apps/:id/timeline", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(AddTimelineEventBody, req.body, res);
  if (!body) return;

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  const b = body as import("../lib/tracker/tracker-schemas.js").AddTimelineEventBody;
  const [event] = await db.insert(applicationTimelineEventsTable).values({
    applicationId: app.id,
    userId,
    eventType: b.eventType,
    title: b.title,
    description: b.description ?? null,
    eventAt: b.eventAt ? new Date(b.eventAt) : new Date(),
    metadata: b.metadata ?? {},
  }).returning();

  res.status(201).json({ event });
});

// ─── POST /api/tracker/apps/:id/reminders ────────────────────────────────────

router.post("/tracker/apps/:id/reminders", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = parsedOrFail(CreateReminderBody, req.body, res);
  if (!body) return;

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  const b = body as import("../lib/tracker/tracker-schemas.js").CreateReminderBody;
  const [reminder] = await db.insert(applicationRemindersTable).values({
    userId,
    applicationId: app.id,
    reminderType: b.reminderType,
    reminderAt: new Date(b.reminderAt),
    reminderNote: b.reminderNote ?? null,
  }).returning();

  res.status(201).json({ reminder });
});

// ─── GET /api/tracker/apps/:id/reminders ─────────────────────────────────────

router.get("/tracker/apps/:id/reminders", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const app = await assertAppOwnership(req.params.id, userId).catch((e) => {
    res.status(e.status ?? 500).json({ error: e.message ?? "Error" });
    return null;
  });
  if (!app) return;

  const reminders = await db
    .select()
    .from(applicationRemindersTable)
    .where(eq(applicationRemindersTable.applicationId, app.id))
    .orderBy(applicationRemindersTable.reminderAt);

  res.json({ reminders });
});

// ─── PATCH /api/tracker/reminders/:id/complete ───────────────────────────────

router.patch("/tracker/reminders/:id/complete", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.update(applicationRemindersTable)
    .set({ isCompleted: true })
    .where(and(eq(applicationRemindersTable.id, req.params.id), eq(applicationRemindersTable.userId, userId)));

  res.json({ ok: true });
});

// ─── GET /api/tracker/reminders (upcoming across all apps) ───────────────────

router.get("/tracker/reminders", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const reminders = await db
    .select()
    .from(applicationRemindersTable)
    .where(and(eq(applicationRemindersTable.userId, userId), eq(applicationRemindersTable.isCompleted, false)))
    .orderBy(applicationRemindersTable.reminderAt);

  res.json({ reminders });
});

export default router;
