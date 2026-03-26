import { type Request, type Response, type NextFunction } from "express";
import { isUserPro } from "../lib/billing.js";
import { logger } from "../lib/logger.js";

/**
 * Express middleware that blocks non-Pro users with HTTP 403.
 * Must run AFTER authMiddleware so req.user is populated.
 */
export async function requirePro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const pro = await isUserPro(req.user.id);
    if (!pro) {
      res.status(403).json({
        error: "This feature requires a ParsePilot Pro subscription.",
        code: "PRO_REQUIRED",
      });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err }, "requirePro: failed to check subscription status");
    res.status(500).json({ error: "Could not verify subscription", code: "BILLING_CHECK_ERROR" });
  }
}
