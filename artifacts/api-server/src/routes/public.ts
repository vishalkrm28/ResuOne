import { Router } from "express";
import { db, applicationsTable } from "@workspace/db";
import { count } from "drizzle-orm";

const router = Router();

router.get("/public/stats", async (_req, res) => {
  try {
    const [row] = await db.select({ total: count() }).from(applicationsTable);
    res.json({ analysesCount: Number(row?.total ?? 0) });
  } catch {
    res.json({ analysesCount: 0 });
  }
});

export default router;
