import { toNumber, round } from "./relocation-helpers.js";
import type { SalaryAnalysisResult, SalaryQualitySignal } from "./relocation-schemas.js";

type SalaryPeriod = "hourly" | "daily" | "monthly" | "annual" | "unknown";

// ─── Detect salary period ─────────────────────────────────────────────────────

export function detectSalaryPeriod(text?: string | null): SalaryPeriod {
  if (!text) return "unknown";
  const lower = text.toLowerCase();
  if (/\bper\s+hour\b|\bhourly\b|\/hr\b|\/h\b/.test(lower)) return "hourly";
  if (/\bper\s+day\b|\bdaily\b|\/day\b/.test(lower)) return "daily";
  if (/\bper\s+month\b|\bmonthly\b|\/mo\b|\/month\b/.test(lower)) return "monthly";
  return "annual";
}

// ─── Annualize salary ─────────────────────────────────────────────────────────

export function annualizeSalary(amount: number, period: SalaryPeriod): number {
  switch (period) {
    case "hourly": return amount * 40 * 52;
    case "daily": return amount * 220;
    case "monthly": return amount * 12;
    case "annual": return amount;
    default: return amount;
  }
}

// ─── Detect currency ─────────────────────────────────────────────────────────

export function detectCurrency(job: {
  currency?: string | null;
  description?: string | null;
  country?: string | null;
}): string {
  if (job.currency) return job.currency.toUpperCase();
  const countryCurrencyMap: Record<string, string> = {
    "united kingdom": "GBP", "uk": "GBP", "gb": "GBP",
    "sweden": "SEK", "se": "SEK",
    "denmark": "DKK", "dk": "DKK",
    "norway": "NOK", "no": "NOK",
    "switzerland": "CHF", "ch": "CHF",
    "japan": "JPY", "jp": "JPY",
    "south korea": "KRW", "kr": "KRW",
    "australia": "AUD", "au": "AUD",
    "canada": "CAD", "ca": "CAD",
    "singapore": "SGD", "sg": "SGD",
    "hong kong": "HKD", "hk": "HKD",
    "china": "CNY", "cn": "CNY",
    "taiwan": "TWD", "tw": "TWD",
    "india": "INR", "in": "INR",
    "brazil": "BRL", "br": "BRL",
    "mexico": "MXN", "mx": "MXN",
    "poland": "PLN", "pl": "PLN",
    "czech republic": "CZK", "cz": "CZK",
    "hungary": "HUF", "hu": "HUF",
  };
  const country = (job.country ?? "").toLowerCase();
  return countryCurrencyMap[country] ?? "USD";
}

// ─── Estimate monthly gross salary ────────────────────────────────────────────

export function estimateMonthlyGrossSalary(job: {
  salaryMin?: number | string | null;
  salaryMax?: number | string | null;
  currency?: string | null;
  description?: string | null;
}): number | null {
  const min = toNumber(job.salaryMin);
  const max = toNumber(job.salaryMax);

  if (min === null && max === null) return null;

  // Use midpoint of range, or whichever is available
  const raw = (min !== null && max !== null)
    ? (min + max) / 2
    : (min ?? max!);

  // Heuristic: if the number looks annual (>10000), divide by 12
  if (raw > 10000) return round(raw / 12);
  // Looks already monthly
  return round(raw);
}

// ─── Compare salary to benchmark ─────────────────────────────────────────────

export function compareSalaryToBenchmark(
  monthlyGross: number,
  benchmarkMedianAnnual: number,
): { ratio: number; description: string } {
  const benchmarkMonthly = benchmarkMedianAnnual / 12;
  const ratio = monthlyGross / benchmarkMonthly;
  let description = "at benchmark";
  if (ratio >= 1.15) description = "above benchmark";
  else if (ratio <= 0.85) description = "below benchmark";
  return { ratio: round(ratio, 3), description };
}

// ─── Infer salary quality signal ─────────────────────────────────────────────

export function inferSalaryQualitySignal(
  monthlyGross: number | null,
  benchmarkMedianAnnual: number | null,
): SalaryQualitySignal {
  if (monthlyGross === null) return "unknown";
  if (benchmarkMedianAnnual === null) {
    // Without a benchmark we can still check absolute floor (~€1500/mo)
    return monthlyGross > 1500 ? "fair" : "weak";
  }
  const benchmarkMonthly = benchmarkMedianAnnual / 12;
  const ratio = monthlyGross / benchmarkMonthly;
  if (ratio >= 1.15) return "strong";
  if (ratio >= 0.85) return "fair";
  return "weak";
}

// ─── Full salary analysis ─────────────────────────────────────────────────────

export function normalizeSalary(job: {
  salaryMin?: number | string | null;
  salaryMax?: number | string | null;
  currency?: string | null;
  description?: string | null;
  country?: string | null;
}, benchmarkMedianAnnual?: number | null): SalaryAnalysisResult {
  const min = toNumber(job.salaryMin);
  const max = toNumber(job.salaryMax);
  const currency = detectCurrency(job);
  const monthlyGross = estimateMonthlyGrossSalary(job);
  const annualGross = monthlyGross !== null ? round(monthlyGross * 12) : null;
  const qualitySignal = inferSalaryQualitySignal(monthlyGross, benchmarkMedianAnnual ?? null);

  // Confidence: high if both min+max present, medium if one, low if none
  let confidenceScore = 0;
  if (min !== null && max !== null) confidenceScore = 75;
  else if (min !== null || max !== null) confidenceScore = 50;

  return {
    monthlyGross,
    annualGross,
    currency,
    period: "annual",
    qualitySignal,
    confidenceScore,
    salaryMin: min,
    salaryMax: max,
  };
}
