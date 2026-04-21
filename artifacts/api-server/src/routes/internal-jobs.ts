import { Router } from "express";
import { z } from "zod";
import { db, internalJobsTable, internalJobApplicationsTable, usersTable, notificationItemsTable } from "@workspace/db";
import { eq, and, desc, count, inArray, or, isNotNull, ne } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { recruiterStatusIsActive, subscriptionIsActive } from "../lib/billing.js";

const router = Router();

// ─── Plan resolution ──────────────────────────────────────────────────────────

async function resolveUserPlan(userId: string): Promise<"free" | "pro" | "recruiter"> {
  const [user] = await db
    .select({ subscriptionStatus: usersTable.subscriptionStatus, recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return "free";
  if (recruiterStatusIsActive(user.recruiterSubscriptionStatus)) return "recruiter";
  if (subscriptionIsActive(user.subscriptionStatus ?? null)) return "pro";
  return "free";
}

// ─── POST /internal-jobs — create listing (recruiter only) ───────────────────

const CreateJobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().optional(),
  country: z.string().optional(),
  remote: z.boolean().optional().default(false),
  jobType: z.string().optional(),
  seniority: z.string().optional(),
  description: z.string().min(10),
  requirements: z.array(z.string()).optional().default([]),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  currency: z.string().optional().default("USD"),
  visibility: z.enum(["pro_only", "public"]).optional().default("pro_only"),
  status: z.enum(["draft", "active"]).optional().default("active"),
});

router.post("/internal-jobs", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const plan = await resolveUserPlan(req.user.id);
  if (plan !== "recruiter") {
    res.status(403).json({ error: "Recruiter plan required to post jobs", code: "RECRUITER_REQUIRED" });
    return;
  }

  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const [job] = await db
      .insert(internalJobsTable)
      .values({ postedByUserId: req.user.id, ...parsed.data })
      .returning();

    if (parsed.data.status === "active") {
      notifyEligibleUsers(job, req.user.id).catch((err) =>
        logger.error({ err }, "Failed to send internal job notifications"),
      );
    }

    res.status(201).json({ job });
  } catch (err) {
    logger.error({ err }, "Failed to create internal job");
    res.status(500).json({ error: "Failed to create job" });
  }
});

// ─── Async notification on new job posting ────────────────────────────────────

async function notifyEligibleUsers(job: typeof internalJobsTable.$inferSelect, posterId: string) {
  const eligibleUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        ne(usersTable.id, posterId),
        or(
          inArray(usersTable.subscriptionStatus, ["active", "trialing"]),
          isNotNull(usersTable.recruiterSubscriptionStatus),
        ),
      ),
    )
    .limit(500);

  if (!eligibleUsers.length) return;

  const locationStr = [job.location, job.remote ? "Remote" : null].filter(Boolean).join(" · ");
  const notifications = eligibleUsers.map((u) => ({
    userId: u.id,
    type: "internal_job_match",
    title: `New Resuone Exclusive: ${job.title}`,
    body: `${job.company}${locationStr ? ` · ${locationStr}` : ""}`,
    actionLabel: "View Job",
    actionUrl: `/jobs/discover?tab=exclusive`,
    priority: "medium",
    status: "pending",
  }));

  await db.insert(notificationItemsTable).values(notifications);
  logger.info({ jobId: job.id, notified: notifications.length }, "Internal job notifications sent");
}

// ─── GET /internal-jobs — list active jobs (plan-gated visibility) ───────────

router.get("/internal-jobs", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const plan = await resolveUserPlan(req.user.id);

    const jobs =
      plan === "free"
        ? await db
            .select()
            .from(internalJobsTable)
            .where(and(eq(internalJobsTable.status, "active"), eq(internalJobsTable.visibility, "public")))
            .orderBy(desc(internalJobsTable.createdAt))
        : await db
            .select()
            .from(internalJobsTable)
            .where(eq(internalJobsTable.status, "active"))
            .orderBy(desc(internalJobsTable.createdAt));

    if (!jobs.length) {
      res.json({ jobs: [], plan });
      return;
    }

    const jobIds = jobs.map((j) => j.id);

    const [appCounts, myApps] = await Promise.all([
      db
        .select({ jobId: internalJobApplicationsTable.jobId, cnt: count() })
        .from(internalJobApplicationsTable)
        .where(inArray(internalJobApplicationsTable.jobId, jobIds))
        .groupBy(internalJobApplicationsTable.jobId),
      db
        .select({ jobId: internalJobApplicationsTable.jobId, status: internalJobApplicationsTable.status })
        .from(internalJobApplicationsTable)
        .where(
          and(
            inArray(internalJobApplicationsTable.jobId, jobIds),
            eq(internalJobApplicationsTable.applicantUserId, req.user.id),
          ),
        ),
    ]);

    const cntMap = Object.fromEntries(appCounts.map((a) => [a.jobId, Number(a.cnt)]));
    const appliedMap = Object.fromEntries(myApps.map((a) => [a.jobId, a.status]));

    res.json({
      jobs: jobs.map((j) => ({
        ...j,
        applicationCount: cntMap[j.id] ?? 0,
        userApplicationStatus: appliedMap[j.id] ?? null,
      })),
      plan,
    });
  } catch (err) {
    logger.error({ err }, "Failed to list internal jobs");
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

// ─── GET /internal-jobs/posted — recruiter's own posted jobs ─────────────────

router.get("/internal-jobs/posted", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const jobs = await db
      .select()
      .from(internalJobsTable)
      .where(eq(internalJobsTable.postedByUserId, req.user.id))
      .orderBy(desc(internalJobsTable.createdAt));

    if (!jobs.length) {
      res.json({ jobs: [] });
      return;
    }

    const jobIds = jobs.map((j) => j.id);
    const appCounts = await db
      .select({ jobId: internalJobApplicationsTable.jobId, cnt: count() })
      .from(internalJobApplicationsTable)
      .where(inArray(internalJobApplicationsTable.jobId, jobIds))
      .groupBy(internalJobApplicationsTable.jobId);

    const cntMap = Object.fromEntries(appCounts.map((a) => [a.jobId, Number(a.cnt)]));

    res.json({
      jobs: jobs.map((j) => ({ ...j, applicationCount: cntMap[j.id] ?? 0 })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list posted jobs");
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

// ─── PATCH /internal-jobs/:id — update job (poster only) ─────────────────────

const UpdateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  company: z.string().min(1).max(200).optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  remote: z.boolean().optional(),
  jobType: z.string().optional(),
  seniority: z.string().optional(),
  description: z.string().min(10).optional(),
  requirements: z.array(z.string()).optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  currency: z.string().optional(),
  visibility: z.enum(["pro_only", "public"]).optional(),
  status: z.enum(["draft", "active", "paused", "closed"]).optional(),
});

router.patch("/internal-jobs/:id", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const [existing] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Job not found" }); return; }
    if (existing.postedByUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    const parsed = UpdateJobSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const [updated] = await db
      .update(internalJobsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(internalJobsTable.id, req.params.id))
      .returning();

    res.json({ job: updated });
  } catch (err) {
    logger.error({ err }, "Failed to update internal job");
    res.status(500).json({ error: "Failed to update job" });
  }
});

// ─── POST /internal-jobs/:id/apply — apply to a job ─────────────────────────

router.post("/internal-jobs/:id/apply", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const [job] = await db
      .select({ id: internalJobsTable.id, status: internalJobsTable.status, visibility: internalJobsTable.visibility, postedByUserId: internalJobsTable.postedByUserId })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (job.status !== "active") { res.status(400).json({ error: "This job is not accepting applications" }); return; }
    if (job.postedByUserId === req.user.id) { res.status(400).json({ error: "Cannot apply to your own job" }); return; }

    if (job.visibility === "pro_only") {
      const plan = await resolveUserPlan(req.user.id);
      if (plan === "free") {
        res.status(403).json({ error: "Pro plan required to apply to exclusive jobs", code: "PRO_REQUIRED" });
        return;
      }
    }

    const [existing] = await db
      .select({ id: internalJobApplicationsTable.id })
      .from(internalJobApplicationsTable)
      .where(and(
        eq(internalJobApplicationsTable.jobId, req.params.id),
        eq(internalJobApplicationsTable.applicantUserId, req.user.id),
      ))
      .limit(1);

    if (existing) { res.status(409).json({ error: "You have already applied to this job" }); return; }

    const Body = z.object({ coverLetter: z.string().optional() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email?.split("@")[0] || null;

    const [application] = await db
      .insert(internalJobApplicationsTable)
      .values({
        jobId: req.params.id,
        applicantUserId: req.user.id,
        applicantName: displayName,
        applicantEmail: req.user.email ?? null,
        coverLetter: parsed.data.coverLetter ?? null,
      })
      .returning();

    res.status(201).json({ application });
  } catch (err) {
    logger.error({ err }, "Failed to apply to internal job");
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// ─── GET /internal-jobs/:id/applications — applicants (poster only) ───────────

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

    const applications = await db
      .select()
      .from(internalJobApplicationsTable)
      .where(eq(internalJobApplicationsTable.jobId, req.params.id))
      .orderBy(desc(internalJobApplicationsTable.createdAt));

    res.json({ applications, jobTitle: job.title });
  } catch (err) {
    logger.error({ err }, "Failed to fetch applications");
    res.status(500).json({ error: "Failed to load applications" });
  }
});

// ─── PATCH /internal-jobs/:id/applications/:appId — update applicant status ──

router.patch("/internal-jobs/:id/applications/:appId", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const [job] = await db
      .select({ postedByUserId: internalJobsTable.postedByUserId })
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job || job.postedByUserId !== req.user.id) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const Body = z.object({
      status: z.enum(["applied", "shortlisted", "rejected", "hired"]),
      notes: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const [updated] = await db
      .update(internalJobApplicationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(
        eq(internalJobApplicationsTable.id, req.params.appId),
        eq(internalJobApplicationsTable.jobId, req.params.id),
      ))
      .returning();

    if (!updated) { res.status(404).json({ error: "Application not found" }); return; }

    res.json({ application: updated });
  } catch (err) {
    logger.error({ err }, "Failed to update application status");
    res.status(500).json({ error: "Failed to update application" });
  }
});

// ─── GET /my-internal-applications — candidate's own applications ─────────────

router.get("/my-internal-applications", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const rows = await db
      .select({
        id: internalJobApplicationsTable.id,
        jobId: internalJobApplicationsTable.jobId,
        status: internalJobApplicationsTable.status,
        coverLetter: internalJobApplicationsTable.coverLetter,
        createdAt: internalJobApplicationsTable.createdAt,
        jobTitle: internalJobsTable.title,
        jobCompany: internalJobsTable.company,
        jobLocation: internalJobsTable.location,
        jobRemote: internalJobsTable.remote,
        jobStatus: internalJobsTable.status,
      })
      .from(internalJobApplicationsTable)
      .leftJoin(internalJobsTable, eq(internalJobApplicationsTable.jobId, internalJobsTable.id))
      .where(eq(internalJobApplicationsTable.applicantUserId, req.user.id))
      .orderBy(desc(internalJobApplicationsTable.createdAt));

    res.json({ applications: rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch my internal applications");
    res.status(500).json({ error: "Failed to load applications" });
  }
});

export default router;
