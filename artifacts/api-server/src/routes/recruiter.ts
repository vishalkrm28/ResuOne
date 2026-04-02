import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { db, candidatesTable, invitesTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

// Protect all /recruiter/* routes
router.use(["/recruiter", "/recruiter/*splat"], requireAuth);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken() {
  return randomBytes(24).toString("hex");
}

async function sendInviteEmail(opts: {
  to: string;
  candidateName: string;
  recruiterName: string;
  recruiterOrg: string;
  type: "interview" | "test";
  scheduledAt?: string | null;
  meetingLink?: string | null;
  message: string;
  inviteId: string;
  baseUrl: string;
}) {
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  if (!smtpUser || !smtpPass) {
    logger.warn("SMTP not configured — invite email skipped");
    return;
  }

  const acceptUrl = `${opts.baseUrl}/invite/${opts.inviteId}`;
  const typeLabel = opts.type === "interview" ? "Interview" : "Skills Test";

  const transporter = nodemailer.createTransport({
    host: "smtppro.zoho.eu",
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const dateStr = opts.scheduledAt
    ? new Date(opts.scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })
    : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;color:#111827">
      <div style="margin-bottom:32px">
        <span style="background:#6E42F0;color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:99px">ParsePilot</span>
      </div>
      <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">You've been invited to the next step</h1>
      <p style="color:#6B7280;margin-bottom:24px">
        <strong>${opts.recruiterName}</strong>${opts.recruiterOrg ? ` at ${opts.recruiterOrg}` : ""} has reviewed your profile and would like to move forward.
      </p>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px"><strong>Type:</strong> ${typeLabel}</p>
        ${dateStr ? `<p style="margin:0 0 8px"><strong>Date &amp; Time:</strong> ${dateStr}</p>` : ""}
        ${opts.meetingLink ? `<p style="margin:0 0 8px"><strong>Link:</strong> <a href="${opts.meetingLink}" style="color:#6E42F0">${opts.meetingLink}</a></p>` : ""}
        ${opts.message ? `<p style="margin:8px 0 0;color:#374151">${opts.message.replace(/\n/g, "<br/>")}</p>` : ""}
      </div>

      <a href="${acceptUrl}" style="display:inline-block;background:#6E42F0;color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">Accept Invite →</a>

      <p style="font-size:12px;color:#9CA3AF">
        You can also visit this link: <a href="${acceptUrl}" style="color:#6E42F0">${acceptUrl}</a>
      </p>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"ParsePilot" <${smtpUser}>`,
    to: opts.to,
    subject: `${opts.recruiterName} – ${typeLabel} Invitation`,
    html,
    text: `${opts.recruiterName}${opts.recruiterOrg ? ` at ${opts.recruiterOrg}` : ""} has invited you to a ${typeLabel}.\n\n${opts.message || ""}\n\nAccept: ${acceptUrl}`,
  });
}

// ─── GET /recruiter/analytics ─────────────────────────────────────────────────
router.get("/recruiter/analytics", async (req, res) => {
  const recruiterId = req.user!.id;
  try {
    const [total] = await db.select({ count: count() }).from(candidatesTable).where(eq(candidatesTable.recruiterId, recruiterId));
    const [invited] = await db.select({ count: count() }).from(candidatesTable).where(and(eq(candidatesTable.recruiterId, recruiterId), sql`status != 'new'`));
    const [accepted] = await db.select({ count: count() }).from(candidatesTable).where(and(eq(candidatesTable.recruiterId, recruiterId), eq(candidatesTable.status, "accepted")));
    const [rejected] = await db.select({ count: count() }).from(candidatesTable).where(and(eq(candidatesTable.recruiterId, recruiterId), eq(candidatesTable.status, "rejected")));
    const [invitesSent] = await db.select({ count: count() }).from(invitesTable).where(eq(invitesTable.recruiterId, recruiterId));
    const [invitesAccepted] = await db.select({ count: count() }).from(invitesTable).where(and(eq(invitesTable.recruiterId, recruiterId), eq(invitesTable.status, "accepted")));

    const totalInvites = invitesSent?.count ?? 0;
    const totalAccepted = invitesAccepted?.count ?? 0;
    const acceptanceRate = totalInvites > 0 ? Math.round((totalAccepted / totalInvites) * 100) : 0;

    res.json({
      total: total?.count ?? 0,
      invited: invited?.count ?? 0,
      accepted: accepted?.count ?? 0,
      rejected: rejected?.count ?? 0,
      invitesSent: totalInvites,
      invitesAccepted: totalAccepted,
      acceptanceRate,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /recruiter/candidates ─────────────────────────────────────────────────
router.get("/recruiter/candidates", async (req, res) => {
  const recruiterId = req.user!.id;
  try {
    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.recruiterId, recruiterId))
      .orderBy(desc(candidatesTable.createdAt));
    res.json({ candidates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/candidates ───────────────────────────────────────────────
const CreateCandidateBody = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  score: z.number().min(0).max(100).optional(),
  skills: z.array(z.string()).optional(),
  experience: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  applicationId: z.string().uuid().optional(),
  parsedCvJson: z.record(z.unknown()).optional(),
  originalCvText: z.string().optional(),
});

router.post("/recruiter/candidates", async (req, res) => {
  const recruiterId = req.user!.id;
  const parsed = CreateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  try {
    const [candidate] = await db.insert(candidatesTable).values({
      ...parsed.data,
      recruiterId,
      skills: parsed.data.skills ?? [],
    }).returning();
    res.status(201).json({ candidate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /recruiter/candidates/:id ────────────────────────────────────────────
router.get("/recruiter/candidates/:id", async (req, res) => {
  const recruiterId = req.user!.id;
  try {
    const [candidate] = await db.select().from(candidatesTable)
      .where(and(eq(candidatesTable.id, req.params.id), eq(candidatesTable.recruiterId, recruiterId)));
    if (!candidate) { res.status(404).json({ error: "Not found" }); return; }

    const invites = await db.select().from(invitesTable)
      .where(eq(invitesTable.candidateId, req.params.id))
      .orderBy(desc(invitesTable.createdAt));

    res.json({ candidate, invites });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /recruiter/candidates/:id ─────────────────────────────────────────
const UpdateCandidateBody = z.object({
  status: z.enum(["new", "invited", "accepted", "rejected"]).optional(),
  notes: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
});

router.patch("/recruiter/candidates/:id", async (req, res) => {
  const recruiterId = req.user!.id;
  const parsed = UpdateCandidateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed" }); return; }
  try {
    const [updated] = await db.update(candidatesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(candidatesTable.id, req.params.id), eq(candidatesTable.recruiterId, recruiterId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ candidate: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /recruiter/candidates/:id ─────────────────────────────────────────
router.delete("/recruiter/candidates/:id", async (req, res) => {
  const recruiterId = req.user!.id;
  try {
    await db.delete(invitesTable).where(eq(invitesTable.candidateId, req.params.id));
    await db.delete(candidatesTable).where(and(eq(candidatesTable.id, req.params.id), eq(candidatesTable.recruiterId, recruiterId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/candidates/:id/invite ────────────────────────────────────
const SendInviteBody = z.object({
  type: z.enum(["interview", "test"]).default("interview"),
  message: z.string().min(1).max(2000),
  scheduledAt: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable(),
  recruiterName: z.string().optional(),
  recruiterOrg: z.string().optional(),
});

router.post("/recruiter/candidates/:id/invite", async (req, res) => {
  const recruiterId = req.user!.id;
  const parsed = SendInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  try {
    const [candidate] = await db.select().from(candidatesTable)
      .where(and(eq(candidatesTable.id, req.params.id), eq(candidatesTable.recruiterId, recruiterId)));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }

    const token = makeToken();
    const [invite] = await db.insert(invitesTable).values({
      candidateId: candidate.id,
      recruiterId,
      recruiterName: parsed.data.recruiterName ?? "The hiring team",
      recruiterOrg: parsed.data.recruiterOrg ?? "",
      type: parsed.data.type,
      message: parsed.data.message,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      meetingLink: parsed.data.meetingLink ?? null,
      token,
    }).returning();

    // Update candidate status
    await db.update(candidatesTable).set({ status: "invited", updatedAt: new Date() })
      .where(eq(candidatesTable.id, candidate.id));

    // Send email
    const origin = req.headers.origin ?? `https://parsepilot.io`;
    try {
      await sendInviteEmail({
        to: candidate.email,
        candidateName: candidate.name,
        recruiterName: parsed.data.recruiterName ?? "The hiring team",
        recruiterOrg: parsed.data.recruiterOrg ?? "",
        type: parsed.data.type,
        scheduledAt: parsed.data.scheduledAt ?? null,
        meetingLink: parsed.data.meetingLink ?? null,
        message: parsed.data.message,
        inviteId: invite.id,
        baseUrl: origin,
      });
      logger.info({ inviteId: invite.id, candidateId: candidate.id }, "Invite email sent");
    } catch (emailErr) {
      logger.warn({ emailErr }, "Invite email failed — invite still created");
    }

    res.status(201).json({ invite });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/candidates/bulk-invite ────────────────────────────────────
const BulkInviteBody = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(50),
  type: z.enum(["interview", "test"]).default("interview"),
  message: z.string().min(1).max(2000),
  scheduledAt: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable(),
  recruiterName: z.string().optional(),
  recruiterOrg: z.string().optional(),
});

router.post("/recruiter/bulk-invite", async (req, res) => {
  const recruiterId = req.user!.id;
  const parsed = BulkInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const results: { id: string; success: boolean; error?: string }[] = [];
  const origin = req.headers.origin ?? "https://parsepilot.io";

  for (const candidateId of parsed.data.candidateIds) {
    try {
      const [candidate] = await db.select().from(candidatesTable)
        .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.recruiterId, recruiterId)));
      if (!candidate) { results.push({ id: candidateId, success: false, error: "Not found" }); continue; }

      const token = makeToken();
      const [invite] = await db.insert(invitesTable).values({
        candidateId: candidate.id, recruiterId,
        recruiterName: parsed.data.recruiterName ?? "The hiring team",
        recruiterOrg: parsed.data.recruiterOrg ?? "",
        type: parsed.data.type, message: parsed.data.message,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        meetingLink: parsed.data.meetingLink ?? null, token,
      }).returning();

      await db.update(candidatesTable).set({ status: "invited", updatedAt: new Date() })
        .where(eq(candidatesTable.id, candidate.id));

      try {
        await sendInviteEmail({ to: candidate.email, candidateName: candidate.name,
          recruiterName: parsed.data.recruiterName ?? "The hiring team",
          recruiterOrg: parsed.data.recruiterOrg ?? "",
          type: parsed.data.type, scheduledAt: parsed.data.scheduledAt ?? null,
          meetingLink: parsed.data.meetingLink ?? null, message: parsed.data.message,
          inviteId: invite.id, baseUrl: origin });
      } catch {}

      results.push({ id: candidateId, success: true });
    } catch (err: any) {
      results.push({ id: candidateId, success: false, error: err.message });
    }
  }

  res.json({ results });
});

// ─── GET /invite/:id (PUBLIC — candidate response) ───────────────────────────
router.get("/invite/:id", async (req, res) => {
  try {
    const [invite] = await db.select().from(invitesTable).where(eq(invitesTable.id, req.params.id));
    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }

    // Mark as opened if still sent
    if (invite.status === "sent") {
      await db.update(invitesTable).set({ status: "opened", updatedAt: new Date() })
        .where(eq(invitesTable.id, invite.id));
    }

    const [candidate] = await db.select({
      name: candidatesTable.name,
      email: candidatesTable.email,
      jobTitle: candidatesTable.jobTitle,
    }).from(candidatesTable).where(eq(candidatesTable.id, invite.candidateId));

    res.json({ invite: { ...invite, status: invite.status === "sent" ? "opened" : invite.status }, candidate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /invite/:id/respond (PUBLIC) ───────────────────────────────────────
const RespondBody = z.object({
  action: z.enum(["accept", "decline"]),
  token: z.string(),
});

router.post("/invite/:id/respond", async (req, res) => {
  const parsed = RespondBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  try {
    const [invite] = await db.select().from(invitesTable).where(eq(invitesTable.id, req.params.id));
    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
    if (invite.token !== parsed.data.token) { res.status(403).json({ error: "Invalid token" }); return; }
    if (invite.status === "accepted" || invite.status === "rejected") {
      res.json({ invite, alreadyResponded: true }); return;
    }

    const newStatus = parsed.data.action === "accept" ? "accepted" : "rejected";

    const [updated] = await db.update(invitesTable).set({ status: newStatus, updatedAt: new Date() })
      .where(eq(invitesTable.id, invite.id)).returning();

    // Also update candidate status
    await db.update(candidatesTable).set({
      status: newStatus === "accepted" ? "accepted" : "rejected",
      updatedAt: new Date(),
    }).where(eq(candidatesTable.id, invite.candidateId));

    res.json({ invite: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
