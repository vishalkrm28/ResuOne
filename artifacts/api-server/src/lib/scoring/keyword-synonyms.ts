import { normalizeKeyword } from "./normalize-keywords.js";

const SYNONYM_GROUPS: string[][] = [
  // ── Microsoft Office ────────────────────────────────────────────────────
  ["microsoft excel", "excel", "ms excel"],
  ["microsoft word", "word", "ms word"],
  ["microsoft powerpoint", "powerpoint", "ms powerpoint", "ppt"],
  ["microsoft office", "ms office", "office 365", "microsoft 365"],
  ["microsoft access", "ms access"],
  ["microsoft teams", "ms teams", "teams"],
  ["microsoft outlook", "outlook", "ms outlook"],
  ["microsoft sharepoint", "sharepoint", "ms sharepoint"],
  ["microsoft dynamics", "dynamics 365", "ms dynamics"],
  ["microsoft power bi", "power bi", "powerbi"],
  ["microsoft visio", "visio"],

  // ── Cloud platforms ──────────────────────────────────────────────────────
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],

  // ── AWS services ─────────────────────────────────────────────────────────
  ["aws lambda", "lambda functions", "serverless computing"],
  ["amazon s3", "aws s3", "s3 storage"],
  ["amazon ec2", "aws ec2"],
  ["amazon rds", "aws rds"],
  ["amazon redshift", "redshift", "aws redshift"],
  ["amazon dynamodb", "dynamodb"],

  // ── Databases ────────────────────────────────────────────────────────────
  ["postgresql", "postgres"],
  ["microsoft sql server", "sql server", "mssql", "ms sql"],
  ["mongodb", "mongo"],
  ["mysql", "my sql"],
  ["sqlite", "sqlite3"],
  ["redis", "redis cache"],
  ["elasticsearch", "elastic search", "elk stack"],
  ["oracle database", "oracle db", "oracle"],
  ["snowflake", "snowflake data warehouse"],
  ["bigquery", "google bigquery"],
  ["amazon redshift", "redshift"],
  ["databricks", "databricks platform"],
  ["nosql", "no sql", "non-relational database"],

  // ── Languages ────────────────────────────────────────────────────────────
  ["javascript", "js"],
  ["typescript", "ts"],
  ["python", "python3", "python 3"],
  ["r programming", "r language", "r statistical", "rlang"],
  ["c++", "cpp"],
  ["c#", "csharp", "c sharp", "dotnet c#", ".net c#"],
  ["scala", "apache scala"],
  ["golang", "go language", "go programming"],
  ["rust programming", "rust language"],
  ["kotlin", "kotlin android"],
  ["swift", "swift ios"],
  ["php", "php programming"],
  ["ruby", "ruby on rails", "rails"],

  // ── Frameworks & libraries ───────────────────────────────────────────────
  ["node.js", "nodejs", "node"],
  ["react.js", "react", "reactjs"],
  ["vue.js", "vue", "vuejs"],
  ["angular", "angularjs"],
  ["next.js", "nextjs"],
  ["svelte", "svelte.js", "sveltejs"],
  ["express.js", "express", "expressjs"],
  ["django", "django framework"],
  ["flask", "flask python"],
  ["fastapi", "fast api"],
  ["spring boot", "spring framework", "java spring"],
  ["asp.net", "asp net", ".net framework", "dotnet"],
  ["laravel", "laravel php"],
  ["tailwind css", "tailwind", "tailwindcss"],
  ["bootstrap", "bootstrap css", "bootstrap framework"],
  ["jquery", "jquery javascript"],

  // ── Data / ML ────────────────────────────────────────────────────────────
  ["machine learning", "ml"],
  ["deep learning", "neural networks", "neural network"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp", "text mining"],
  ["computer vision", "image recognition", "image processing"],
  ["data science", "data scientist"],
  ["data analysis", "data analytics", "data analyst"],
  ["data engineering", "data engineer", "data pipeline"],
  ["data visualization", "data viz", "data dashboards"],
  ["business intelligence", "bi"],
  ["predictive analytics", "predictive modeling"],
  ["statistical analysis", "statistical modeling", "statistics"],
  ["python pandas", "pandas", "dataframes"],
  ["numpy", "numerical python"],
  ["scikit-learn", "sklearn", "scikit learn"],
  ["tensorflow", "tensor flow"],
  ["pytorch", "torch", "py torch"],
  ["apache spark", "spark", "pyspark"],
  ["apache kafka", "kafka", "message queue"],
  ["apache airflow", "airflow", "workflow orchestration"],
  ["dbt", "data build tool"],
  ["tableau", "tableau desktop", "tableau software"],
  ["looker", "looker studio", "google looker"],
  ["qlik", "qlikview", "qlik sense"],

  // ── DevOps & infrastructure ───────────────────────────────────────────────
  ["devops", "dev ops", "development operations"],
  ["ci/cd", "cicd", "continuous integration", "continuous deployment", "continuous delivery"],
  ["kubernetes", "k8s", "container orchestration"],
  ["docker", "containerization", "containers"],
  ["terraform", "infrastructure as code", "iac"],
  ["ansible", "configuration management"],
  ["jenkins", "jenkins ci", "jenkins pipeline"],
  ["github actions", "github ci", "github workflows"],
  ["gitlab ci", "gitlab pipelines"],
  ["aws cloudformation", "cloudformation"],
  ["linux", "unix", "ubuntu", "centos", "rhel"],
  ["bash", "shell scripting", "bash scripting"],
  ["monitoring", "observability", "logging"],
  ["nginx", "apache web server", "web server"],

  // ── Web & APIs ───────────────────────────────────────────────────────────
  ["html", "html5"],
  ["css", "css3"],
  ["rest api", "restful api", "restful", "rest apis", "api development"],
  ["graphql", "graph ql"],
  ["websockets", "web sockets", "websocket"],

  // ── Version control ───────────────────────────────────────────────────────
  ["git", "github", "gitlab", "bitbucket", "version control"],

  // ── Project management & methodology ─────────────────────────────────────
  ["project management", "project manager"],
  ["programme management", "program management"],
  ["agile", "agile methodology", "agile development", "agile framework"],
  ["scrum", "scrum methodology", "scrum framework"],
  ["kanban", "kanban methodology", "kanban board"],
  ["waterfall", "waterfall methodology"],
  ["prince2", "prince 2"],
  ["pmp", "project management professional", "pmi"],
  ["safe", "scaled agile framework", "scaled agile"],
  ["lean", "lean methodology", "lean thinking"],
  ["six sigma", "lean six sigma", "6 sigma"],
  ["okrs", "okr", "objectives and key results"],
  ["jira", "atlassian jira"],
  ["confluence", "atlassian confluence"],
  ["asana", "asana project management"],
  ["trello", "trello board"],
  ["monday.com", "monday com"],

  // ── Business skills ───────────────────────────────────────────────────────
  ["stakeholder management", "stakeholder engagement", "stakeholder coordination"],
  ["change management", "change management process", "organizational change", "change control"],
  ["risk management", "risk assessment", "risk mitigation", "risk analysis"],
  ["strategic planning", "strategy", "strategic management"],
  ["business development", "biz dev"],
  ["business analysis", "business analyst", "business analytics"],
  ["requirements gathering", "requirements analysis", "business requirements"],
  ["process improvement", "process optimisation", "process optimization"],
  ["continuous improvement", "kaizen"],
  ["operations management", "operations", "operational management"],
  ["vendor management", "vendor relations", "supplier management"],
  ["contract management", "contract negotiation"],
  ["budget management", "budgeting", "financial planning", "budget control"],
  ["forecasting", "demand forecasting", "financial forecasting"],
  ["reporting", "management reporting", "performance reporting"],

  // ── Finance ───────────────────────────────────────────────────────────────
  ["financial modeling", "financial modelling"],
  ["profit and loss", "p&l", "p and l", "pnl"],
  ["key performance indicators", "kpis", "kpi"],
  ["cash flow", "cash flow management", "cashflow"],
  ["accounts payable", "ap"],
  ["accounts receivable", "ar"],
  ["financial reporting", "financial statements", "financial analysis"],
  ["financial forecasting", "revenue forecasting"],

  // ── Marketing & digital ────────────────────────────────────────────────
  ["search engine optimization", "seo"],
  ["search engine marketing", "sem", "paid search"],
  ["pay per click", "ppc"],
  ["google ads", "google adwords", "adwords"],
  ["facebook ads", "meta ads", "meta advertising"],
  ["digital marketing", "online marketing"],
  ["content marketing", "content strategy", "content creation"],
  ["social media marketing", "smm", "social media management"],
  ["email marketing", "email campaigns"],
  ["marketing automation", "automated marketing"],
  ["google analytics", "ga4"],
  ["conversion rate optimization", "cro"],
  ["a/b testing", "ab testing", "split testing"],
  ["copywriting", "copy writing"],
  ["brand management", "brand strategy", "branding"],
  ["public relations", "pr"],

  // ── CRM & sales tools ─────────────────────────────────────────────────
  ["customer relationship management", "crm"],
  ["salesforce", "sfdc", "salesforce crm"],
  ["hubspot", "hubspot crm"],
  ["marketo", "marketo automation"],
  ["zendesk", "customer support software"],
  ["servicenow", "service now", "itsm"],
  ["account management", "account executive", "client management"],
  ["sales management", "sales leadership", "sales strategy"],
  ["b2b sales", "business to business", "enterprise sales"],
  ["b2c sales", "business to consumer", "consumer sales"],

  // ── ERP & enterprise ──────────────────────────────────────────────────
  ["enterprise resource planning", "erp"],
  ["sap", "sap erp", "sap s/4hana"],
  ["oracle erp", "oracle financials"],
  ["workday", "workday hrm", "workday hcm"],
  ["netsuite", "oracle netsuite"],

  // ── HR & people ──────────────────────────────────────────────────────
  ["human resources", "hr"],
  ["talent acquisition", "recruitment", "recruiting", "hiring", "talent sourcing"],
  ["performance management", "performance reviews", "performance appraisal"],
  ["learning and development", "l&d", "training and development"],
  ["onboarding", "employee onboarding", "new hire onboarding"],
  ["compensation and benefits", "comp and benefits", "total rewards"],
  ["diversity and inclusion", "dei", "d&i", "diversity equity inclusion"],
  ["employee engagement", "employee relations"],
  ["succession planning", "talent management"],
  ["hris", "hr information system", "hr system"],

  // ── Supply chain & logistics ────────────────────────────────────────
  ["supply chain management", "supply chain", "scm"],
  ["logistics", "logistics management"],
  ["inventory management", "stock management", "inventory control"],
  ["procurement", "purchasing", "sourcing"],
  ["demand planning", "demand management"],
  ["warehouse management", "warehousing"],

  // ── Design & UX ──────────────────────────────────────────────────────
  ["user experience", "ux", "ux design"],
  ["user interface", "ui", "ui design"],
  ["product design", "ui/ux", "ux/ui"],
  ["user research", "ux research", "user testing", "usability testing"],
  ["wireframing", "wireframes", "prototyping", "mockups"],
  ["figma", "figma design"],
  ["sketch", "sketch app"],
  ["adobe xd", "adobe experience design"],
  ["adobe photoshop", "photoshop"],
  ["adobe illustrator", "illustrator"],
  ["adobe indesign", "indesign"],
  ["adobe premiere", "premiere pro", "video editing"],
  ["after effects", "adobe after effects"],

  // ── Cloud & data warehousing ─────────────────────────────────────────
  ["fivetran", "data integration"],
  ["data warehousing", "data warehouse"],
  ["etl", "extract transform load", "data ingestion"],
  ["data governance", "data quality", "data management"],
  ["data modelling", "data modeling"],

  // ── Security & compliance ─────────────────────────────────────────────
  ["cybersecurity", "cyber security", "information security", "infosec"],
  ["gdpr", "data protection", "data privacy"],
  ["hipaa", "healthcare compliance"],
  ["iso 27001", "iso 27001 certification"],
  ["iso 9001", "iso 9001 certification"],
  ["compliance", "regulatory compliance"],
  ["penetration testing", "pen testing", "ethical hacking"],

  // ── Testing & QA ─────────────────────────────────────────────────────
  ["quality assurance", "qa", "quality control", "qc"],
  ["test automation", "automated testing"],
  ["selenium", "selenium webdriver"],
  ["cypress", "cypress testing"],
  ["jest", "jest testing", "unit testing"],
  ["pytest", "python testing"],
  ["test driven development", "tdd"],
  ["behaviour driven development", "bdd", "behavior driven development"],
  ["end to end testing", "e2e testing"],
  ["regression testing", "functional testing"],

  // ── Communication & soft skills ──────────────────────────────────────
  ["communication skills", "communication"],
  ["leadership", "team leadership", "leading teams", "people leadership"],
  ["problem solving", "problem-solving skills", "critical thinking"],
  ["analytical skills", "analytical thinking", "analysis"],
  ["presentation skills", "presenting", "public speaking"],
  ["negotiation skills", "negotiation"],
  ["mentoring", "coaching", "team development"],
  ["cross-functional collaboration", "cross functional teams", "cross functional collaboration"],
  ["stakeholder communication", "communicating with stakeholders"],

  // ── Other tech abbreviations ─────────────────────────────────────────
  ["sql", "structured query language"],
  ["nosql", "no sql"],
  ["api", "application programming interface", "apis"],
  ["sdk", "software development kit"],
  ["ide", "integrated development environment"],
  ["oop", "object oriented programming", "object-oriented programming"],
  ["mvc", "model view controller"],
  ["microservices", "micro services", "microservice architecture"],
  ["service oriented architecture", "soa"],
  ["big data", "large scale data", "data at scale"],
  ["blockchain", "distributed ledger"],
  ["internet of things", "iot"],
  ["augmented reality", "ar"],
  ["virtual reality", "vr"],
  ["saas", "software as a service"],
  ["paas", "platform as a service"],
  ["iaas", "infrastructure as a service"],

  // ── Frontend / backend / fullstack ──────────────────────────────────────
  ["frontend", "front end", "front-end", "client side", "client-side"],
  ["backend", "back end", "back-end", "server side", "server-side"],
  ["full stack", "full-stack", "fullstack"],
  ["mobile development", "mobile app development", "mobile apps"],
  ["ios development", "ios developer", "swift development"],
  ["android development", "android developer", "kotlin development"],
  ["web development", "web developer", "web application development"],
  ["software development", "software engineer", "software engineering", "swe"],
  ["software architecture", "solution architecture", "solutions architect"],
  ["cloud architecture", "cloud architect", "cloud engineering"],
  ["data architecture", "data architect"],
  ["platform engineering", "platform engineer", "infrastructure engineering"],
  ["site reliability engineering", "sre", "reliability engineering"],

  // ── Architecture & design patterns ───────────────────────────────────────
  ["event driven architecture", "event-driven", "event driven", "message driven"],
  ["domain driven design", "ddd"],
  ["clean architecture", "hexagonal architecture", "ports and adapters"],
  ["design patterns", "software design patterns", "architectural patterns"],
  ["solid principles", "solid"],

  // ── Additional databases & data tools ────────────────────────────────────
  ["database administration", "dba", "database admin", "database management"],
  ["sql querying", "sql queries", "sql database", "relational database", "rdbms"],
  ["data lake", "data lakehouse"],
  ["real-time data", "real time data", "streaming data", "stream processing"],

  // ── Additional cloud & networking ─────────────────────────────────────────
  ["virtual private cloud", "vpc"],
  ["load balancing", "load balancer"],
  ["cdn", "content delivery network"],
  ["dns", "domain name system"],
  ["ssl/tls", "ssl", "tls", "https", "certificates"],
  ["api gateway", "api management"],
  ["serverless", "functions as a service", "faas"],
  ["cloud native", "cloud-native"],
  ["hybrid cloud", "multi cloud", "multi-cloud"],

  // ── Security & auth ───────────────────────────────────────────────────────
  ["identity and access management", "iam"],
  ["oauth", "oauth2", "openid connect", "oidc", "saml"],
  ["single sign on", "sso"],
  ["zero trust", "zero-trust security"],
  ["vulnerability assessment", "vulnerability management", "vulnerability scanning"],

  // ── Observability & operations ────────────────────────────────────────────
  ["distributed tracing", "opentelemetry", "otel"],
  ["prometheus", "grafana", "metrics monitoring"],
  ["datadog", "new relic", "application performance monitoring", "apm"],
  ["splunk", "log management", "log aggregation"],
  ["incident management", "incident response", "on-call", "problem management"],
  ["capacity planning", "performance tuning", "performance optimisation",
   "performance optimization"],

  // ── Project & delivery ────────────────────────────────────────────────────
  ["product management", "product manager", "product owner", "po"],
  ["product roadmap", "roadmap planning"],
  ["sprint planning", "sprint review", "sprint retrospective"],
  ["backlog management", "backlog grooming", "backlog refinement"],
  ["release management", "release planning", "deployment management"],
  ["it service management", "itsm", "service management"],

  // ── Seniority / roles ─────────────────────────────────────────────────────
  ["c-suite", "c suite", "c level", "executive level"],
  ["board level", "board of directors"],
  ["vice president", "vp", "evp", "svp"],
  ["chief technology officer", "cto"],
  ["chief information officer", "cio"],
  ["chief executive officer", "ceo"],
  ["engineering manager", "engineering lead", "tech lead", "technical lead"],
  ["people management", "team management", "managing teams", "line management"],
  ["individual contributor", "ic"],

  // ── Soft skills (additional) ─────────────────────────────────────────────
  ["time management", "deadline management", "meeting deadlines"],
  ["decision making", "decision-making"],
  ["conflict resolution", "conflict management"],
  ["active listening", "listening skills"],
  ["written communication", "written communication skills", "technical writing"],
  ["influencing skills", "influencing without authority", "persuasion"],
  ["adaptability", "flexibility", "adaptable"],
  ["creativity", "innovative thinking", "innovation"],
  ["emotional intelligence", "eq", "empathy"],
  ["cultural awareness", "cultural sensitivity", "global mindset"],
  ["multitasking", "multi-tasking", "managing multiple priorities"],

  // ── Word-family groups (verb ↔ noun ↔ adjective forms) ──────────────────
  // These supplement the stemmer for verb/noun pairs whose roots don't
  // converge algorithmically (e.g., analyse/analysis/analytical).
  ["analysis", "analyse", "analyze", "analyses", "analyzes", "analysed",
   "analyzed", "analysing", "analyzing", "analytical", "analytics"],
  ["organization", "organise", "organize", "organised", "organized",
   "organising", "organizing", "organizational", "organisational"],
  ["collaboration", "collaborate", "collaborates", "collaborated",
   "collaborating", "collaborative", "collaboratively"],
  ["coordination", "coordinate", "coordinates", "coordinated",
   "coordinating", "coordinator"],
  ["demonstration", "demonstrate", "demonstrates", "demonstrated",
   "demonstrating", "demonstrative"],
  ["communication", "communicate", "communicates", "communicated",
   "communicating", "communicative"],
  ["implementation", "implement", "implements", "implemented",
   "implementing", "implementer"],
  ["optimization", "optimise", "optimize", "optimised", "optimized",
   "optimising", "optimizing", "optimisation"],
  ["automation", "automate", "automates", "automated", "automating"],
  ["evaluation", "evaluate", "evaluates", "evaluated", "evaluating"],
  ["negotiation", "negotiate", "negotiates", "negotiated", "negotiating"],
  ["facilitation", "facilitate", "facilitates", "facilitated",
   "facilitating", "facilitator"],
  ["presentation", "present", "presents", "presented", "presenting"],
  ["prioritization", "prioritise", "prioritize", "prioritised",
   "prioritized", "prioritising", "prioritizing", "prioritisation",
   "prioritize", "priority", "priorities"],
  ["modernization", "modernise", "modernize", "modernised", "modernized",
   "modernisation"],
  ["transformation", "transform", "transforms", "transformed",
   "transforming", "transformative"],
  ["development", "develop", "develops", "developed", "developing",
   "developer"],
  ["management", "manage", "manages", "managed", "managing", "manager"],

  // ── UK / US spelling pairs not covered by the -ise→-ize normalization ──
  ["behaviour", "behavior", "behaviours", "behaviors",
   "behavioural", "behavioral"],
  ["programme", "program", "programmes", "programs"],
  ["modelling", "modeling"],
  ["travelling", "traveling"],
  ["licence", "license", "licences", "licenses", "licensing"],
  ["defence", "defense"],
  ["offence", "offense"],
  ["labour", "labor"],
  ["colour", "color", "colours", "colors"],
  ["favour", "favor", "favourite", "favorite"],
  ["neighbour", "neighbor"],
  ["centre", "center", "centres", "centers"],
  ["fibre", "fiber", "fibres", "fibers"],
  ["theatre", "theater"],
  ["catalogue", "catalog"],
  ["dialogue", "dialog"],
  ["fulfil", "fulfill", "fulfils", "fulfills", "fulfilled", "fulfilling",
   "fulfilment", "fulfillment"],

  // ── Common professional abbreviations not yet in the map ────────────────
  ["executive", "exec", "executives"],
  ["information technology", "it", "technology"],
  ["return on investment", "roi"],
  ["total cost of ownership", "tco"],
  ["service level agreement", "sla", "slas"],
  ["proof of concept", "poc"],
  ["minimum viable product", "mvp"],
  ["product owner", "po"],
  ["business process", "bpo", "business process outsourcing"],
  ["research and development", "r&d", "r and d"],
  ["mergers and acquisitions", "m&a", "m and a"],
  ["net promoter score", "nps"],
  ["mean time to recovery", "mttr"],
  ["root cause analysis", "rca"],
  ["voice of the customer", "voc"],
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
      // Also index without spaces (e.g. "nodejs" → canonical)
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
