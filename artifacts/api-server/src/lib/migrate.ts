import { logger } from "./logger.js";
import { pool } from "@workspace/db";

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "internal_jobs_visa_columns",
    sql: `
      ALTER TABLE internal_jobs
        ADD COLUMN IF NOT EXISTS visa_sponsorship_available boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS visa_sponsorship_notes text,
        ADD COLUMN IF NOT EXISTS relocation_support boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS work_authorization_requirement text,
        ADD COLUMN IF NOT EXISTS sponsorship_signal text DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS sponsorship_confidence integer DEFAULT 0
    `,
  },
  {
    name: "internal_jobs_language_columns",
    sql: `
      ALTER TABLE internal_jobs
        ADD COLUMN IF NOT EXISTS language_required jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS language_preferred jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS working_language text,
        ADD COLUMN IF NOT EXISTS language_notes text,
        ADD COLUMN IF NOT EXISTS language_requirement_signal text DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS language_confidence integer DEFAULT 0
    `,
  },
  {
    name: "internal_jobs_relocation_intelligence",
    sql: `
      ALTER TABLE internal_jobs
        ADD COLUMN IF NOT EXISTS relocation_score integer,
        ADD COLUMN IF NOT EXISTS relocation_recommendation text DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS estimated_monthly_surplus text,
        ADD COLUMN IF NOT EXISTS salary_quality_signal text DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS cost_of_living_signal text DEFAULT 'unknown'
    `,
  },
];

export async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const migration of MIGRATIONS) {
      try {
        await client.query(migration.sql);
        logger.info({ migration: migration.name }, "Migration applied");
      } catch (err: any) {
        logger.error({ err, migration: migration.name }, "Migration failed — proceeding");
      }
    }
  } finally {
    client.release();
  }
}
