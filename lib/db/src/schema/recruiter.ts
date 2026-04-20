import { pgTable, text, timestamp, real, jsonb, uuid, integer } from "drizzle-orm/pg-core";
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

// ─── Recruiter Jobs ───────────────────────────────────────────────────────────

export const recruiterJobsTable = pgTable("recruiter_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterUserId: text("recruiter_user_id").notNull(),
  title: text("title").notNull(),
  company: text("company"),
  location: text("location"),
  rawDescription: text("raw_description").notNull(),
  normalizedRequirements: jsonb("normalized_requirements").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRecruiterJobSchema = createInsertSchema(recruiterJobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type RecruiterJob = typeof recruiterJobsTable.$inferSelect;
export type InsertRecruiterJob = z.infer<typeof insertRecruiterJobSchema>;

// ─── Recruiter Job Candidates ─────────────────────────────────────────────────

export const recruiterJobCandidatesTable = pgTable("recruiter_job_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterJobId: uuid("recruiter_job_id").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  currentTitle: text("current_title"),
  rawCvText: text("raw_cv_text").notNull(),
  parsedCvJson: jsonb("parsed_cv_json").$type<Record<string, unknown>>().default({}),
  fileName: text("file_name"),
  status: text("status", { enum: ["new", "shortlisted", "interview", "rejected", "hired"] }).default("new").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRecruiterJobCandidateSchema = createInsertSchema(recruiterJobCandidatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type RecruiterJobCandidate = typeof recruiterJobCandidatesTable.$inferSelect;
export type InsertRecruiterJobCandidate = z.infer<typeof insertRecruiterJobCandidateSchema>;

// ─── Recruiter Candidate Matches ──────────────────────────────────────────────

export const recruiterCandidateMatchesTable = pgTable("recruiter_candidate_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterJobId: uuid("recruiter_job_id").notNull(),
  recruiterCandidateId: uuid("recruiter_candidate_id").notNull(),
  overallScore: integer("overall_score").notNull().default(0),
  interviewRecommendation: text("interview_recommendation"),
  matchingSkills: jsonb("matching_skills").$type<string[]>().default([]).notNull(),
  missingSkills: jsonb("missing_skills").$type<string[]>().default([]).notNull(),
  strengths: jsonb("strengths").$type<string[]>().default([]).notNull(),
  concerns: jsonb("concerns").$type<string[]>().default([]).notNull(),
  recruiterSummary: text("recruiter_summary"),
  scoringBreakdownJson: jsonb("scoring_breakdown_json"),
  rankPosition: integer("rank_position"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRecruiterCandidateMatchSchema = createInsertSchema(recruiterCandidateMatchesTable).omit({ id: true, createdAt: true });
export type RecruiterCandidateMatch = typeof recruiterCandidateMatchesTable.$inferSelect;
export type InsertRecruiterCandidateMatch = z.infer<typeof insertRecruiterCandidateMatchSchema>;
