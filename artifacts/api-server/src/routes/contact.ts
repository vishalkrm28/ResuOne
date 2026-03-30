import { Router } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
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

    // ── Zoho SMTP email notification ─────────────────────────────────────────
    const smtpUser = process.env["SMTP_USER"];
    const smtpPass = process.env["SMTP_PASS"];

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtppro.zoho.eu",
          port: 465,
          secure: true,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"ParsePilot" <${smtpUser}>`,
          to: smtpUser,
          replyTo: email,
          subject: `New Contact Message from ${name} – ParsePilot`,
          text: [
            `Name:    ${name}`,
            `Email:   ${email}`,
            ``,
            `Message:`,
            message,
          ].join("\n"),
          html: `
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <hr/>
            <p>${message.replace(/\n/g, "<br/>")}</p>
          `,
        });

        logger.info({ name, email }, "Contact email sent via Zoho SMTP");
      } catch (emailErr) {
        logger.warn({ emailErr }, "Contact email notification failed — message still saved");
      }
    } else {
      logger.warn("SMTP_USER / SMTP_PASS not configured — contact email skipped");
    }

    logger.info({ name, email, userId }, "Contact message received");

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to save contact message");
    res.status(500).json({ error: "Failed to send your message. Please try again.", code: "DB_ERROR" });
  }
});

export default router;
