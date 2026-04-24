import { z } from "zod";

// ─── Task types ───────────────────────────────────────────────────────────────

export const AI_TASK_TYPES = [
  "relocation_summary",
] as const;
export type AiTaskType = typeof AI_TASK_TYPES[number];

// ─── Provider identifiers ─────────────────────────────────────────────────────

export type AiProviderName = "openai" | "anthropic" | "deterministic";

// ─── Result wrapper ───────────────────────────────────────────────────────────

export const AiRouterResultSchema = z.object({
  output: z.record(z.unknown()),
  provider: z.enum(["openai", "anthropic", "deterministic"]),
  model: z.string().nullable(),
  latencyMs: z.number(),
  fromFallback: z.boolean(),
});
export type AiRouterResult = z.infer<typeof AiRouterResultSchema>;

// ─── Relocation summary input/output ─────────────────────────────────────────

export const RelocationSummaryInputSchema = z.object({
  relocationScore: z.number(),
  relocationRecommendation: z.string(),
  riskFlags: z.array(z.string()),
  positiveFactors: z.array(z.string()),
  estimatedMonthlyGross: z.number().nullable(),
  estimatedMonthlyNet: z.number().nullable(),
  estimatedMonthlyCost: z.number().nullable(),
  estimatedMonthlySurplus: z.number().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  jobTitle: z.string(),
  company: z.string(),
});
export type RelocationSummaryInput = z.infer<typeof RelocationSummaryInputSchema>;

export const RelocationSummaryOutputSchema = z.object({
  summary: z.string(),
  mainUpside: z.string(),
  mainRisk: z.string(),
  candidateAdvice: z.string(),
  confidenceNote: z.string(),
});
export type RelocationSummaryOutput = z.infer<typeof RelocationSummaryOutputSchema>;
