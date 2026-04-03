import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { db, candidatesTable, invitesTable, candidateNotesTable, applicationsTable, usersTable } from "@workspace/db";
import { recruiterTeamInvitesTable } from "@workspace/db";
import { eq, and, desc, count, sql, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

/**
 * requireRecruiterAccess
 * Allows:
 *   - Users with their own "solo" or "team" recruiter subscription
 *   - Users who are team members of a Team-plan owner
 *
 * Attaches to req:
 *   effectiveRecruiterId  — the pool owner (self for owner, team owner for members)
 *   recruiterPlan         — "solo" | "team"
 *   isTeamOwner           — true if this user owns the Team plan
 */
async function requireRecruiterAccess(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const [user] = await db
      .select({
        recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
        recruiterTeamId: usersTable.recruiterTeamId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const ownPlan = user.recruiterSubscriptionStatus;

    // Own recruiter subscription (Solo or Team)
    if (ownPlan === "solo" || ownPlan === "team") {
      req.effectiveRecruiterId = req.user.id;
      req.recruiterPlan = ownPlan;
      req.isTeamOwner = ownPlan === "team";
      next(); return;
    }

    // Team member — check if owner still has an active Team plan
    if (user.recruiterTeamId) {
      const [owner] = await db
        .select({ recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus })
        .from(usersTable)
        .where(eq(usersTable.id, user.recruiterTeamId));

      if (owner?.recruiterSubscriptionStatus === "team") {
        req.effectiveRecruiterId = user.recruiterTeamId;
        req.recruiterPlan = "team";
        req.isTeamOwner = false;
        next(); return;
      }
    }

    res.status(403).json({ error: "Recruiter plan required", code: "RECRUITER_ACCESS_REQUIRED" });
  } catch (err: any) {
    logger.error({ err }, "requireRecruiterAccess error");
    res.status(500).json({ error: "Internal error" });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken() {
  return randomBytes(24).toString("hex");
}

async function sendSmtpEmail(opts: { to: string; subject: string; html: string; text: string }) {
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  if (!smtpUser || !smtpPass) { logger.warn("SMTP not configured — email skipped"); return; }

  const transporter = nodemailer.createTransport({
    host: "smtppro.zoho.eu", port: 465, secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({ from: `"ResuOne" <${smtpUser}>`, ...opts });
}

async function sendInviteEmail(opts: {
  to: string; candidateName: string; recruiterName: string; recruiterOrg: string;
  type: "interview" | "test"; scheduledAt?: string | null; meetingLink?: string | null;
  message: string; inviteId: string; baseUrl: string;
}) {
  const acceptUrl = `${opts.baseUrl}/invite/${opts.inviteId}`;
  const typeLabel = opts.type === "interview" ? "Interview" : "Skills Test";
  const dateStr = opts.scheduledAt
    ? new Date(opts.scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })
    : null;

  await sendSmtpEmail({
    to: opts.to,
    subject: `${opts.recruiterName} – ${typeLabel} Invitation`,
    html: `
      <!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;color:#111827">
        <div style="margin-bottom:32px"><span style="background:#6E42F0;color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:99px">ResuOne</span></div>
        <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">You've been invited to the next step</h1>
        <p style="color:#6B7280;margin-bottom:24px"><strong>${opts.recruiterName}</strong>${opts.recruiterOrg ? ` at ${opts.recruiterOrg}` : ""} has reviewed your profile and would like to move forward.</p>
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:24px">
          <p style="margin:0 0 8px"><strong>Type:</strong> ${typeLabel}</p>
          ${dateStr ? `<p style="margin:0 0 8px"><strong>Date &amp; Time:</strong> ${dateStr}</p>` : ""}
          ${opts.meetingLink ? `<p style="margin:0 0 8px"><strong>Link:</strong> <a href="${opts.meetingLink}" style="color:#6E42F0">${opts.meetingLink}</a></p>` : ""}
          ${opts.message ? `<p style="margin:8px 0 0;color:#374151">${opts.message.replace(/\n/g, "<br/>")}</p>` : ""}
        </div>
        <a href="${acceptUrl}" style="display:inline-block;background:#6E42F0;color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">Accept Invite →</a>
        <p style="font-size:12px;color:#9CA3AF">Or visit: <a href="${acceptUrl}" style="color:#6E42F0">${acceptUrl}</a></p>
      </body></html>`,
    text: `${opts.recruiterName}${opts.recruiterOrg ? ` at ${opts.recruiterOrg}` : ""} has invited you to a ${typeLabel}.\n\n${opts.message || ""}\n\nAccept: ${acceptUrl}`,
  });
}

// ─── GET /recruiter/access ─────────────────────────────────────────────────────

router.get("/recruiter/access", requireAuth, async (req: any, res: any) => {
  try {
    const [user] = await db
      .select({
        recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus,
        recruiterTeamId: usersTable.recruiterTeamId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    const ownPlan = user?.recruiterSubscriptionStatus;
    if (ownPlan === "solo" || ownPlan === "team") {
      res.json({ hasAccess: true, plan: ownPlan, isTeamOwner: ownPlan === "team", isMember: false });
      return;
    }

    if (user?.recruiterTeamId) {
      const [owner] = await db
        .select({ recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus })
        .from(usersTable)
        .where(eq(usersTable.id, user.recruiterTeamId));

      if (owner?.recruiterSubscriptionStatus === "team") {
        res.json({ hasAccess: true, plan: "team", isTeamOwner: false, isMember: true, teamOwnerId: user.recruiterTeamId });
        return;
      }
    }

    res.json({ hasAccess: false, plan: null, isTeamOwner: false, isMember: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /recruiter/analytics ──────────────────────────────────────────────────

router.get("/recruiter/analytics", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  try {
    const [total] = await db.select({ count: count() }).from(candidatesTable).where(eq(candidatesTable.recruiterId, recruiterId));
    const [invited] = await db.select({ count: count() }).from(candidatesTable).where(and(eq(candidatesTable.recruiterId, recruiterId), sql`status != 'new'`));
    const [accepted] = await db.select({ count: count() }).from(candidatesTable).where(and(eq(candidatesTable.recruiterId, recruiterId), eq(candidatesTable.status, "accepted")));
    const [rejected] = await db.select({ count: count() }).from(candidatesTable).where(and(eq(candidatesTable.recruiterId, recruiterId), eq(candidatesTable.status, "rejected")));
    const [invitesSent] = await db.select({ count: count() }).from(invitesTable).where(eq(invitesTable.recruiterId, recruiterId));
    const [invitesAccepted] = await db.select({ count: count() }).from(invitesTable).where(and(eq(invitesTable.recruiterId, recruiterId), eq(invitesTable.status, "accepted")));

    const totalInvites = invitesSent?.count ?? 0;
    const totalAccepted = invitesAccepted?.count ?? 0;
    res.json({
      total: total?.count ?? 0, invited: invited?.count ?? 0,
      accepted: accepted?.count ?? 0, rejected: rejected?.count ?? 0,
      invitesSent: totalInvites, invitesAccepted: totalAccepted,
      acceptanceRate: totalInvites > 0 ? Math.round((totalAccepted / totalInvites) * 100) : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /recruiter/candidates ─────────────────────────────────────────────────

router.get("/recruiter/candidates", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  try {
    const candidates = await db.select().from(candidatesTable)
      .where(eq(candidatesTable.recruiterId, recruiterId))
      .orderBy(desc(candidatesTable.createdAt));
    res.json({ candidates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/candidates ────────────────────────────────────────────────

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

router.post("/recruiter/candidates", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  const parsed = CreateCandidateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }
  try {
    const [candidate] = await db.insert(candidatesTable).values({
      ...parsed.data, recruiterId, skills: parsed.data.skills ?? [],
    }).returning();
    res.status(201).json({ candidate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /recruiter/candidates/:id ─────────────────────────────────────────────

router.get("/recruiter/candidates/:id", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
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

// ─── PATCH /recruiter/candidates/:id ───────────────────────────────────────────

const UpdateCandidateBody = z.object({
  status: z.enum(["new", "invited", "accepted", "rejected"]).optional(),
  notes: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
});

router.patch("/recruiter/candidates/:id", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
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

// ─── DELETE /recruiter/candidates/:id ──────────────────────────────────────────

router.delete("/recruiter/candidates/:id", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  try {
    await db.delete(invitesTable).where(eq(invitesTable.candidateId, req.params.id));
    await db.delete(candidatesTable).where(and(eq(candidatesTable.id, req.params.id), eq(candidatesTable.recruiterId, recruiterId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/candidates/:id/invite ─────────────────────────────────────

const SendInviteBody = z.object({
  type: z.enum(["interview", "test"]).default("interview"),
  message: z.string().min(1).max(2000),
  scheduledAt: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable(),
  recruiterName: z.string().optional(),
  recruiterOrg: z.string().optional(),
});

router.post("/recruiter/candidates/:id/invite", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  const parsed = SendInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  try {
    const [candidate] = await db.select().from(candidatesTable)
      .where(and(eq(candidatesTable.id, req.params.id), eq(candidatesTable.recruiterId, recruiterId)));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }

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

    const origin = req.headers.origin ?? "https://resuone.com";
    try {
      await sendInviteEmail({
        to: candidate.email, candidateName: candidate.name,
        recruiterName: parsed.data.recruiterName ?? "The hiring team",
        recruiterOrg: parsed.data.recruiterOrg ?? "",
        type: parsed.data.type,
        scheduledAt: parsed.data.scheduledAt ?? null,
        meetingLink: parsed.data.meetingLink ?? null,
        message: parsed.data.message, inviteId: invite.id, baseUrl: origin,
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

// ─── POST /recruiter/bulk-invite ───────────────────────────────────────────────

const BulkInviteBody = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(50),
  type: z.enum(["interview", "test"]).default("interview"),
  message: z.string().min(1).max(2000),
  scheduledAt: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable(),
  recruiterName: z.string().optional(),
  recruiterOrg: z.string().optional(),
});

router.post("/recruiter/bulk-invite", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  const parsed = BulkInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const results: { id: string; success: boolean; error?: string }[] = [];
  const origin = req.headers.origin ?? "https://resuone.com";

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
        await sendInviteEmail({
          to: candidate.email, candidateName: candidate.name,
          recruiterName: parsed.data.recruiterName ?? "The hiring team",
          recruiterOrg: parsed.data.recruiterOrg ?? "",
          type: parsed.data.type,
          scheduledAt: parsed.data.scheduledAt ?? null,
          meetingLink: parsed.data.meetingLink ?? null,
          message: parsed.data.message, inviteId: invite.id, baseUrl: origin,
        });
      } catch { }

      results.push({ id: candidateId, success: true });
    } catch (err: any) {
      results.push({ id: candidateId, success: false, error: err.message });
    }
  }

  res.json({ results });
});

// ─── GET /recruiter/import-sources ─────────────────────────────────────────────

router.get("/recruiter/import-sources", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  try {
    const apps = await db
      .select({
        id: applicationsTable.id,
        jobTitle: applicationsTable.jobTitle,
        company: applicationsTable.company,
        keywordMatchScore: applicationsTable.keywordMatchScore,
        parsedCvJson: applicationsTable.parsedCvJson,
        matchedKeywords: applicationsTable.matchedKeywords,
        missingKeywords: applicationsTable.missingKeywords,
        createdAt: applicationsTable.createdAt,
      })
      .from(applicationsTable)
      .where(and(eq(applicationsTable.userId, recruiterId), eq(applicationsTable.status, "analyzed")))
      .orderBy(desc(applicationsTable.createdAt))
      .limit(100);

    const existingAppIds = await db
      .select({ applicationId: candidatesTable.applicationId })
      .from(candidatesTable)
      .where(and(eq(candidatesTable.recruiterId, recruiterId)));
    const importedIds = new Set(existingAppIds.map(r => r.applicationId?.toString()));

    const sources = apps.map(app => {
      const cv = app.parsedCvJson as any;
      return {
        id: app.id, name: cv?.name ?? "Unknown", email: cv?.email ?? null,
        score: app.keywordMatchScore, skills: cv?.skills ?? [],
        jobTitle: app.jobTitle, company: app.company,
        alreadyImported: importedIds.has(app.id), createdAt: app.createdAt,
      };
    });

    res.json({ sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/import-from-analyses ──────────────────────────────────────

const ImportBody = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(50),
});

router.post("/recruiter/import-from-analyses", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const results: { id: string; success: boolean; candidateId?: string; error?: string }[] = [];

  for (const appId of parsed.data.applicationIds) {
    try {
      const [app] = await db.select().from(applicationsTable)
        .where(and(eq(applicationsTable.id, appId), eq(applicationsTable.userId, recruiterId)));

      if (!app) { results.push({ id: appId, success: false, error: "Not found" }); continue; }

      const cv = app.parsedCvJson as any;
      const name = cv?.name ?? "Unknown";
      const email = cv?.email ?? "";
      const skills: string[] = cv?.skills ?? [];
      const experience = (cv?.work_experience ?? [])
        .slice(0, 2).map((j: any) => `${j.title} at ${j.company}`).join("; ");

      const [candidate] = await db.insert(candidatesTable).values({
        recruiterId, name, email: email || `unknown-${appId.slice(0, 8)}@import`,
        score: app.keywordMatchScore ?? undefined, skills,
        experience: experience || undefined,
        jobTitle: app.jobTitle, company: app.company,
        applicationId: app.id as any, parsedCvJson: app.parsedCvJson as any,
      }).returning();

      results.push({ id: appId, success: true, candidateId: candidate.id });
    } catch (err: any) {
      results.push({ id: appId, success: false, error: err.message });
    }
  }

  res.json({ results, imported: results.filter(r => r.success).length });
});

// ─── Candidate Notes ───────────────────────────────────────────────────────────

router.get("/recruiter/candidates/:id/notes", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  try {
    const notes = await db.select().from(candidateNotesTable)
      .where(and(eq(candidateNotesTable.candidateId, req.params.id), eq(candidateNotesTable.recruiterId, recruiterId)))
      .orderBy(desc(candidateNotesTable.createdAt));
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/recruiter/candidates/:id/notes", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  const { text } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Note text is required" }); return;
  }
  try {
    const [note] = await db.insert(candidateNotesTable).values({
      candidateId: req.params.id, recruiterId, text: text.trim(),
    }).returning();
    res.status(201).json({ note });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/recruiter/candidates/:id/notes/:noteId", requireRecruiterAccess, async (req: any, res: any) => {
  const recruiterId = req.effectiveRecruiterId;
  try {
    await db.delete(candidateNotesTable).where(
      and(eq(candidateNotesTable.id, req.params.noteId), eq(candidateNotesTable.recruiterId, recruiterId))
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: candidate invite response ────────────────────────────────────────

router.get("/invite/:id", async (req: any, res: any) => {
  try {
    const [invite] = await db.select().from(invitesTable).where(eq(invitesTable.id, req.params.id));
    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }

    if (invite.status === "sent") {
      await db.update(invitesTable).set({ status: "opened", updatedAt: new Date() })
        .where(eq(invitesTable.id, invite.id));
    }

    const [candidate] = await db.select({
      name: candidatesTable.name, email: candidatesTable.email, jobTitle: candidatesTable.jobTitle,
    }).from(candidatesTable).where(eq(candidatesTable.id, invite.candidateId));

    res.json({ invite: { ...invite, status: invite.status === "sent" ? "opened" : invite.status }, candidate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const RespondBody = z.object({
  action: z.enum(["accept", "decline"]),
  token: z.string(),
});

router.post("/invite/:id/respond", async (req: any, res: any) => {
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

    await db.update(candidatesTable).set({
      status: newStatus === "accepted" ? "accepted" : "rejected", updatedAt: new Date(),
    }).where(eq(candidatesTable.id, invite.candidateId));

    res.json({ invite: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEAM MANAGEMENT ──────────────────────────────────────────────────────────
// All team management routes require the acting user to own a Team plan.

const TEAM_MAX_SEATS = 3; // owner + 2 invited members

function requireTeamOwner(req: any, res: any, next: any) {
  if (!req.isTeamOwner) {
    res.status(403).json({ error: "Team plan required", code: "TEAM_PLAN_REQUIRED" });
    return;
  }
  next();
}

// ─── GET /recruiter/team ───────────────────────────────────────────────────────
// Returns team members and pending invites for the owner.

router.get("/recruiter/team", requireRecruiterAccess, requireTeamOwner, async (req: any, res: any) => {
  const ownerId = req.user.id;
  try {
    const members = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.recruiterTeamId, ownerId));

    const invites = await db
      .select()
      .from(recruiterTeamInvitesTable)
      .where(and(
        eq(recruiterTeamInvitesTable.teamOwnerId, ownerId),
        inArray(recruiterTeamInvitesTable.status, ["pending"]),
      ))
      .orderBy(desc(recruiterTeamInvitesTable.createdAt));

    const usedSeats = 1 + members.length; // owner counts as 1
    const pendingCount = invites.length;

    res.json({ members, invites, usedSeats, pendingCount, maxSeats: TEAM_MAX_SEATS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/team/invite ───────────────────────────────────────────────
// Invite someone to join the team (Team plan owner only, max seats enforced).

const TeamInviteBody = z.object({
  email: z.string().email(),
});

router.post("/recruiter/team/invite", requireRecruiterAccess, requireTeamOwner, async (req: any, res: any) => {
  const ownerId = req.user.id;
  const parsed = TeamInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid email" }); return; }

  const { email } = parsed.data;

  try {
    // Count current members + pending invites against seat limit
    const currentMembers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.recruiterTeamId, ownerId));

    const pendingInvites = await db
      .select({ id: recruiterTeamInvitesTable.id })
      .from(recruiterTeamInvitesTable)
      .where(and(
        eq(recruiterTeamInvitesTable.teamOwnerId, ownerId),
        eq(recruiterTeamInvitesTable.status, "pending"),
      ));

    const usedSeats = 1 + currentMembers.length + pendingInvites.length; // owner + members + pending
    if (usedSeats >= TEAM_MAX_SEATS) {
      res.status(400).json({
        error: `Your team is full (${TEAM_MAX_SEATS} seats max). Remove a member or cancel a pending invite first.`,
        code: "TEAM_FULL",
      });
      return;
    }

    // Check if already a member or already has a pending invite
    const [existingInvite] = await db
      .select()
      .from(recruiterTeamInvitesTable)
      .where(and(
        eq(recruiterTeamInvitesTable.teamOwnerId, ownerId),
        eq(recruiterTeamInvitesTable.invitedEmail, email),
        eq(recruiterTeamInvitesTable.status, "pending"),
      ));

    if (existingInvite) {
      res.status(400).json({ error: "There is already a pending invite for this email", code: "ALREADY_INVITED" });
      return;
    }

    const token = makeToken();
    const [invite] = await db.insert(recruiterTeamInvitesTable).values({
      teamOwnerId: ownerId, invitedEmail: email, token,
    }).returning();

    // Get owner's name for the email
    const [owner] = await db.select({ firstName: usersTable.firstName, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, ownerId));
    const ownerName = owner?.firstName ?? owner?.email ?? "Your colleague";

    const origin = req.headers.origin ?? "https://resuone.com";
    const joinUrl = `${origin}/recruiter/team/join/${token}`;

    try {
      await sendSmtpEmail({
        to: email,
        subject: `${ownerName} invited you to their ResuOne Recruiter team`,
        html: `
          <!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;color:#111827">
            <div style="margin-bottom:32px"><span style="background:#6E42F0;color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:99px">ResuOne</span></div>
            <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">You've been invited to a recruiter team</h1>
            <p style="color:#6B7280;margin-bottom:24px"><strong>${ownerName}</strong> has invited you to join their ResuOne Recruiter workspace. You'll share access to their candidate pipeline.</p>
            <a href="${joinUrl}" style="display:inline-block;background:#6E42F0;color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">Accept Invitation →</a>
            <p style="font-size:12px;color:#9CA3AF">Or visit: <a href="${joinUrl}" style="color:#6E42F0">${joinUrl}</a></p>
            <p style="font-size:11px;color:#D1D5DB;margin-top:32px">If you didn't expect this, you can ignore this email.</p>
          </body></html>`,
        text: `${ownerName} has invited you to join their ResuOne Recruiter team.\n\nAccept: ${joinUrl}\n\nIf you didn't expect this, ignore this email.`,
      });
    } catch (emailErr) {
      logger.warn({ emailErr }, "Team invite email failed — invite still created");
    }

    logger.info({ ownerId, email, inviteId: invite.id }, "Team invite sent");
    res.status(201).json({ invite });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /recruiter/team/invites/:inviteId ──────────────────────────────────
// Cancel a pending team invite.

router.delete("/recruiter/team/invites/:inviteId", requireRecruiterAccess, requireTeamOwner, async (req: any, res: any) => {
  const ownerId = req.user.id;
  try {
    const [invite] = await db.select().from(recruiterTeamInvitesTable)
      .where(and(
        eq(recruiterTeamInvitesTable.id, req.params.inviteId),
        eq(recruiterTeamInvitesTable.teamOwnerId, ownerId),
      ));
    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }

    await db.update(recruiterTeamInvitesTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(recruiterTeamInvitesTable.id, invite.id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /recruiter/team/members/:userId ────────────────────────────────────
// Remove a team member (Team plan owner only).

router.delete("/recruiter/team/members/:userId", requireRecruiterAccess, requireTeamOwner, async (req: any, res: any) => {
  const ownerId = req.user.id;
  const memberUserId = req.params.userId;
  try {
    const [member] = await db.select({ recruiterTeamId: usersTable.recruiterTeamId })
      .from(usersTable)
      .where(and(eq(usersTable.id, memberUserId), eq(usersTable.recruiterTeamId, ownerId)));

    if (!member) { res.status(404).json({ error: "Member not found in your team" }); return; }

    await db.update(usersTable)
      .set({ recruiterTeamId: null })
      .where(eq(usersTable.id, memberUserId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /recruiter/team/join/:token (PUBLIC) ──────────────────────────────────
// Returns team invite details so the user can decide to accept.

router.get("/recruiter/team/join/:token", async (req: any, res: any) => {
  try {
    const [invite] = await db.select().from(recruiterTeamInvitesTable)
      .where(eq(recruiterTeamInvitesTable.token, req.params.token));
    if (!invite) { res.status(404).json({ error: "Invite not found or already used" }); return; }

    const [owner] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, invite.teamOwnerId));

    const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || owner?.email || "A recruiter";

    res.json({ invite, ownerName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/team/join/:token/accept (auth required) ──────────────────
// Logged-in user accepts a team invite.

router.post("/recruiter/team/join/:token/accept", requireAuth, async (req: any, res: any) => {
  try {
    const [invite] = await db.select().from(recruiterTeamInvitesTable)
      .where(eq(recruiterTeamInvitesTable.token, req.params.token));

    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
    if (invite.status !== "pending") {
      res.status(400).json({ error: `This invite has already been ${invite.status}`, code: "INVITE_USED" }); return;
    }

    // Verify the owner still has a Team plan
    const [owner] = await db
      .select({ recruiterSubscriptionStatus: usersTable.recruiterSubscriptionStatus })
      .from(usersTable)
      .where(eq(usersTable.id, invite.teamOwnerId));

    if (owner?.recruiterSubscriptionStatus !== "team") {
      res.status(400).json({ error: "The team owner no longer has an active Team plan", code: "OWNER_NO_PLAN" });
      return;
    }

    // Count current members to enforce seat limit
    const currentMembers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.recruiterTeamId, invite.teamOwnerId));

    if (1 + currentMembers.length >= TEAM_MAX_SEATS) {
      res.status(400).json({ error: "This team is now full", code: "TEAM_FULL" }); return;
    }

    // Join the team
    await db.update(usersTable)
      .set({ recruiterTeamId: invite.teamOwnerId })
      .where(eq(usersTable.id, req.user.id));

    await db.update(recruiterTeamInvitesTable)
      .set({ status: "accepted", invitedUserId: req.user.id, updatedAt: new Date() })
      .where(eq(recruiterTeamInvitesTable.id, invite.id));

    logger.info({ userId: req.user.id, teamOwnerId: invite.teamOwnerId }, "User joined recruiter team");
    res.json({ success: true, teamOwnerId: invite.teamOwnerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /recruiter/team/leave (auth required) ────────────────────────────────
// Team member leaves the team voluntarily.

router.post("/recruiter/team/leave", requireAuth, async (req: any, res: any) => {
  try {
    const [user] = await db.select({ recruiterTeamId: usersTable.recruiterTeamId })
      .from(usersTable).where(eq(usersTable.id, req.user.id));

    if (!user?.recruiterTeamId) {
      res.status(400).json({ error: "You are not a member of any team" }); return;
    }

    await db.update(usersTable).set({ recruiterTeamId: null }).where(eq(usersTable.id, req.user.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
