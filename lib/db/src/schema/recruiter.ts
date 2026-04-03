import { pgTable, text, timestamp, real, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Candidates ───────────────────────────────────────────────────────────────

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: text("recruiter_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  score: real("score"),
  skills: jsonb("skills").$type<string[]>().default([]).notNull(),
  experience: text("experience"),
  status: text("status", { enum: ["new", "invited", "accepted", "rejected"] }).default("new").notNull(),
  originalCvText: text("original_cv_text"),
  parsedCvJson: jsonb("parsed_cv_json").$type<Record<string, unknown>>(),
  jobTitle: text("job_title"),
  company: text("company"),
  notes: text("notes"),
  applicationId: uuid("application_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCandidateSchema = createSelectSchema(candidatesTable);
export type Candidate = typeof candidatesTable.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

// ─── Invites ──────────────────────────────────────────────────────────────────

export const invitesTable = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").notNull(),
  recruiterId: text("recruiter_id").notNull(),
  recruiterName: text("recruiter_name"),
  recruiterOrg: text("recruiter_org"),
  type: text("type", { enum: ["interview", "test"] }).default("interview").notNull(),
  status: text("status", { enum: ["sent", "opened", "accepted", "rejected"] }).default("sent").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  meetingLink: text("meeting_link"),
  message: text("message"),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertInviteSchema = createInsertSchema(invitesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectInviteSchema = createSelectSchema(invitesTable);
export type Invite = typeof invitesTable.$inferSelect;
export type InsertInvite = z.infer<typeof insertInviteSchema>;

// ─── Candidate Notes ──────────────────────────────────────────────────────────

export const candidateNotesTable = pgTable("candidate_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").notNull(),
  recruiterId: text("recruiter_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCandidateNoteSchema = createInsertSchema(candidateNotesTable).omit({ id: true, createdAt: true });
export type CandidateNote = typeof candidateNotesTable.$inferSelect;

// ─── Recruiter Team Invites ───────────────────────────────────────────────────

export const recruiterTeamInvitesTable = pgTable("recruiter_team_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamOwnerId: text("team_owner_id").notNull(),
  invitedEmail: text("invited_email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["pending", "accepted", "declined", "cancelled"] }).default("pending").notNull(),
  invitedUserId: text("invited_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RecruiterTeamInvite = typeof recruiterTeamInvitesTable.$inferSelect;
