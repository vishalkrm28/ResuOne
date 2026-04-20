import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── GET /api/jobs/sources ────────────────────────────────────────────────────
// Returns the list of configured job sources and their availability.

router.get("/jobs/sources", async (_req, res) => {
  const hasSerpApi = Boolean(process.env.SERPAPI_API_KEY);
  const hasGreenhouse = Boolean(process.env.GREENHOUSE_BOARD_TOKENS_JSON);
  const hasLever = Boolean(process.env.LEVER_COMPANIES_JSON);

  const sources = [
    {
      id: "google_jobs_serpapi",
      sourceType: "google_jobs",
      displayName: "Google Jobs (via SerpApi)",
      description: "Real-time job listings aggregated from Google Jobs search results",
      active: hasSerpApi,
      requiresConfig: !hasSerpApi,
      configKey: "SERPAPI_API_KEY",
    },
    {
      id: "greenhouse",
      sourceType: "greenhouse",
      displayName: "Greenhouse ATS",
      description: "Direct job postings from companies using the Greenhouse ATS platform",
      active: true,
      requiresConfig: false,
      hasCustomBoards: hasGreenhouse,
      configKey: "GREENHOUSE_BOARD_TOKENS_JSON",
      note: hasGreenhouse ? "Using custom board tokens from config" : "Using default seed boards",
    },
    {
      id: "lever",
      sourceType: "lever",
      displayName: "Lever ATS",
      description: "Direct job postings from companies using the Lever hiring platform",
      active: true,
      requiresConfig: false,
      hasCustomCompanies: hasLever,
      configKey: "LEVER_COMPANIES_JSON",
      note: hasLever ? "Using custom company handles from config" : "Using default seed companies",
    },
  ];

  return res.json({
    sources,
    defaultCountry: process.env.JOB_DISCOVERY_DEFAULT_COUNTRY ?? "se",
    cacheHours: parseInt(process.env.JOB_DISCOVERY_CACHE_HOURS ?? "12", 10),
    maxResults: parseInt(process.env.JOB_DISCOVERY_MAX_RESULTS ?? "100", 10),
  });
});

export default router;
