import { logger } from "../logger.js";
import { routeRelocationSummary } from "../ai-router/index.js";
import type { RelocationScoreResult, AiRelocationSummary, RelocationAnalysisResult } from "./relocation-schemas.js";

// ─── Public entry point ───────────────────────────────────────────────────────
// Strategy: OpenAI (gpt-5.2) → Claude (claude-sonnet-4-6) → deterministic
// The deterministic builder is always passed as the final safety fallback.

export async function generateRelocationSummary(
  scoreResult: RelocationScoreResult,
  extras: {
    estimatedMonthlyGross: number | null;
    estimatedMonthlyNet: number | null;
    estimatedMonthlyCost: number | null;
    estimatedMonthlySurplus: number | null;
    country: string | null;
    city: string | null;
    jobTitle: string;
    company: string;
  },
): Promise<{ summary: AiRelocationSummary; provider: string | null; model: string | null }> {
  const { relocationScore, relocationRecommendation, riskFlags, positiveFactors } = scoreResult;

  const input = {
    relocationScore,
    relocationRecommendation,
    riskFlags: riskFlags as string[],
    positiveFactors: positiveFactors as string[],
    ...extras,
  };

  try {
    const result = await routeRelocationSummary(
      input,
      () => buildDeterministicSummary({ relocationScore, relocationRecommendation, riskFlags, positiveFactors, ...extras }),
    );

    logger.info(
      { provider: result.provider, model: result.model, latencyMs: result.latencyMs, fromFallback: result.fromFallback },
      "Relocation summary generated",
    );

    return {
      summary: result.output as AiRelocationSummary,
      provider: result.provider === "deterministic" ? null : result.provider,
      model: result.model,
    };
  } catch (err) {
    logger.error({ err }, "generateRelocationSummary: AI router threw — using deterministic fallback");
    return {
      summary: buildDeterministicSummary({ relocationScore, relocationRecommendation, riskFlags, positiveFactors, ...extras }),
      provider: null,
      model: null,
    };
  }
}

// ─── Deterministic summary builder (safety fallback) ──────────────────────────

function buildDeterministicSummary(opts: {
  relocationScore: number;
  relocationRecommendation: string;
  riskFlags: string[];
  positiveFactors: string[];
  estimatedMonthlyGross: number | null;
  estimatedMonthlyNet: number | null;
  estimatedMonthlyCost: number | null;
  estimatedMonthlySurplus: number | null;
  country: string | null;
  city: string | null;
  jobTitle: string;
  company: string;
}): AiRelocationSummary {
  const location = [opts.city, opts.country].filter(Boolean).join(", ") || "the target location";
  const hasFinancialData = opts.estimatedMonthlyNet !== null && opts.estimatedMonthlyCost !== null;

  let summary = `Relocation score: ${opts.relocationScore}/100 — ${recommendationLabel(opts.relocationRecommendation)}.`;
  if (hasFinancialData) {
    const surplus = opts.estimatedMonthlySurplus;
    summary += surplus !== null && surplus > 0
      ? ` Estimated monthly surplus of ~${fmtCurrency(surplus)} after estimated living costs in ${location}.`
      : ` Estimated living costs in ${location} may be tight based on available salary information.`;
  } else {
    summary += ` Salary information is missing or incomplete, making a full financial assessment difficult.`;
  }

  const mainUpside = buildMainUpside(opts.positiveFactors, opts.estimatedMonthlySurplus, location);
  const mainRisk = buildMainRisk(opts.riskFlags, location);
  const candidateAdvice = buildCandidateAdvice(opts.relocationRecommendation, opts.riskFlags, location);
  const confidenceNote = hasFinancialData
    ? "Estimates based on available salary data and city cost profiles. Actual costs will vary."
    : "Limited financial data available. Estimates are based on visa/language signals only. Confirm salary directly with the employer.";

  return { summary, mainUpside, mainRisk, candidateAdvice, confidenceNote };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recommendationLabel(rec: string): string {
  const labels: Record<string, string> = {
    strong_move: "strong candidate for relocation",
    possible_move: "viable relocation opportunity",
    risky_move: "relocation carries notable risk",
    not_recommended: "relocation not recommended based on current data",
    unknown: "insufficient data for a reliable recommendation",
  };
  return labels[rec] ?? rec;
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function buildMainUpside(positiveFactors: string[], surplus: number | null, location: string): string {
  if (positiveFactors.includes("salary_above_benchmark")) return `Salary appears above the local benchmark for ${location}.`;
  if (positiveFactors.includes("affordable_city")) return `${location} has relatively affordable living costs compared to salary.`;
  if (positiveFactors.includes("visa_friendly")) return "Visa pathway appears favourable based on available signals.";
  if (positiveFactors.includes("english_friendly")) return "The role appears English-friendly, lowering the language barrier.";
  if (positiveFactors.includes("relocation_support")) return "The employer indicates relocation support, which reduces upfront moving costs.";
  if (surplus !== null && surplus > 500) return `Estimated surplus of ~${fmtCurrency(surplus)}/month after living expenses.`;
  return "Some positive signals detected, but more information would improve the assessment.";
}

function buildMainRisk(riskFlags: string[], location: string): string {
  if (riskFlags.includes("salary_missing")) return "Salary is not disclosed, making it impossible to assess financial viability.";
  if (riskFlags.includes("no_sponsorship_signal")) return "No visa sponsorship signal detected — you may need to have the right to work already.";
  if (riskFlags.includes("language_fit_poor")) return "This role may require language skills not in your profile.";
  if (riskFlags.includes("local_language_required")) return `The role may require proficiency in the local language of ${location}.`;
  if (riskFlags.includes("high_cost_of_living")) return `The cost of living in ${location} may be high relative to the offered salary.`;
  if (riskFlags.includes("salary_low")) return "Salary appears below the local market benchmark.";
  if (riskFlags.includes("cost_data_low_confidence")) return "City cost data has low confidence — verify local living costs independently.";
  return "No major risks detected, but always verify key details with the employer.";
}

function buildCandidateAdvice(recommendation: string, riskFlags: string[], location: string): string {
  if (riskFlags.includes("salary_missing")) {
    return "Request salary information before applying — without it, the financial case for relocation cannot be assessed.";
  }
  if (recommendation === "strong_move") {
    return "This looks like a realistic and financially sound move based on available data. Confirm visa and sponsorship details with the employer.";
  }
  if (recommendation === "possible_move") {
    return "The move is viable, but confirm sponsorship status and living cost details before committing. Negotiate if salary is at the lower end.";
  }
  if (recommendation === "risky_move") {
    return "Proceed with caution. Clarify visa sponsorship, confirm salary, and research actual living costs in " + location + " before applying.";
  }
  if (recommendation === "not_recommended") {
    return "Current data suggests this relocation may not be financially or practically viable. Seek more information before proceeding.";
  }
  return "Gather more information on salary, visa sponsorship, and local living costs before making a decision.";
}
