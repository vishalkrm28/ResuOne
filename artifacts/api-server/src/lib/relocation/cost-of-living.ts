import { db, cityCostProfilesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { normalizeCityName, normalizeCountryName, round, toNumber } from "./relocation-helpers.js";
import type { CityCostProfile } from "@workspace/db";
import type { CostOfLivingSignal, CostProfileResult, Lifestyle } from "./relocation-schemas.js";

// ─── Fetch cost profile ───────────────────────────────────────────────────────

export async function getCityCostProfile(
  city: string,
  country: string,
): Promise<CityCostProfile | null> {
  const nc = normalizeCityName(city);
  const nco = normalizeCountryName(country);

  const results = await db
    .select()
    .from(cityCostProfilesTable)
    .where(
      and(
        eq(cityCostProfilesTable.normalizedCity, nc),
        eq(cityCostProfilesTable.normalizedCountry, nco),
      ),
    )
    .limit(1);

  return results[0] ?? null;
}

// ─── Calculate estimated monthly cost ────────────────────────────────────────

export function estimateMonthlyCost(
  profile: CityCostProfile,
  lifestyle: Lifestyle = "moderate",
): number | null {
  const rent = toNumber(profile.rentMid);
  const food = toNumber(profile.monthlyFood);
  const transport = toNumber(profile.monthlyTransport);
  const utilities = toNumber(profile.monthlyUtilities);
  const healthcare = toNumber(profile.monthlyHealthcare);
  const other = toNumber(profile.monthlyOther);

  // If pre-calculated total is available and rent breakdown is missing, use it
  if (rent === null) {
    const preCalc = toNumber(profile.estimatedMonthlyCost);
    if (preCalc === null) return null;
    const multiplier = lifestyle === "low" ? 0.85 : lifestyle === "high" ? 1.25 : 1.0;
    return round(preCalc * multiplier);
  }

  const base = (rent ?? 0) + (food ?? 0) + (transport ?? 0) + (utilities ?? 0) + (healthcare ?? 0) + (other ?? 0);
  const multiplier = lifestyle === "low" ? 0.85 : lifestyle === "high" ? 1.25 : 1.0;
  return round(base * multiplier);
}

// ─── Cost-of-living signal ────────────────────────────────────────────────────

export function costOfLivingSignal(
  monthlyCost: number | null,
  monthlyNetSalary: number | null,
): CostOfLivingSignal {
  if (monthlyCost === null || monthlyNetSalary === null) return "unknown";
  const surplus = monthlyNetSalary - monthlyCost;
  const ratio = monthlyCost / monthlyNetSalary;
  if (ratio <= 0.55) return "affordable";
  if (ratio <= 0.75) return "manageable";
  return "expensive";
}

// ─── Monthly surplus ─────────────────────────────────────────────────────────

export function calculateMonthlySurplus(
  monthlyNetSalary: number | null,
  estimatedMonthlyCost: number | null,
): number | null {
  if (monthlyNetSalary === null || estimatedMonthlyCost === null) return null;
  return round(monthlyNetSalary - estimatedMonthlyCost);
}

// ─── Full cost profile result ─────────────────────────────────────────────────

export async function buildCostProfileResult(
  city: string | null | undefined,
  country: string | null | undefined,
  monthlyNetSalary: number | null,
  lifestyle: Lifestyle = "moderate",
): Promise<CostProfileResult> {
  if (!city || !country) {
    return { estimatedMonthlyCost: null, signal: "unknown", confidenceScore: 0, currency: null };
  }

  const profile = await getCityCostProfile(city, country);
  if (!profile) {
    return { estimatedMonthlyCost: null, signal: "unknown", confidenceScore: 0, currency: null };
  }

  const monthlyCost = estimateMonthlyCost(profile, lifestyle);
  const signal = costOfLivingSignal(monthlyCost, monthlyNetSalary);
  const confidenceScore = profile.confidenceScore ?? 30;

  return {
    estimatedMonthlyCost: monthlyCost,
    signal,
    confidenceScore,
    currency: profile.currency,
    breakdown: {
      rent: toNumber(profile.rentMid),
      food: toNumber(profile.monthlyFood),
      transport: toNumber(profile.monthlyTransport),
      utilities: toNumber(profile.monthlyUtilities),
      healthcare: toNumber(profile.monthlyHealthcare),
      other: toNumber(profile.monthlyOther),
    },
  };
}

// ─── Compare current vs target city ──────────────────────────────────────────

export async function compareCurrentVsTargetCity(
  currentCity: string,
  currentCountry: string,
  targetCity: string,
  targetCountry: string,
): Promise<{
  currentMonthlyCost: number | null;
  targetMonthlyCost: number | null;
  differencePercent: number | null;
  targetIsMoreExpensive: boolean | null;
}> {
  const [currentProfile, targetProfile] = await Promise.all([
    getCityCostProfile(currentCity, currentCountry),
    getCityCostProfile(targetCity, targetCountry),
  ]);

  const currentCost = currentProfile ? estimateMonthlyCost(currentProfile, "moderate") : null;
  const targetCost = targetProfile ? estimateMonthlyCost(targetProfile, "moderate") : null;

  if (currentCost === null || targetCost === null) {
    return { currentMonthlyCost: currentCost, targetMonthlyCost: targetCost, differencePercent: null, targetIsMoreExpensive: null };
  }

  const differencePercent = round(((targetCost - currentCost) / currentCost) * 100);
  return {
    currentMonthlyCost: currentCost,
    targetMonthlyCost: targetCost,
    differencePercent,
    targetIsMoreExpensive: targetCost > currentCost,
  };
}
