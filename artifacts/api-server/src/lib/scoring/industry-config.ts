export interface IndustryConfig {
  name: string;
  detectionTerms: string[];
  domainTerms: string[];
}

/**
 * Word-boundary aware term matching.
 *
 * `String.includes()` causes systematic false positives with short terms:
 *   "api"  matches "capital"   (c-[api]-tal)
 *   "pr"   matches "process"   (start of word)
 *   "care" matches "career"    ("care"+er)
 *   "risk" matches "brisk"     (b+"risk")
 *
 * We require the term to be preceded and followed by a non-alphanumeric
 * character (or the string boundary), which is equivalent to \b but works
 * correctly with hyphens and slashes in terms like "ci/cd" and "full-stack".
 */
const _termRegexCache = new Map<string, RegExp>();

function termInText(term: string, normalizedText: string): boolean {
  let re = _termRegexCache.get(term);
  if (!re) {
    // Escape regex special characters in the term
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    _termRegexCache.set(term, re);
  }
  return re.test(normalizedText);
}

export const INDUSTRY_CONFIGS: IndustryConfig[] = [
  {
    name: "software",
    detectionTerms: [
      // Removed bare "api" — matched "capital", "capability" via substring.
      // Replaced with the unambiguous form.
      "software", "developer", "engineer", "frontend", "backend", "fullstack",
      "full-stack", "devops", "infrastructure", "cloud", "api endpoints",
      "microservices", "codebase", "repository", "deployment", "ci/cd",
      "sprint", "agile",
    ],
    domainTerms: [
      "javascript", "typescript", "python", "java", "react", "node", "aws",
      "docker", "kubernetes", "git", "sql", "rest", "graphql", "testing",
      "debugging", "architecture", "scalability", "performance", "security",
    ],
  },
  {
    name: "finance",
    detectionTerms: [
      "finance", "financial", "accounting", "audit", "investment", "banking",
      "treasury", "compliance", "risk management", "portfolio", "equity",
      // "risk" alone matched "at-risk" / "brisk"; "fund" still fine (≥4 chars)
      "fund", "revenue", "budgeting", "forecasting", "financial analyst",
      "cfa", "cpa",
    ],
    domainTerms: [
      "excel", "modelling", "valuation", "p&l", "balance sheet", "cash flow",
      "gaap", "ifrs", "variance", "kpi", "reporting", "reconciliation",
      "tax", "hedge", "derivatives", "dcf", "irr", "npv",
    ],
  },
  {
    name: "marketing",
    detectionTerms: [
      "marketing", "brand", "campaign", "digital", "content", "social media",
      "seo", "ppc", "growth", "acquisition", "retention", "conversion",
      "e-commerce", "advertising", "media", "communications",
      // Removed bare "pr" — it is a 2-char prefix of "process", "provide",
      // "project", etc., and appeared in virtually every job description.
      "public relations",
    ],
    domainTerms: [
      "google analytics", "hubspot", "salesforce", "mailchimp", "seo",
      "sem", "ppc", "return on investment", "click-through rate",
      "cost per acquisition", "cost per click", "funnel", "crm",
      "a/b testing", "segmentation", "persona", "positioning", "branding",
    ],
  },
  {
    name: "logistics",
    detectionTerms: [
      "logistics", "supply chain", "operations", "procurement", "warehouse",
      "distribution", "shipping", "freight", "inventory", "vendor", "sourcing",
      "planning", "manufacturing", "production", "lean", "six sigma",
    ],
    domainTerms: [
      "erp", "sap", "wms", "tms", "scm", "inventory management",
      "demand planning", "vendor management", "supplier", "purchase order",
      "kpi", "throughput", "lead time", "just-in-time", "jit",
    ],
  },
  {
    name: "healthcare",
    detectionTerms: [
      "healthcare", "medical", "clinical", "patient", "hospital", "nursing",
      "pharmacy", "physician", "diagnosis", "treatment", "health",
      // Removed bare "care" — it matched "career", "carefully", "childcare".
      // "healthcare" above already captures the key term.
      "pharmaceutical", "biotech", "research", "regulatory",
    ],
    domainTerms: [
      "ehr", "emr", "hipaa", "gdpr", "clinical trials", "icd", "cpt",
      "patient care", "diagnosis", "documentation", "compliance",
    ],
  },
];

export function detectIndustry(jdText: string): IndustryConfig {
  const norm = jdText.toLowerCase();
  let bestMatch = { config: INDUSTRY_CONFIGS[0], count: 0 };

  for (const config of INDUSTRY_CONFIGS) {
    const count = config.detectionTerms.filter(t => termInText(t, norm)).length;
    if (count > bestMatch.count) {
      bestMatch = { config, count };
    }
  }

  if (bestMatch.count === 0) {
    return { name: "general", detectionTerms: [], domainTerms: [] };
  }

  return bestMatch.config;
}

export function scoreIndustryAlignment(
  industry: IndustryConfig,
  cvText: string,
): number {
  if (!industry.domainTerms.length) return 0.5;
  const norm = cvText.toLowerCase();
  const matched = industry.domainTerms.filter(t => termInText(t, norm)).length;
  return Math.min(1, matched / Math.max(1, Math.min(5, industry.domainTerms.length)));
}
