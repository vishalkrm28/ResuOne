import {
  db,
  internalJobsTable,
  discoveredJobsTable,
  candidateVisaPreferencesTable,
  jobRelocationScoresTable,
  cityCostProfilesTable,
  salaryBenchmarksTable,
} from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { logger } from "../logger.js";
import { normalizeSalary } from "./salary-analysis.js";
import { estimateMonthlyNetSalary } from "./tax-estimate.js";
import { buildCostProfileResult, calculateMonthlySurplus, costOfLivingSignal } from "./cost-of-living.js";
import { calculateRelocationScore } from "./relocation-score.js";
import { generateRelocationSummary } from "./relocation-prompts.js";
import {
  buildRelocationCacheKey,
  getCachedRelocationAnalysis,
  saveRelocationAnalysisCache,
} from "./relocation-cache.js";
import { calculateLanguageFit } from "../language/language-fit.js";
import { toNumber, normalizeJobTitle, normalizeCountryName } from "./relocation-helpers.js";
import {
  RELOCATION_DISCLAIMER,
  type RelocationAnalysisResult,
  type Lifestyle,
} from "./relocation-schemas.js";

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function analyzeRelocationForJob(opts: {
  userId: string;
  candidateProfileId?: string | null;
  jobId?: string | null;
  internalJobId?: string | null;
  lifestyle?: Lifestyle;
  forceRefresh?: boolean;
}): Promise<RelocationAnalysisResult | null> {
  const lifestyle = opts.lifestyle ?? "moderate";

  // ── 1. Fetch job ──────────────────────────────────────────────────────────
  let job: any = null;
  let jobSource = "internal";

  if (opts.internalJobId) {
    const rows = await db.select().from(internalJobsTable)
      .where(eq(internalJobsTable.id, opts.internalJobId)).limit(1);
    job = rows[0] ?? null;
    jobSource = "internal";
  } else if (opts.jobId) {
    const rows = await db.select().from(discoveredJobsTable)
      .where(eq(discoveredJobsTable.id, opts.jobId)).limit(1);
    job = rows[0] ?? null;
    jobSource = "discovered";
  }

  if (!job) {
    logger.warn({ opts }, "Relocation pipeline: job not found");
    return null;
  }

  // ── 2. Build cache key ───────────────────────────────────────────────────
  const cacheKey = buildRelocationCacheKey({
    userId: opts.userId,
    jobId: opts.jobId,
    internalJobId: opts.internalJobId,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    country: job.country,
    city: job.location,
    sponsorshipSignal: job.sponsorshipSignal ?? null,
    languageSignal: job.languageRequirementSignal ?? null,
    lifestyle,
  });

  // ── 3. Return cache if fresh ─────────────────────────────────────────────
  if (!opts.forceRefresh) {
    const cached = await getCachedRelocationAnalysis(cacheKey);
    if (cached) return { ...cached, fromCache: true };
  }

  // ── 4. Fetch candidate preferences ──────────────────────────────────────
  const prefRows = await db
    .select()
    .from(candidateVisaPreferencesTable)
    .where(eq(candidateVisaPreferencesTable.userId, opts.userId))
    .limit(1);
  const prefs = prefRows[0] ?? null;

  const targetCountries: string[] = (prefs?.targetCountries as string[]) ?? [];
  const knownLanguages: string[] = (prefs?.knownLanguages as string[]) ?? [];
  const preferredWorkingLanguages: string[] = (prefs?.preferredWorkingLanguages as string[]) ?? [];
  const targetCountryMatch = job.country
    ? targetCountries.some((c: string) => c.toLowerCase() === job.country?.toLowerCase())
    : false;

  // ── 5. Visa + language signals ───────────────────────────────────────────
  const sponsorshipSignal: string | null = job.sponsorshipSignal ?? null;
  const languageSignal: string | null = job.languageRequirementSignal ?? null;

  // Compute visa fit
  const visaFit = deriveVisaFit(sponsorshipSignal, prefs?.needsVisaSponsorship ?? false);

  // Compute language fit
  const langFitResult = calculateLanguageFit({
    candidateKnownLanguages: knownLanguages,
    candidatePreferredWorkingLanguages: preferredWorkingLanguages,
    requiredLanguages: (job.languageRequired as string[]) ?? [],
    preferredLanguages: (job.languagePreferred as string[]) ?? [],
    languageRequirementSignal: languageSignal ?? "unknown",
  });
  const languageFit = langFitResult.fit;

  // ── 6. Salary analysis ───────────────────────────────────────────────────
  // Fetch benchmark if available
  let benchmarkMedian: number | null = null;
  if (job.title && job.country) {
    const normTitle = normalizeJobTitle(job.title);
    const benchRows = await db
      .select({ salaryMedian: salaryBenchmarksTable.salaryMedian })
      .from(salaryBenchmarksTable)
      .where(ilike(salaryBenchmarksTable.normalizedJobTitle, `%${normTitle.split(" ").slice(0, 2).join("%")}%`))
      .limit(1);
    benchmarkMedian = toNumber(benchRows[0]?.salaryMedian);
  }

  const salaryAnalysis = normalizeSalary({
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    description: job.description,
    country: job.country,
  }, benchmarkMedian);

  // ── 7. Tax estimate ──────────────────────────────────────────────────────
  const country = job.country ?? "";
  let estimatedMonthlyNet: number | null = null;
  if (salaryAnalysis.monthlyGross !== null) {
    const taxResult = estimateMonthlyNetSalary(salaryAnalysis.monthlyGross, country);
    estimatedMonthlyNet = taxResult.estimatedMonthlyNet;
  }

  // ── 8. Cost of living ────────────────────────────────────────────────────
  const city = extractCity(job.location);
  const costResult = await buildCostProfileResult(city, country, estimatedMonthlyNet, lifestyle);
  const surplus = calculateMonthlySurplus(estimatedMonthlyNet, costResult.estimatedMonthlyCost);

  // ── 9. Relocation score ──────────────────────────────────────────────────
  const scoreResult = calculateRelocationScore({
    salarySignal: salaryAnalysis.qualitySignal,
    costSignal: costResult.signal,
    surplus,
    visaFit,
    languageFit,
    relocationSupport: !!(job.relocationSupport ?? false),
    remote: !!(job.remote ?? false),
    sponsorshipSignal,
    languageSignal,
    workAuthorizationRequirement: job.workAuthorizationRequirement ?? null,
    targetCountryMatch,
    costConfidence: costResult.confidenceScore,
  });

  // ── 10. AI summary ───────────────────────────────────────────────────────
  const { summary: aiSummary, provider: aiProvider, model: aiModel } = await generateRelocationSummary(
    scoreResult,
    {
      estimatedMonthlyGross: salaryAnalysis.monthlyGross,
      estimatedMonthlyNet,
      estimatedMonthlyCost: costResult.estimatedMonthlyCost,
      estimatedMonthlySurplus: surplus,
      country,
      city,
      jobTitle: job.title,
      company: job.company ?? "",
    },
  );

  // ── 11. Persist to DB ────────────────────────────────────────────────────
  const annualSurplus = surplus !== null ? surplus * 12 : null;
  const overallConfidence = Math.round(
    (salaryAnalysis.confidenceScore + costResult.confidenceScore) / 2,
  );

  await db
    .insert(jobRelocationScoresTable)
    .values({
      jobSource,
      jobId: opts.jobId ?? null,
      internalJobId: opts.internalJobId ?? null,
      userId: opts.userId,
      candidateProfileId: opts.candidateProfileId ?? null,
      salaryScore: scoreResult.salaryScore,
      costOfLivingScore: scoreResult.costOfLivingScore,
      visaScore: scoreResult.visaScore,
      languageScore: scoreResult.languageScore,
      relocationSupportScore: scoreResult.relocationSupportScore,
      relocationScore: scoreResult.relocationScore,
      relocationRecommendation: scoreResult.relocationRecommendation,
      salaryQualitySignal: salaryAnalysis.qualitySignal,
      costOfLivingSignal: costResult.signal,
      estimatedMonthlyGrossSalary: salaryAnalysis.monthlyGross !== null ? String(salaryAnalysis.monthlyGross) : null,
      estimatedMonthlyNetSalary: estimatedMonthlyNet !== null ? String(estimatedMonthlyNet) : null,
      estimatedMonthlyCost: costResult.estimatedMonthlyCost !== null ? String(costResult.estimatedMonthlyCost) : null,
      estimatedMonthlySurplus: surplus !== null ? String(surplus) : null,
      estimatedAnnualSurplus: annualSurplus !== null ? String(annualSurplus) : null,
      riskFlags: scoreResult.riskFlags as any,
      positiveFactors: scoreResult.positiveFactors as any,
      aiSummary: aiSummary as any,
      aiProvider: aiProvider ?? null,
      aiModel: aiModel ?? null,
      confidenceScore: overallConfidence,
      lifestyle,
    })
    .onConflictDoNothing();

  // ── 12. Update job summary columns ────────────────────────────────────────
  try {
    if (opts.internalJobId) {
      await db.update(internalJobsTable)
        .set({
          relocationScore: scoreResult.relocationScore,
          relocationRecommendation: scoreResult.relocationRecommendation,
          estimatedMonthlySurplus: surplus !== null ? String(surplus) : null,
          salaryQualitySignal: salaryAnalysis.qualitySignal,
          costOfLivingSignal: costResult.signal,
          updatedAt: new Date(),
        } as any)
        .where(eq(internalJobsTable.id, opts.internalJobId));
    } else if (opts.jobId) {
      await db.update(discoveredJobsTable)
        .set({
          relocationScore: scoreResult.relocationScore,
          relocationRecommendation: scoreResult.relocationRecommendation,
          estimatedMonthlySurplus: surplus !== null ? String(surplus) : null,
          salaryQualitySignal: salaryAnalysis.qualitySignal,
          costOfLivingSignal: costResult.signal,
          updatedAt: new Date(),
        } as any)
        .where(eq(discoveredJobsTable.id, opts.jobId));
    }
  } catch (err) {
    logger.warn({ err }, "Relocation pipeline: failed to update job summary columns");
  }

  // ── 13. Build result ──────────────────────────────────────────────────────
  const result: RelocationAnalysisResult = {
    jobSource,
    jobId: opts.jobId ?? null,
    internalJobId: opts.internalJobId ?? null,
    userId: opts.userId,
    relocationScore: scoreResult.relocationScore,
    relocationRecommendation: scoreResult.relocationRecommendation,
    salaryScore: scoreResult.salaryScore,
    costOfLivingScore: scoreResult.costOfLivingScore,
    visaScore: scoreResult.visaScore,
    languageScore: scoreResult.languageScore,
    relocationSupportScore: scoreResult.relocationSupportScore,
    estimatedMonthlyGrossSalary: salaryAnalysis.monthlyGross,
    estimatedMonthlyNetSalary: estimatedMonthlyNet,
    estimatedMonthlyCost: costResult.estimatedMonthlyCost,
    estimatedMonthlySurplus: surplus,
    estimatedAnnualSurplus: annualSurplus,
    salaryQualitySignal: salaryAnalysis.qualitySignal,
    costOfLivingSignal: costResult.signal,
    visaFit,
    languageFit,
    riskFlags: scoreResult.riskFlags,
    positiveFactors: scoreResult.positiveFactors,
    aiSummary,
    aiProvider,
    aiModel,
    confidenceScore: overallConfidence,
    lifestyle,
    disclaimer: RELOCATION_DISCLAIMER,
  };

  // ── 14. Save cache ────────────────────────────────────────────────────────
  await saveRelocationAnalysisCache({
    cacheKey,
    userId: opts.userId,
    jobId: opts.jobId ?? null,
    internalJobId: opts.internalJobId ?? null,
    candidateProfileId: opts.candidateProfileId ?? null,
    result,
  });

  return result;
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function backfillRelocationScoresForUser(userId: string): Promise<number> {
  const jobs = await db.select({ id: internalJobsTable.id })
    .from(internalJobsTable)
    .limit(20);

  let count = 0;
  for (const job of jobs) {
    try {
      await analyzeRelocationForJob({ userId, internalJobId: job.id, forceRefresh: true });
      count++;
    } catch (err) {
      logger.warn({ err, jobId: job.id }, "Backfill: failed for job");
    }
  }
  return count;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveVisaFit(sponsorshipSignal: string | null, needsSponsorship: boolean): string {
  if (!needsSponsorship) return "good";
  if (!sponsorshipSignal || sponsorshipSignal === "unknown") return "unknown";
  if (sponsorshipSignal === "high" || sponsorshipSignal === "medium") return "good";
  if (sponsorshipSignal === "low") return "risky";
  if (sponsorshipSignal === "none" || sponsorshipSignal === "no") return "unlikely";
  return "unknown";
}

/** Extract city from a location string like "Berlin, Germany" */
function extractCity(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim());
  return parts[0] ?? null;
}
