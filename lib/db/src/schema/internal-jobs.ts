import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { candidateProfilesTable } from "./jobs-core.js";
import { tailoredCvsTable, coverLettersTable } from "./tailoring.js";

// ─── Enums (value models) ─────────────────────────────────────────────────────

export const INTERNAL_JOB_STATUS = ["draft", "active", "paused", "closed"] as const;
export const INTERNAL_JOB_VISIBILITY = ["public", "pro_only"] as const;
export const INTERNAL_JOB_APPLICATION_STATUS = [
  "applied", "shortlisted", "rejected", "interview", "offer", "hired", "withdrawn",
] as const;
export const INTERNAL_JOB_STAGE = [
  "submitted", "under_review", "shortlisted", "interview",
  "final_review", "offer", "rejected", "hired", "withdrawn",
] as const;
export const INTERNAL_JOB_EVENT_TYPE = [
  "application_created", "analysis_generated", "status_changed", "stage_changed",
  "recruiter_note_added", "candidate_note_added", "shortlisted", "rejected",
  "interview_requested", "interview_response_received", "offer_made",
  "message_sent", "withdrawn",
] as const;
export const INTERNAL_JOB_ACTOR_TYPE = ["recruiter", "candidate", "system"] as const;
export const INTERNAL_JOB_MESSAGE_TYPE = [
  "message", "interview_invite", "interview_followup",
  "shortlist_notice", "rejection_notice", "offer_notice",
] as const;
export const INTERNAL_JOB_SENDER_TYPE = ["recruiter", "candidate", "system"] as const;
export const INTERNAL_JOB_RECIPIENT_TYPE = ["recruiter", "candidate"] as const;
export const INTERNAL_JOB_INTERVIEW_TYPE = [
  "recruiter_screen", "hiring_manager", "technical",
  "case_study", "final_round", "general",
] as const;
export const INTERNAL_JOB_INVITE_STATUS = [
  "pending", "accepted", "declined", "reschedule_requested", "cancelled", "completed",
] as const;

// ─── internal_jobs ────────────────────────────────────────────────────────────

export const internalJobsTable = pgTable(
  "internal_jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    // who posted it
    postedByUserId: text("posted_by_user_id").notNull(),
    // optional workspace association
    workspaceId: varchar("workspace_id"),
    // job details
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    country: text("country"),
    remote: boolean("remote").default(false),
    employmentType: text("employment_type"),
    seniority: text("seniority"),
    description: text("description").notNull(),
    requirements: jsonb("requirements").default(sql`'[]'::jsonb`),
    preferredSkills: jsonb("preferred_skills").default(sql`'[]'::jsonb`),
    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    currency: text("currency").default("USD"),
    // lifecycle
    status: text("status").notNull().default("draft"),
    visibility: text("visibility").notNull().default("pro_only"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("internal_jobs_posted_by_idx").on(t.postedByUserId),
    index("internal_jobs_workspace_idx").on(t.workspaceId),
    index("internal_jobs_status_idx").on(t.status),
    index("internal_jobs_visibility_idx").on(t.visibility),
    index("internal_jobs_country_idx").on(t.country),
    index("internal_jobs_remote_idx").on(t.remote),
  ],
);

// ─── internal_job_applications ────────────────────────────────────────────────

export const internalJobApplicationsTable = pgTable(
  "internal_job_applications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    jobId: varchar("job_id").notNull().references(() => internalJobsTable.id, { onDelete: "cascade" }),
    applicantUserId: text("applicant_user_id").notNull(),
    // optional enrichment links
    candidateProfileId: varchar("candidate_profile_id").references(
      () => candidateProfilesTable.id,
      { onDelete: "set null" },
    ),
    tailoredCvId: varchar("tailored_cv_id").references(
      () => tailoredCvsTable.id,
      { onDelete: "set null" },
    ),
    coverLetterId: varchar("cover_letter_id").references(
      () => coverLettersTable.id,
      { onDelete: "set null" },
    ),
    // applicant snapshot (captured at application time)
    applicantName: text("applicant_name"),
    applicantEmail: text("applicant_email"),
    // cover letter text (inline, if not linked)
    coverLetter: text("cover_letter"),
    // pipeline state
    status: text("status").notNull().default("applied"),
    stage: text("stage").notNull().default("submitted"),
    // notes
    candidateNotes: text("candidate_notes"),
    recruiterNotes: text("recruiter_notes"),
    // automation
    autoApplyMode: boolean("auto_apply_mode").default(false),
    // timestamps
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("int_job_apps_job_idx").on(t.jobId),
    index("int_job_apps_user_idx").on(t.applicantUserId),
    index("int_job_apps_status_idx").on(t.status),
    index("int_job_apps_stage_idx").on(t.stage),
  ],
);

// ─── internal_job_candidate_analyses ─────────────────────────────────────────

export const internalJobCandidateAnalysesTable = pgTable(
  "internal_job_candidate_analyses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    internalJobId: varchar("internal_job_id")
      .notNull()
      .references(() => internalJobsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    candidateProfileId: varchar("candidate_profile_id").references(
      () => candidateProfilesTable.id,
      { onDelete: "set null" },
    ),
    sourceApplicationId: varchar("source_application_id"),
    // AI output
    matchScore: integer("match_score").notNull(),
    fitReasons: jsonb("fit_reasons").default(sql`'[]'::jsonb`),
    missingRequirements: jsonb("missing_requirements").default(sql`'[]'::jsonb`),
    strengths: jsonb("strengths").default(sql`'[]'::jsonb`),
    concerns: jsonb("concerns").default(sql`'[]'::jsonb`),
    recommendationSummary: text("recommendation_summary"),
    tailoredCvSuggestion: jsonb("tailored_cv_suggestion").default(sql`'{}'::jsonb`),
    coverLetterSuggestion: text("cover_letter_suggestion"),
    applyRecommendation: text("apply_recommendation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("int_job_analysis_user_idx").on(t.userId),
    index("int_job_analysis_job_idx").on(t.internalJobId),
  ],
);

// ─── internal_job_application_events ─────────────────────────────────────────

export const internalJobApplicationEventsTable = pgTable(
  "internal_job_application_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id")
      .notNull()
      .references(() => internalJobApplicationsTable.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("int_job_events_app_idx").on(t.applicationId),
  ],
);

// ─── internal_job_notifications ───────────────────────────────────────────────

export const internalJobNotificationsTable = pgTable(
  "internal_job_notifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    internalJobId: varchar("internal_job_id")
      .notNull()
      .references(() => internalJobsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    notified: boolean("notified").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("int_job_notif_job_idx").on(t.internalJobId),
    index("int_job_notif_user_idx").on(t.userId),
  ],
);

// ─── internal_job_messages ────────────────────────────────────────────────────

export const internalJobMessagesTable = pgTable(
  "internal_job_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id")
      .notNull()
      .references(() => internalJobApplicationsTable.id, { onDelete: "cascade" }),
    jobId: varchar("job_id")
      .notNull()
      .references(() => internalJobsTable.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id").notNull(),
    senderType: text("sender_type").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    recipientType: text("recipient_type").notNull(),
    messageType: text("message_type").notNull().default("message"),
    subject: text("subject"),
    bodyText: text("body_text").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("int_job_msgs_app_idx").on(t.applicationId),
    index("int_job_msgs_recipient_idx").on(t.recipientUserId),
    index("int_job_msgs_read_idx").on(t.isRead),
  ],
);

// ─── internal_job_interview_invites ──────────────────────────────────────────

export const internalJobInterviewInvitesTable = pgTable(
  "internal_job_interview_invites",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id")
      .notNull()
      .references(() => internalJobApplicationsTable.id, { onDelete: "cascade" }),
    jobId: varchar("job_id")
      .notNull()
      .references(() => internalJobsTable.id, { onDelete: "cascade" }),
    recruiterUserId: text("recruiter_user_id").notNull(),
    candidateUserId: text("candidate_user_id").notNull(),
    inviteTitle: text("invite_title").notNull(),
    interviewType: text("interview_type").notNull().default("general"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    timezone: text("timezone"),
    location: text("location"),
    meetingUrl: text("meeting_url"),
    notes: text("notes"),
    status: text("status").notNull().default("pending"),
    candidateResponseNote: text("candidate_response_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("int_job_invites_app_idx").on(t.applicationId),
    index("int_job_invites_candidate_idx").on(t.candidateUserId),
    index("int_job_invites_status_idx").on(t.status),
  ],
);

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type InternalJob = typeof internalJobsTable.$inferSelect;
export type InsertInternalJob = typeof internalJobsTable.$inferInsert;
export type InternalJobApplication = typeof internalJobApplicationsTable.$inferSelect;
export type InsertInternalJobApplication = typeof internalJobApplicationsTable.$inferInsert;
export type InternalJobCandidateAnalysis = typeof internalJobCandidateAnalysesTable.$inferSelect;
export type InsertInternalJobCandidateAnalysis = typeof internalJobCandidateAnalysesTable.$inferInsert;
export type InternalJobApplicationEvent = typeof internalJobApplicationEventsTable.$inferSelect;
export type InternalJobMessage = typeof internalJobMessagesTable.$inferSelect;
export type InternalJobInterviewInvite = typeof internalJobInterviewInvitesTable.$inferSelect;
