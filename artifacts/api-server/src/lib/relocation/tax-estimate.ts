import { round } from "./relocation-helpers.js";
import type { TaxEstimateResult } from "./relocation-schemas.js";

// ─── Per-country rough effective tax rate ranges ──────────────────────────────
// These are conservative midpoint estimates only — not tax advice.

interface TaxProfile {
  low: number;   // lower bound of effective rate
  high: number;  // upper bound of effective rate
  mid: number;   // midpoint used for estimates
  note: string;
}

const TAX_PROFILES: Record<string, TaxProfile> = {
  "sweden":           { low: 0.30, high: 0.35, mid: 0.32, note: "Swedish income tax (kommunalskatt + statlig)" },
  "se":               { low: 0.30, high: 0.35, mid: 0.32, note: "Swedish income tax" },
  "germany":          { low: 0.35, high: 0.42, mid: 0.38, note: "German income tax + solidarity surcharge" },
  "de":               { low: 0.35, high: 0.42, mid: 0.38, note: "German income tax" },
  "netherlands":      { low: 0.30, high: 0.40, mid: 0.35, note: "Dutch income tax (box 1)" },
  "nl":               { low: 0.30, high: 0.40, mid: 0.35, note: "Dutch income tax" },
  "united kingdom":   { low: 0.25, high: 0.35, mid: 0.30, note: "UK income tax + NI contributions" },
  "uk":               { low: 0.25, high: 0.35, mid: 0.30, note: "UK income tax + NI" },
  "gb":               { low: 0.25, high: 0.35, mid: 0.30, note: "UK income tax + NI" },
  "denmark":          { low: 0.35, high: 0.45, mid: 0.40, note: "Danish income tax (bundskat + topskat)" },
  "dk":               { low: 0.35, high: 0.45, mid: 0.40, note: "Danish income tax" },
  "france":           { low: 0.30, high: 0.40, mid: 0.35, note: "French income tax + social charges" },
  "fr":               { low: 0.30, high: 0.40, mid: 0.35, note: "French income tax" },
  "switzerland":      { low: 0.20, high: 0.35, mid: 0.27, note: "Swiss income tax (varies by canton)" },
  "ch":               { low: 0.20, high: 0.35, mid: 0.27, note: "Swiss income tax" },
  "norway":           { low: 0.28, high: 0.38, mid: 0.33, note: "Norwegian income tax" },
  "no":               { low: 0.28, high: 0.38, mid: 0.33, note: "Norwegian income tax" },
  "ireland":          { low: 0.25, high: 0.35, mid: 0.30, note: "Irish income tax + PRSI + USC" },
  "ie":               { low: 0.25, high: 0.35, mid: 0.30, note: "Irish income tax" },
  "belgium":          { low: 0.35, high: 0.45, mid: 0.40, note: "Belgian income tax + social security" },
  "be":               { low: 0.35, high: 0.45, mid: 0.40, note: "Belgian income tax" },
  "spain":            { low: 0.25, high: 0.37, mid: 0.31, note: "Spanish IRPF + social security" },
  "es":               { low: 0.25, high: 0.37, mid: 0.31, note: "Spanish income tax" },
  "italy":            { low: 0.28, high: 0.40, mid: 0.34, note: "Italian IRPEF + regional tax" },
  "it":               { low: 0.28, high: 0.40, mid: 0.34, note: "Italian income tax" },
  "portugal":         { low: 0.22, high: 0.35, mid: 0.28, note: "Portuguese IRS" },
  "pt":               { low: 0.22, high: 0.35, mid: 0.28, note: "Portuguese income tax" },
  "austria":          { low: 0.30, high: 0.40, mid: 0.35, note: "Austrian income tax" },
  "at":               { low: 0.30, high: 0.40, mid: 0.35, note: "Austrian income tax" },
  "poland":           { low: 0.20, high: 0.32, mid: 0.26, note: "Polish PIT" },
  "pl":               { low: 0.20, high: 0.32, mid: 0.26, note: "Polish income tax" },
  "czech republic":   { low: 0.20, high: 0.30, mid: 0.25, note: "Czech personal income tax" },
  "cz":               { low: 0.20, high: 0.30, mid: 0.25, note: "Czech income tax" },
  "hungary":          { low: 0.15, high: 0.25, mid: 0.20, note: "Hungarian SZJA + contributions" },
  "hu":               { low: 0.15, high: 0.25, mid: 0.20, note: "Hungarian income tax" },
  "finland":          { low: 0.30, high: 0.40, mid: 0.35, note: "Finnish income tax" },
  "fi":               { low: 0.30, high: 0.40, mid: 0.35, note: "Finnish income tax" },
  "united states":    { low: 0.22, high: 0.32, mid: 0.27, note: "US federal + state tax estimate" },
  "us":               { low: 0.22, high: 0.32, mid: 0.27, note: "US federal + state tax" },
  "usa":              { low: 0.22, high: 0.32, mid: 0.27, note: "US federal + state tax" },
  "canada":           { low: 0.25, high: 0.35, mid: 0.30, note: "Canadian federal + provincial tax" },
  "ca":               { low: 0.25, high: 0.35, mid: 0.30, note: "Canadian income tax" },
  "australia":        { low: 0.25, high: 0.37, mid: 0.31, note: "Australian income tax + Medicare levy" },
  "au":               { low: 0.25, high: 0.37, mid: 0.31, note: "Australian income tax" },
  "singapore":        { low: 0.10, high: 0.22, mid: 0.15, note: "Singapore income tax (flat rate structure)" },
  "sg":               { low: 0.10, high: 0.22, mid: 0.15, note: "Singapore income tax" },
  "united arab emirates": { low: 0.00, high: 0.00, mid: 0.00, note: "UAE has no personal income tax" },
  "uae":              { low: 0.00, high: 0.00, mid: 0.00, note: "UAE no income tax" },
  "ae":               { low: 0.00, high: 0.00, mid: 0.00, note: "UAE no income tax" },
  "new zealand":      { low: 0.25, high: 0.35, mid: 0.30, note: "NZ income tax + ACC levy" },
  "nz":               { low: 0.25, high: 0.35, mid: 0.30, note: "NZ income tax" },
};

const DEFAULT_PROFILE: TaxProfile = {
  low: 0.25,
  high: 0.35,
  mid: 0.30,
  note: "Generic estimate — actual rate varies by country",
};

export function getDefaultTaxRateEstimate(country: string): TaxProfile {
  const key = country.toLowerCase().trim();
  return TAX_PROFILES[key] ?? DEFAULT_PROFILE;
}

export function buildTaxDisclaimer(country: string): string {
  const profile = getDefaultTaxRateEstimate(country);
  return (
    `Tax estimate for ${country}: rough effective rate ~${Math.round(profile.low * 100)}–${Math.round(profile.high * 100)}% ` +
    `(${profile.note}). This is not tax advice. Actual liability depends on personal circumstances, deductions, and local rules.`
  );
}

export function estimateMonthlyNetSalary(
  grossMonthly: number,
  country: string,
): TaxEstimateResult {
  const profile = getDefaultTaxRateEstimate(country);
  const estimatedMonthlyNet = round(grossMonthly * (1 - profile.mid));
  const isKnown = (TAX_PROFILES[country.toLowerCase().trim()] !== undefined);

  return {
    estimatedMonthlyNet,
    estimatedTaxRate: profile.mid,
    confidenceScore: isKnown ? 55 : 35,
    disclaimer: buildTaxDisclaimer(country),
  };
}
