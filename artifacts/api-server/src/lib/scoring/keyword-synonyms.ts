import { normalizeKeyword } from "./normalize-keywords.js";

const SYNONYM_GROUPS: string[][] = [
  ["microsoft excel", "excel", "ms excel"],
  ["microsoft word", "word", "ms word"],
  ["microsoft powerpoint", "powerpoint", "ms powerpoint", "ppt"],
  ["microsoft office", "ms office", "office 365", "microsoft 365"],
  ["microsoft access", "ms access"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],
  ["postgresql", "postgres"],
  ["microsoft sql server", "sql server", "mssql", "ms sql"],
  ["mongodb", "mongo"],
  ["javascript", "js"],
  ["typescript", "ts"],
  ["c++", "cpp"],
  ["c#", "csharp", "c sharp"],
  ["node.js", "nodejs", "node"],
  ["react.js", "react", "reactjs"],
  ["vue.js", "vue", "vuejs"],
  ["next.js", "nextjs"],
  ["express.js", "express", "expressjs"],
  ["project management", "project manager"],
  ["programme management", "program management"],
  ["agile", "agile methodology", "agile development"],
  ["scrum", "scrum methodology"],
  ["kanban", "kanban methodology"],
  ["stakeholder management", "stakeholder engagement", "stakeholder coordination"],
  ["supply chain management", "supply chain", "scm"],
  ["customer relationship management", "crm"],
  ["enterprise resource planning", "erp"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp"],
  ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
  ["kubernetes", "k8s"],
  ["business intelligence", "bi"],
  ["data analysis", "data analytics"],
  ["search engine optimization", "seo"],
  ["pay per click", "ppc"],
  ["digital marketing", "online marketing"],
  ["financial modeling", "financial modelling"],
  ["human resources", "hr"],
  ["key performance indicators", "kpis", "kpi"],
  ["profit and loss", "p&l", "p and l"],
  ["continuous improvement", "kaizen"],
  ["sql", "structured query language"],
  ["html", "html5"],
  ["css", "css3"],
  ["rest api", "restful api", "restful", "rest"],
  ["graphql", "graph ql"],
  ["git", "github", "gitlab", "version control"],
  ["linux", "unix"],
  ["docker", "containerization", "containers"],
  ["terraform", "infrastructure as code", "iac"],
  ["power bi", "powerbi"],
  ["tableau", "tableau desktop"],
  ["salesforce", "sfdc"],
  ["sap", "sap erp"],
  ["jira", "atlassian jira"],
  ["confluence", "atlassian confluence"],
];

let _synonymMap: Map<string, string> | null = null;

function getSynonymMap(): Map<string, string> {
  if (_synonymMap) return _synonymMap;
  _synonymMap = new Map();
  for (const group of SYNONYM_GROUPS) {
    const canonical = normalizeKeyword(group[0]);
    for (const alias of group) {
      const normAlias = normalizeKeyword(alias);
      _synonymMap.set(normAlias, canonical);
      _synonymMap.set(normAlias.replace(/\s+/g, ""), canonical);
    }
  }
  return _synonymMap;
}

export function resolveToCanonical(normalizedKeyword: string): string {
  return getSynonymMap().get(normalizedKeyword) ?? normalizedKeyword;
}

export function getAllAliases(normalizedKeyword: string): string[] {
  const canonical = resolveToCanonical(normalizedKeyword);
  const map = getSynonymMap();
  const aliases: string[] = [canonical];
  for (const [alias, can] of map.entries()) {
    if (can === canonical && !aliases.includes(alias)) {
      aliases.push(alias);
    }
  }
  return aliases;
}
