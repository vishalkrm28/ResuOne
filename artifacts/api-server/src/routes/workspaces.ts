/**
 * Workspace routes — CRUD + team management.
 *
 * All routes require authentication. Permission checks are enforced server-side.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import { db, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createWorkspace,
  getWorkspaceById,
  getWorkspacesForUser,
  getWorkspaceMembers,
  getMemberCountForWorkspace,
  getMemberInWorkspace,
  inviteMember,
  acceptInvite,
  updateMemberRole,
  removeMember,
  getWorkspaceUsageSummary,
  getPendingInvitationsForWorkspace,
} from "../lib/workspaces/workspace-helpers.js";
import {
  requireWorkspacePermission,
  getMemberRole,
} from "../lib/workspaces/permissions.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const ALLOWED_ROLES = ["owner", "admin", "recruiter", "member", "viewer"] as const;

// ─── GET /workspaces ──────────────────────────────────────────────────────────
// List all workspaces the authenticated user belongs to.

router.get("/workspaces", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const rows = await getWorkspacesForUser(req.user.id);
    const result = await Promise.all(
      rows.map(async (r) => {
        const memberCount = await getMemberCountForWorkspace(r.workspace.id);
        return { ...r.workspace, role: r.member.role, memberCount };
      }),
    );
    res.json({ workspaces: result });
  } catch (err) {
    logger.error({ err }, "Failed to list workspaces");
    res.status(500).json({ error: "Could not load workspaces" });
  }
});

// ─── POST /workspaces ─────────────────────────────────────────────────────────
// Create a new workspace. Caller becomes owner.

const CreateWorkspaceBody = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/i),
  workspaceType: z.enum(["recruiter_team", "institution", "personal"]).optional(),
});

router.post("/workspaces", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", issues: parsed.error.issues }); return; }

  try {
    const ws = await createWorkspace({
      ownerUserId: req.user.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      workspaceType: parsed.data.workspaceType ?? "recruiter_team",
    });
    res.status(201).json({ workspace: ws });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "A workspace with this slug already exists" });
      return;
    }
    logger.error({ err }, "Failed to create workspace");
    res.status(500).json({ error: "Could not create workspace" });
  }
});

// ─── GET /workspaces/:id ──────────────────────────────────────────────────────

router.get("/workspaces/:id", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const ws = await getWorkspaceById(req.params.id);
    if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }

    await requireWorkspacePermission(ws.id, req.user.id, "viewer");

    const [members, invitations, usageSummary, memberCount] = await Promise.all([
      getWorkspaceMembers(ws.id),
      getPendingInvitationsForWorkspace(ws.id),
      getWorkspaceUsageSummary(ws.id),
      getMemberCountForWorkspace(ws.id),
    ]);

    const [plan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.code, ws.planCode))
      .limit(1);

    const myRole = await getMemberRole(ws.id, req.user.id);

    res.json({ workspace: ws, members, invitations, usageSummary, memberCount, plan: plan ?? null, myRole });
  } catch (err: any) {
    if (err.status === 403) { res.status(403).json({ error: err.message }); return; }
    logger.error({ err }, "Failed to get workspace detail");
    res.status(500).json({ error: "Could not load workspace" });
  }
});

// ─── POST /workspaces/:id/invite ──────────────────────────────────────────────

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "recruiter", "member", "viewer"]).default("member"),
});

router.post("/workspaces/:id/invite", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = InviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", issues: parsed.error.issues }); return; }

  try {
    const ws = await getWorkspaceById(req.params.id);
    if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }

    await requireWorkspacePermission(ws.id, req.user.id, "admin");

    // Seat limit check
    const [plan] = await db
      .select({ maxTeamMembers: plansTable.maxTeamMembers })
      .from(plansTable)
      .where(eq(plansTable.code, ws.planCode))
      .limit(1);

    const memberCount = await getMemberCountForWorkspace(ws.id);
    if (plan && plan.maxTeamMembers !== null && memberCount >= plan.maxTeamMembers) {
      res.status(403).json({ error: `Your plan allows a maximum of ${plan.maxTeamMembers} member(s)` });
      return;
    }

    const invite = await inviteMember({
      workspaceId: ws.id,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedByUserId: req.user.id,
    });

    // Send invite email via SMTP (non-fatal)
    const smtpUser = process.env["SMTP_USER"];
    const smtpPass = process.env["SMTP_PASS"];
    const appBase = process.env["APP_BASE_URL"] ?? "https://resuone.com";
    const acceptUrl = `${appBase}/workspaces/accept?token=${invite.token}`;
    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtppro.zoho.eu",
          port: 465,
          secure: true,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: `"ResuOne" <${smtpUser}>`,
          to: parsed.data.email,
          subject: `You've been invited to join ${ws.name} on ResuOne`,
          text: [
            `Hi there,`,
            ``,
            `You've been invited to join the workspace "${ws.name}" on ResuOne as a ${parsed.data.role}.`,
            ``,
            `Accept your invitation here:`,
            acceptUrl,
            ``,
            `This link expires in 7 days. If you weren't expecting this invite, you can safely ignore it.`,
            ``,
            `— The ResuOne Team`,
          ].join("\n"),
          html: `
            <p>Hi there,</p>
            <p>You've been invited to join the workspace <strong>${ws.name}</strong> on ResuOne as a <strong>${parsed.data.role}</strong>.</p>
            <p><a href="${acceptUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Accept Invitation</a></p>
            <p>Or copy this link: <a href="${acceptUrl}">${acceptUrl}</a></p>
            <p style="color:#888;font-size:12px;">This link expires in 7 days. If you weren't expecting this invite, you can safely ignore it.</p>
            <p>— The ResuOne Team</p>
          `,
        });
        logger.info({ email: parsed.data.email, workspaceId: ws.id }, "Workspace invite email sent");
      } catch (emailErr) {
        logger.warn({ emailErr }, "Workspace invite email failed — invite still created");
      }
    } else {
      logger.warn("SMTP not configured — workspace invite email skipped");
    }

    // Return invite link token — caller can share this link
    const inviteLink = `/workspaces/accept?token=${invite.token}`;
    res.json({ invite, inviteLink });
  } catch (err: any) {
    if (err.status === 403) { res.status(403).json({ error: err.message }); return; }
    logger.error({ err }, "Failed to invite member");
    res.status(500).json({ error: "Could not create invitation" });
  }
});

// ─── GET /workspaces/:id/members ──────────────────────────────────────────────

router.get("/workspaces/:id/members", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const ws = await getWorkspaceById(req.params.id);
    if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
    await requireWorkspacePermission(ws.id, req.user.id, "viewer");
    const members = await getWorkspaceMembers(ws.id);
    res.json({ members });
  } catch (err: any) {
    if (err.status === 403) { res.status(403).json({ error: err.message }); return; }
    res.status(500).json({ error: "Could not load members" });
  }
});

// ─── PATCH /workspaces/:id/members/:userId ────────────────────────────────────

const UpdateRoleBody = z.object({ role: z.enum(["admin", "recruiter", "member", "viewer"]) });

router.patch("/workspaces/:id/members/:userId", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid role" }); return; }

  try {
    const ws = await getWorkspaceById(req.params.id);
    if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
    await requireWorkspacePermission(ws.id, req.user.id, "admin");

    // Prevent changing owner role
    const targetMember = await getMemberInWorkspace(ws.id, req.params.userId);
    if (targetMember?.role === "owner") {
      res.status(403).json({ error: "Cannot change the owner's role" }); return;
    }

    await updateMemberRole(ws.id, req.params.userId, parsed.data.role);
    res.json({ success: true });
  } catch (err: any) {
    if (err.status === 403) { res.status(403).json({ error: err.message }); return; }
    res.status(500).json({ error: "Could not update role" });
  }
});

// ─── DELETE /workspaces/:id/members/:userId ───────────────────────────────────

router.delete("/workspaces/:id/members/:userId", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const ws = await getWorkspaceById(req.params.id);
    if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }

    // Admins can remove others; members can remove themselves
    const actorRole = await getMemberRole(ws.id, req.user.id);
    const isSelf = req.params.userId === req.user.id;

    if (!isSelf && (actorRole !== "owner" && actorRole !== "admin")) {
      res.status(403).json({ error: "Insufficient permissions to remove this member" }); return;
    }

    const targetMember = await getMemberInWorkspace(ws.id, req.params.userId);
    if (targetMember?.role === "owner") {
      res.status(403).json({ error: "Cannot remove the workspace owner" }); return;
    }

    await removeMember(ws.id, req.params.userId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.status === 403) { res.status(403).json({ error: err.message }); return; }
    res.status(500).json({ error: "Could not remove member" });
  }
});

// ─── POST /workspaces/accept-invite ──────────────────────────────────────────

const AcceptInviteBody = z.object({ token: z.string().min(1) });

router.post("/workspaces/accept-invite", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = AcceptInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Token is required" }); return; }

  try {
    const invite = await acceptInvite(parsed.data.token, req.user.id);
    res.json({ success: true, workspaceId: invite.workspaceId });
  } catch (err: any) {
    logger.error({ err }, "Failed to accept invite");
    res.status(400).json({ error: err.message ?? "Could not accept invitation" });
  }
});

export default router;
