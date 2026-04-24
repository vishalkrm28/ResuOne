import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { candidateProfilesTable } from "./jobs-core";

// Re-export from jobs-core so nothing breaks
export * from "./jobs-core";

// ─── Global Discovered Jobs ───────────────────────────────────────────────────
// Canonical store for all globally discovered jobs across all sources.
// source + external_id provides the natural dedup key per provider.
// canonical_key provides cross-source dedup.

export const discoveredJobsTable = pgTable(
  "jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    source: text("source").notNull(),
    sourceType: text("source_type").notNull(),
    externalId: text("external_id"),
    canonicalKey: text("canonical_key").notNull(),
    title: text("title").notNull(),
    company: text("company"),
    location: text("location"),
    country: text("country"),
    remote: boolean("remote").default(false),
    employmentType: text("employment_type"),
    seniority: text("seniority"),
    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    currency: text("currency"),
    description: text("description"),
    applyUrl: text("apply_url"),
    companyCareersUrl: text("company_careers_url"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    skills: jsonb("skills").default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    rawPayload: jsonb("raw_payload").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Visa intelligence — computed from job description analysis
    sponsorshipSignal: text("sponsorship_signal").default("unknown"),
    sponsorshipConfidence: integer("sponsorship_confidence").default(0),
    relocationSupport: boolean("relocation_support").default(false),
    visaSponsorshipNotes: text("visa_sponsorship_notes"),
    workAuthorizationRequirement: text("work_authorization_requirement"),
    // Language intelligence — computed from job description analysis
    languageRequirementSignal: text("language_requirement_signal").default("unknown"),
    languageRequiredLanguages: jsonb("language_required_languages").default(sql`'[]'::jsonb`),
    languagePreferredLanguages: jsonb("language_preferred_languages").default(sql`'[]'::jsonb`),
    languageConfidence: integer("language_confidence").default(0),
    languageEvidenceSummary: text("language_evidence_summary"),
    // Relocation intelligence — computed by relocation pipeline
    relocationScore: integer("relocation_score"),
    relocationRecommendation: text("relocation_recommendation").default("unknown"),
    estimatedMonthlySurplus: text("estimated_monthly_surplus"),
    salaryQualitySignal: text("salary_quality_signal").default("unknown"),
    costOfLivingSignal: text("cost_of_living_signal").default("unknown"),
  },
  (t) => [
    uniqueIndex("jobs_canonical_key_idx").on(t.canonicalKey),
    index("jobs_country_idx").on(t.country),
    index("jobs_remote_idx").on(t.remote),
    index("jobs_source_idx").on(t.source),
    index("jobs_source_type_idx").on(t.sourceType),
    index("jobs_created_at_idx").on(t.createdAt),
  ],
);

// ─── Job Source Registry ──────────────────────────────────────────────────────
// Tracks all configured job sources and their metadata.

export const jobSourceRegistryTable = pgTable("job_source_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  sourceType: text("source_type").notNull(),
  displayName: text("display_name").notNull(),
  baseUrl: text("base_url"),
  countryScope: text("country_scope"),
  isActive: boolean("is_active").default(true),
  config: jsonb("config").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Job Search Cache ─────────────────────────────────────────────────────────
// Caches search results by query + country + filters to avoid redundant API calls.

export const jobSearchCacheTable = pgTable(
  "job_search_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    query: text("query").notNull(),
    country: text("country"),
    remoteOnly: boolean("remote_only").default(false),
    filters: jsonb("filters").default(sql`'{}'::jsonb`),
    cacheKey: text("cache_key").notNull(),
    resultJobIds: jsonb("result_job_ids").default(sql`'[]'::jsonb`),
    resultCount: integer("result_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("job_search_cache_key_idx").on(t.cacheKey)],
);

// ─── Job Match Results ────────────────────────────────────────────────────────
// Stores AI-ranked match results from the global discovery engine.

export const jobMatchResultsTable = pgTable(
  "job_match_results",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    candidateProfileId: varchar("candidate_profile_id").references(
      () => candidateProfilesTable.id,
      { onDelete: "set null" },
    ),
    jobId: varchar("job_id").references(() => discoveredJobsTable.id, {
      onDelete: "cascade",
    }),
    matchScore: integer("match_score").notNull(),
    fitReasons: jsonb("fit_reasons").default(sql`'[]'::jsonb`),
    missingRequirements: jsonb("missing_requirements").default(sql`'[]'::jsonb`),
    recommendationSummary: text("recommendation_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_match_results_user_idx").on(t.userId)],
);

// ─── Job Discovery Runs ───────────────────────────────────────────────────────
// Audit log of every discovery run for observability.

export const jobDiscoveryRunsTable = pgTable("job_discovery_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  sourceApplicationId: varchar("source_application_id"),
  query: text("query").notNull(),
  country: text("country"),
  remoteOnly: boolean("remote_only").default(false),
  sourceBreakdown: jsonb("source_breakdown").default(sql`'{}'::jsonb`),
  discoveredCount: integer("discovered_count").default(0),
  dedupedCount: integer("deduped_count").default(0),
  cached: boolean("cached").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DiscoveredJob = typeof discoveredJobsTable.$inferSelect;
export type InsertDiscoveredJob = typeof discoveredJobsTable.$inferInsert;
export type JobSearchCache = typeof jobSearchCacheTable.$inferSelect;
export type JobMatchResult = typeof jobMatchResultsTable.$inferSelect;
export type JobDiscoveryRun = typeof jobDiscoveryRunsTable.$inferSelect;
