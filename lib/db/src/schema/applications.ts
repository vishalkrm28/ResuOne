import { pgTable, text, timestamp, real, jsonb, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Parsed CV ───────────────────────────────────────────────────────────────

export const ParsedWorkExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  bullets: z.array(z.string()),
});

export const ParsedEducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
});

export const ParsedCvSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedin: z.string().nullable().optional(),
  github: z.string().nullable().optional(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  work_experience: z.array(ParsedWorkExperienceSchema),
  education: z.array(ParsedEducationSchema),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
});

export type ParsedCv = z.infer<typeof ParsedCvSchema>;

// ─── Parsed Job Description ──────────────────────────────────────────────────

export const ParsedJobDescriptionSchema = z.object({
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  required_experience_years: z.number().nullable(),
  key_responsibilities: z.array(z.string()),
  must_have: z.array(z.string()),
  nice_to_have: z.array(z.string()),
  job_type: z.enum(["full-time", "part-time", "contract", "internship"]).nullable(),
  location_type: z.enum(["remote", "hybrid", "onsite"]).nullable(),
});

export type ParsedJobDescription = z.infer<typeof ParsedJobDescriptionSchema>;

// ─── Applications Table ──────────────────────────────────────────────────────

export const applicationsTable = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  jobDescription: text("job_description").notNull(),
  originalCvText: text("original_cv_text").notNull(),
  parsedCvJson: jsonb("parsed_cv_json").$type<ParsedCv>(),
  parsedJdJson: jsonb("parsed_jd_json").$type<ParsedJobDescription>(),
  tailoredCvText: text("tailored_cv_text"),
  coverLetterText: text("cover_letter_text"),
  keywordMatchScore: real("keyword_match_score"),
  missingKeywords: jsonb("missing_keywords").$type<string[]>().default([]).notNull(),
  matchedKeywords: jsonb("matched_keywords").$type<string[]>().default([]).notNull(),
  missingInfoQuestions: jsonb("missing_info_questions").$type<string[]>().default([]).notNull(),
  sectionSuggestions: jsonb("section_suggestions").$type<string[]>().default([]).notNull(),
  scoringBreakdownJson: jsonb("scoring_breakdown_json").$type<Record<string, unknown>>(),
  inputHash: text("input_hash"),
  status: text("status", { enum: ["draft", "analyzed", "exported"] }).default("draft").notNull(),
  identityFlagged: boolean("identity_flagged").default(false).notNull(),
  bulkSessionId: text("bulk_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectApplicationSchema = createSelectSchema(applicationsTable);

export type Application = typeof applicationsTable.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
