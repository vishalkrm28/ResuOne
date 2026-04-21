import { boolean, index, jsonb, numeric, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Internal Jobs (Resuone Exclusive listings) ───────────────────────────────

export const internalJobsTable = pgTable(
  "internal_jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    postedByUserId: text("posted_by_user_id").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    country: text("country"),
    remote: boolean("remote").default(false),
    jobType: text("job_type"),
    seniority: text("seniority"),
    description: text("description").notNull(),
    requirements: jsonb("requirements").default(sql`'[]'::jsonb`),
    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    currency: text("currency").default("USD"),
    status: text("status").notNull().default("active"),
    visibility: text("visibility").notNull().default("pro_only"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("internal_jobs_posted_by_idx").on(t.postedByUserId),
    index("internal_jobs_status_idx").on(t.status),
    index("internal_jobs_visibility_idx").on(t.visibility),
    index("internal_jobs_country_idx").on(t.country),
    index("internal_jobs_remote_idx").on(t.remote),
  ],
);

// ─── Internal Job Applications ────────────────────────────────────────────────

export const internalJobApplicationsTable = pgTable(
  "internal_job_applications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    jobId: varchar("job_id").notNull().references(() => internalJobsTable.id, { onDelete: "cascade" }),
    applicantUserId: text("applicant_user_id").notNull(),
    applicantName: text("applicant_name"),
    applicantEmail: text("applicant_email"),
    coverLetter: text("cover_letter"),
    status: text("status").notNull().default("applied"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("internal_job_apps_job_idx").on(t.jobId),
    index("internal_job_apps_user_idx").on(t.applicantUserId),
  ],
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type InternalJob = typeof internalJobsTable.$inferSelect;
export type InsertInternalJob = typeof internalJobsTable.$inferInsert;
export type InternalJobApplication = typeof internalJobApplicationsTable.$inferSelect;
export type InsertInternalJobApplication = typeof internalJobApplicationsTable.$inferInsert;
