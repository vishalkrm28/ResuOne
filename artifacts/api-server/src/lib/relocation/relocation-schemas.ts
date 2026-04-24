import { z } from "zod";

// ─── Signal enums ─────────────────────────────────────────────────────────────

export const SalaryQualitySignalSchema = z.enum(["strong", "fair", "weak", "unknown"]);
export type SalaryQualitySignal = z.infer<typeof SalaryQualitySignalSchema>;

export const CostOfLivingSignalSchema = z.enum(["affordable", "manageable", "expensive", "unknown"]);
export type CostOfLivingSignal = z.infer<typeof CostOfLivingSignalSchema>;

export const RelocationRecommendationSchema = z.enum([
  "strong_move", "possible_move", "risky_move", "not_recommended", "unknown",
]);
export type RelocationRecommendation = z.infer<typeof RelocationRecommendationSchema>;

export const LifestyleSchema = z.enum(["low", "moderate", "high"]);
export type Lifestyle = z.infer<typeof LifestyleSchema>;

// ─── Risk flags + positive factors ───────────────────────────────────────────

export const RelocationRiskFlagSchema = z.enum([
  "salary_missing",
  "salary_low",
  "high_cost_of_living",
  "no_sponsorship_signal",
  "sponsorship_unknown",
  "local_language_required",
  "language_fit_poor",
  "no_relocation_support",
  "work_authorization_unclear",
  "tax_unknown",
  "cost_data_low_confidence",
]);
export type RelocationRiskFlag = z.infer<typeof RelocationRiskFlagSchema>;

export const RelocationPositiveFactorSchema = z.enum([
  "salary_above_benchmark",
  "affordable_city",
  "visa_friendly",
  "english_friendly",
  "relocation_support",
  "remote_option",
  "target_country_match",
  "strong_candidate_match",
]);
export type RelocationPositiveFactor = z.infer<typeof RelocationPositiveFactorSchema>;

// ─── Core types ───────────────────────────────────────────────────────────────

export const AiRelocationSummarySchema = z.object({
  summary: z.string(),
  mainUpside: z.string(),
  mainRisk: z.string(),
  candidateAdvice: z.string(),
  confidenceNote: z.string(),
});
export type AiRelocationSummary = z.infer<typeof AiRelocationSummarySchema>;

export const RelocationScoreResultSchema = z.object({
  salaryScore: z.number().int().min(0).max(25),
  costOfLivingScore: z.number().int().min(0).max(25),
  visaScore: z.number().int().min(0).max(20),
  languageScore: z.number().int().min(0).max(20),
  relocationSupportScore: z.number().int().min(0).max(10),
  relocationScore: z.number().int().min(0).max(100),
  relocationRecommendation: RelocationRecommendationSchema,
  riskFlags: z.array(RelocationRiskFlagSchema),
  positiveFactors: z.array(RelocationPositiveFactorSchema),
});
export type RelocationScoreResult = z.infer<typeof RelocationScoreResultSchema>;

export const SalaryAnalysisResultSchema = z.object({
  monthlyGross: z.number().nullable(),
  annualGross: z.number().nullable(),
  currency: z.string().nullable(),
  period: z.enum(["hourly", "daily", "monthly", "annual", "unknown"]),
  qualitySignal: SalaryQualitySignalSchema,
  confidenceScore: z.number().int().min(0).max(100),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
});
export type SalaryAnalysisResult = z.infer<typeof SalaryAnalysisResultSchema>;

export const TaxEstimateResultSchema = z.object({
  estimatedMonthlyNet: z.number().nullable(),
  estimatedTaxRate: z.number(),
  confidenceScore: z.number().int().min(0).max(100),
  disclaimer: z.string(),
});
export type TaxEstimateResult = z.infer<typeof TaxEstimateResultSchema>;

export const CostProfileResultSchema = z.object({
  estimatedMonthlyCost: z.number().nullable(),
  signal: CostOfLivingSignalSchema,
  confidenceScore: z.number().int().min(0).max(100),
  currency: z.string().nullable(),
  breakdown: z.object({
    rent: z.number().nullable(),
    food: z.number().nullable(),
    transport: z.number().nullable(),
    utilities: z.number().nullable(),
    healthcare: z.number().nullable(),
    other: z.number().nullable(),
  }).optional(),
});
export type CostProfileResult = z.infer<typeof CostProfileResultSchema>;

export const RelocationAnalysisResultSchema = z.object({
  jobSource: z.string(),
  jobId: z.string().nullable(),
  internalJobId: z.string().nullable(),
  userId: z.string(),
  relocationScore: z.number(),
  relocationRecommendation: RelocationRecommendationSchema,
  salaryScore: z.number(),
  costOfLivingScore: z.number(),
  visaScore: z.number(),
  languageScore: z.number(),
  relocationSupportScore: z.number(),
  estimatedMonthlyGrossSalary: z.number().nullable(),
  estimatedMonthlyNetSalary: z.number().nullable(),
  estimatedMonthlyCost: z.number().nullable(),
  estimatedMonthlySurplus: z.number().nullable(),
  estimatedAnnualSurplus: z.number().nullable(),
  salaryQualitySignal: SalaryQualitySignalSchema,
  costOfLivingSignal: CostOfLivingSignalSchema,
  visaFit: z.string(),
  languageFit: z.string(),
  riskFlags: z.array(RelocationRiskFlagSchema),
  positiveFactors: z.array(RelocationPositiveFactorSchema),
  aiSummary: AiRelocationSummarySchema,
  aiProvider: z.string().nullable(),
  aiModel: z.string().nullable(),
  confidenceScore: z.number(),
  lifestyle: LifestyleSchema,
  disclaimer: z.string(),
  fromCache: z.boolean().optional(),
});
export type RelocationAnalysisResult = z.infer<typeof RelocationAnalysisResultSchema>;

export const RELOCATION_DISCLAIMER =
  "Relocation, salary, tax, visa, and cost-of-living estimates are approximate. " +
  "Confirm details with official sources, employers, and qualified professionals before making decisions.";
