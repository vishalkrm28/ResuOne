import { Router } from "express";
import { z } from "zod";
import {
  db,
  internalJobsTable,
  internalJobApplicationsTable,
  internalJobCandidateAnalysesTable,
} from "@workspace/db";
import { eq, and, desc, count, ilike, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { resolveUserPlan, canSeeProOnlyJobs, canPostJobs } from "../lib/internal-jobs/plan.js";
import { notifyUsersOfNewJob } from "../lib/internal-jobs/notifications.js";

const router = Router();

// ─── POST /internal-jobs — create (draft default) ────────────────────────────

const CreateJobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().optional(),
  country: z.string().optional(),
  remote: z.boolean().optional().default(false),
  employmentType: z.string().optional(),
  seniority: z.string().optional(),
  description: z.string().min(10),
  requirements: z.array(z.string()).optional().default([]),
  preferredSkills: z.array(z.string()).optional().default([]),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  currency: z.string().optional().default("USD"),
  visibility: z.enum(["pro_only", "public"]).optional().default("pro_only"),
  workspaceId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post("/internal-jobs", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const plan = await resolveUserPlan(req.user.id);
  if (!canPostJobs(plan)) {
    res.status(403).json({ error: "Recruiter plan required to post jobs", code: "RECRUITER_REQUIRED" });
    return;
  }
  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  try {
    const { expiresAt, ...rest } = parsed.data;
    const [job] = await db
      .insert(internalJobsTable)
      .values({
        postedByUserId: req.user.id,
        status: "draft",
        ...rest,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();
    res.status(201).json({ job });
  } catch (err) {
    logger.error({ err }, "Failed to create internal job");
    res.status(500).json({ error: "Failed to create job" });
  }
});

// ─── POST /internal-jobs/:id/publish — activate job + trigger notifications ──

router.post("/internal-jobs/:id/publish", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [existing] = await db
      .select()
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Job not found" }); return; }
    if (existing.postedByUserId !== req.user.id) { res.status(403).json({ error: "Not authorized" }); return; }
    if (existing.status === "active") { res.json({ job: existing }); return; }

    const [job] = await db
      .update(internalJobsTable)
      .set({ status: "active", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(internalJobsTable.id, req.params.id))
      .returning();

    notifyUsersOfNewJob(job).catch((err) => logger.error({ err }, "Notification failed"));
    res.json({ job });
  } catch (err) {
    logger.error({ err }, "Failed to publish job");
    res.status(500).json({ error: "Failed to publish job" });
  }
});

// ─── PATCH /internal-jobs/:id — update job (poster only) ─────────────────────

const UpdateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  company: z.string().min(1).max(200).optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  remote: z.boolean().optional(),
  employmentType: z.string().optional(),
  seniority: z.string().optional(),
  description: z.string().min(10).optional(),
  requirements: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  currency: z.string().optional(),
  visibility: z.enum(["pro_only", "public"]).optional(),
  status: z.enum(["draft", "active", "paused", "closed"]).optional(),
  expiresAt: z.string().datetime().optional(),
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

    const { expiresAt, ...rest } = parsed.data;
    const [updated] = await db
      .update(internalJobsTable)
      .set({ ...rest, expiresAt: expiresAt ? new Date(expiresAt) : undefined, updatedAt: new Date() })
      .where(eq(internalJobsTable.id, req.params.id))
      .returning();
    res.json({ job: updated });
  } catch (err) {
    logger.error({ err }, "Failed to update job");
    res.status(500).json({ error: "Failed to update job" });
  }
});

// ─── GET /internal-jobs — list with filters ───────────────────────────────────

router.get("/internal-jobs", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const plan = await resolveUserPlan(req.user.id);
    const { query, country, remote, employmentType, seniority } = req.query as Record<string, string>;

    const conditions: ReturnType<typeof eq>[] = [
      eq(internalJobsTable.status, "active"),
    ];

    if (!canSeeProOnlyJobs(plan)) {
      conditions.push(eq(internalJobsTable.visibility, "public") as any);
    }
    if (country) conditions.push(eq(internalJobsTable.country, country) as any);
    if (remote === "true") conditions.push(eq(internalJobsTable.remote, true) as any);
    if (employmentType) conditions.push(eq(internalJobsTable.employmentType, employmentType) as any);
    if (seniority) conditions.push(eq(internalJobsTable.seniority, seniority) as any);

    let jobs = await db
      .select()
      .from(internalJobsTable)
      .where(and(...conditions as any))
      .orderBy(desc(internalJobsTable.publishedAt))
      .limit(100);

    // Text search (post-filter — lightweight)
    if (query) {
      const q = query.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          (j.description?.toLowerCase().includes(q) ?? false),
      );
    }

    if (!jobs.length) { res.json({ jobs: [], plan }); return; }

    const jobIds = jobs.map((j) => j.id);

    const [appCounts, myApps, myAnalyses] = await Promise.all([
      db
        .select({ jobId: internalJobApplicationsTable.jobId, cnt: count() })
        .from(internalJobApplicationsTable)
        .where(sql`${internalJobApplicationsTable.jobId} = ANY(${jobIds})`)
        .groupBy(internalJobApplicationsTable.jobId),
      db
        .select({
          jobId: internalJobApplicationsTable.jobId,
          status: internalJobApplicationsTable.status,
          stage: internalJobApplicationsTable.stage,
          applicationId: internalJobApplicationsTable.id,
        })
        .from(internalJobApplicationsTable)
        .where(
          and(
            sql`${internalJobApplicationsTable.jobId} = ANY(${jobIds})`,
            eq(internalJobApplicationsTable.applicantUserId, req.user.id) as any,
          ),
        ),
      db
        .select({
          jobId: internalJobCandidateAnalysesTable.internalJobId,
          matchScore: internalJobCandidateAnalysesTable.matchScore,
          applyRecommendation: internalJobCandidateAnalysesTable.applyRecommendation,
        })
        .from(internalJobCandidateAnalysesTable)
        .where(
          and(
            sql`${internalJobCandidateAnalysesTable.internalJobId} = ANY(${jobIds})`,
            eq(internalJobCandidateAnalysesTable.userId, req.user.id) as any,
          ),
        )
        .orderBy(desc(internalJobCandidateAnalysesTable.createdAt))
        .limit(jobIds.length),
    ]);

    const cntMap = Object.fromEntries(appCounts.map((a) => [a.jobId, Number(a.cnt)]));
    const appMap = Object.fromEntries(myApps.map((a) => [a.jobId, a]));
    const analysisMap: Record<string, { matchScore: number; applyRecommendation: string | null }> = {};
    for (const a of myAnalyses) {
      if (!analysisMap[a.jobId]) analysisMap[a.jobId] = { matchScore: a.matchScore, applyRecommendation: a.applyRecommendation };
    }

    res.json({
      jobs: jobs.map((j) => ({
        ...j,
        applicationCount: cntMap[j.id] ?? 0,
        userApplication: appMap[j.id] ?? null,
        latestAnalysis: analysisMap[j.id] ?? null,
      })),
      plan,
    });
  } catch (err) {
    logger.error({ err }, "Failed to list jobs");
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

// ─── GET /internal-jobs/:id — job detail ──────────────────────────────────────

router.get("/internal-jobs/:id", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const plan = await resolveUserPlan(req.user.id);

    const [job] = await db
      .select()
      .from(internalJobsTable)
      .where(eq(internalJobsTable.id, req.params.id))
      .limit(1);

    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    const isOwner = job.postedByUserId === req.user.id;
    if (!isOwner && job.status !== "active") {
      res.status(404).json({ error: "Job not found" }); return;
    }
    if (!isOwner && job.visibility === "pro_only" && !canSeeProOnlyJobs(plan)) {
      res.status(403).json({ error: "Pro plan required", code: "PRO_REQUIRED" }); return;
    }

    const [appCountRow, myApp, myAnalysis] = await Promise.all([
      db
        .select({ cnt: count() })
        .from(internalJobApplicationsTable)
        .where(eq(internalJobApplicationsTable.jobId, req.params.id)),
      db
        .select()
        .from(internalJobApplicationsTable)
        .where(
          and(
            eq(internalJobApplicationsTable.jobId, req.params.id),
            eq(internalJobApplicationsTable.applicantUserId, req.user.id) as any,
          ),
        )
        .limit(1),
      db
        .select()
        .from(internalJobCandidateAnalysesTable)
        .where(
          and(
            eq(internalJobCandidateAnalysesTable.internalJobId, req.params.id),
            eq(internalJobCandidateAnalysesTable.userId, req.user.id) as any,
          ),
        )
        .orderBy(desc(internalJobCandidateAnalysesTable.createdAt))
        .limit(1),
    ]);

    res.json({
      job,
      applicationCount: Number(appCountRow[0]?.cnt ?? 0),
      userApplication: myApp[0] ?? null,
      latestAnalysis: myAnalysis[0] ?? null,
      plan,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load job detail");
    res.status(500).json({ error: "Failed to load job" });
  }
});

// ─── GET /internal-jobs/posted — recruiter's own listings ────────────────────

router.get("/internal-jobs/posted", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const { status } = req.query as Record<string, string>;

    const conditions: any[] = [eq(internalJobsTable.postedByUserId, req.user.id)];
    if (status) conditions.push(eq(internalJobsTable.status, status));

    const jobs = await db
      .select()
      .from(internalJobsTable)
      .where(and(...conditions))
      .orderBy(desc(internalJobsTable.createdAt));

    if (!jobs.length) { res.json({ jobs: [] }); return; }

    const jobIds = jobs.map((j) => j.id);
    const appCounts = await db
      .select({ jobId: internalJobApplicationsTable.jobId, cnt: count() })
      .from(internalJobApplicationsTable)
      .where(sql`${internalJobApplicationsTable.jobId} = ANY(${jobIds})`)
      .groupBy(internalJobApplicationsTable.jobId);

    const cntMap = Object.fromEntries(appCounts.map((a) => [a.jobId, Number(a.cnt)]));
    res.json({ jobs: jobs.map((j) => ({ ...j, applicationCount: cntMap[j.id] ?? 0 })) });
  } catch (err) {
    logger.error({ err }, "Failed to load posted jobs");
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

export default router;
