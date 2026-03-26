import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// ─── Usage Balances ───────────────────────────────────────────────────────────
// One row per user. Tracks available credits and the current billing period so
// Pro resets are idempotent (safe to run on every webhook fire).

export const usageBalancesTable = pgTable("usage_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  availableCredits: integer("available_credits").notNull().default(0),
  lifetimeCreditsUsed: integer("lifetime_credits_used").notNull().default(0),
  // Tracks which Stripe billing period credits were last seeded for.
  // Used to prevent double-resets when the same webhook fires more than once.
  billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }),
  billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),
  lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── Usage Events ─────────────────────────────────────────────────────────────
// Append-only audit trail of every credit deduction or award.

export const usageEventsTable = pgTable("usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  // e.g. "cv_optimization" | "cover_letter" | "credits_init" | "credits_reset_pro"
  type: varchar("type").notNull(),
  // Negative = credits spent; positive = credits awarded/reset
  creditsDelta: integer("credits_delta").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UsageBalance = typeof usageBalancesTable.$inferSelect;
export type InsertUsageBalance = typeof usageBalancesTable.$inferInsert;
export type UsageEvent = typeof usageEventsTable.$inferSelect;
export type InsertUsageEvent = typeof usageEventsTable.$inferInsert;
