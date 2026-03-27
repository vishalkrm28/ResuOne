import { Router } from "express";
import { db, bulkPassesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

const ADMIN_TOKEN = process.env["ADMIN_SEED_TOKEN"] ?? "parsepilot-admin-2026";

router.post("/_admin/seed-bulk", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }

  try {
    await db.insert(bulkPassesTable).values({
      userId,
      cvLimit: 25,
      cvsUsed: 0,
      tier: "25",
      status: "paid",
      amountPaid: 2900,
      currency: "gbp",
    });

    logger.info({ userId }, "Admin seeded bulk pass");
    res.json({ success: true, message: `Bulk pass (25 CVs) granted to ${userId}` });
  } catch (err: any) {
    logger.error({ err }, "Admin seed failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
