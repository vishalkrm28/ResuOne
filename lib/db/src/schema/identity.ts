import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// ─── Identity History Entry ────────────────────────────────────────────────────

export interface IdentityHistoryEntry {
  hash: string;
  name: string | null;
  email: string | null;
  detectedAt: string;
}

// ─── User Identity Profiles ────────────────────────────────────────────────────
// One row per user. Tracks the primary CV identity seen on the account and
// records each time a different person's CV is submitted (identity switch).
//
// This is used to detect and apply friction when a Pro user uploads CVs for
// multiple people. We do not hard-block — we charge an extra credit.

export const userIdentityProfilesTable = pgTable("user_identity_profiles", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  // Hash of the first detected identity (primary / canonical for this account)
  primaryIdentityHash: varchar("primary_identity_hash").notNull(),
  primaryIdentityName: varchar("primary_identity_name"),
  primaryIdentityEmail: varchar("primary_identity_email"),

  // Running count of distinct identities ever seen on this account
  distinctIdentityCount: integer("distinct_identity_count").notNull().default(1),

  // Append-only log of every identity that has been seen — capped at 20 entries
  identityHistory: jsonb("identity_history")
    .$type<IdentityHistoryEntry[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserIdentityProfile = typeof userIdentityProfilesTable.$inferSelect;
export type InsertUserIdentityProfile = typeof userIdentityProfilesTable.$inferInsert;
