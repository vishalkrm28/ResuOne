import { Router } from "express";
import { z } from "zod";
import { db, contactMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router = Router();

const ContactBody = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  email: z.string().email().max(500).transform((s) => s.trim().toLowerCase()),
  message: z.string().min(10).max(5000).transform((s) => s.trim()),
});

// ─── POST /contact ────────────────────────────────────────────────────────────

router.post("/contact", async (req, res) => {
  const parsed = ContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please fill in all fields correctly.",
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }

  const { name, email, message } = parsed.data;
  const userId = req.user?.id ?? null;

  try {
    await db.insert(contactMessagesTable).values({ name, email, message, userId });

    // ── Optional email notification ──────────────────────────────────────────
    // Fires only when RESEND_API_KEY is configured. Gracefully skipped otherwise.
    const resendKey = process.env["RESEND_API_KEY"];
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ParsePilot <no-reply@parsepilot.io>",
            to: ["help@parsepilot.io"],
            subject: "New Contact Message – ParsePilot",
            text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
          }),
        });
      } catch (emailErr) {
        logger.warn({ emailErr }, "Contact email notification failed — message still saved");
      }
    }

    logger.info({ name, email, userId }, "Contact message received");

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to save contact message");
    res.status(500).json({ error: "Failed to send your message. Please try again.", code: "DB_ERROR" });
  }
});

export default router;
