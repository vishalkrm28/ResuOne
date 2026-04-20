import { integer, jsonb, numeric, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Candidate Profiles ───────────────────────────────────────────────────────
// Stores the normalized AI-extracted profile for a job-seeker.
// Built once from a parsed CV and reused for multiple recommendation runs.

export const candidateProfilesTable = pgTable("candidate_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  sourceApplicationId: varchar("source_application_id"),
  parsedCv: jsonb("parsed_cv").notNull(),
  normalizedProfile: jsonb("normalized_profile").notNull(),
  preferences: jsonb("preferences").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── External Jobs Cache ──────────────────────────────────────────────────────
// Caches jobs fetched from external providers (Adzuna, The Muse).
// Refreshed when fetched_at is older than 12 hours.

export const externalJobsCacheTable = pgTable(
  "external_jobs_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    source: text("source").notNull(),
    externalJobId: text("external_job_id").notNull(),
    title: text("title").notNull(),
    company: text("company"),
    location: text("location"),
    employmentType: text("employment_type"),
    remoteType: text("remote_type"),
    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    currency: text("currency"),
    description: text("description"),
    applyUrl: text("apply_url"),
    sourcePayload: jsonb("source_payload").default(sql`'{}'::jsonb`),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.source, t.externalJobId)],
);

// ─── Job Recommendations ──────────────────────────────────────────────────────
// Stores AI-ranked job recommendations per candidate profile run.

export const jobRecommendationsTable = pgTable("job_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  candidateProfileId: varchar("candidate_profile_id").references(
    () => candidateProfilesTable.id,
    { onDelete: "cascade" },
  ),
  externalJobCacheId: varchar("external_job_cache_id").references(
    () => externalJobsCacheTable.id,
    { onDelete: "cascade" },
  ),
  matchScore: integer("match_score").notNull(),
  fitReasons: jsonb("fit_reasons").default(sql`'[]'::jsonb`),
  missingRequirements: jsonb("missing_requirements").default(sql`'[]'::jsonb`),
  recommendationSummary: text("recommendation_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CandidateProfile = typeof candidateProfilesTable.$inferSelect;
export type InsertCandidateProfile = typeof candidateProfilesTable.$inferInsert;
export type ExternalJobCache = typeof externalJobsCacheTable.$inferSelect;
export type InsertExternalJobCache = typeof externalJobsCacheTable.$inferInsert;
export type JobRecommendation = typeof jobRecommendationsTable.$inferSelect;
export type InsertJobRecommendation = typeof jobRecommendationsTable.$inferInsert;
