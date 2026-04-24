import {
  boolean, index, integer, jsonb, numeric, pgTable,
  text, timestamp, uniqueIndex, varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── city_cost_profiles ───────────────────────────────────────────────────────

export const cityCostProfilesTable = pgTable(
  "city_cost_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    city: text("city").notNull(),
    country: text("country").notNull(),
    normalizedCity: text("normalized_city").notNull(),
    normalizedCountry: text("normalized_country").notNull(),
    currency: text("currency"),
    rentLow: numeric("rent_low"),
    rentMid: numeric("rent_mid"),
    rentHigh: numeric("rent_high"),
    monthlyFood: numeric("monthly_food"),
    monthlyTransport: numeric("monthly_transport"),
    monthlyUtilities: numeric("monthly_utilities"),
    monthlyHealthcare: numeric("monthly_healthcare"),
    monthlyOther: numeric("monthly_other"),
    estimatedMonthlyCost: numeric("estimated_monthly_cost"),
    dataSource: text("data_source"),
    confidenceScore: integer("confidence_score").default(50),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("city_cost_profiles_city_country_uniq").on(t.normalizedCity, t.normalizedCountry),
  ],
);

export type CityCostProfile = typeof cityCostProfilesTable.$inferSelect;
export type InsertCityCostProfile = typeof cityCostProfilesTable.$inferInsert;

// ─── salary_benchmarks ────────────────────────────────────────────────────────

export const salaryBenchmarksTable = pgTable(
  "salary_benchmarks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    jobTitle: text("job_title"),
    normalizedJobTitle: text("normalized_job_title"),
    country: text("country"),
    city: text("city"),
    currency: text("currency"),
    salaryMin: numeric("salary_min"),
    salaryMedian: numeric("salary_median"),
    salaryMax: numeric("salary_max"),
    seniority: text("seniority"),
    dataSource: text("data_source"),
    confidenceScore: integer("confidence_score").default(50),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("salary_benchmarks_title_country_idx").on(t.normalizedJobTitle, t.country, t.city),
  ],
);

export type SalaryBenchmark = typeof salaryBenchmarksTable.$inferSelect;
export type InsertSalaryBenchmark = typeof salaryBenchmarksTable.$inferInsert;

// ─── job_relocation_scores ────────────────────────────────────────────────────

export const jobRelocationScoresTable = pgTable(
  "job_relocation_scores",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    jobSource: text("job_source").notNull(),
    jobId: varchar("job_id"),
    internalJobId: varchar("internal_job_id"),
    userId: text("user_id").notNull(),
    candidateProfileId: varchar("candidate_profile_id"),
    salaryScore: integer("salary_score").default(0),
    costOfLivingScore: integer("cost_of_living_score").default(0),
    visaScore: integer("visa_score").default(0),
    languageScore: integer("language_score").default(0),
    relocationSupportScore: integer("relocation_support_score").default(0),
    relocationScore: integer("relocation_score").default(0),
    relocationRecommendation: text("relocation_recommendation").default("unknown"),
    salaryQualitySignal: text("salary_quality_signal").default("unknown"),
    costOfLivingSignal: text("cost_of_living_signal").default("unknown"),
    estimatedMonthlyGrossSalary: numeric("estimated_monthly_gross_salary"),
    estimatedMonthlyNetSalary: numeric("estimated_monthly_net_salary"),
    estimatedMonthlyCost: numeric("estimated_monthly_cost"),
    estimatedMonthlySurplus: numeric("estimated_monthly_surplus"),
    estimatedAnnualSurplus: numeric("estimated_annual_surplus"),
    riskFlags: jsonb("risk_flags").default(sql`'[]'::jsonb`),
    positiveFactors: jsonb("positive_factors").default(sql`'[]'::jsonb`),
    aiSummary: jsonb("ai_summary").default(sql`'{}'::jsonb`),
    aiProvider: text("ai_provider"),
    aiModel: text("ai_model"),
    confidenceScore: integer("confidence_score").default(0),
    lifestyle: text("lifestyle").default("moderate"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("job_relocation_scores_user_idx").on(t.userId),
    index("job_relocation_scores_job_idx").on(t.jobId),
    index("job_relocation_scores_internal_job_idx").on(t.internalJobId),
    index("job_relocation_scores_score_idx").on(t.relocationScore),
  ],
);

export type JobRelocationScore = typeof jobRelocationScoresTable.$inferSelect;
export type InsertJobRelocationScore = typeof jobRelocationScoresTable.$inferInsert;

// ─── relocation_analysis_cache ────────────────────────────────────────────────

export const relocationAnalysisCacheTable = pgTable(
  "relocation_analysis_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    cacheKey: text("cache_key").notNull().unique(),
    userId: text("user_id"),
    jobId: varchar("job_id"),
    internalJobId: varchar("internal_job_id"),
    candidateProfileId: varchar("candidate_profile_id"),
    resultJson: jsonb("result_json").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("relocation_analysis_cache_key_idx").on(t.cacheKey),
  ],
);

export type RelocationAnalysisCache = typeof relocationAnalysisCacheTable.$inferSelect;
export type InsertRelocationAnalysisCache = typeof relocationAnalysisCacheTable.$inferInsert;
