import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { db, recruiterJobsTable, recruiterJobCandidatesTable, recruiterCandidateMatchesTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { parseCv, normalizeJobDescription } from "../services/ai.js";
import { extractTextFromFile } from "../services/fileParser.js";
import { calculateMatchScore } from "../lib/scoring/index.js";
import type { ScoringInput } from "../lib/scoring/scoring-types.js";
import { scoreToRecommendation, rankCandidates } from "../lib/scoring/scoring-helpers.js";

const router = Router();

// ─── Auth + recruiter access helpers ─────────────────────────────────────────

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

async function requireRecruiterAccess(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [user] = await db
      .select({ recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus, recruiterTeamId: usersTable.recruiterTeamId })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (user.recruiterSubscriptionStatus === "solo" || user.recruiterSubscriptionStatus === "team") {
      req.effectiveRecruiterId = req.user.id;
      next(); return;
    }

    if (user.recruiterTeamId) {
      const [owner] = await db
        .select({ recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus })
        .from(usersTable)
        .where(eq(usersTable.id, user.recruiterTeamId));
      if (owner?.recruiterSubscriptionStatus === "team") {
        req.effectiveRecruiterId = user.recruiterTeamId;
        next(); return;
      }
    }

    res.status(403).json({ error: "Recruiter subscription required", code: "RECRUITER_REQUIRED" });
  } catch (err) {
    logger.error({ err }, "requireRecruiterAccess error");
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Multer for batch upload ──────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

const batchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 100 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype) || /\.(pdf|docx|doc|txt)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error("Unsupported file type"), { code: "INVALID_FILE_TYPE" }));
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildScoringInput(parsedCv: any, normalizedReqs: any, rawCvText: string, rawDescription: string): ScoringInput {
  const cvBullets = (parsedCv?.work_experience ?? []).flatMap((w: any) => w.bullets ?? []);
  const cvTitles = (parsedCv?.work_experience ?? []).map((w: any) => w.title ?? "");

  return {
    cvSkills: [...(parsedCv?.skills ?? []), ...(parsedCv?.tools ?? [])],
    cvBullets,
    cvTitles,
    cvSummary: parsedCv?.summary ?? "",
    cvText: rawCvText,
    jdRequiredSkills: normalizedReqs?.must_have_skills ?? [],
    jdPreferredSkills: [...(normalizedReqs?.nice_to_have_skills ?? []), ...(normalizedReqs?.soft_skills ?? [])],
    jdMustHave: normalizedReqs?.must_have_skills ?? [],
    jdNiceToHave: normalizedReqs?.nice_to_have_skills ?? [],
    jdResponsibilities: normalizedReqs?.keywords ?? [],
    jdRequiredYears: normalizedReqs?.years_experience_required ?? null,
    jdText: rawDescription,
  };
}

async function assertJobOwner(jobId: string, recruiterId: string, res: any): Promise<any> {
  const [job] = await db.select().from(recruiterJobsTable).where(eq(recruiterJobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return null; }
  if (job.recruiterUserId !== recruiterId) { res.status(403).json({ error: "Access denied" }); return null; }
  return job;
}

// ─── POST /recruiter/jobs — create job + normalize ────────────────────────────

const CreateJobBody = z.object({
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  rawDescription: z.string().min(50).max(100_000),
});

router.post("/recruiter/jobs", requireAuth, requireRecruiterAccess, async (req, res) => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues, code: "VALIDATION_ERROR" });
    return;
  }

  const { title, company, location, rawDescription } = parsed.data;

  try {
    let normalizedRequirements: Record<string, unknown> = {};
    try {
      normalizedRequirements = await normalizeJobDescription(rawDescription) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err }, "Job normalization failed (non-fatal)");
    }

    const [job] = await db
      .insert(recruiterJobsTable)
      .values({ recruiterUserId: req.effectiveRecruiterId, title, company, location, rawDescription, normalizedRequirements })
      .returning();

    res.status(201).json(job);
  } catch (err) {
    logger.error({ err }, "Failed to create recruiter job");
    res.status(500).json({ error: "Failed to create job", code: "DB_ERROR" });
  }
});

// ─── GET /recruiter/jobs — list jobs ─────────────────────────────────────────

router.get("/recruiter/jobs", requireAuth, requireRecruiterAccess, async (req, res) => {
  try {
    const jobs = await db
      .select()
      .from(recruiterJobsTable)
      .where(eq(recruiterJobsTable.recruiterUserId, req.effectiveRecruiterId))
      .orderBy(desc(recruiterJobsTable.createdAt));

    res.json({ jobs });
  } catch (err) {
    logger.error({ err }, "Failed to list recruiter jobs");
    res.status(500).json({ error: "Failed to list jobs", code: "DB_ERROR" });
  }
});

// ─── GET /recruiter/jobs/:jobId — job detail + candidates ─────────────────────

router.get("/recruiter/jobs/:jobId", requireAuth, requireRecruiterAccess, async (req, res) => {
  const { jobId } = req.params;
  try {
    const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
    if (!job) return;

    const candidates = await db
      .select()
      .from(recruiterJobCandidatesTable)
      .where(eq(recruiterJobCandidatesTable.recruiterJobId, jobId))
      .orderBy(desc(recruiterJobCandidatesTable.createdAt));

    res.json({ job, candidates });
  } catch (err) {
    logger.error({ err, jobId }, "Failed to get recruiter job");
    res.status(500).json({ error: "Failed to get job", code: "DB_ERROR" });
  }
});

// ─── DELETE /recruiter/jobs/:jobId ───────────────────────────────────────────

router.delete("/recruiter/jobs/:jobId", requireAuth, requireRecruiterAccess, async (req, res) => {
  const { jobId } = req.params;
  try {
    const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
    if (!job) return;
    await db.delete(recruiterJobsTable).where(eq(recruiterJobsTable.id, jobId));
    res.status(204).end();
  } catch (err) {
    logger.error({ err, jobId }, "Failed to delete recruiter job");
    res.status(500).json({ error: "Failed to delete job", code: "DB_ERROR" });
  }
});

// ─── POST /recruiter/jobs/:jobId/upload — batch CV upload ────────────────────

router.post("/recruiter/jobs/:jobId/upload", requireAuth, requireRecruiterAccess,
  (req, res, next) => {
    batchUpload.array("files", 100)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: err.message, code: err.code }); return;
      }
      if (err) { res.status(400).json({ error: (err as Error).message ?? "Upload failed" }); return; }
      next();
    });
  },
  async (req, res) => {
    const { jobId } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded", code: "NO_FILES" }); return;
    }

    const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
    if (!job) return;

    const CHUNK = 5;
    const results: { fileName: string; status: "ok" | "error"; candidateId?: string; error?: string }[] = [];

    for (let i = 0; i < files.length; i += CHUNK) {
      const chunk = files.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (file) => {
          try {
            const rawCvText = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
            let parsedCv: Record<string, unknown> = {};
            try { parsedCv = await parseCv(rawCvText) as Record<string, unknown>; } catch (_e) {}

            const [inserted] = await db
              .insert(recruiterJobCandidatesTable)
              .values({
                recruiterJobId: jobId,
                fullName: (parsedCv as any)?.name ?? null,
                email: (parsedCv as any)?.email ?? null,
                currentTitle: (parsedCv as any)?.work_experience?.[0]?.title ?? null,
                rawCvText,
                parsedCvJson: parsedCv,
                fileName: file.originalname,
              })
              .returning({ id: recruiterJobCandidatesTable.id });

            results.push({ fileName: file.originalname, status: "ok", candidateId: inserted.id });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed";
            results.push({ fileName: file.originalname, status: "error", error: msg });
          }
        })
      );
    }

    const ok = results.filter(r => r.status === "ok").length;
    res.json({ uploaded: files.length, processed: ok, results });
  }
);

// ─── POST /recruiter/jobs/:jobId/analyze — score candidates ──────────────────

const AnalyzeBody = z.object({
  candidateIds: z.array(z.string().uuid()).optional(),
});

router.post("/recruiter/jobs/:jobId/analyze", requireAuth, requireRecruiterAccess, async (req, res) => {
  const { jobId } = req.params;
  const parsed = AnalyzeBody.safeParse(req.body);

  const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
  if (!job) return;

  try {
    let candidates = await db
      .select()
      .from(recruiterJobCandidatesTable)
      .where(eq(recruiterJobCandidatesTable.recruiterJobId, jobId));

    if (parsed.success && parsed.data.candidateIds?.length) {
      candidates = candidates.filter(c => parsed.data.candidateIds!.includes(c.id));
    }

    if (candidates.length === 0) {
      res.json({ analyzed: 0, message: "No candidates to analyze" }); return;
    }

    const normalizedReqs = job.normalizedRequirements ?? {};
    let analyzed = 0;
    const CHUNK = 5;

    for (let i = 0; i < candidates.length; i += CHUNK) {
      const chunk = candidates.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (candidate) => {
        try {
          const scoringInput = buildScoringInput(candidate.parsedCvJson, normalizedReqs, candidate.rawCvText, job.rawDescription);
          const breakdown = calculateMatchScore(scoringInput);

          const score = Math.round(breakdown.totalScore);
          const recommendation = scoreToRecommendation(score);

          const topStrengths = breakdown.matchedKeywords.slice(0, 5);
          const topConcerns = breakdown.missingKeywords.slice(0, 5);

          await db
            .insert(recruiterCandidateMatchesTable)
            .values({
              recruiterJobId: jobId,
              recruiterCandidateId: candidate.id,
              overallScore: score,
              interviewRecommendation: recommendation,
              matchingSkills: breakdown.matchedKeywords,
              missingSkills: breakdown.missingKeywords,
              strengths: topStrengths,
              concerns: topConcerns,
              scoringBreakdownJson: breakdown as unknown as Record<string, unknown>,
            })
            .onConflictDoNothing();

          analyzed++;
        } catch (err) {
          logger.warn({ err, candidateId: candidate.id }, "Candidate scoring failed");
        }
      }));
    }

    res.json({ analyzed, total: candidates.length });
  } catch (err) {
    logger.error({ err, jobId }, "Batch analysis failed");
    res.status(500).json({ error: "Batch analysis failed", code: "ANALYSIS_ERROR" });
  }
});

// ─── POST /recruiter/jobs/:jobId/rank — assign rank positions ─────────────────

router.post("/recruiter/jobs/:jobId/rank", requireAuth, requireRecruiterAccess, async (req, res) => {
  const { jobId } = req.params;
  const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
  if (!job) return;

  try {
    const matches = await db
      .select()
      .from(recruiterCandidateMatchesTable)
      .where(eq(recruiterCandidateMatchesTable.recruiterJobId, jobId));

    if (matches.length === 0) {
      res.json({ ranked: 0, message: "No matches to rank" }); return;
    }

    const ranked = rankCandidates(matches);

    await Promise.all(
      ranked.map(m =>
        db.update(recruiterCandidateMatchesTable)
          .set({ rankPosition: m.rankPosition })
          .where(eq(recruiterCandidateMatchesTable.id, m.id))
      )
    );

    res.json({ ranked: ranked.length });
  } catch (err) {
    logger.error({ err, jobId }, "Ranking failed");
    res.status(500).json({ error: "Ranking failed", code: "RANK_ERROR" });
  }
});

// ─── GET /recruiter/jobs/:jobId/ranking — ranked list with filters ────────────

router.get("/recruiter/jobs/:jobId/ranking", requireAuth, requireRecruiterAccess, async (req, res) => {
  const { jobId } = req.params;
  const { minScore, recommendation, status, missingSkill } = req.query as Record<string, string>;

  const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
  if (!job) return;

  try {
    const candidates = await db.select().from(recruiterJobCandidatesTable)
      .where(eq(recruiterJobCandidatesTable.recruiterJobId, jobId));

    const matches = await db.select().from(recruiterCandidateMatchesTable)
      .where(eq(recruiterCandidateMatchesTable.recruiterJobId, jobId));

    const candidateMap = new Map(candidates.map(c => [c.id, c]));

    let rows = matches.map(m => ({
      ...m,
      candidate: candidateMap.get(m.recruiterCandidateId) ?? null,
    }));

    if (minScore) {
      const min = parseInt(minScore, 10);
      if (!isNaN(min)) rows = rows.filter(r => r.overallScore >= min);
    }
    if (recommendation) rows = rows.filter(r => r.interviewRecommendation === recommendation);
    if (status) rows = rows.filter(r => r.candidate?.status === status);
    if (missingSkill) {
      const needle = missingSkill.toLowerCase();
      rows = rows.filter(r => (r.missingSkills as string[]).some(s => s.toLowerCase().includes(needle)));
    }

    rows.sort((a, b) => (a.rankPosition ?? 9999) - (b.rankPosition ?? 9999));

    res.json({ job, ranking: rows, total: rows.length });
  } catch (err) {
    logger.error({ err, jobId }, "Failed to get ranking");
    res.status(500).json({ error: "Failed to get ranking", code: "DB_ERROR" });
  }
});

// ─── PATCH /recruiter/jobs/:jobId/candidates/:cid — update status ─────────────

const UpdateCandidateStatusBody = z.object({
  status: z.enum(["new", "shortlisted", "interview", "rejected", "hired"]),
});

router.patch("/recruiter/jobs/:jobId/candidates/:cid", requireAuth, requireRecruiterAccess, async (req, res) => {
  const { jobId, cid } = req.params;
  const job = await assertJobOwner(jobId, req.effectiveRecruiterId, res);
  if (!job) return;

  const parsed = UpdateCandidateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status", code: "VALIDATION_ERROR" }); return;
  }

  try {
    const [updated] = await db
      .update(recruiterJobCandidatesTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(and(eq(recruiterJobCandidatesTable.id, cid), eq(recruiterJobCandidatesTable.recruiterJobId, jobId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Candidate not found" }); return; }
    res.json(updated);
  } catch (err) {
    logger.error({ err, cid }, "Failed to update candidate status");
    res.status(500).json({ error: "Failed to update status", code: "DB_ERROR" });
  }
});

export default router;
