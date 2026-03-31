import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, applicationsTable } from "@workspace/db";
import {
  CreateApplicationBody,
  UpdateApplicationBody,
  AnalyzeApplicationBody,
  GenerateCoverLetterBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { analyzeCvForJob, generateCoverLetter, parseJobDescription } from "../services/ai.js";
import { calculateMatchScore } from "../lib/scoring/index.js";
import type { ScoringInput } from "../lib/scoring/scoring-types.js";
import { logger } from "../lib/logger.js";
import { requirePro } from "../middlewares/requirePro.js";
import { isUserPro, userCanAccessFullResult, hasUnlockedResult } from "../lib/billing.js";
import { spendCredits, getUserCredits, CREDIT_COSTS } from "../lib/credits.js";
import { consumeBulkSlot } from "../lib/bulk.js";
import { applyFreeFilter, applyProPass, applyUnlockPass } from "../lib/preview.js";
import {
  extractIdentityFromParsedCv,
  checkAndRecordIdentity,
} from "../lib/identity.js";
import { getClientIp, countFreeAnalysesByIp } from "../lib/ip.js";

const router: IRouter = Router();

// ─── GET /applications ───────────────────────────────────────────────────────

router.get("/applications", async (req, res) => {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId query param is required", code: "MISSING_USER_ID" });
    return;
  }

  // ── Ownership gate ─────────────────────────────────────────────────────────
  // Only the authenticated user may list their own applications.
  // This prevents user A from listing user B's applications by passing a
  // different userId in the query string.
  if (userId !== req.user.id) {
    res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
    return;
  }

  try {
    const apps = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.userId, userId))
      .orderBy(desc(applicationsTable.createdAt));

    // Strip premium content from list for free users (same policy as detail GET).
    // freePreview is NOT included in the list — only needed in the detail view.
    const pro = await isUserPro(req.user.id);
    const safeApps = pro
      ? apps
      : apps.map((a) => ({ ...a, tailoredCvText: null, coverLetterText: null }));

    res.json(safeApps);
  } catch (err) {
    logger.error({ err }, "Failed to list applications");
    res.status(500).json({ error: "Failed to retrieve applications", code: "DB_ERROR" });
  }
});

// ─── POST /applications ──────────────────────────────────────────────────────

router.post("/applications", async (req, res) => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }

  // ── Free-tier gate: limit to 1 application ───────────────────────────────
  // Use req.user.id when available (auth session), else fall back to body userId.
  const ownerUserId = req.user?.id ?? parsed.data.userId;
  try {
    const pro = await isUserPro(ownerUserId);
    if (!pro) {
      const [{ value: appCount }] = await db
        .select({ value: count() })
        .from(applicationsTable)
        .where(eq(applicationsTable.userId, ownerUserId));

      if (appCount >= 1) {
        res.status(403).json({
          error: "Free plan is limited to 1 application. Upgrade to Pro for unlimited applications.",
          code: "PRO_REQUIRED",
        });
        return;
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to check Pro status on application create");
    res.status(500).json({ error: "Could not verify subscription", code: "BILLING_CHECK_ERROR" });
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const [app] = await db
      .insert(applicationsTable)
      .values({
        userId: parsed.data.userId,
        jobTitle: parsed.data.jobTitle,
        company: parsed.data.company,
        jobDescription: parsed.data.jobDescription,
        originalCvText: parsed.data.originalCvText,
        parsedCvJson: (parsed.data.parsedCvJson as any) ?? null,
        missingKeywords: [],
        matchedKeywords: [],
        missingInfoQuestions: [],
        sectionSuggestions: [],
      })
      .returning();
    res.status(201).json(app);
  } catch (err) {
    logger.error({ err }, "Failed to create application");
    res.status(500).json({ error: "Failed to create application", code: "DB_ERROR" });
  }
});

// ─── GET /applications/:id ───────────────────────────────────────────────────

router.get("/applications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    // ── Owner check ────────────────────────────────────────────────────────
    // Prevents a Pro user from reading another user's tailored CV content
    // by guessing application IDs. Only the owning user may access an app.
    const requestingUserId = req.user?.id;
    if (requestingUserId && app.userId !== requestingUserId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // ── Content gating ─────────────────────────────────────────────────────
    // Full content is sent when: (a) the user is Pro, OR (b) they have a
    // one-time unlock purchase for this specific application.
    // `userCanAccessFullResult` is the single authoritative check.
    if (!requestingUserId) {
      res.json(applyFreeFilter(app));
      return;
    }
    const [pro, unlocked] = await Promise.all([
      isUserPro(requestingUserId),
      hasUnlockedResult(requestingUserId, app.id),
    ]);
    const response = pro
      ? applyProPass(app)
      : unlocked
        ? applyUnlockPass(app)
        : applyFreeFilter(app);

    res.json({ ...response, identityFlagged: app.identityFlagged });
  } catch (err) {
    logger.error({ err, id }, "Failed to get application");
    res.status(500).json({ error: "Failed to retrieve application", code: "DB_ERROR" });
  }
});

// ─── PUT /applications/:id ───────────────────────────────────────────────────

router.put("/applications/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }
  try {
    // ── Ownership check ───────────────────────────────────────────────────────
    // Fetch the application first so we can verify the requesting user owns it.
    const [existing] = await db
      .select({ userId: applicationsTable.userId })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    const requestingUserId = req.user?.id;
    if (requestingUserId && existing.userId !== requestingUserId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // ── Strip AI-only fields ──────────────────────────────────────────────────
    // tailoredCvText and coverLetterText are set exclusively by the AI service
    // (POST /analyze and POST /cover-letter). They must NOT be writable through
    // this general PUT route — otherwise a free user could inject arbitrary
    // content by calling PUT directly instead of going through the AI service.
    const {
      tailoredCvText: _stripped1,
      coverLetterText: _stripped2,
      ...safeUpdate
    } = parsed.data;

    const [app] = await db
      .update(applicationsTable)
      .set({ ...safeUpdate, parsedCvJson: (safeUpdate.parsedCvJson as any) ?? undefined, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to update application");
    res.status(500).json({ error: "Failed to update application", code: "DB_ERROR" });
  }
});

// ─── DELETE /applications/:id ────────────────────────────────────────────────

router.delete("/applications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // ── Ownership check ───────────────────────────────────────────────────────
    const [existing] = await db
      .select({ userId: applicationsTable.userId })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    const requestingUserId = req.user?.id;
    if (requestingUserId && existing.userId !== requestingUserId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    await db.delete(applicationsTable).where(eq(applicationsTable.id, id));
    res.status(204).end();
  } catch (err) {
    logger.error({ err, id }, "Failed to delete application");
    res.status(500).json({ error: "Failed to delete application", code: "DB_ERROR" });
  }
});

// ─── PATCH /applications/:id/tailored-cv ─────────────────────────────────────

const SaveTailoredCvBody = z.object({
  tailoredCvText: z.string().min(1, "Tailored CV text cannot be empty"),
});

router.patch("/applications/:id/tailored-cv", requirePro, async (req, res) => {
  const { id } = req.params;
  const parsed = SaveTailoredCvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }
  try {
    // ── Ownership check ───────────────────────────────────────────────────────
    const [existing] = await db
      .select({ userId: applicationsTable.userId })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    const [app] = await db
      .update(applicationsTable)
      .set({ tailoredCvText: parsed.data.tailoredCvText, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to save tailored CV");
    res.status(500).json({ error: "Failed to save tailored CV", code: "DB_ERROR" });
  }
});

// ─── PATCH /applications/:id/cover-letter ────────────────────────────────────

const SaveCoverLetterBody = z.object({
  coverLetterText: z.string().min(1, "Cover letter text cannot be empty"),
});

router.patch("/applications/:id/cover-letter-save", requirePro, async (req, res) => {
  const { id } = req.params;
  const parsed = SaveCoverLetterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      code: "VALIDATION_ERROR",
    });
    return;
  }
  try {
    // ── Ownership check ───────────────────────────────────────────────────────
    const [existing] = await db
      .select({ userId: applicationsTable.userId })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    const [app] = await db
      .update(applicationsTable)
      .set({ coverLetterText: parsed.data.coverLetterText, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }
    res.json(app);
  } catch (err) {
    logger.error({ err, id }, "Failed to save cover letter");
    res.status(500).json({ error: "Failed to save cover letter", code: "DB_ERROR" });
  }
});

// ─── POST /applications/:id/analyze ─────────────────────────────────────────
//
// Order of operations (important — do not rearrange):
//   1. Fetch app  →  ownership check  →  identity check
//   2. Credit gate: base cost + optional identity-switch penalty
//   3. AI analysis + DB save
//   4. Content filter (free vs Pro) + return

router.post("/applications/:id/analyze", async (req, res) => {
  const { id } = req.params;
  const ownerUserId = req.user?.id;
  const clientIp = getClientIp(req);

  const parsed = AnalyzeApplicationBody.safeParse(req.body);
  const confirmedAnswers = parsed.success
    ? (parsed.data.confirmedAnswers as Record<string, string> | undefined)
    : undefined;

  try {
    // ── 1. Fetch app ────────────────────────────────────────────────────────
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    // ── Ownership check ─────────────────────────────────────────────────────
    if (ownerUserId && app.userId !== ownerUserId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // ── Identity check ──────────────────────────────────────────────────────
    // Skip when the request comes from the bulk session UI — bulk mode is
    // explicitly for multiple different candidates (recruiters/HR) so identity
    // switching is expected and must never trigger a warning or penalty.
    // For regular Pro users the check always runs.
    const isBulkSession = parsed.success && parsed.data.isBulkSession === true;

    let identityResult = {
      isDifferentIdentity: false,
      isAboveLimit: false,
      distinctIdentityCount: 0,
    };

    if (ownerUserId && app.parsedCvJson && !isBulkSession) {
      const identity = extractIdentityFromParsedCv(app.parsedCvJson as any);
      identityResult = await checkAndRecordIdentity(ownerUserId, identity, id);
    }

    // ── 2. Credit / bulk-slot gate ───────────────────────────────────────────
    if (ownerUserId) {
      if (isBulkSession) {
        // Bulk mode always requires a purchased bulk pass — Pro subscription
        // alone does NOT grant bulk access. Consume one slot from the pass.
        const slotConsumed = await consumeBulkSlot(ownerUserId);
        if (!slotConsumed) {
          res.status(402).json({
            error: "You have no remaining CV slots. Purchase a new Bulk pass to continue.",
            code: "BULK_SLOTS_EXHAUSTED",
          });
          return;
        }
      } else {
        // Regular single-CV analysis → deduct from credit balance.
        // Covers: Pro users (100 credits/month) and Free users (3 lifetime).
        const baseCost = CREDIT_COSTS.cv_optimization;
        if (baseCost > 0) {
          const spend = await spendCredits(ownerUserId, baseCost, "cv_optimization", {
            applicationId: id,
          });
          if (!spend.success) {
            const balance = await getUserCredits(ownerUserId);
            res.status(402).json({
              error: "You've used all your optimization credits.",
              code: "CREDITS_EXHAUSTED",
              remainingCredits: balance?.availableCredits ?? 0,
            });
            return;
          }
        }
      }

      // ── IP abuse check — free-tier only ───────────────────────────────────
      // If this user is not Pro, check how many free analyses have already
      // been performed from the same IP across ALL accounts.  Blocks users
      // who register throwaway emails to bypass the 3-credit free limit.
      if (!isBulkSession) {
        const isPro = await isUserPro(ownerUserId);
        if (!isPro && clientIp !== "unknown") {
          const ipCount = await countFreeAnalysesByIp(clientIp);
          const IP_FREE_LIMIT = 5; // analyses per IP across all accounts
          if (ipCount >= IP_FREE_LIMIT) {
            res.status(429).json({
              error: "Too many free analyses from this network. Please upgrade to Pro to continue.",
              code: "IP_LIMIT_EXCEEDED",
            });
            return;
          }
        }
      }

      // Penalty cost: +1 credit when a different person's CV is detected.
      // We charge this after the base cost check — if the user has exactly 1
      // credit left they still get to run the analysis (base cost succeeds)
      // but the penalty is a best-effort deduct (non-blocking if insufficient).
      if (identityResult.isDifferentIdentity) {
        const penaltyCost = CREDIT_COSTS.identity_switch_penalty;
        if (penaltyCost > 0) {
          // Non-blocking: if they can't afford it, log it but don't fail the request.
          const penaltySpend = await spendCredits(
            ownerUserId,
            penaltyCost,
            "identity_switch_penalty",
            { applicationId: id, distinctIdentityCount: identityResult.distinctIdentityCount },
          );
          if (!penaltySpend.success) {
            logger.warn(
              { userId: ownerUserId, applicationId: id },
              "Identity switch penalty could not be charged — insufficient credits",
            );
          }
        }
      }
    }

    // ── 3. AI analysis + scoring engine + DB save ───────────────────────────
    let parsedJd = app.parsedJdJson ?? null;
    if (!parsedJd) {
      try {
        parsedJd = await parseJobDescription(app.jobDescription);
      } catch (err) {
        logger.warn({ err, id }, "JD parse failed (non-fatal) — continuing without parsed JD");
      }
    }

    const aiResult = await analyzeCvForJob({
      originalCvText: app.originalCvText,
      jobDescription: app.jobDescription,
      jobTitle: app.jobTitle,
      company: app.company,
      parsedJd,
      confirmedAnswers,
    });

    // Build deterministic scoring input from structured CV/JD data
    const parsedCv = app.parsedCvJson as any;
    const cvSkills: string[] = parsedCv?.skills ?? [];
    const cvBullets: string[] = (parsedCv?.work_experience ?? []).flatMap(
      (exp: any) => exp.bullets ?? []
    );
    const cvTitles: string[] = (parsedCv?.work_experience ?? []).map(
      (exp: any) => exp.title ?? ""
    ).filter(Boolean);
    const cvSummary: string = parsedCv?.summary ?? "";

    const scoringInput: ScoringInput = {
      cvSkills,
      cvBullets,
      cvTitles,
      cvSummary,
      cvText: app.originalCvText,
      jdRequiredSkills: parsedJd?.required_skills ?? [],
      jdPreferredSkills: parsedJd?.preferred_skills ?? [],
      jdMustHave: parsedJd?.must_have ?? [],
      jdNiceToHave: parsedJd?.nice_to_have ?? [],
      jdResponsibilities: parsedJd?.key_responsibilities ?? [],
      jdRequiredYears: parsedJd?.required_experience_years ?? null,
      jdText: app.jobDescription,
    };

    const scoring = calculateMatchScore(scoringInput);

    const result = {
      ...aiResult,
      keywordMatchScore: scoring.totalScore,
      matchedKeywords: scoring.matchedKeywords,
      missingKeywords: scoring.missingKeywords,
    };

    // Always persist full tailoredCvText so Pro features remain accessible
    // after a free→Pro upgrade.
    await db
      .update(applicationsTable)
      .set({
        tailoredCvText: result.tailoredCvText,
        keywordMatchScore: scoring.totalScore,
        missingKeywords: scoring.missingKeywords,
        matchedKeywords: scoring.matchedKeywords,
        missingInfoQuestions: result.missingInfoQuestions,
        sectionSuggestions: result.sectionSuggestions,
        scoringBreakdownJson: scoring as unknown as Record<string, unknown>,
        inputHash: scoring.inputHash,
        parsedJdJson: parsedJd as any,
        status: "analyzed",
        identityFlagged: identityResult.isDifferentIdentity,
        ipAddress: clientIp,
        updatedAt: new Date(),
      })
      .where(eq(applicationsTable.id, id));

    // ── 4. Content filter + response ────────────────────────────────────────
    const pro = ownerUserId ? await isUserPro(ownerUserId) : false;
    const safeResult = pro
      ? applyProPass({ ...result, parsedJd, scoringBreakdownJson: scoring })
      : applyFreeFilter({ ...result, parsedJd, scoringBreakdownJson: scoring });

    res.json({
      ...safeResult,
      // Identity warning fields — consumed by the frontend to show a banner.
      // Included even when isDifferentIdentity is false so the client always
      // has a stable shape to destructure.
      identityWarning: identityResult.isDifferentIdentity,
      identityAboveLimit: identityResult.isAboveLimit,
      distinctIdentityCount: identityResult.distinctIdentityCount,
    });
  } catch (err) {
    logger.error({ err, id }, "Failed to analyze application");
    res.status(500).json({ error: "Analysis failed. Please try again.", code: "ANALYSIS_ERROR" });
  }
});

// ─── POST /applications/:id/cover-letter ─────────────────────────────────────

router.post("/applications/:id/cover-letter", requirePro, async (req, res) => {
  const { id } = req.params;
  const parsed = GenerateCoverLetterBody.safeParse(req.body);
  const tone = parsed.success && parsed.data.tone ? parsed.data.tone : "professional";
  const additionalContext = parsed.success ? parsed.data.additionalContext : undefined;

  // ── Credit gate ───────────────────────────────────────────────────────────
  const ownerUserId = req.user?.id;
  if (ownerUserId) {
    const cost = CREDIT_COSTS.cover_letter;
    if (cost > 0) {
      const spend = await spendCredits(ownerUserId, cost, "cover_letter", { applicationId: id });
      if (!spend.success) {
        res.status(402).json({
          error: "You've used all your Pro credits for this billing period.",
          code: "CREDITS_EXHAUSTED",
          remainingCredits: 0,
        });
        return;
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).json({ error: "Application not found", code: "NOT_FOUND" });
      return;
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    if (ownerUserId && app.userId !== ownerUserId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    if (!app.tailoredCvText) {
      res.status(400).json({
        error: "Run CV analysis before generating a cover letter",
        code: "ANALYSIS_REQUIRED",
      });
      return;
    }

    // Derive candidate name from the uploaded CV, not the Clerk account.
    // Priority: parsedCvJson.name (AI-extracted) → first non-blank line of original CV text.
    let candidateName: string | undefined;
    const parsedCvForName = app.parsedCvJson as Record<string, unknown> | null;
    const nameFromParsed = typeof parsedCvForName?.name === "string" ? parsedCvForName.name.trim() : "";
    if (nameFromParsed) {
      candidateName = nameFromParsed;
    } else if (app.originalCvText) {
      const firstLine = app.originalCvText.split("\n").map((l: string) => l.trim()).find((l: string) => l.length > 0);
      if (firstLine) candidateName = firstLine;
    }

    const coverLetterText = await generateCoverLetter({
      originalCvText: app.originalCvText,
      tailoredCvText: app.tailoredCvText,
      jobDescription: app.jobDescription,
      jobTitle: app.jobTitle,
      company: app.company,
      tone,
      additionalContext,
      candidateName,
    });

    await db
      .update(applicationsTable)
      .set({ coverLetterText, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id));

    res.json({ coverLetterText });
  } catch (err) {
    logger.error({ err, id }, "Failed to generate cover letter");
    res.status(500).json({ error: "Cover letter generation failed. Please try again.", code: "GENERATION_ERROR" });
  }
});

export default router;
