import { db, usersTable, notificationItemsTable, internalJobNotificationsTable, candidateProfilesTable } from "@workspace/db";
import { eq, and, inArray, or, isNotNull, ne, sql } from "drizzle-orm";
import { logger } from "../logger.js";
import type { InternalJob } from "@workspace/db";

// ─── Relevance scoring ────────────────────────────────────────────────────────

function textOverlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const bWords = b.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hits = bWords.filter((w) => aWords.has(w)).length;
  return hits / Math.max(aWords.size, 1);
}

function isJobRelevantForUser(
  job: InternalJob,
  profile: { normalizedProfile: unknown; preferences: unknown } | null,
): boolean {
  if (!profile) return true; // no profile — notify anyway

  const np = profile.normalizedProfile as Record<string, unknown>;
  const prefs = profile.preferences as Record<string, unknown> ?? {};

  // Country match
  const preferredCountries = (prefs.countries as string[] | undefined) ?? [];
  if (
    job.country &&
    preferredCountries.length > 0 &&
    !job.remote &&
    !preferredCountries.includes(job.country)
  ) {
    return false;
  }

  // Remote preference
  const wantsRemoteOnly = prefs.remoteOnly === true;
  if (wantsRemoteOnly && !job.remote) return false;

  return true;
}

// ─── Send notifications for a newly published job ─────────────────────────────

export async function notifyUsersOfNewJob(job: InternalJob): Promise<void> {
  try {
    const isPro = job.visibility === "pro_only";

    // Find already-notified users for this job (de-dupe)
    const alreadyNotified = await db
      .select({ userId: internalJobNotificationsTable.userId })
      .from(internalJobNotificationsTable)
      .where(eq(internalJobNotificationsTable.internalJobId, job.id));
    const notifiedSet = new Set(alreadyNotified.map((r) => r.userId));

    // Find eligible users
    const eligibleUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          ne(usersTable.id, job.postedByUserId),
          isPro
            ? or(
                inArray(usersTable.subscriptionStatus, ["active", "trialing"]),
                isNotNull(usersTable.recruiterSubscriptionStatus),
              )
            : sql`true`,
        ),
      )
      .limit(1000);

    const toNotify = eligibleUsers.filter((u) => !notifiedSet.has(u.id));
    if (!toNotify.length) return;

    // Load candidate profiles for relevance filtering (batch)
    const profiles = await db
      .select({ userId: candidateProfilesTable.userId, normalizedProfile: candidateProfilesTable.normalizedProfile, preferences: candidateProfilesTable.preferences })
      .from(candidateProfilesTable)
      .where(inArray(candidateProfilesTable.userId, toNotify.map((u) => u.id)));

    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const relevant = toNotify.filter((u) => {
      const profile = profileMap.get(u.id) ?? null;
      return isJobRelevantForUser(job, profile);
    });

    if (!relevant.length) return;

    const locationStr = [job.location, job.remote ? "Remote" : null].filter(Boolean).join(" · ");

    // Create notification items + tracking rows in parallel batches
    const notifItems = relevant.map((u) => ({
      userId: u.id,
      type: "internal_job_match",
      title: `New Resuone Exclusive: ${job.title}`,
      body: `${job.company}${locationStr ? ` · ${locationStr}` : ""}`,
      actionLabel: "View Job",
      actionUrl: `/jobs/exclusive/${job.id}`,
      priority: "medium",
      status: "pending",
    }));

    const trackingRows = relevant.map((u) => ({
      internalJobId: job.id,
      userId: u.id,
      notified: true,
    }));

    await Promise.all([
      db.insert(notificationItemsTable).values(notifItems),
      db.insert(internalJobNotificationsTable).values(trackingRows),
    ]);

    logger.info({ jobId: job.id, notified: relevant.length }, "Internal job notifications sent");
  } catch (err) {
    logger.error({ err }, "Failed to send internal job notifications");
  }
}

// ─── Application pipeline notifications ──────────────────────────────────────

export async function notifyApplicationUpdate(params: {
  recipientUserId: string;
  title: string;
  body: string;
  actionUrl: string;
  actionLabel?: string;
}): Promise<void> {
  try {
    await db.insert(notificationItemsTable).values({
      userId: params.recipientUserId,
      type: "application_update",
      title: params.title,
      body: params.body,
      actionLabel: params.actionLabel ?? "View Application",
      actionUrl: params.actionUrl,
      priority: "high",
      status: "pending",
    });
  } catch (err) {
    logger.error({ err }, "Failed to send application notification");
  }
}
