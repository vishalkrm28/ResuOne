import { pgTable, text, timestamp, real, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationsTable = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  jobDescription: text("job_description").notNull(),
  originalCvText: text("original_cv_text").notNull(),
  tailoredCvText: text("tailored_cv_text"),
  coverLetterText: text("cover_letter_text"),
  keywordMatchScore: real("keyword_match_score"),
  missingKeywords: jsonb("missing_keywords").$type<string[]>().default([]).notNull(),
  matchedKeywords: jsonb("matched_keywords").$type<string[]>().default([]).notNull(),
  missingInfoQuestions: jsonb("missing_info_questions").$type<string[]>().default([]).notNull(),
  status: text("status", { enum: ["draft", "analyzed", "exported"] }).default("draft").notNull(),
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
