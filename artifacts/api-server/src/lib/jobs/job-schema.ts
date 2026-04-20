import { z } from "zod";

// ─── Unified Job Schema ───────────────────────────────────────────────────────
// Every source adapter must map its raw response into this shape.

export const UnifiedJobSchema = z.object({
  source: z.string(),
  sourceType: z.enum(["google_jobs", "greenhouse", "lever", "manual_seed", "other"]),
  externalId: z.string(),
  title: z.string(),
  company: z.string().default(""),
  location: z.string().default(""),
  country: z.string().default(""),
  remote: z.boolean().default(false),
  employmentType: z.string().default(""),
  seniority: z.string().default(""),
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  currency: z.string().default(""),
  description: z.string().default(""),
  applyUrl: z.string().default(""),
  companyCareersUrl: z.string().default(""),
  postedAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  skills: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  rawPayload: z.record(z.unknown()).default({}),
});

export type UnifiedJob = z.infer<typeof UnifiedJobSchema>;

// ─── Source-specific raw schemas ─────────────────────────────────────────────

export const GoogleDiscoveredJobSchema = z.object({
  title: z.string().optional(),
  company_name: z.string().optional(),
  location: z.string().optional(),
  via: z.string().optional(),
  description: z.string().optional(),
  job_id: z.string().optional(),
  thumbnail: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  detected_extensions: z.record(z.unknown()).optional(),
  apply_options: z
    .array(z.object({ title: z.string(), link: z.string() }))
    .optional(),
  related_links: z
    .array(z.object({ link: z.string(), text: z.string() }))
    .optional(),
  job_highlights: z.array(z.object({ title: z.string(), items: z.array(z.string()) })).optional(),
});

export type GoogleDiscoveredJob = z.infer<typeof GoogleDiscoveredJobSchema>;

export const GreenhouseJobSchema = z.object({
  id: z.number().or(z.string()),
  title: z.string(),
  location: z.object({ name: z.string().optional() }).optional(),
  content: z.string().optional(),
  absolute_url: z.string().optional(),
  departments: z.array(z.object({ name: z.string() })).optional(),
  offices: z.array(z.object({ name: z.string().optional(), location: z.string().optional() })).optional(),
  updated_at: z.string().optional(),
  metadata: z.unknown().optional(),
});

export type GreenhouseJob = z.infer<typeof GreenhouseJobSchema>;

export const LeverJobSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  categories: z
    .object({
      location: z.string().optional(),
      team: z.string().optional(),
      commitment: z.string().optional(),
      department: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
  descriptionPlain: z.string().optional(),
  hostedUrl: z.string().optional(),
  applyUrl: z.string().optional(),
  createdAt: z.number().optional(),
});

export type LeverJob = z.infer<typeof LeverJobSchema>;

// ─── Discovery input schema ───────────────────────────────────────────────────

export const DiscoveryInputSchema = z.object({
  userId: z.string().optional(),
  query: z.string().min(1).max(200),
  country: z.string().max(10).optional().default(""),
  location: z.string().max(100).optional().default(""),
  remoteOnly: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

export type DiscoveryInput = z.infer<typeof DiscoveryInputSchema>;
