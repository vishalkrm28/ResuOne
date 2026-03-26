/**
 * CV Identity detection and comparison.
 *
 * Strategy (in order of confidence):
 *   1. Email match — definitive. If both sides have an email, they must match.
 *   2. Name match — fallback. Token-sorted lowercase comparison so "John Smith"
 *      and "Smith, John" resolve to the same person.
 *   3. No signal — conservatively returns "same person" to avoid false positives.
 *
 * Anti-abuse pattern:
 *   - First CV seen on an account becomes the primary identity.
 *   - Subsequent CVs are compared against the primary identity.
 *   - If a different identity is detected: +1 credit penalty is applied, and
 *     the distinct identity count is incremented.
 *   - Hard block is NOT used — we apply friction (cost) instead.
 *   - Max distinct identities per account: 3 (soft limit, after which the
 *     penalty continues but no new identities are recorded in distinctIdentityCount).
 */

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, userIdentityProfilesTable, usageEventsTable } from "@workspace/db";
import { logger } from "./logger.js";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const MAX_DISTINCT_IDENTITIES = 3;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CvIdentity {
  name: string | null;
  email: string | null;
}

export interface IdentityCheckResult {
  /** True if the submitted CV appears to belong to a different person. */
  isDifferentIdentity: boolean;
  /** True if the account has already exceeded MAX_DISTINCT_IDENTITIES. */
  isAboveLimit: boolean;
  /** Total distinct identities seen so far (including this one). */
  distinctIdentityCount: number;
  /** Name on the account's primary (first-seen) identity. */
  primaryName: string | null;
  /** Email on the account's primary (first-seen) identity. */
  primaryEmail: string | null;
}

// ─── normalizeName ─────────────────────────────────────────────────────────────
// Token-sort so "John Smith" and "Smith, John" compare equal.

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\.]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

// ─── extractIdentityFromParsedCv ───────────────────────────────────────────────
// The parsedCvJson field already has name + email extracted by the AI parser,
// so we just pluck them out.

export function extractIdentityFromParsedCv(
  parsedCv: { name?: string | null; email?: string | null } | null | undefined,
): CvIdentity {
  return {
    name: parsedCv?.name?.trim() || null,
    email: parsedCv?.email?.trim()?.toLowerCase() || null,
  };
}

// ─── isSameIdentity ────────────────────────────────────────────────────────────

export function isSameIdentity(a: CvIdentity, b: CvIdentity): boolean {
  // Email is definitive
  if (a.email && b.email) {
    return a.email === b.email;
  }
  // Fall back to token-sorted name comparison
  if (a.name && b.name) {
    return normalizeName(a.name) === normalizeName(b.name);
  }
  // No signal on either side — conservatively assume same person
  return true;
}

// ─── buildIdentityHash ─────────────────────────────────────────────────────────
// Deterministic 32-char hex hash so we can compare identities without storing PII.

function buildIdentityHash(identity: CvIdentity): string {
  const key = [identity.email ?? "", identity.name ? normalizeName(identity.name) : ""]
    .join("||")
    .toLowerCase();
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
}

// ─── checkAndRecordIdentity ────────────────────────────────────────────────────
// Main entry point called from the analyze route.
//
// Returns the identity check result so the caller can decide whether to charge
// a credit penalty. This function only records the detection — it does NOT
// spend any credits itself.
//
// Non-fatal: any DB error is logged and the function returns a safe "same
// identity" result so analysis is never blocked by identity system failures.

export async function checkAndRecordIdentity(
  userId: string,
  identity: CvIdentity,
  applicationId: string,
): Promise<IdentityCheckResult> {
  try {
    const hash = buildIdentityHash(identity);
    const now = new Date().toISOString();

    const [profile] = await db
      .select()
      .from(userIdentityProfilesTable)
      .where(eq(userIdentityProfilesTable.userId, userId));

    // ── First CV ever on this account ──────────────────────────────────────────
    if (!profile) {
      await db.insert(userIdentityProfilesTable).values({
        userId,
        primaryIdentityHash: hash,
        primaryIdentityName: identity.name,
        primaryIdentityEmail: identity.email,
        distinctIdentityCount: 1,
        identityHistory: [
          { hash, name: identity.name, email: identity.email, detectedAt: now },
        ],
      });

      logger.info({ userId, applicationId }, "Primary CV identity established");

      return {
        isDifferentIdentity: false,
        isAboveLimit: false,
        distinctIdentityCount: 1,
        primaryName: identity.name,
        primaryEmail: identity.email,
      };
    }

    // ── Compare against stored primary identity ────────────────────────────────
    const primaryIdentity: CvIdentity = {
      name: profile.primaryIdentityName ?? null,
      email: profile.primaryIdentityEmail ?? null,
    };

    if (isSameIdentity(primaryIdentity, identity)) {
      return {
        isDifferentIdentity: false,
        isAboveLimit: false,
        distinctIdentityCount: profile.distinctIdentityCount,
        primaryName: profile.primaryIdentityName ?? null,
        primaryEmail: profile.primaryIdentityEmail ?? null,
      };
    }

    // ── Different identity detected ────────────────────────────────────────────
    const newCount = profile.distinctIdentityCount + 1;
    const isAboveLimit = newCount > MAX_DISTINCT_IDENTITIES;

    const history = Array.isArray(profile.identityHistory) ? profile.identityHistory : [];
    const updatedHistory = [
      ...history.slice(-19),
      { hash, name: identity.name, email: identity.email, detectedAt: now },
    ];

    await db
      .update(userIdentityProfilesTable)
      .set({
        distinctIdentityCount: newCount,
        identityHistory: updatedHistory,
        updatedAt: new Date(),
      })
      .where(eq(userIdentityProfilesTable.userId, userId));

    // Audit log — creditsDelta 0 because the credit penalty is charged separately
    await db.insert(usageEventsTable).values({
      userId,
      type: "identity_switch",
      creditsDelta: 0,
      metadata: {
        applicationId,
        fromHash: profile.primaryIdentityHash,
        toHash: hash,
        toName: identity.name,
        toEmail: identity.email,
        distinctCount: newCount,
        isAboveLimit,
      },
    });

    logger.warn(
      {
        userId,
        applicationId,
        fromHash: profile.primaryIdentityHash,
        toHash: hash,
        distinctCount: newCount,
        isAboveLimit,
      },
      "CV identity switch detected",
    );

    return {
      isDifferentIdentity: true,
      isAboveLimit,
      distinctIdentityCount: newCount,
      primaryName: profile.primaryIdentityName ?? null,
      primaryEmail: profile.primaryIdentityEmail ?? null,
    };
  } catch (err) {
    logger.error({ err, userId, applicationId }, "Identity check failed (non-fatal) — analysis proceeding");
    return {
      isDifferentIdentity: false,
      isAboveLimit: false,
      distinctIdentityCount: 0,
      primaryName: null,
      primaryEmail: null,
    };
  }
}
