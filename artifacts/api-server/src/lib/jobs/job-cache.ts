import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, jobSearchCacheTable } from "@workspace/db";
import { logger } from "../logger.js";

const DEFAULT_CACHE_HOURS = parseInt(
  process.env.JOB_DISCOVERY_CACHE_HOURS ?? "12",
  10,
);

// ─── Cache key ────────────────────────────────────────────────────────────────

export function buildSearchCacheKey(params: {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
  filters?: Record<string, unknown>;
}): string {
  const { query, country = "", location = "", remoteOnly = false, filters = {} } = params;
  const normalized = JSON.stringify({
    q: query.toLowerCase().trim(),
    c: country.toLowerCase().trim(),
    l: location.toLowerCase().trim(),
    r: remoteOnly,
    f: filters,
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// ─── Read cache ───────────────────────────────────────────────────────────────

export async function getCachedSearchResult(cacheKey: string): Promise<{
  jobIds: string[];
  resultCount: number;
} | null> {
  try {
    const [row] = await db
      .select()
      .from(jobSearchCacheTable)
      .where(eq(jobSearchCacheTable.cacheKey, cacheKey))
      .limit(1);

    if (!row) return null;
    if (!isCacheFresh(row.expiresAt)) {
      // Expired — clean up silently
      await db
        .delete(jobSearchCacheTable)
        .where(eq(jobSearchCacheTable.cacheKey, cacheKey))
        .catch(() => {});
      return null;
    }

    return {
      jobIds: (row.resultJobIds as string[]) ?? [],
      resultCount: row.resultCount ?? 0,
    };
  } catch (err) {
    logger.warn({ err }, "Cache read failed (non-critical)");
    return null;
  }
}

// ─── Write cache ──────────────────────────────────────────────────────────────

export async function saveCachedSearchResult({
  query,
  country,
  location,
  remoteOnly,
  filters,
  cacheKey,
  jobIds,
}: {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
  filters?: Record<string, unknown>;
  cacheKey: string;
  jobIds: string[];
}): Promise<void> {
  const expiresAt = new Date(
    Date.now() + DEFAULT_CACHE_HOURS * 60 * 60 * 1000,
  );

  try {
    await db
      .insert(jobSearchCacheTable)
      .values({
        query,
        country: country ?? null,
        remoteOnly: remoteOnly ?? false,
        filters: (filters ?? {}) as any,
        cacheKey,
        resultJobIds: jobIds as any,
        resultCount: jobIds.length,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: jobSearchCacheTable.cacheKey,
        set: {
          resultJobIds: jobIds as any,
          resultCount: jobIds.length,
          expiresAt,
        },
      });
  } catch (err) {
    logger.warn({ err }, "Cache write failed (non-critical)");
  }
}

// ─── Freshness check ──────────────────────────────────────────────────────────

export function isCacheFresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt > new Date();
}
