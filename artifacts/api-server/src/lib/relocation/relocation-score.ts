import type {
  SalaryQualitySignal,
  CostOfLivingSignal,
  RelocationRecommendation,
  RelocationRiskFlag,
  RelocationPositiveFactor,
  RelocationScoreResult,
} from "./relocation-schemas.js";

// ─── Score tables ─────────────────────────────────────────────────────────────

const SALARY_SCORES: Record<SalaryQualitySignal, number> = {
  strong: 25,
  fair: 17,
  weak: 8,
  unknown: 5,
};

const COL_SCORES: Record<string, number> = {
  surplus_high: 25,   // > 1500
  surplus_mid: 18,    // 750–1500
  surplus_low: 10,    // 250–749
  surplus_tight: 3,   // < 250
  unknown: 8,
};

const VISA_SCORES: Record<string, number> = {
  good: 20,
  risky: 10,
  unlikely: 0,
  unknown: 6,
};

const LANGUAGE_SCORES: Record<string, number> = {
  good: 20,
  risky: 10,
  poor: 0,
  unknown: 8,
};

// ─── Score helpers ────────────────────────────────────────────────────────────

function calcCostOfLivingScore(
  surplus: number | null,
  signal: CostOfLivingSignal,
): number {
  if (surplus === null) return COL_SCORES.unknown;
  if (surplus > 1500) return COL_SCORES.surplus_high;
  if (surplus >= 750) return COL_SCORES.surplus_mid;
  if (surplus >= 250) return COL_SCORES.surplus_low;
  return COL_SCORES.surplus_tight;
}

function calcVisaScore(visaFit: string): number {
  return VISA_SCORES[visaFit] ?? VISA_SCORES.unknown;
}

function calcLanguageScore(languageFit: string): number {
  return LANGUAGE_SCORES[languageFit] ?? LANGUAGE_SCORES.unknown;
}

function calcRelocationSupportScore(relocationSupport: boolean, remote: boolean): number {
  if (relocationSupport) return 10;
  if (remote) return 5;
  return 0;
}

function mapScoreToRecommendation(
  score: number,
  salarySignal: SalaryQualitySignal,
  costSignal: CostOfLivingSignal,
): RelocationRecommendation {
  // If we have no financial data, be conservative
  const financiallyBlind = salarySignal === "unknown" && costSignal === "unknown";
  if (financiallyBlind && score < 55) return "unknown";

  if (score >= 80) return "strong_move";
  if (score >= 60) return "possible_move";
  if (score >= 40) return "risky_move";
  return "not_recommended";
}

// ─── Risk flags ───────────────────────────────────────────────────────────────

function collectRiskFlags(opts: {
  salarySignal: SalaryQualitySignal;
  costSignal: CostOfLivingSignal;
  surplus: number | null;
  visaFit: string;
  languageFit: string;
  relocationSupport: boolean;
  sponsorshipSignal: string | null;
  languageSignal: string | null;
  workAuthorizationRequirement: string | null;
  costConfidence: number;
}): RelocationRiskFlag[] {
  const flags: RelocationRiskFlag[] = [];
  if (opts.salarySignal === "unknown") flags.push("salary_missing");
  if (opts.salarySignal === "weak") flags.push("salary_low");
  if (opts.costSignal === "expensive") flags.push("high_cost_of_living");
  if (opts.sponsorshipSignal === "none" || opts.sponsorshipSignal === "no") flags.push("no_sponsorship_signal");
  if (opts.sponsorshipSignal === "unknown" || opts.sponsorshipSignal === null) flags.push("sponsorship_unknown");
  if (opts.languageSignal === "local_required" || opts.languageSignal === "local_preferred") flags.push("local_language_required");
  if (opts.languageFit === "poor") flags.push("language_fit_poor");
  if (!opts.relocationSupport) flags.push("no_relocation_support");
  if (opts.workAuthorizationRequirement && opts.workAuthorizationRequirement.toLowerCase().includes("citizen")) {
    flags.push("work_authorization_unclear");
  }
  if (opts.costConfidence < 30) flags.push("cost_data_low_confidence");
  return [...new Set(flags)];
}

// ─── Positive factors ─────────────────────────────────────────────────────────

function collectPositiveFactors(opts: {
  salarySignal: SalaryQualitySignal;
  costSignal: CostOfLivingSignal;
  visaFit: string;
  languageFit: string;
  languageSignal: string | null;
  relocationSupport: boolean;
  remote: boolean;
  targetCountryMatch: boolean;
}): RelocationPositiveFactor[] {
  const factors: RelocationPositiveFactor[] = [];
  if (opts.salarySignal === "strong") factors.push("salary_above_benchmark");
  if (opts.costSignal === "affordable") factors.push("affordable_city");
  if (opts.visaFit === "good") factors.push("visa_friendly");
  if (opts.languageSignal === "english_friendly") factors.push("english_friendly");
  if (opts.relocationSupport) factors.push("relocation_support");
  if (opts.remote) factors.push("remote_option");
  if (opts.targetCountryMatch) factors.push("target_country_match");
  return factors;
}

// ─── Main scoring function ────────────────────────────────────────────────────

export interface RelocationScoreInput {
  salarySignal: SalaryQualitySignal;
  costSignal: CostOfLivingSignal;
  surplus: number | null;
  visaFit: string;
  languageFit: string;
  relocationSupport: boolean;
  remote: boolean;
  sponsorshipSignal: string | null;
  languageSignal: string | null;
  workAuthorizationRequirement: string | null;
  targetCountryMatch: boolean;
  costConfidence: number;
}

export function calculateRelocationScore(input: RelocationScoreInput): RelocationScoreResult {
  const salaryScore = SALARY_SCORES[input.salarySignal] ?? SALARY_SCORES.unknown;
  const costOfLivingScore = calcCostOfLivingScore(input.surplus, input.costSignal);
  const visaScore = calcVisaScore(input.visaFit);
  const languageScore = calcLanguageScore(input.languageFit);
  const relocationSupportScore = calcRelocationSupportScore(input.relocationSupport, input.remote);

  const relocationScore = salaryScore + costOfLivingScore + visaScore + languageScore + relocationSupportScore;
  const relocationRecommendation = mapScoreToRecommendation(relocationScore, input.salarySignal, input.costSignal);

  const riskFlags = collectRiskFlags({
    salarySignal: input.salarySignal,
    costSignal: input.costSignal,
    surplus: input.surplus,
    visaFit: input.visaFit,
    languageFit: input.languageFit,
    relocationSupport: input.relocationSupport,
    sponsorshipSignal: input.sponsorshipSignal,
    languageSignal: input.languageSignal,
    workAuthorizationRequirement: input.workAuthorizationRequirement,
    costConfidence: input.costConfidence,
  });

  const positiveFactors = collectPositiveFactors({
    salarySignal: input.salarySignal,
    costSignal: input.costSignal,
    visaFit: input.visaFit,
    languageFit: input.languageFit,
    languageSignal: input.languageSignal,
    relocationSupport: input.relocationSupport,
    remote: input.remote,
    targetCountryMatch: input.targetCountryMatch,
  });

  return {
    salaryScore,
    costOfLivingScore,
    visaScore,
    languageScore,
    relocationSupportScore,
    relocationScore,
    relocationRecommendation,
    riskFlags,
    positiveFactors,
  };
}
