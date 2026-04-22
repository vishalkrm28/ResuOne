import { Router } from "express";
import { z } from "zod";
import {
  db,
  internalJobInterviewInvitesTable,
  internalJobApplicationsTable,
  internalJobsTable,
  notificationItemsTable,
} from "@workspace/db";
import { eq, and, desc, or, lt, count } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { createApplicationEvent } from "../lib/internal-jobs/events.js";

const router = Router();

// ─── POST /internal-job-interviews — recruiter creates invite ─────────────────

const CreateInviteSchema = z.object({
  applicationId: z.string(),
  inviteTitle: z.string().min(1).max(200),
  interviewType: z.enum(["recruiter_screen", "hiring_manager", "technical", "case_study", "final_round", "general"]).optional().default("general"),
  scheduledAt: z.string().datetime(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  meetingUrl: z.string().optional().transform((v) => {
    if (!v) return undefined;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }),
  notes: z.string().optional(),
});

router.post("/internal-job-interviews", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const parsed = CreateInviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  try {
    const [app] = await db
      .select({ applicantUserId: internalJobApplicationsTable.applicantUserId, jobId: internalJobApplicationsTable.jobId })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, parsed.data.applicationId))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId, title: internalJobsTable.title })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, app.jobId))
      .limit(1);

    if (!job || job.postedByUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    const [invite] = await db
      .insert(internalJobInterviewInvitesTable)
      .values({
        applicationId: parsed.data.applicationId,
        jobId: app.jobId,
        recruiterUserId: req.user.id,
        candidateUserId: app.applicantUserId,
        inviteTitle: parsed.data.inviteTitle,
        interviewType: parsed.data.interviewType,
        scheduledAt: new Date(parsed.data.scheduledAt),
        timezone: parsed.data.timezone ?? null,
        location: parsed.data.location ?? null,
        meetingUrl: parsed.data.meetingUrl ?? null,
        notes: parsed.data.notes ?? null,
        status: "pending",
      })
      .returning();

    // Move application to interview stage
    await db
      .update(internalJobApplicationsTable)
      .set({ status: "interview", stage: "interview", updatedAt: new Date() })
      .where(eq(internalJobApplicationsTable.id, parsed.data.applicationId));

    await createApplicationEvent({
      applicationId: parsed.data.applicationId,
      actorType: "recruiter",
      actorUserId: req.user.id,
      eventType: "interview_requested",
      title: `Interview invite sent: ${parsed.data.inviteTitle}`,
      metadata: { interviewType: parsed.data.interviewType, scheduledAt: parsed.data.scheduledAt },
    });

    // Notify candidate
    await db.insert(notificationItemsTable).values({
      userId: app.applicantUserId,
      type: "interview_invite",
      title: `Interview invite: ${parsed.data.inviteTitle}`,
      body: `${job.title} — scheduled ${new Date(parsed.data.scheduledAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`,
      actionLabel: "View Invite",
      actionUrl: `/jobs/exclusive/application/${parsed.data.applicationId}`,
      priority: "high",
      status: "pending",
    }).catch(() => {});

    res.status(201).json({ invite });
  } catch (err) {
    logger.error({ err }, "Failed to create interview invite");
    res.status(500).json({ error: "Failed to create invite" });
  }
});

// ─── GET /internal-job-interviews/candidate — candidate's invites ─────────────

router.get("/internal-job-interviews/candidate", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const invites = await db
      .select({
        id: internalJobInterviewInvitesTable.id,
        applicationId: internalJobInterviewInvitesTable.applicationId,
        jobId: internalJobInterviewInvitesTable.jobId,
        inviteTitle: internalJobInterviewInvitesTable.inviteTitle,
        interviewType: internalJobInterviewInvitesTable.interviewType,
        scheduledAt: internalJobInterviewInvitesTable.scheduledAt,
        timezone: internalJobInterviewInvitesTable.timezone,
        location: internalJobInterviewInvitesTable.location,
        meetingUrl: internalJobInterviewInvitesTable.meetingUrl,
        notes: internalJobInterviewInvitesTable.notes,
        status: internalJobInterviewInvitesTable.status,
        candidateResponseNote: internalJobInterviewInvitesTable.candidateResponseNote,
        createdAt: internalJobInterviewInvitesTable.createdAt,
        jobTitle: internalJobsTable.title,
        jobCompany: internalJobsTable.company,
      })
      .from(internalJobInterviewInvitesTable)
      .leftJoin(internalJobsTable, eq(internalJobInterviewInvitesTable.jobId, internalJobsTable.id))
      .where(eq(internalJobInterviewInvitesTable.candidateUserId, req.user.id) as any)
      .orderBy(desc(internalJobInterviewInvitesTable.scheduledAt));

    res.json({ invites });
  } catch (err) {
    logger.error({ err }, "Failed to load candidate invites");
    res.status(500).json({ error: "Failed to load invites" });
  }
});

// ─── GET /internal-job-interviews/recruiter — recruiter's invites ─────────────

router.get("/internal-job-interviews/recruiter", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const invites = await db
      .select({
        id: internalJobInterviewInvitesTable.id,
        applicationId: internalJobInterviewInvitesTable.applicationId,
        jobId: internalJobInterviewInvitesTable.jobId,
        inviteTitle: internalJobInterviewInvitesTable.inviteTitle,
        interviewType: internalJobInterviewInvitesTable.interviewType,
        scheduledAt: internalJobInterviewInvitesTable.scheduledAt,
        timezone: internalJobInterviewInvitesTable.timezone,
        location: internalJobInterviewInvitesTable.location,
        meetingUrl: internalJobInterviewInvitesTable.meetingUrl,
        notes: internalJobInterviewInvitesTable.notes,
        status: internalJobInterviewInvitesTable.status,
        candidateResponseNote: internalJobInterviewInvitesTable.candidateResponseNote,
        candidateUserId: internalJobInterviewInvitesTable.candidateUserId,
        createdAt: internalJobInterviewInvitesTable.createdAt,
        jobTitle: internalJobsTable.title,
        jobCompany: internalJobsTable.company,
      })
      .from(internalJobInterviewInvitesTable)
      .leftJoin(internalJobsTable, eq(internalJobInterviewInvitesTable.jobId, internalJobsTable.id))
      .where(eq(internalJobInterviewInvitesTable.recruiterUserId, req.user.id) as any)
      .orderBy(desc(internalJobInterviewInvitesTable.scheduledAt));

    res.json({ invites });
  } catch (err) {
    logger.error({ err }, "Failed to load recruiter invites");
    res.status(500).json({ error: "Failed to load invites" });
  }
});

// ─── GET /internal-job-interviews/:applicationId — invites for an application ─

router.get("/internal-job-interviews/application/:applicationId", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [app] = await db
      .select({ applicantUserId: internalJobApplicationsTable.applicantUserId, jobId: internalJobApplicationsTable.jobId })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, req.params.applicationId))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Not found" }); return; }

    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, app.jobId))
      .limit(1);

    if (app.applicantUserId !== req.user.id && job?.postedByUserId !== req.user.id) {
      res.status(403).json({ error: "Not authorized" }); return;
    }

    const invites = await db
      .select()
      .from(internalJobInterviewInvitesTable)
      .where(eq(internalJobInterviewInvitesTable.applicationId, req.params.applicationId))
      .orderBy(desc(internalJobInterviewInvitesTable.scheduledAt));

    res.json({ invites });
  } catch (err) {
    logger.error({ err }, "Failed to load application invites");
    res.status(500).json({ error: "Failed to load invites" });
  }
});

// ─── PATCH /internal-job-interviews/:id/respond — candidate responds ──────────

const RespondSchema = z.object({
  status: z.enum(["accepted", "declined", "reschedule_requested"]),
  candidateResponseNote: z.string().max(1000).optional(),
});

router.patch("/internal-job-interviews/:id/respond", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const parsed = RespondSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  try {
    const [invite] = await db
      .select()
      .from(internalJobInterviewInvitesTable)
      .where(eq(internalJobInterviewInvitesTable.id, req.params.id))
      .limit(1);

    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
    if (invite.candidateUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }
    if (invite.status !== "pending") { res.status(400).json({ error: "Already responded" }); return; }

    const [updated] = await db
      .update(internalJobInterviewInvitesTable)
      .set({
        status: parsed.data.status,
        candidateResponseNote: parsed.data.candidateResponseNote ?? null,
        updatedAt: new Date(),
      })
      .where(eq(internalJobInterviewInvitesTable.id, req.params.id))
      .returning();

    await createApplicationEvent({
      applicationId: invite.applicationId,
      actorType: "candidate",
      actorUserId: req.user.id,
      eventType: "interview_response_received",
      title: `Interview ${parsed.data.status}: ${invite.inviteTitle}`,
      metadata: { status: parsed.data.status, note: parsed.data.candidateResponseNote },
    });

    // Notify recruiter
    const statusLabel: Record<string, string> = {
      accepted: "accepted",
      declined: "declined",
      reschedule_requested: "requested a reschedule for",
    };
    await db.insert(notificationItemsTable).values({
      userId: invite.recruiterUserId,
      type: "interview_response",
      title: `Candidate ${statusLabel[parsed.data.status] ?? "responded to"} interview`,
      body: invite.inviteTitle,
      actionLabel: "View Application",
      actionUrl: `/recruiter/exclusive-jobs/${invite.jobId}/application/${invite.applicationId}`,
      priority: "high",
      status: "pending",
    }).catch(() => {});

    res.json({ invite: updated });
  } catch (err) {
    logger.error({ err }, "Failed to respond to invite");
    res.status(500).json({ error: "Failed to respond" });
  }
});

// ─── PATCH /internal-job-interviews/:id/status — recruiter updates status ─────

router.patch("/internal-job-interviews/:id/status", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const Body = z.object({ status: z.enum(["completed", "cancelled"]) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  try {
    const [invite] = await db
      .select({
        id: internalJobInterviewInvitesTable.id,
        recruiterUserId: internalJobInterviewInvitesTable.recruiterUserId,
        candidateUserId: internalJobInterviewInvitesTable.candidateUserId,
        applicationId: internalJobInterviewInvitesTable.applicationId,
        inviteTitle: internalJobInterviewInvitesTable.inviteTitle,
        jobId: internalJobInterviewInvitesTable.jobId,
      })
      .from(internalJobInterviewInvitesTable)
      .where(eq(internalJobInterviewInvitesTable.id, req.params.id))
      .limit(1);

    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
    if (invite.recruiterUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    const [updated] = await db
      .update(internalJobInterviewInvitesTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(internalJobInterviewInvitesTable.id, req.params.id))
      .returning();

    const label = parsed.data.status === "completed" ? "completed" : "cancelled";

    // Timeline event visible to both parties
    await createApplicationEvent({
      applicationId: invite.applicationId,
      actorType: "recruiter",
      actorUserId: req.user.id,
      eventType: parsed.data.status === "completed" ? "interview_completed" : "interview_cancelled",
      title: `Interview ${label}: ${invite.inviteTitle}`,
    }).catch(() => {});

    // Notify the candidate
    await db.insert(notificationItemsTable).values({
      userId: invite.candidateUserId,
      type: "interview_update",
      title: `Interview ${label}: ${invite.inviteTitle}`,
      body: parsed.data.status === "completed"
        ? "The recruiter has marked this interview round as completed."
        : "The recruiter has cancelled this interview round.",
      actionLabel: "View",
      actionUrl: `/jobs/exclusive/application/${invite.applicationId}`,
      priority: "high",
      status: "pending",
    }).catch(() => {});

    res.json({ invite: updated });
  } catch (err) {
    logger.error({ err }, "Failed to update invite status");
    res.status(500).json({ error: "Failed to update" });
  }
});

// ─── GET /internal-job-interviews/bulk-delete/preview ─────────────────────────
// Returns count of past invites (cancelled/completed) older than a given month.

router.get("/internal-job-interviews/bulk-delete/preview", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const year = Number(req.query.year);
  const month = Number(req.query.month); // 1-12
  if (!year || !month || month < 1 || month > 12 || year < 2020 || year > 2100) {
    res.status(400).json({ error: "Invalid year or month" }); return;
  }

  // Cutoff: start of the month AFTER the selected month (so selected month is included)
  const cutoff = new Date(year, month, 1); // month is 1-indexed here, JS Date uses 0-indexed

  try {
    const [row] = await db
      .select({ cnt: count() })
      .from(internalJobInterviewInvitesTable)
      .where(
        and(
          eq(internalJobInterviewInvitesTable.recruiterUserId, req.user.id),
          lt(internalJobInterviewInvitesTable.scheduledAt, cutoff),
        ),
      );
    res.json({ count: Number(row?.cnt ?? 0), cutoff: cutoff.toISOString() });
  } catch (err) {
    logger.error({ err }, "Failed to preview bulk delete");
    res.status(500).json({ error: "Failed to preview" });
  }
});

// ─── DELETE /internal-job-interviews/bulk-delete ───────────────────────────────
// Bulk-deletes past invites (for this recruiter) older than a given month.

router.delete("/internal-job-interviews/bulk-delete", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const Body = z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { year, month } = parsed.data;
  const cutoff = new Date(year, month, 1); // start of next month (month is 1-indexed)

  try {
    const deleted = await db
      .delete(internalJobInterviewInvitesTable)
      .where(
        and(
          eq(internalJobInterviewInvitesTable.recruiterUserId, req.user.id),
          lt(internalJobInterviewInvitesTable.scheduledAt, cutoff),
        ),
      )
      .returning({ id: internalJobInterviewInvitesTable.id });

    logger.info({ userId: req.user.id, cutoff, count: deleted.length }, "Recruiter bulk-deleted interview invites");
    res.json({ deleted: deleted.length });
  } catch (err) {
    logger.error({ err }, "Failed to bulk delete invites");
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
