import { Router } from "express";
import { z } from "zod";
import {
  db,
  internalJobMessagesTable,
  internalJobApplicationsTable,
  internalJobsTable,
  notificationItemsTable,
} from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { createApplicationEvent } from "../lib/internal-jobs/events.js";

const router = Router();

// ─── POST /internal-job-messages — send message ───────────────────────────────

const SendSchema = z.object({
  applicationId: z.string(),
  recipientUserId: z.string(),
  messageType: z.enum(["message", "interview_invite", "interview_followup", "shortlist_notice", "rejection_notice", "offer_notice"]).optional().default("message"),
  subject: z.string().max(200).optional(),
  bodyText: z.string().min(1).max(5000),
});

router.post("/internal-job-messages", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const parsed = SendSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  try {
    // Load application and verify access
    const [app] = await db
      .select({
        id: internalJobApplicationsTable.id,
        jobId: internalJobApplicationsTable.jobId,
        applicantUserId: internalJobApplicationsTable.applicantUserId,
      })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, parsed.data.applicationId))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId, title: internalJobsTable.title, company: internalJobsTable.company })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, app.jobId))
      .limit(1);

    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    const isRecruiter = job.postedByUserId === req.user.id;
    const isCandidate = app.applicantUserId === req.user.id;
    if (!isRecruiter && !isCandidate) { res.status(403).json({ error: "Not authorized" }); return; }

    const senderType = isRecruiter ? "recruiter" : "candidate";
    const recipientType = isRecruiter ? "candidate" : "recruiter";
    const recipientUserId = isRecruiter ? app.applicantUserId : job.postedByUserId;

    const [message] = await db
      .insert(internalJobMessagesTable)
      .values({
        applicationId: app.id,
        jobId: app.jobId,
        senderUserId: req.user.id,
        senderType,
        recipientUserId,
        recipientType,
        messageType: parsed.data.messageType,
        subject: parsed.data.subject ?? null,
        bodyText: parsed.data.bodyText,
        isRead: false,
      })
      .returning();

    // Application event
    await createApplicationEvent({
      applicationId: app.id,
      actorType: senderType as any,
      actorUserId: req.user.id,
      eventType: "message_sent",
      title: `${senderType === "recruiter" ? "Recruiter" : "Candidate"} sent a message`,
    });

    // Notify recipient
    await db.insert(notificationItemsTable).values({
      userId: recipientUserId,
      type: "new_message",
      title: `New message about ${job.title}`,
      body: parsed.data.subject ?? parsed.data.bodyText.slice(0, 80) + (parsed.data.bodyText.length > 80 ? "…" : ""),
      actionLabel: "View",
      actionUrl: `/jobs/exclusive/application/${app.id}`,
      priority: "high",
      status: "pending",
    }).catch(() => {});

    res.status(201).json({ message });
  } catch (err) {
    logger.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ─── GET /internal-job-messages/:applicationId — thread ──────────────────────

router.get("/internal-job-messages/:applicationId", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [app] = await db
      .select({ applicantUserId: internalJobApplicationsTable.applicantUserId, jobId: internalJobApplicationsTable.jobId })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, req.params.applicationId))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, app.jobId))
      .limit(1);

    const isRecruiter = job?.postedByUserId === req.user.id;
    const isCandidate = app.applicantUserId === req.user.id;
    if (!isRecruiter && !isCandidate) { res.status(403).json({ error: "Not authorized" }); return; }

    const messages = await db
      .select()
      .from(internalJobMessagesTable)
      .where(eq(internalJobMessagesTable.applicationId, req.params.applicationId))
      .orderBy(desc(internalJobMessagesTable.createdAt));

    // Auto-mark as read for recipient
    await db
      .update(internalJobMessagesTable)
      .set({ isRead: true })
      .where(
        and(
          eq(internalJobMessagesTable.applicationId, req.params.applicationId),
          eq(internalJobMessagesTable.recipientUserId, req.user.id) as any,
          eq(internalJobMessagesTable.isRead, false) as any,
        ),
      );

    res.json({ messages });
  } catch (err) {
    logger.error({ err }, "Failed to load messages");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ─── GET /internal-job-inbox — all conversations for current user ──────────────

router.get("/internal-job-inbox", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const messages = await db
      .select({
        id: internalJobMessagesTable.id,
        applicationId: internalJobMessagesTable.applicationId,
        jobId: internalJobMessagesTable.jobId,
        senderUserId: internalJobMessagesTable.senderUserId,
        senderType: internalJobMessagesTable.senderType,
        recipientUserId: internalJobMessagesTable.recipientUserId,
        messageType: internalJobMessagesTable.messageType,
        subject: internalJobMessagesTable.subject,
        bodyText: internalJobMessagesTable.bodyText,
        isRead: internalJobMessagesTable.isRead,
        createdAt: internalJobMessagesTable.createdAt,
        jobTitle: internalJobsTable.title,
        jobCompany: internalJobsTable.company,
      })
      .from(internalJobMessagesTable)
      .leftJoin(internalJobsTable, eq(internalJobMessagesTable.jobId, internalJobsTable.id))
      .where(
        or(
          eq(internalJobMessagesTable.senderUserId, req.user.id) as any,
          eq(internalJobMessagesTable.recipientUserId, req.user.id) as any,
        ),
      )
      .orderBy(desc(internalJobMessagesTable.createdAt))
      .limit(200);

    // Group by applicationId
    const threads = new Map<string, {
      applicationId: string;
      jobId: string;
      jobTitle: string | null;
      jobCompany: string | null;
      lastMessage: typeof messages[0];
      unread: number;
    }>();

    for (const msg of messages) {
      const existing = threads.get(msg.applicationId);
      const isUnread = !msg.isRead && msg.recipientUserId === req.user.id;
      if (!existing) {
        threads.set(msg.applicationId, {
          applicationId: msg.applicationId,
          jobId: msg.jobId,
          jobTitle: msg.jobTitle,
          jobCompany: msg.jobCompany,
          lastMessage: msg,
          unread: isUnread ? 1 : 0,
        });
      } else {
        if (isUnread) existing.unread++;
      }
    }

    res.json({ threads: Array.from(threads.values()) });
  } catch (err) {
    logger.error({ err }, "Failed to load inbox");
    res.status(500).json({ error: "Failed to load inbox" });
  }
});

export default router;
