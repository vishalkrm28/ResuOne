import { Router } from "express";
import { z } from "zod";
import { db, cityCostProfilesTable, salaryBenchmarksTable, jobRelocationScoresTable } from "@workspace/db";
import { eq, and, ilike, desc, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { analyzeRelocationForJob } from "../lib/relocation/relocation-pipeline.js";
import { normalizeCityName, normalizeCountryName, normalizeJobTitle } from "../lib/relocation/relocation-helpers.js";
import { LifestyleSchema } from "../lib/relocation/relocation-schemas.js";

const router = Router();

// ─── POST /relocation/analyze-job ─────────────────────────────────────────────

const AnalyzeJobSchema = z.object({
  jobId: z.string().optional(),
  internalJobId: z.string().optional(),
  candidateProfileId: z.string().optional(),
  lifestyle: LifestyleSchema.optional().default("moderate"),
  forceRefresh: z.boolean().optional().default(false),
});

router.post("/relocation/analyze-job", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = AnalyzeJobSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { jobId, internalJobId, candidateProfileId, lifestyle, forceRefresh } = parsed.data;
  if (!jobId && !internalJobId) { res.status(400).json({ error: "Either jobId or internalJobId is required" }); return; }

  try {
    const result = await analyzeRelocationForJob({
      userId: req.user.id,
      jobId: jobId ?? null,
      internalJobId: internalJobId ?? null,
      candidateProfileId: candidateProfileId ?? null,
      lifestyle,
      forceRefresh,
    });
    if (!result) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({ result });
  } catch (err) {
    logger.error({ err }, "Relocation analysis failed");
    res.status(500).json({ error: "Relocation analysis failed" });
  }
});

// ─── GET /relocation/city-cost-profile?city=&country= ─────────────────────────

router.get("/relocation/city-cost-profile", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const { city, country } = req.query as Record<string, string>;
  if (!city || !country) { res.status(400).json({ error: "city and country are required" }); return; }

  try {
    const rows = await db
      .select()
      .from(cityCostProfilesTable)
      .where(and(
        eq(cityCostProfilesTable.normalizedCity, normalizeCityName(city)),
        eq(cityCostProfilesTable.normalizedCountry, normalizeCountryName(country)),
      ))
      .limit(1);
    if (rows.length === 0) { res.status(404).json({ error: "City cost profile not found" }); return; }
    res.json({ profile: rows[0] });
  } catch (err) {
    logger.error({ err }, "Failed to fetch city cost profile");
    res.status(500).json({ error: "Failed to fetch city cost profile" });
  }
});

// ─── POST /relocation/city-cost-profile (admin: upsert) ──────────────────────

const CityProfileUpsertSchema = z.object({
  city: z.string(),
  country: z.string(),
  currency: z.string().optional(),
  rentLow: z.number().optional(),
  rentMid: z.number().optional(),
  rentHigh: z.number().optional(),
  monthlyFood: z.number().optional(),
  monthlyTransport: z.number().optional(),
  monthlyUtilities: z.number().optional(),
  monthlyHealthcare: z.number().optional(),
  monthlyOther: z.number().optional(),
  estimatedMonthlyCost: z.number().optional(),
  dataSource: z.string().optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
});

router.post("/relocation/city-cost-profile", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = CityProfileUpsertSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { city, country, ...rest } = parsed.data;
  const normalizedCity = normalizeCityName(city);
  const normalizedCountry = normalizeCountryName(country);

  try {
    const toNum = (v?: number) => v !== undefined ? String(v) : undefined;
    const [row] = await db
      .insert(cityCostProfilesTable)
      .values({
        city,
        country,
        normalizedCity,
        normalizedCountry,
        currency: rest.currency,
        rentLow: toNum(rest.rentLow),
        rentMid: toNum(rest.rentMid),
        rentHigh: toNum(rest.rentHigh),
        monthlyFood: toNum(rest.monthlyFood),
        monthlyTransport: toNum(rest.monthlyTransport),
        monthlyUtilities: toNum(rest.monthlyUtilities),
        monthlyHealthcare: toNum(rest.monthlyHealthcare),
        monthlyOther: toNum(rest.monthlyOther),
        estimatedMonthlyCost: toNum(rest.estimatedMonthlyCost),
        dataSource: rest.dataSource,
        confidenceScore: rest.confidenceScore,
      })
      .onConflictDoUpdate({
        target: [cityCostProfilesTable.normalizedCity, cityCostProfilesTable.normalizedCountry],
        set: {
          rentMid: toNum(rest.rentMid),
          monthlyFood: toNum(rest.monthlyFood),
          monthlyTransport: toNum(rest.monthlyTransport),
          monthlyUtilities: toNum(rest.monthlyUtilities),
          monthlyHealthcare: toNum(rest.monthlyHealthcare),
          monthlyOther: toNum(rest.monthlyOther),
          estimatedMonthlyCost: toNum(rest.estimatedMonthlyCost),
          dataSource: rest.dataSource,
          confidenceScore: rest.confidenceScore,
          updatedAt: new Date(),
        },
      })
      .returning();
    res.json({ profile: row });
  } catch (err) {
    logger.error({ err }, "Failed to upsert city cost profile");
    res.status(500).json({ error: "Failed to save city cost profile" });
  }
});

// ─── GET /relocation/salary-benchmark ─────────────────────────────────────────

router.get("/relocation/salary-benchmark", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const { jobTitle, country } = req.query as Record<string, string>;
  if (!jobTitle) { res.status(400).json({ error: "jobTitle is required" }); return; }

  try {
    const normTitle = normalizeJobTitle(jobTitle);
    const words = normTitle.split(" ").slice(0, 2).join("%");
    const rows = await db
      .select()
      .from(salaryBenchmarksTable)
      .where(
        country
          ? and(ilike(salaryBenchmarksTable.normalizedJobTitle, `%${words}%`), eq(salaryBenchmarksTable.country, country))
          : ilike(salaryBenchmarksTable.normalizedJobTitle, `%${words}%`),
      )
      .limit(5);
    res.json({ benchmarks: rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch salary benchmark");
    res.status(500).json({ error: "Failed to fetch salary benchmark" });
  }
});

// ─── POST /relocation/salary-benchmark (admin: upsert) ────────────────────────

const SalaryBenchmarkUpsertSchema = z.object({
  jobTitle: z.string(),
  country: z.string().optional(),
  city: z.string().optional(),
  currency: z.string().optional().default("USD"),
  salaryMin: z.number().optional(),
  salaryMedian: z.number(),
  salaryMax: z.number().optional(),
  seniority: z.string().optional(),
  dataSource: z.string().optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
});

router.post("/relocation/salary-benchmark", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = SalaryBenchmarkUpsertSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { jobTitle, ...rest } = parsed.data;
  const normalizedJobTitle = normalizeJobTitle(jobTitle);

  try {
    const toNum = (v?: number) => v !== undefined ? String(v) : undefined;
    const [row] = await db
      .insert(salaryBenchmarksTable)
      .values({
        jobTitle,
        normalizedJobTitle,
        country: rest.country,
        city: rest.city,
        currency: rest.currency,
        salaryMin: toNum(rest.salaryMin),
        salaryMedian: toNum(rest.salaryMedian),
        salaryMax: toNum(rest.salaryMax),
        seniority: rest.seniority,
        dataSource: rest.dataSource,
        confidenceScore: rest.confidenceScore,
      })
      .returning();
    res.json({ benchmark: row });
  } catch (err) {
    logger.error({ err }, "Failed to upsert salary benchmark");
    res.status(500).json({ error: "Failed to save salary benchmark" });
  }
});

// ─── POST /relocation/filter-jobs ─────────────────────────────────────────────

const FilterJobsSchema = z.object({
  jobIds: z.array(z.string()).optional().default([]),
  internalJobIds: z.array(z.string()).optional().default([]),
  minimumRelocationScore: z.number().int().optional().default(0),
  hideRiskyMoves: z.boolean().optional().default(false),
  requireVisaFriendly: z.boolean().optional().default(false),
  requireEnglishFriendly: z.boolean().optional().default(false),
  requirePositiveMonthlySurplus: z.boolean().optional().default(false),
  lifestyle: LifestyleSchema.optional().default("moderate"),
});

router.post("/relocation/filter-jobs", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = FilterJobsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  try {
    const rows = await db
      .select()
      .from(jobRelocationScoresTable)
      .where(eq(jobRelocationScoresTable.userId, req.user.id))
      .orderBy(desc(jobRelocationScoresTable.relocationScore))
      .limit(100);

    let filtered = rows;
    if (parsed.data.minimumRelocationScore > 0) {
      filtered = filtered.filter((r) => (r.relocationScore ?? 0) >= parsed.data.minimumRelocationScore);
    }
    if (parsed.data.hideRiskyMoves) {
      filtered = filtered.filter((r) => !["risky_move", "not_recommended"].includes(r.relocationRecommendation ?? ""));
    }
    if (parsed.data.requirePositiveMonthlySurplus) {
      filtered = filtered.filter((r) => Number(r.estimatedMonthlySurplus ?? 0) > 0);
    }

    res.json({ results: filtered, count: filtered.length });
  } catch (err) {
    logger.error({ err }, "Failed to filter jobs by relocation");
    res.status(500).json({ error: "Failed to filter jobs" });
  }
});

// ─── POST /relocation/recalculate ─────────────────────────────────────────────

const RecalculateSchema = z.object({
  jobIds: z.array(z.string()).optional().default([]),
  internalJobIds: z.array(z.string()).optional().default([]),
  lifestyle: LifestyleSchema.optional().default("moderate"),
});

router.post("/relocation/recalculate", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = RecalculateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const results: string[] = [];
  const errors: string[] = [];

  try {
    for (const internalJobId of parsed.data.internalJobIds.slice(0, 10)) {
      try {
        const r = await analyzeRelocationForJob({
          userId: req.user.id,
          internalJobId,
          lifestyle: parsed.data.lifestyle,
          forceRefresh: true,
        });
        if (r) results.push(internalJobId);
      } catch (err) {
        errors.push(internalJobId);
      }
    }
    for (const jobId of parsed.data.jobIds.slice(0, 10)) {
      try {
        const r = await analyzeRelocationForJob({
          userId: req.user.id,
          jobId,
          lifestyle: parsed.data.lifestyle,
          forceRefresh: true,
        });
        if (r) results.push(jobId);
      } catch (err) {
        errors.push(jobId);
      }
    }
    res.json({ recalculated: results.length, errors: errors.length, jobIds: results });
  } catch (err) {
    logger.error({ err }, "Recalculate failed");
    res.status(500).json({ error: "Recalculate failed" });
  }
});

export default router;
