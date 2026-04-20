import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { trackedApplicationsTable } from "./tracker";

export const applicationEmailDraftsTable = pgTable("application_email_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  applicationId: varchar("application_id").references(
    () => trackedApplicationsTable.id,
    { onDelete: "cascade" },
  ),
  draftType: text("draft_type").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  tone: text("tone").notNull().default("professional"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApplicationEmailDraft = typeof applicationEmailDraftsTable.$inferSelect;
export type InsertApplicationEmailDraft = typeof applicationEmailDraftsTable.$inferInsert;
