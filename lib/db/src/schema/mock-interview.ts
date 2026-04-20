import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { trackedApplicationsTable, interviewPrepsTable } from "./tracker";

export const applicationInterviewsTable = pgTable("application_interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  applicationId: varchar("application_id").references(
    () => trackedApplicationsTable.id,
    { onDelete: "cascade" },
  ),
  interviewType: text("interview_type").notNull().default("general"),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  timezone: text("timezone"),
  location: text("location"),
  meetingUrl: text("meeting_url"),
  notes: text("notes"),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mockInterviewSessionsTable = pgTable("mock_interview_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  applicationId: varchar("application_id").references(
    () => trackedApplicationsTable.id,
    { onDelete: "cascade" },
  ),
  interviewPrepId: varchar("interview_prep_id").references(
    () => interviewPrepsTable.id,
    { onDelete: "set null" },
  ),
  sessionType: text("session_type").notNull().default("role_specific"),
  sessionTitle: text("session_title"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const mockInterviewQuestionsTable = pgTable("mock_interview_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(
    () => mockInterviewSessionsTable.id,
    { onDelete: "cascade" },
  ),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answerType: text("answer_type").notNull().default("general"),
  whyItMatters: text("why_it_matters"),
  suggestedPoints: jsonb("suggested_points").notNull().default(sql`'[]'::jsonb`),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mockInterviewAnswersTable = pgTable("mock_interview_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(
    () => mockInterviewSessionsTable.id,
    { onDelete: "cascade" },
  ),
  questionId: varchar("question_id").references(
    () => mockInterviewQuestionsTable.id,
    { onDelete: "cascade" },
  ),
  userId: text("user_id").notNull(),
  answerText: text("answer_text").notNull().default(""),
  aiFeedback: jsonb("ai_feedback").notNull().default(sql`'{}'::jsonb`),
  score: integer("score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApplicationInterview = typeof applicationInterviewsTable.$inferSelect;
export type InsertApplicationInterview = typeof applicationInterviewsTable.$inferInsert;
export type MockInterviewSession = typeof mockInterviewSessionsTable.$inferSelect;
export type InsertMockInterviewSession = typeof mockInterviewSessionsTable.$inferInsert;
export type MockInterviewQuestion = typeof mockInterviewQuestionsTable.$inferSelect;
export type InsertMockInterviewQuestion = typeof mockInterviewQuestionsTable.$inferInsert;
export type MockInterviewAnswer = typeof mockInterviewAnswersTable.$inferSelect;
export type InsertMockInterviewAnswer = typeof mockInterviewAnswersTable.$inferInsert;
