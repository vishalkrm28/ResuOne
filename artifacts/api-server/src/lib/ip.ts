import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Extracts the real client IP from a request.
 * Respects X-Forwarded-For (set by Replit's proxy) and falls back to req.ip.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    // X-Forwarded-For can be a comma-separated list — take the first (original client)
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

/**
 * How many free-tier analyses (across ALL user accounts) have been performed
 * from this IP address.  Pro users are excluded from the count — we only want
 * to catch multi-account free-tier abuse.
 *
 * Joins applications → usage_events to find events with action = 'cv_optimization'
 * for users who are not on an active Pro subscription.
 */
export async function countFreeAnalysesByIp(ip: string): Promise<number> {
  if (!ip || ip === "unknown") return 0;

  const result = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM applications a
    WHERE a.ip_address = ${ip}
      AND a.status != 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = a.user_id
          AND u.subscription_status = 'active'
      )
  `);

  const row = (result.rows as Array<{ cnt: string | number }>)[0];
  return row ? Number(row.cnt) : 0;
}
