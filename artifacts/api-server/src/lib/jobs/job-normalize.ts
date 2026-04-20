import crypto from "crypto";
import type { UnifiedJob } from "./job-schema.js";
import _citiesJson from "./cities.json";

// ─── HTML strip ───────────────────────────────────────────────────────────────

/** Strip HTML tags and normalize whitespace from a string. */
export function sanitizeDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Remote detection ─────────────────────────────────────────────────────────

const REMOTE_SIGNALS = [
  "remote", "work from home", "wfh", "home office", "fully remote",
  "distributed", "anywhere", "virtual", "telecommute",
];

export function inferRemoteFlag(title: string, location: string): boolean {
  const text = `${title} ${location}`.toLowerCase();
  return REMOTE_SIGNALS.some((sig) => text.includes(sig));
}

// ─── Employment type ──────────────────────────────────────────────────────────

export function inferEmploymentType(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (s.includes("full") || s.includes("permanent")) return "full-time";
  if (s.includes("part")) return "part-time";
  if (s.includes("contract") || s.includes("freelance") || s.includes("temporary")) return "contract";
  if (s.includes("intern")) return "internship";
  return raw.trim();
}

// ─── Country inference ────────────────────────────────────────────────────────

// Stage 1: Complete country name → ISO-2 lookup (all 195 UN member states +
// key territories, with common aliases and native-language names).
const COUNTRY_NAMES: Record<string, string> = {
  // A
  afghanistan: "af", albania: "al", algeria: "dz", andorra: "ad",
  angola: "ao", argentina: "ar", armenia: "am", australia: "au",
  austria: "at", azerbaijan: "az",
  // B
  bahamas: "bs", bahrain: "bh", bangladesh: "bd", barbados: "bb",
  belarus: "by", belgium: "be", belgique: "be", belgie: "be", belgien: "be",
  belize: "bz", benin: "bj", bhutan: "bt", bolivia: "bo",
  "bosnia and herzegovina": "ba", bosnia: "ba", botswana: "bw",
  brazil: "br", brasil: "br", brunei: "bn", bulgaria: "bg",
  "burkina faso": "bf", burundi: "bi",
  // C
  "cabo verde": "cv", "cape verde": "cv", cambodia: "kh", cameroon: "cm",
  canada: "ca", "central african republic": "cf", chad: "td", chile: "cl",
  china: "cn", colombia: "co", comoros: "km", congo: "cg",
  "democratic republic of the congo": "cd", "dr congo": "cd", "drc": "cd",
  "costa rica": "cr", croatia: "hr", cuba: "cu", cyprus: "cy",
  "czech republic": "cz", czechia: "cz",
  // D
  denmark: "dk", danmark: "dk", djibouti: "dj", dominica: "dm",
  "dominican republic": "do",
  // E
  ecuador: "ec", egypt: "eg", "el salvador": "sv",
  "equatorial guinea": "gq", eritrea: "er", estonia: "ee", eswatini: "sz",
  swaziland: "sz", ethiopia: "et",
  // F
  fiji: "fj", finland: "fi", suomi: "fi", france: "fr",
  // G
  gabon: "ga", gambia: "gm", georgia: "ge", germany: "de",
  deutschland: "de", ghana: "gh", greece: "gr", grenada: "gd",
  guatemala: "gt", guinea: "gn", "guinea-bissau": "gw", guyana: "gy",
  // H
  haiti: "ht", honduras: "hn", hungary: "hu",
  // I
  iceland: "is", india: "in", indonesia: "id", iran: "ir", iraq: "iq",
  ireland: "ie", eire: "ie", israel: "il", italy: "it", italia: "it",
  // J
  jamaica: "jm", japan: "jp", jordan: "jo",
  // K
  kazakhstan: "kz", kenya: "ke", kiribati: "ki",
  "north korea": "kp", "south korea": "kr", korea: "kr",
  kosovo: "xk", kuwait: "kw", kyrgyzstan: "kg",
  // L
  laos: "la", latvia: "lv", lebanon: "lb", lesotho: "ls", liberia: "lr",
  libya: "ly", liechtenstein: "li", lithuania: "lt", luxembourg: "lu",
  // M
  madagascar: "mg", malawi: "mw", malaysia: "my", maldives: "mv",
  mali: "ml", malta: "mt", "marshall islands": "mh", mauritania: "mr",
  mauritius: "mu", mexico: "mx",
  micronesia: "fm", moldova: "md", monaco: "mc", mongolia: "mn",
  montenegro: "me", morocco: "ma", mozambique: "mz", myanmar: "mm",
  burma: "mm",
  // N
  namibia: "na", nauru: "nr", nepal: "np", netherlands: "nl",
  nederland: "nl", holland: "nl", "new zealand": "nz", nicaragua: "ni",
  niger: "ne", nigeria: "ng", "north macedonia": "mk", macedonia: "mk",
  norway: "no", norge: "no",
  // O
  oman: "om",
  // P
  pakistan: "pk", palau: "pw", palestine: "ps", panama: "pa",
  "papua new guinea": "pg", paraguay: "py", peru: "pe", philippines: "ph",
  poland: "pl", polska: "pl", portugal: "pt",
  // Q
  qatar: "qa",
  // R
  romania: "ro", russia: "ru", rwanda: "rw",
  // S
  "saint kitts and nevis": "kn", "saint lucia": "lc",
  "saint vincent and the grenadines": "vc", samoa: "ws",
  "san marino": "sm", "sao tome and principe": "st",
  "saudi arabia": "sa", senegal: "sn", serbia: "rs",
  seychelles: "sc", "sierra leone": "sl", singapore: "sg",
  slovakia: "sk", slovenia: "si", "solomon islands": "sb",
  somalia: "so", "south africa": "za", "south sudan": "ss",
  spain: "es", "sri lanka": "lk", sudan: "sd", suriname: "sr",
  sweden: "se", sverige: "se", switzerland: "ch", schweiz: "ch",
  suisse: "ch", svizzera: "ch", syria: "sy",
  // T
  taiwan: "tw", tajikistan: "tj", tanzania: "tz", thailand: "th",
  "timor-leste": "tl", "east timor": "tl", togo: "tg", tonga: "to",
  "trinidad and tobago": "tt", trinidad: "tt", tunisia: "tn",
  turkey: "tr", türkiye: "tr", turkmenistan: "tm", tuvalu: "tv",
  // U
  uganda: "ug", ukraine: "ua",
  "united arab emirates": "ae", uae: "ae",
  "united kingdom": "gb", uk: "gb", "great britain": "gb",
  england: "gb", scotland: "gb", wales: "gb",
  "united states": "us", usa: "us", "u.s.a": "us", "u.s": "us",
  "united states of america": "us",
  uruguay: "uy", uzbekistan: "uz",
  // V
  vanuatu: "vu", venezuela: "ve", vietnam: "vn",
  // Y
  yemen: "ye",
  // Z
  zambia: "zm", zimbabwe: "zw",
  // Key territories often used in job listings
  "hong kong": "hk", "hong kong sar": "hk",
  macau: "mo", macao: "mo",
  "puerto rico": "pr",
};

// Stage 2: 119 K world cities → ISO-2
// Built from GeoNames via all-the-cities (max-population wins for duplicate names).
const CITY_INDEX = new Map<string, string>(
  Object.entries(_citiesJson as Record<string, string>)
);

// Supplemental overrides: aliases or high-value phrases not in the GeoNames dataset,
// or where the dataset's max-population winner is wrong for job-listing context.
const CITY_OVERRIDES: Record<string, string> = {
  // ── Truly global remote signals (location explicitly says "no country restriction")
  // Note: "remote", "wfh", "work from home" are NOT here — those are work styles,
  // not geographic scope. A US remote job is still US-only.
  anywhere: "remote", worldwide: "remote",
  "globally remote": "remote", "remote worldwide": "remote",
  "remote global": "remote", "open to all locations": "remote",

  // ── Anglicised spellings missing from or wrong in GeoNames ──────────────────
  // Belgium
  antwerp: "be",            // GeoNames has Antwerp, Ohio (US) as higher pop
  ghent: "be",              // GeoNames only has "gent" (Flemish)
  bruges: "be",             // GeoNames has a Bruges in France
  liege: "be", luik: "be", // accented versions only in dataset
  leuven: "be", louvain: "be",
  mechelen: "be", hasselt: "be", kortrijk: "be",
  ostend: "be", ostende: "be",
  genk: "be", aalst: "be", mons: "be",

  // Germany
  cologne: "de",            // GeoNames has Cologne → Italy (small town)
  münchen: "de",            // accented — GeoNames misses it
  nuremberg: "de",          // English vs "nürnberg"
  dusseldorf: "de",         // unaccented

  // Switzerland
  zurich: "ch",             // GeoNames has "zürich"; "zurich" maps to somewhere else
  geneva: "ch",             // GeoNames has Geneva, NY (US) as higher pop
  genève: "ch",

  // Netherlands
  "the hague": "nl", "den haag": "nl",

  // Poland
  krakow: "pl",             // GeoNames only has "kraków" (accented)
  wroclaw: "pl",            // vs "wrocław"
  gdansk: "pl",             // vs "gdańsk"

  // Czech Republic
  prague: "cz",             // double-check — dataset has it but just in case

  // Scandinavia / Baltic
  reykjavik: "is",          // Iceland capital — missing from dataset
  ulaanbaatar: "mn",        // Mongolia capital — missing from dataset
  gothenburg: "se",         // English name; dataset has "göteborg"
  malmo: "se",              // vs "malmö"
  copenhagen: "dk",         // check — dataset may have it

  // Eastern Europe
  bucharest: "ro",
  chisinau: "md",
  kyiv: "ua", kiev: "ua",

  // Russia
  moscow: "ru",
  "saint petersburg": "ru", "st. petersburg": "ru",

  // Middle East
  "tel aviv": "il",
  "abu dhabi": "ae",
  riyadh: "sa", jeddah: "sa",

  // Africa
  "ivory coast": "ci",
  "dar es salaam": "tz",
  "addis ababa": "et",

  // South / Southeast Asia
  "ho chi minh city": "vn", "ho chi minh": "vn",
  "kuala lumpur": "my",
  "chiang mai": "th",
  bangalore: "in",          // English name; dataset has "bengaluru"
  bombay: "in",             // old name for Mumbai

  // East Asia
  "hong kong": "hk",
  "hong kong sar": "hk",

  // Americas
  "new york": "us",         // GeoNames has "New York City"
  "new york city": "us",
  "san francisco": "us",
  "los angeles": "us",
  "las vegas": "us",
  "salt lake city": "us",
  "kansas city": "us",
  "new orleans": "us",
  "san jose": "us",         // overrides Costa Rica small-city hit
  "new delhi": "in",

  // Brazil
  "rio de janeiro": "br",
  "sao paulo": "br", "são paulo": "br",
  "belo horizonte": "br",

  // Misc
  "buenos aires": "ar",     // ensure AR wins over MX/CO duplicates
  "mexico city": "mx",
  "cape town": "za",
  "gold coast": "au",
  "la paz": "bo",
};

// US state abbreviations regex ("Jacksonville, FL" → "us")
const US_STATE_ABBREV = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/i;

/** Look up a phrase (1–3 words) in supplemental overrides then the 119K city index. */
function cityLookup(phrase: string): string | undefined {
  return CITY_OVERRIDES[phrase] ?? CITY_INDEX.get(phrase);
}

export function inferCountry(location: string, queryCountry = ""): string {
  if (!location) return queryCountry; // empty location → fall back to query country

  const loc = location.toLowerCase().trim();

  // 1. Supplemental overrides – exact substring match for multi-word phrases
  for (const phrase of Object.keys(CITY_OVERRIDES)) {
    if (phrase.includes(" ") && loc.includes(phrase)) return CITY_OVERRIDES[phrase];
  }

  // 2. Country name whole-word match
  for (const [name, code] of Object.entries(COUNTRY_NAMES)) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(loc)) return code;
  }

  // 3. N-gram city lookup (3-word → 2-word → 1-word), O(1) per combo
  const tokens = loc.split(/[\s,/()|]+/).filter((t) => t.length >= 2);
  for (let i = 0; i < tokens.length; i++) {
    // Try 3-word phrase
    if (i + 2 < tokens.length) {
      const hit = cityLookup(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
      if (hit) return hit;
    }
    // Try 2-word phrase
    if (i + 1 < tokens.length) {
      const hit = cityLookup(`${tokens[i]} ${tokens[i + 1]}`);
      if (hit) return hit;
    }
    // Try single token
    if (tokens[i].length >= 3) {
      const hit = cityLookup(tokens[i]);
      if (hit) return hit;
    }
  }

  // 4. US state abbreviation fallback ("Jacksonville, FL")
  if (US_STATE_ABBREV.test(location)) return "us";

  // 5. Nothing matched — use the query country as last resort
  return queryCountry;
}

// ─── Seniority ────────────────────────────────────────────────────────────────

export function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/\b(vp|vice president|cto|ceo|coo|chief)\b/.test(t)) return "executive";
  if (/\b(director|head of|principal)\b/.test(t)) return "director";
  if (/\b(senior|sr\.?|lead|staff|architect)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|graduate|entry.?level|associate)\b/.test(t)) return "junior";
  if (/\b(intern|trainee|apprentice)\b/.test(t)) return "intern";
  if (/\b(mid|middle|intermediate)\b/.test(t)) return "mid";
  return "";
}

// ─── Location normalization ───────────────────────────────────────────────────

export function normalizeLocation(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

// ─── Canonical key ────────────────────────────────────────────────────────────

/**
 * Build a stable canonical key from title + company + location.
 * Falls back to source + externalId when available.
 *
 * The key is a short SHA-256 prefix so it's compact and collision-resistant.
 */
export function buildCanonicalKey(job: {
  title: string;
  company?: string;
  location?: string;
  source?: string;
  externalId?: string;
}): string {
  const { title, company = "", location = "", source, externalId } = job;

  // Prefer source + externalId for ATS jobs (stable, unique)
  if (source && externalId) {
    const raw = `${source}::${externalId}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
  }

  // Fall back to normalized title + company + location
  const normalized = [title, company, location]
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("::");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

// ─── Full job normalization helper ────────────────────────────────────────────
// Applies all inference functions to a partially-constructed UnifiedJob

export function applyNormalization(job: UnifiedJob, queryCountry = ""): UnifiedJob {
  const location = normalizeLocation(job.location);
  const description = sanitizeDescription(job.description);
  const remote = job.remote || inferRemoteFlag(job.title, location);
  const employmentType = job.employmentType || inferEmploymentType(job.employmentType);
  const seniority = job.seniority || inferSeniority(job.title);
  const country = job.country || inferCountry(location, queryCountry);
  const canonicalKey = buildCanonicalKey({
    title: job.title,
    company: job.company,
    location,
    source: job.source,
    externalId: job.externalId,
  });

  return {
    ...job,
    location,
    description,
    remote,
    employmentType,
    seniority,
    country,
    metadata: { ...job.metadata, canonicalKey },
  };
}
