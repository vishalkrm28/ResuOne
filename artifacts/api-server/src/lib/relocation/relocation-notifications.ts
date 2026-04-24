import { db, notificationItemsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../logger.js";
import type { RelocationAnalysisResult } from "./relocation-schemas.js";

// ─── Notify user when a relocation score is strong or possible ────────────────
// Creates one notification per user+job. Deduped by actionUrl to prevent spam.

export async function notifyRelocationScore(
  userId: string,
  result: RelocationAnalysisResult,
  opts: {
    jobTitle: string;
    company: string;
    internalJobId?: string | null;
    jobId?: string | null;
  },
): Promise<void> {
  if (
    result.relocationRecommendation !== "strong_move" &&
    result.relocationRecommendation !== "possible_move"
  ) {
    return;
  }

  const actionUrl = opts.internalJobId
    ? `/jobs/exclusive/${opts.internalJobId}`
    : "/jobs/discover";

  const recLabel =
    result.relocationRecommendation === "strong_move" ? "Strong Move" : "Possible Move";

  const surplus = result.estimatedMonthlySurplus;
  const surplusText =
    surplus !== null && surplus > 0
      ? ` · Est. surplus ~$${Math.round(surplus).toLocaleString()}/mo`
      : "";

  const title = `Relocation Fit: ${recLabel} — ${opts.jobTitle}`;
  const body = `${opts.company} · Score: ${result.relocationScore}/100${surplusText}`;

  try {
    // De-dupe: only one relocation_alert per user per job URL
    const existing = await db
      .select({ id: notificationItemsTable.id })
      .from(notificationItemsTable)
      .where(
        and(
          eq(notificationItemsTable.userId, userId),
          eq(notificationItemsTable.actionUrl, actionUrl),
          eq(notificationItemsTable.type, "relocation_alert"),
        ),
      )
      .limit(1);

    if (existing.length > 0) return;

    await db.insert(notificationItemsTable).values({
      userId,
      type: "relocation_alert",
      title,
      body,
      actionLabel: "View Job",
      actionUrl,
      priority: result.relocationRecommendation === "strong_move" ? "high" : "medium",
      status: "pending",
    } as any);

    logger.info(
      { userId, score: result.relocationScore, recommendation: result.relocationRecommendation },
      "Relocation alert notification created",
    );
  } catch (err) {
    logger.warn({ err }, "Failed to create relocation notification — non-fatal");
  }
}
