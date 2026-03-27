import { sql } from "drizzle-orm";
import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// ─── Bulk Passes ──────────────────────────────────────────────────────────────
// One row per bulk purchase (one-time payment).
// A user buys a tier (10 / 25 / 50 CVs) and gets that many full-result slots.
// Each new CV analysis they run decrements cvsUsed by 1.
// Pro users skip this and use their credit balance instead.

export const bulkPassesTable = pgTable("bulk_passes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  // "10" | "25" | "50" — the selected tier label
  tier: varchar("tier").notNull(),

  // Absolute CV limit for this pass
  cvLimit: integer("cv_limit").notNull(),

  // How many CVs have been analyzed against this pass
  cvsUsed: integer("cvs_used").notNull().default(0),

  // Stripe payment tracking
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id").unique(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").unique(),
  amountPaid: integer("amount_paid"),
  currency: varchar("currency"),

  // "pending" → payment started; "paid" → payment confirmed (webhook)
  status: varchar("status").notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type BulkPass = typeof bulkPassesTable.$inferSelect;
export type InsertBulkPass = typeof bulkPassesTable.$inferInsert;
