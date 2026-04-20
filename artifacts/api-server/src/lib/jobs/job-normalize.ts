import crypto from "crypto";
import type { UnifiedJob } from "./job-schema.js";

// ─── HTML strip ───────────────────────────────────────────────────────────────

/** Strip HTML tags and normalize whitespace from a string. */
export function sanitizeDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Remote detection ─────────────────────────────────────────────────────────

const REMOTE_SIGNALS = [
  "remote", "work from home", "wfh", "home office", "fully remote",
  "distributed", "anywhere", "virtual", "telecommute",
];

export function inferRemoteFlag(title: string, location: string): boolean {
  const text = `${title} ${location}`.toLowerCase();
  return REMOTE_SIGNALS.some((sig) => text.includes(sig));
}

// ─── Employment type ──────────────────────────────────────────────────────────

export function inferEmploymentType(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (s.includes("full") || s.includes("permanent")) return "full-time";
  if (s.includes("part")) return "part-time";
  if (s.includes("contract") || s.includes("freelance") || s.includes("temporary")) return "contract";
  if (s.includes("intern")) return "internship";
  return raw.trim();
}

// ─── Country inference ────────────────────────────────────────────────────────

const COUNTRY_HINTS: Array<{ pattern: RegExp; country: string }> = [
  { pattern: /\bsweden\b|\bstockholm\b|\bgothenburg\b|\bmalmö\b/i, country: "se" },
  { pattern: /\bnorway\b|\boslo\b|\bbergen\b/i, country: "no" },
  { pattern: /\bdenmark\b|\bcopenhagen\b/i, country: "dk" },
  { pattern: /\bfinland\b|\bhelsinki\b/i, country: "fi" },
  { pattern: /\bgermany\b|\bberlin\b|\bhamburg\b|\bmunich\b/i, country: "de" },
  { pattern: /\bnetherlands\b|\bamsterdam\b|\brotterdam\b/i, country: "nl" },
  { pattern: /\bbel?gium\b|\bbrussels?\b|\bbr[uü]ssel\b|\bantwerp\b|\bghent\b|\bliège\b/i, country: "be" },
  { pattern: /\bswitzerland\b|\bzurich\b|\bgeneva\b|\bbern\b/i, country: "ch" },
  { pattern: /\baustri[ae]\b|\bvienna\b/i, country: "at" },
  { pattern: /\bunited kingdom\b|\blondon\b|\bmanchester\b|\bedinburgh\b|\bbirmingham\b/i, country: "gb" },
  { pattern: /\bireland\b|\bdublin\b/i, country: "ie" },
  { pattern: /\bunited states\b|\bnew york\b|\bsan francisco\b|\blos angeles\b|\bchicago\b|\bseattle\b|\busa\b|\bu\.s\.a\./i, country: "us" },
  { pattern: /\baustralia\b|\bsydney\b|\bmelbourne\b|\bbrisbane\b/i, country: "au" },
  { pattern: /\bcanada\b|\btoronto\b|\bvancouver\b|\bmontreal\b/i, country: "ca" },
  { pattern: /\bsingapore\b/i, country: "sg" },
  { pattern: /\bindia\b|\bbangalore\b|\bmumbai\b|\bdelhi\b|\bhyderabad\b/i, country: "in" },
  { pattern: /\bfrance\b|\bparis\b|\blyon\b|\bmarseille\b/i, country: "fr" },
  { pattern: /\bspain\b|\bmadrid\b|\bbarcelona\b/i, country: "es" },
  { pattern: /\bportugal\b|\blisbon\b|\bporto\b/i, country: "pt" },
  { pattern: /\bpoland\b|\bwarsaw\b|\bkrakow\b/i, country: "pl" },
  { pattern: /\bczech\b|\bprague\b/i, country: "cz" },
  { pattern: /\bital[yi]\b|\brome\b|\bmilan\b/i, country: "it" },
  { pattern: /\bremote\b|\banywhere\b|\bglobal\b|\bworldwide\b/i, country: "remote" },
];

export function inferCountry(location: string, queryCountry = ""): string {
  if (queryCountry) return queryCountry;
  for (const { pattern, country } of COUNTRY_HINTS) {
    if (pattern.test(location)) return country;
  }
  return "";
}

// ─── Seniority ────────────────────────────────────────────────────────────────

export function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/\b(vp|vice president|cto|ceo|coo|chief)\b/.test(t)) return "executive";
  if (/\b(director|head of|principal)\b/.test(t)) return "director";
  if (/\b(senior|sr\.?|lead|staff|architect)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|graduate|entry.?level|associate)\b/.test(t)) return "junior";
  if (/\b(intern|trainee|apprentice)\b/.test(t)) return "intern";
  if (/\b(mid|middle|intermediate)\b/.test(t)) return "mid";
  return "";
}

// ─── Location normalization ───────────────────────────────────────────────────

export function normalizeLocation(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

// ─── Canonical key ────────────────────────────────────────────────────────────

/**
 * Build a stable canonical key from title + company + location.
 * Falls back to source + externalId when available.
 *
 * The key is a short SHA-256 prefix so it's compact and collision-resistant.
 */
export function buildCanonicalKey(job: {
  title: string;
  company?: string;
  location?: string;
  source?: string;
  externalId?: string;
}): string {
  const { title, company = "", location = "", source, externalId } = job;

  // Prefer source + externalId for ATS jobs (stable, unique)
  if (source && externalId) {
    const raw = `${source}::${externalId}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
  }

  // Fall back to normalized title + company + location
  const normalized = [title, company, location]
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("::");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

// ─── Full job normalization helper ────────────────────────────────────────────
// Applies all inference functions to a partially-constructed UnifiedJob

export function applyNormalization(job: UnifiedJob, queryCountry = ""): UnifiedJob {
  const location = normalizeLocation(job.location);
  const description = sanitizeDescription(job.description);
  const remote = job.remote || inferRemoteFlag(job.title, location);
  const employmentType = job.employmentType || inferEmploymentType(job.employmentType);
  const seniority = job.seniority || inferSeniority(job.title);
  const country = job.country || inferCountry(location, queryCountry);
  const canonicalKey = buildCanonicalKey({
    title: job.title,
    company: job.company,
    location,
    source: job.source,
    externalId: job.externalId,
  });

  return {
    ...job,
    location,
    description,
    remote,
    employmentType,
    seniority,
    country,
    metadata: { ...job.metadata, canonicalKey },
  };
}
