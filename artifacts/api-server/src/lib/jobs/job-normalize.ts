import crypto from "crypto";
import type { UnifiedJob } from "./job-schema.js";

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

// Stage 2: Major world cities → ISO-2 (for locations that omit the country name)
const CITY_TO_COUNTRY: Record<string, string> = {
  // Remote signals (handled here so we scan once)
  remote: "remote", anywhere: "remote", worldwide: "remote",
  global: "remote", "work from home": "remote", wfh: "remote",
  // Belgium
  brussels: "be", bruxelles: "be", brussel: "be", antwerp: "be",
  antwerpen: "be", ghent: "be", gent: "be", liege: "be", luik: "be",
  leuven: "be", louvain: "be", bruges: "be", brugge: "be", namur: "be",
  charleroi: "be", mechelen: "be", mons: "be", aalst: "be", genk: "be",
  hasselt: "be", kortrijk: "be", ostend: "be", ostende: "be",
  // Germany
  berlin: "de", hamburg: "de", munich: "de", münchen: "de",
  frankfurt: "de", cologne: "de", köln: "de", stuttgart: "de",
  düsseldorf: "de", dusseldorf: "de", leipzig: "de", dortmund: "de",
  essen: "de", nuremberg: "de", nürnberg: "de", bremen: "de",
  hanover: "de", hannover: "de", dresden: "de", bonn: "de",
  // France
  paris: "fr", lyon: "fr", marseille: "fr", toulouse: "fr", nice: "fr",
  nantes: "fr", strasbourg: "fr", montpellier: "fr", bordeaux: "fr",
  lille: "fr", rennes: "fr", reims: "fr", grenoble: "fr",
  // Netherlands
  amsterdam: "nl", rotterdam: "nl", "the hague": "nl", "den haag": "nl",
  utrecht: "nl", eindhoven: "nl", groningen: "nl", tilburg: "nl",
  breda: "nl", nijmegen: "nl",
  // Spain
  madrid: "es", barcelona: "es", valencia: "es", seville: "es",
  sevilla: "es", zaragoza: "es", malaga: "es", málaga: "es",
  bilbao: "es", alicante: "es",
  // Italy
  rome: "it", roma: "it", milan: "it", milano: "it", naples: "it",
  napoli: "it", turin: "it", torino: "it", palermo: "it", genoa: "it",
  genova: "it", bologna: "it", florence: "it", firenze: "it",
  // UK
  london: "gb", manchester: "gb", edinburgh: "gb", birmingham: "gb",
  glasgow: "gb", leeds: "gb", bristol: "gb", liverpool: "gb",
  sheffield: "gb", cambridge: "gb", oxford: "gb", brighton: "gb",
  nottingham: "gb", newcastle: "gb", cardiff: "gb",
  // Ireland
  dublin: "ie", cork: "ie", galway: "ie", limerick: "ie",
  // Sweden
  stockholm: "se", gothenburg: "se", göteborg: "se", malmö: "se",
  malmo: "se", uppsala: "se",
  // Norway
  oslo: "no", bergen: "no", trondheim: "no", stavanger: "no",
  // Denmark
  copenhagen: "dk", københavn: "dk", aarhus: "dk", odense: "dk",
  // Finland
  helsinki: "fi", espoo: "fi", tampere: "fi", turku: "fi",
  // Switzerland
  zurich: "ch", zürich: "ch", geneva: "ch", genève: "ch", bern: "ch",
  basel: "ch", lausanne: "ch",
  // Austria
  vienna: "at", wien: "at", graz: "at", linz: "at", salzburg: "at",
  innsbruck: "at",
  // Poland
  warsaw: "pl", warszawa: "pl", krakow: "pl", kraków: "pl",
  wroclaw: "pl", wrocław: "pl", poznan: "pl", gdansk: "pl",
  // Czech Republic
  prague: "cz", praha: "cz", brno: "cz", ostrava: "cz",
  // Hungary
  budapest: "hu",
  // Romania
  bucharest: "ro", cluj: "ro",
  // Portugal
  lisbon: "pt", lisboa: "pt", porto: "pt", braga: "pt",
  // Greece
  athens: "gr", thessaloniki: "gr",
  // US
  "new york": "us", "san francisco": "us", "los angeles": "us",
  chicago: "us", seattle: "us", austin: "us", denver: "us",
  atlanta: "us", boston: "us", miami: "us", houston: "us",
  dallas: "us", phoenix: "us", portland: "us", nashville: "us",
  minneapolis: "us", detroit: "us", columbus: "us", charlotte: "us",
  "las vegas": "us", philadelphia: "us", "san diego": "us",
  "san jose": "us", pittsburgh: "us", cleveland: "us", raleigh: "us",
  memphis: "us", "kansas city": "us", indianapolis: "us",
  baltimore: "us", milwaukee: "us", "new orleans": "us",
  sacramento: "us", omaha: "us", "salt lake city": "us",
  // Canada
  toronto: "ca", vancouver: "ca", montreal: "ca", calgary: "ca",
  ottawa: "ca", edmonton: "ca", winnipeg: "ca", quebec: "ca",
  // Brazil
  "sao paulo": "br", "são paulo": "br", "rio de janeiro": "br",
  brasilia: "br", brasília: "br", curitiba: "br", fortaleza: "br",
  "belo horizonte": "br", manaus: "br", recife: "br",
  // Mexico
  "mexico city": "mx", guadalajara: "mx", monterrey: "mx",
  puebla: "mx", tijuana: "mx",
  // Argentina
  "buenos aires": "ar", rosario: "ar", mendoza: "ar",
  // Japan
  tokyo: "jp", osaka: "jp", kyoto: "jp", yokohama: "jp",
  nagoya: "jp", sapporo: "jp", fukuoka: "jp", kobe: "jp",
  // China
  beijing: "cn", shanghai: "cn", shenzhen: "cn", guangzhou: "cn",
  chengdu: "cn", wuhan: "cn", tianjin: "cn", hangzhou: "cn",
  nanjing: "cn",
  // South Korea
  seoul: "kr", incheon: "kr", busan: "kr", daejeon: "kr", daegu: "kr",
  // India
  bangalore: "in", bengaluru: "in", mumbai: "in", bombay: "in",
  "new delhi": "in", delhi: "in", hyderabad: "in", chennai: "in",
  madras: "in", kolkata: "in", calcutta: "in", pune: "in",
  ahmedabad: "in", noida: "in", gurgaon: "in", gurugram: "in",
  // Australia
  sydney: "au", melbourne: "au", brisbane: "au", perth: "au",
  adelaide: "au", canberra: "au", "gold coast": "au",
  // New Zealand
  auckland: "nz", wellington: "nz", christchurch: "nz",
  // Singapore
  singapore: "sg",
  // Hong Kong
  "hong kong": "hk",
  // Taiwan
  taipei: "tw",
  // Thailand
  bangkok: "th", "chiang mai": "th",
  // Indonesia
  jakarta: "id", surabaya: "id", bandung: "id",
  // Malaysia
  "kuala lumpur": "my", penang: "my",
  // Philippines
  manila: "ph", cebu: "ph",
  // Vietnam
  "ho chi minh": "vn", hanoi: "vn",
  // UAE
  dubai: "ae", "abu dhabi": "ae", sharjah: "ae",
  // Israel
  "tel aviv": "il", jerusalem: "il", haifa: "il",
  // Saudi Arabia
  riyadh: "sa", jeddah: "sa", dammam: "sa",
  // South Africa
  johannesburg: "za", "cape town": "za", durban: "za", pretoria: "za",
  // Egypt
  cairo: "eg", alexandria: "eg",
  // Kenya
  nairobi: "ke", mombasa: "ke",
  // Nigeria
  lagos: "ng", abuja: "ng",
  // Other capitals/major hubs
  accra: "gh", "dar es salaam": "tz", addis: "et", "addis ababa": "et",
  "kuala lumpur": "my", kathmandu: "np", colombo: "lk",
  dhaka: "bd", karachi: "pk", lahore: "pk", islamabad: "pk",
  tashkent: "uz", almaty: "kz", baku: "az", tbilisi: "ge",
  yerevan: "am", minsk: "by", riga: "lv", vilnius: "lt", tallinn: "ee",
  helsinki: "fi", sofia: "bg", zagreb: "hr", belgrade: "rs",
  sarajevo: "ba", skopje: "mk", tirana: "al", chisinau: "md",
  kyiv: "ua", kiev: "ua", moscow: "ru", "saint petersburg": "ru",
  amman: "jo", beirut: "lb", baghdad: "iq", tehran: "ir",
  doha: "qa", muscat: "om", manama: "bh", kuwait: "kw",
  tunis: "tn", algiers: "dz", casablanca: "ma", rabat: "ma",
  khartoum: "sd", kampala: "ug", dakar: "sn", abidjan: "ci",
  "ivory coast": "ci", kinshasa: "cd", luanda: "ao",
  lusaka: "zm", harare: "zw", maputo: "mz",
  lima: "pe", bogota: "co", bogotá: "co", medellin: "co",
  quito: "ec", "la paz": "bo", asuncion: "py", montevideo: "uy",
  caracas: "ve", panama: "pa", "san jose": "cr",
  "san juan": "pr", havana: "cu",
};

// US state abbreviations regex ("Jacksonville, FL" → "us")
const US_STATE_ABBREV = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/i;

export function inferCountry(location: string, queryCountry = ""): string {
  if (queryCountry) return queryCountry;
  if (!location) return "";

  const loc = location.toLowerCase().trim();

  // 1. Check multi-word city phrases first (longer matches take priority)
  for (const [city, code] of Object.entries(CITY_TO_COUNTRY)) {
    if (city.includes(" ") && loc.includes(city)) return code;
  }

  // 2. Check for country name as a whole word in the location string
  for (const [name, code] of Object.entries(COUNTRY_NAMES)) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(loc)) return code;
  }

  // 3. Single-word city lookup
  const tokens = loc.split(/[\s,/|]+/);
  for (const token of tokens) {
    if (token.length < 3) continue;
    const hit = CITY_TO_COUNTRY[token];
    if (hit) return hit;
  }

  // 4. US state abbreviation fallback ("Jacksonville, FL")
  if (US_STATE_ABBREV.test(location)) return "us";

  return "";
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
