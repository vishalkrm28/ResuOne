export interface IndustryConfig {
  name: string;
  detectionTerms: string[];
  domainTerms: string[];
}

export const INDUSTRY_CONFIGS: IndustryConfig[] = [
  {
    name: "software",
    detectionTerms: [
      "software", "developer", "engineer", "frontend", "backend", "fullstack",
      "full-stack", "devops", "infrastructure", "cloud", "api", "microservices",
      "codebase", "repository", "deployment", "ci/cd", "sprint", "agile",
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
      "treasury", "compliance", "risk", "portfolio", "equity", "fund",
      "revenue", "budgeting", "forecasting", "analyst", "cfa", "cpa",
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
      "e-commerce", "advertising", "media", "communications", "pr",
    ],
    domainTerms: [
      "google analytics", "hubspot", "salesforce", "mailchimp", "seo",
      "sem", "ppc", "roi", "ctr", "cpa", "cpc", "funnel", "crm",
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
      "pharmacy", "physician", "diagnosis", "treatment", "health", "care",
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
    const count = config.detectionTerms.filter(t => norm.includes(t)).length;
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
  if (!industry.domainTerms.length) return 0.7;
  const norm = cvText.toLowerCase();
  const matched = industry.domainTerms.filter(t => norm.includes(t)).length;
  return Math.min(1, matched / Math.max(1, Math.min(5, industry.domainTerms.length)));
}
