import { db, relocationAnalysisCacheTable } from "@workspace/db";
import { eq, lt, sql } from "drizzle-orm";
import crypto from "crypto";
import type { RelocationAnalysisResult, Lifestyle } from "./relocation-schemas.js";

const CACHE_HOURS = Number(process.env.RELOCATION_CACHE_HOURS ?? "24");

// ─── Build cache key ──────────────────────────────────────────────────────────

export function buildRelocationCacheKey(opts: {
  userId: string;
  jobId?: string | null;
  internalJobId?: string | null;
  salaryMin?: number | string | null;
  salaryMax?: number | string | null;
  country?: string | null;
  city?: string | null;
  sponsorshipSignal?: string | null;
  languageSignal?: string | null;
  lifestyle: Lifestyle;
}): string {
  const parts = [
    opts.userId,
    opts.jobId ?? "",
    opts.internalJobId ?? "",
    String(opts.salaryMin ?? ""),
    String(opts.salaryMax ?? ""),
    opts.country ?? "",
    opts.city ?? "",
    opts.sponsorshipSignal ?? "",
    opts.languageSignal ?? "",
    opts.lifestyle,
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

// ─── Get cached analysis ──────────────────────────────────────────────────────

export async function getCachedRelocationAnalysis(
  cacheKey: string,
): Promise<RelocationAnalysisResult | null> {
  const rows = await db
    .select()
    .from(relocationAnalysisCacheTable)
    .where(eq(relocationAnalysisCacheTable.cacheKey, cacheKey))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!isRelocationCacheFresh(row.expiresAt)) return null;
  return row.resultJson as RelocationAnalysisResult;
}

// ─── Save analysis to cache ───────────────────────────────────────────────────

export async function saveRelocationAnalysisCache(opts: {
  cacheKey: string;
  userId: string;
  jobId?: string | null;
  internalJobId?: string | null;
  candidateProfileId?: string | null;
  result: RelocationAnalysisResult;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000);

  await db
    .insert(relocationAnalysisCacheTable)
    .values({
      cacheKey: opts.cacheKey,
      userId: opts.userId,
      jobId: opts.jobId ?? null,
      internalJobId: opts.internalJobId ?? null,
      candidateProfileId: opts.candidateProfileId ?? null,
      resultJson: opts.result as any,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: relocationAnalysisCacheTable.cacheKey,
      set: {
        resultJson: opts.result as any,
        expiresAt,
      },
    });
}

// ─── Check freshness ──────────────────────────────────────────────────────────

export function isRelocationCacheFresh(expiresAt: Date): boolean {
  return expiresAt > new Date();
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function purgeStaleCacheEntries(): Promise<number> {
  const result = await db
    .delete(relocationAnalysisCacheTable)
    .where(lt(relocationAnalysisCacheTable.expiresAt, new Date()));
  return (result as any).rowCount ?? 0;
}
