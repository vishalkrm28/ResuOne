import { Router } from "express";
import { z } from "zod";
import {
  db,
  internalJobsTable,
  internalJobApplicationsTable,
  internalJobApplicationEventsTable,
  internalJobCandidateAnalysesTable,
  applicationsTable,
  candidateProfilesTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { resolveUserPlan, canSeeProOnlyJobs, canApplyToProOnlyJob } from "../lib/internal-jobs/plan.js";
import { analyzeInternalJobForCandidate } from "../lib/internal-jobs/analysis.js";
import { createApplicationEvent } from "../lib/internal-jobs/events.js";
import { notifyApplicationUpdate } from "../lib/internal-jobs/notifications.js";

const router = Router();

// ─── POST /internal-jobs/:id/analyze — pre-apply AI fit analysis ──────────────

router.post("/internal-jobs/:id/analyze", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const Body = z.object({
    candidateProfileId: z.string().optional(),
    sourceApplicationId: z.string().optional(),
    forceRefresh: z.boolean().optional().default(false),
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  try {
    const plan = await resolveUserPlan(req.user.id);

    const [job] = await db
      .select({ status: internalJobsTable.status, visibility: internalJobsTable.visibility })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (job.visibility === "pro_only" && !canSeeProOnlyJobs(plan)) {
      res.status(403).json({ error: "Pro plan required", code: "PRO_REQUIRED" }); return;
    }

    // If no source provided, try to find their most recent CV
    let { candidateProfileId, sourceApplicationId } = parsed.data;
    if (!candidateProfileId && !sourceApplicationId) {
      const [latestProfile] = await db
        .select({ id: candidateProfilesTable.id })
        .from(candidateProfilesTable)
        .where(eq(candidateProfilesTable.userId, req.user.id))
        .orderBy(desc(candidateProfilesTable.createdAt))
        .limit(1);
      if (latestProfile) candidateProfileId = latestProfile.id;

      if (!candidateProfileId) {
        const [latestApp] = await db
          .select({ id: applicationsTable.id })
          .from(applicationsTable)
          .where(eq(applicationsTable.userId, req.user.id))
          .orderBy(desc(applicationsTable.createdAt))
          .limit(1);
        if (latestApp) sourceApplicationId = latestApp.id;
      }
    }

    const analysis = await analyzeInternalJobForCandidate({
      userId: req.user.id,
      jobId: req.params.id,
      candidateProfileId,
      sourceApplicationId,
      forceRefresh: parsed.data.forceRefresh,
    });

    res.json({ analysis });
  } catch (err: any) {
    logger.error({ err }, "Failed to analyze job for candidate");
    if (err.message?.includes("No CV data")) {
      res.status(400).json({ error: err.message, code: "NO_CV" });
    } else {
      res.status(500).json({ error: "Analysis failed" });
    }
  }
});

// ─── POST /internal-jobs/:id/apply — submit application ──────────────────────

const ApplySchema = z.object({
  candidateProfileId: z.string().optional(),
  sourceApplicationId: z.string().optional(),
  tailoredCvId: z.string().optional(),
  coverLetterId: z.string().optional(),
  coverLetter: z.string().optional(),
  candidateNotes: z.string().optional(),
  autoApplyMode: z.boolean().optional().default(false),
});

router.post("/internal-jobs/:id/apply", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const [job] = await db
      .select()
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (job.status !== "active") { res.status(400).json({ error: "Job is not accepting applications" }); return; }
    if (job.postedByUserId === req.user.id) { res.status(400).json({ error: "Cannot apply to your own job" }); return; }

    const plan = await resolveUserPlan(req.user.id);
    if (job.visibility === "pro_only" && !canApplyToProOnlyJob(plan)) {
      res.status(403).json({ error: "Pro plan required to apply to exclusive jobs", code: "PRO_REQUIRED" }); return;
    }

    // Duplicate check
    const [existing] = await db
      .select({ id: internalJobApplicationsTable.id })
      .from(internalJobApplicationsTable)
      .where(
        and(
          eq(internalJobApplicationsTable.jobId, req.params.id),
          eq(internalJobApplicationsTable.applicantUserId, req.user.id) as any,
        ),
      )
      .limit(1);
    if (existing) { res.status(409).json({ error: "Already applied", applicationId: existing.id }); return; }

    const parsed = ApplySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || null;

    const [application] = await db
      .insert(internalJobApplicationsTable)
      .values({
        jobId: req.params.id,
        applicantUserId: req.user.id,
        candidateProfileId: parsed.data.candidateProfileId ?? null,
        tailoredCvId: parsed.data.tailoredCvId ?? null,
        coverLetterId: parsed.data.coverLetterId ?? null,
        coverLetter: parsed.data.coverLetter ?? null,
        candidateNotes: parsed.data.candidateNotes ?? null,
        autoApplyMode: parsed.data.autoApplyMode,
        applicantName: displayName,
        applicantEmail: req.user.email ?? null,
        status: "applied",
        stage: "submitted",
      })
      .returning();

    await createApplicationEvent({
      applicationId: application.id,
      actorType: "candidate",
      actorUserId: req.user.id,
      eventType: "application_created",
      title: "Application submitted",
      description: `Applied to ${job.title} at ${job.company}`,
    });

    res.status(201).json({ application });
  } catch (err) {
    logger.error({ err }, "Failed to submit application");
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// ─── GET /my-internal-applications — all my applications ─────────────────────

router.get("/my-internal-applications", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const rows = await db
      .select({
        id: internalJobApplicationsTable.id,
        jobId: internalJobApplicationsTable.jobId,
        status: internalJobApplicationsTable.status,
        stage: internalJobApplicationsTable.stage,
        candidateNotes: internalJobApplicationsTable.candidateNotes,
        coverLetter: internalJobApplicationsTable.coverLetter,
        appliedAt: internalJobApplicationsTable.appliedAt,
        updatedAt: internalJobApplicationsTable.updatedAt,
        jobTitle: internalJobsTable.title,
        jobCompany: internalJobsTable.company,
        jobLocation: internalJobsTable.location,
        jobRemote: internalJobsTable.remote,
        jobStatus: internalJobsTable.status,
        jobCountry: internalJobsTable.country,
        postedByUserId: internalJobsTable.postedByUserId,
      })
      .from(internalJobApplicationsTable)
      .leftJoin(internalJobsTable, eq(internalJobApplicationsTable.jobId, internalJobsTable.id))
      .where(eq(internalJobApplicationsTable.applicantUserId, req.user.id) as any)
      .orderBy(desc(internalJobApplicationsTable.appliedAt));

    res.json({ applications: rows });
  } catch (err) {
    logger.error({ err }, "Failed to load my applications");
    res.status(500).json({ error: "Failed to load applications" });
  }
});

// ─── GET /internal-applications/:id — application detail ─────────────────────

router.get("/internal-applications/:id", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [app] = await db
      .select()
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, req.params.id))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    const [job] = await db
      .select()
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, app.jobId))
      .limit(1);

    const isApplicant = app.applicantUserId === req.user.id;
    const isRecruiter = job?.postedByUserId === req.user.id;
    if (!isApplicant && !isRecruiter) { res.status(403).json({ error: "Not authorized" }); return; }

    const events = await db
      .select()
      .from(internalJobApplicationEventsTable)
      .where(eq(internalJobApplicationEventsTable.applicationId, req.params.id))
      .orderBy(asc(internalJobApplicationEventsTable.createdAt));

    res.json({ application: app, job, events });
  } catch (err) {
    logger.error({ err }, "Failed to load application detail");
    res.status(500).json({ error: "Failed to load application" });
  }
});

// ─── PATCH /internal-applications/:id/note — candidate adds note ──────────────

router.patch("/internal-applications/:id/note", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const Body = z.object({ candidateNotes: z.string().max(2000) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  try {
    const [app] = await db
      .select({ applicantUserId: internalJobApplicationsTable.applicantUserId })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, req.params.id))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Not found" }); return; }
    if (app.applicantUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    await db
      .update(internalJobApplicationsTable)
      .set({ candidateNotes: parsed.data.candidateNotes, updatedAt: new Date() })
      .where(eq(internalJobApplicationsTable.id, req.params.id));

    await createApplicationEvent({
      applicationId: req.params.id,
      actorType: "candidate",
      actorUserId: req.user.id,
      eventType: "candidate_note_added",
      title: "Candidate added a note",
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update note");
    res.status(500).json({ error: "Failed to update note" });
  }
});

// ─── POST /internal-applications/:id/withdraw ─────────────────────────────────

router.post("/internal-applications/:id/withdraw", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [app] = await db
      .select({ applicantUserId: internalJobApplicationsTable.applicantUserId, status: internalJobApplicationsTable.status })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, req.params.id))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Not found" }); return; }
    if (app.applicantUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }
    if (["withdrawn", "hired"].includes(app.status)) { res.status(400).json({ error: "Cannot withdraw at this stage" }); return; }

    await db
      .update(internalJobApplicationsTable)
      .set({ status: "withdrawn", stage: "withdrawn", updatedAt: new Date() })
      .where(eq(internalJobApplicationsTable.id, req.params.id));

    await createApplicationEvent({
      applicationId: req.params.id,
      actorType: "candidate",
      actorUserId: req.user.id,
      eventType: "withdrawn",
      title: "Application withdrawn",
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to withdraw");
    res.status(500).json({ error: "Failed to withdraw" });
  }
});

// ─── GET /internal-jobs/:id/applications — recruiter views applicants ──────────

router.get("/internal-jobs/:id/applications", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId, title: internalJobsTable.title })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (job.postedByUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    // Subquery step 1: most recent analysis timestamp per user for this job
    const latestTimeSq = db
      .select({
        userId: internalJobCandidateAnalysesTable.userId,
        maxCreatedAt: sql<string>`max(${internalJobCandidateAnalysesTable.createdAt})`.as("max_created_at"),
      })
      .from(internalJobCandidateAnalysesTable)
      .where(eq(internalJobCandidateAnalysesTable.internalJobId, req.params.id))
      .groupBy(internalJobCandidateAnalysesTable.userId)
      .as("latest_times");

    // Subquery step 2: join back to get the matchScore for that exact most-recent row
    const latestScoreSq = db
      .select({
        userId: internalJobCandidateAnalysesTable.userId,
        matchScore: internalJobCandidateAnalysesTable.matchScore,
      })
      .from(internalJobCandidateAnalysesTable)
      .innerJoin(
        latestTimeSq,
        and(
          eq(latestTimeSq.userId, internalJobCandidateAnalysesTable.userId),
          sql`${internalJobCandidateAnalysesTable.createdAt} = ${latestTimeSq.maxCreatedAt}`,
        ),
      )
      .where(eq(internalJobCandidateAnalysesTable.internalJobId, req.params.id))
      .as("latest_scores");

    const rows = await db
      .select({
        id: internalJobApplicationsTable.id,
        jobId: internalJobApplicationsTable.jobId,
        applicantUserId: internalJobApplicationsTable.applicantUserId,
        candidateProfileId: internalJobApplicationsTable.candidateProfileId,
        tailoredCvId: internalJobApplicationsTable.tailoredCvId,
        coverLetterId: internalJobApplicationsTable.coverLetterId,
        applicantName: internalJobApplicationsTable.applicantName,
        applicantEmail: internalJobApplicationsTable.applicantEmail,
        coverLetter: internalJobApplicationsTable.coverLetter,
        status: internalJobApplicationsTable.status,
        stage: internalJobApplicationsTable.stage,
        candidateNotes: internalJobApplicationsTable.candidateNotes,
        recruiterNotes: internalJobApplicationsTable.recruiterNotes,
        autoApplyMode: internalJobApplicationsTable.autoApplyMode,
        appliedAt: internalJobApplicationsTable.appliedAt,
        updatedAt: internalJobApplicationsTable.updatedAt,
        matchScore: latestScoreSq.matchScore,
      })
      .from(internalJobApplicationsTable)
      .leftJoin(latestScoreSq, eq(latestScoreSq.userId, internalJobApplicationsTable.applicantUserId))
      .where(eq(internalJobApplicationsTable.jobId, req.params.id))
      .orderBy(
        sql`${latestScoreSq.matchScore} desc nulls last`,
        desc(internalJobApplicationsTable.appliedAt),
      );

    res.json({ applications: rows, jobTitle: job.title });
  } catch (err) {
    logger.error({ err }, "Failed to load applicants");
    res.status(500).json({ error: "Failed to load applicants" });
  }
});

// ─── PATCH /internal-jobs/:id/applications/:appId — recruiter manages pipeline ─

const RecruiterUpdateSchema = z.object({
  status: z.enum(["applied", "shortlisted", "rejected", "interview", "offer", "hired", "withdrawn"]).optional(),
  stage: z.enum(["submitted", "under_review", "shortlisted", "interview", "final_review", "offer", "rejected", "hired", "withdrawn"]).optional(),
  recruiterNotes: z.string().max(5000).optional(),
});

router.patch("/internal-jobs/:id/applications/:appId", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job || job.postedByUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    const parsed = RecruiterUpdateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const [app] = await db
      .select({ applicantUserId: internalJobApplicationsTable.applicantUserId, status: internalJobApplicationsTable.status })
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.id, req.params.appId))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    const [updated] = await db
      .update(internalJobApplicationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(internalJobApplicationsTable.id, req.params.appId))
      .returning();

    // Create event for status changes
    if (parsed.data.status && parsed.data.status !== app.status) {
      const eventMap: Record<string, { type: any; title: string }> = {
        shortlisted: { type: "shortlisted", title: "Candidate shortlisted" },
        rejected: { type: "rejected", title: "Application rejected" },
        interview: { type: "interview_requested", title: "Moved to interview stage" },
        offer: { type: "offer_made", title: "Offer extended" },
        hired: { type: "offer_made", title: "Candidate hired" },
      };
      const ev = eventMap[parsed.data.status];
      if (ev) {
        await createApplicationEvent({
          applicationId: req.params.appId,
          actorType: "recruiter",
          actorUserId: req.user.id,
          eventType: ev.type,
          title: ev.title,
          metadata: { newStatus: parsed.data.status, previousStatus: app.status },
        });

        // Notify candidate of meaningful status changes
        if (["shortlisted", "rejected", "interview", "offer", "hired"].includes(parsed.data.status)) {
          const notifMap: Record<string, string> = {
            shortlisted: "You've been shortlisted!",
            rejected: "Application update",
            interview: "You've been invited to interview",
            offer: "You have an offer!",
            hired: "Congratulations — you've been hired!",
          };
          notifyApplicationUpdate({
            recipientUserId: app.applicantUserId,
            title: notifMap[parsed.data.status],
            body: `Your application status has been updated.`,
            actionUrl: `/jobs/exclusive/application/${req.params.appId}`,
          }).catch(() => {});
        }
      }
    }

    if (parsed.data.recruiterNotes) {
      await createApplicationEvent({
        applicationId: req.params.appId,
        actorType: "recruiter",
        actorUserId: req.user.id,
        eventType: "recruiter_note_added",
        title: "Recruiter note added",
      });
    }

    res.json({ application: updated });
  } catch (err) {
    logger.error({ err }, "Failed to update application");
    res.status(500).json({ error: "Failed to update application" });
  }
});

export default router;
