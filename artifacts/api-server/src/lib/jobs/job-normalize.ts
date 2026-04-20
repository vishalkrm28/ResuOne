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

const COUNTRY_HINTS: Array<{ pattern: RegExp; country: string }> = [
  // ── Remote / global (check first so "Remote, Belgium" → remote) ────────────
  { pattern: /\bremote\b|\banywhere\b|\bglobal\b|\bworldwide\b|\bwork from home\b|\bwfh\b/i, country: "remote" },

  // ── Europe ────────────────────────────────────────────────────────────────
  { pattern: /\bbelgium\b|\bbel?gi[eë]\b|\bbrussels?\b|\bbr[uü]ssel\b|\bantwerp(en)?\b|\bgent\b|\bghent\b|\bli[eè]ge\b|\blur?ik\b|\bleuven\b|\blouvain\b|\bbruges?\b|\bbrugge\b|\bnamur\b|\bcharleroi\b|\bmechelen\b|\bmons\b|\baalst\b|\bgenk\b|\bhasselt\b|\bkortrijk\b|\bostend\b|\boosten(de)?\b/i, country: "be" },
  { pattern: /\bgermany\b|\bdeutschland\b|\bberlin\b|\bhamburg\b|\bm[uü]nchen\b|\bmunich\b|\bfrankfurt\b|\bcologne\b|\bk[oö]ln\b|\bstuttgart\b|\bd[uü]sseldorf\b|\bleipzig\b|\bdortmund\b|\bessen\b|\bnuremberg\b|\bn[uü]rnberg\b|\bbremen\b|\bhanover\b|\bhannover\b/i, country: "de" },
  { pattern: /\bfrance\b|\bparis\b|\blyon\b|\bmarseille\b|\btoulouse\b|\bnice\b|\bnantes\b|\bstrasbourg\b|\bmontpellier\b|\bbordeaux\b|\blille\b|\brennes\b|\breims\b|\bgrenoble\b/i, country: "fr" },
  { pattern: /\bnetherlands\b|\bholland\b|\bnederland\b|\bamsterdam\b|\brotterdam\b|\bthe hague\b|\bden haag\b|\butrecht\b|\beindhoven\b|\bgroningen\b|\btilburg\b|\bbreda\b|\bapeldoorn\b/i, country: "nl" },
  { pattern: /\bspain\b|\bespa[nñ]a\b|\bmadrid\b|\bbarcelona\b|\bvalencia\b|\bseville\b|\bsevilla\b|\bzaragoza\b|\bm[aá]laga\b|\bbilbao\b|\balicante\b|\bcordoba\b|\bvalladolid\b/i, country: "es" },
  { pattern: /\bital[yi]\b|\bitalia\b|\brome\b|\broma\b|\bmilan[oe]?\b|\bnaples\b|\bnapoli\b|\bturin\b|\btorino\b|\bpalermo\b|\bgenoa\b|\bgenova\b|\bbologna\b|\bflorence\b|\bfirenze\b/i, country: "it" },
  { pattern: /\bsweden\b|\bsverige\b|\bstockholm\b|\bgothenburg\b|\bg[oö]teborg\b|\bmalm[oö]\b|\buppsala\b|\blink[oö]ping\b/i, country: "se" },
  { pattern: /\bnorway\b|\bnorge\b|\boslo\b|\bbergen\b|\btrondheim\b|\bstavanger\b/i, country: "no" },
  { pattern: /\bdenmark\b|\bdanmark\b|\bcopenhagen\b|\bk[oø]benhavn\b|\baarhus\b|\bodense\b/i, country: "dk" },
  { pattern: /\bfinland\b|\bsuomi\b|\bhelsinki\b|\bespoo\b|\btampere\b|\bturku\b/i, country: "fi" },
  { pattern: /\bswitzerland\b|\bschweiz\b|\bzurich\b|\bz[uü]rich\b|\bgeneva\b|\bgen[eè]ve\b|\bbern\b|\bbasel\b|\blausanne\b/i, country: "ch" },
  { pattern: /\baustria\b|\b[oö]sterreich\b|\bvienna\b|\bwien\b|\bgraz\b|\blinz\b|\bsalzburg\b|\binnsbruck\b/i, country: "at" },
  { pattern: /\bunited kingdom\b|\buk\b|\bgreat britain\b|\bengland\b|\bscotland\b|\bwales\b|\blondon\b|\bmanchester\b|\bedinburgh\b|\bbirmingham\b|\bglasgow\b|\bleeds\b|\bbristol\b|\bliverpool\b|\bsheffield\b|\bcambridge\b|\boxford\b|\bnotting(ham)?\b|\bbrighton\b/i, country: "gb" },
  { pattern: /\bireland\b|\b[eé]ire\b|\bdublin\b|\bcork\b|\bgalway\b|\blimerick\b/i, country: "ie" },
  { pattern: /\bportugal\b|\blisbon\b|\blisboa\b|\bporto\b|\bbraga\b|\bcoimbra\b/i, country: "pt" },
  { pattern: /\bpoland\b|\bpolska\b|\bwarsaw\b|\bwarszawa\b|\bkrak[oó]w\b|\bwroclaw\b|\bwr[oó]claw\b|\bpozna[nń]\b|\bgda[nń]sk\b|\blod[zź]\b/i, country: "pl" },
  { pattern: /\bczech\b|\bczechia\b|\bprague\b|\bpraha\b|\bbrno\b|\bostrava\b/i, country: "cz" },
  { pattern: /\bhungary\b|\bmagyarorsz[aá]g\b|\bbudapest\b|\bdebrecen\b/i, country: "hu" },
  { pattern: /\bromania\b|\bbucharest\b|\bbucure[sș]ti\b|\bcluj\b|\btimiș?oara\b/i, country: "ro" },
  { pattern: /\bgreece\b|\bathens\b|\bathina\b|\bthessaloniki\b/i, country: "gr" },

  // ── Americas ──────────────────────────────────────────────────────────────
  // US state abbreviations first (e.g. "Jacksonville, FL")
  {
    pattern: /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/i,
    country: "us",
  },
  { pattern: /\bunited states\b|\busa\b|\bu\.s\.a\b|\bnew york\b|\bsan francisco\b|\blos angeles\b|\bchicago\b|\bseattle\b|\baustin\b|\bdenver\b|\batlanta\b|\bboston\b|\bmiami\b|\bhouston\b|\bdallas\b|\bphoenix\b|\bportland\b|\bnashville\b|\bminneapolis\b|\bdetroit\b|\bcolumbus\b|\bcharlotte\b|\blas vegas\b|\bsalt lake\b|\bphiladelphia\b|\bsan diego\b|\bsan jose\b|\bpittsburgh\b|\bcleveland\b|\braleigh\b|\bmemphis\b|\blouisville\b|\bkansas city\b|\bindianapolis\b|\bbaltimore\b|\bmilwaukee\b|\bnew orleans\b|\btucson\b|\bfresno\b|\bsacramento\b|\bmesa\b|\bomaha\b|\bvirginiabeach\b/i, country: "us" },
  { pattern: /\bcanada\b|\btoronto\b|\bvancouver\b|\bmontreal\b|\bcalgary\b|\bottawa\b|\bedmonton\b|\bwinnipeg\b|\bquebec\b|\bhamilton\b|\bkitchener\b/i, country: "ca" },
  { pattern: /\bbrazil\b|\bbrasil\b|\bs[aã]o paulo\b|\brio de janeiro\b|\bbras[ií]lia\b|\bcuritiba\b|\bfortaleza\b|\bbelo horizonte\b|\bmanaus\b|\brecife\b/i, country: "br" },
  { pattern: /\bmexico\b|\bm[eé]xico\b|\bmexico city\b|\bguadalajara\b|\bmonterrey\b|\bpuebla\b|\btijuana\b|\bc[uú]liac[aá]n\b|\bm[eé]rida\b/i, country: "mx" },
  { pattern: /\bargentina\b|\bbuenos aires\b|\bc[oó]rdoba\b|\brosario\b|\bmendon?za\b/i, country: "ar" },
  { pattern: /\bchile\b|\bsantiago\b|\bvalpara[ií]so\b/i, country: "cl" },
  { pattern: /\bcolombia\b|\bbogot[aá]\b|\bmedellin\b|\bmedell[ií]n\b|\bcali\b/i, country: "co" },

  // ── Asia-Pacific ──────────────────────────────────────────────────────────
  { pattern: /\bjapan\b|\bnihon\b|\btokyo\b|\bosaka\b|\bkyoto\b|\byokohama\b|\bnagoya\b|\bsapporo\b|\bfukuoka\b|\bkobe\b/i, country: "jp" },
  { pattern: /\bchina\b|\bzhongguo\b|\bbeijing\b|\bshanghai\b|\bshenzhen\b|\bguangzhou\b|\bchengdu\b|\bwuhan\b|\btianjin\b|\bxi'?an\b|\bhangzhou\b|\bnanjing\b/i, country: "cn" },
  { pattern: /\bsouth korea\b|\bkorea\b|\bkorean\b|\bseoul\b|\bincheon\b|\bbusan\b|\bdaejeon\b|\bdaegu\b/i, country: "kr" },
  { pattern: /\bindia\b|\bbangalore\b|\bbengaluru\b|\bmumbai\b|\bbombay\b|\bnew delhi\b|\bdelhi\b|\bhyderabad\b|\bchennai\b|\bmadras\b|\bkolkata\b|\bcalcutta\b|\bpune\b|\bahmedabad\b|\bnoida\b|\bgurgaon\b/i, country: "in" },
  { pattern: /\baustralia\b|\bsydney\b|\bmelbourne\b|\bbrisbane\b|\bperth\b|\badelaide\b|\bcanberra\b|\bgold coast\b/i, country: "au" },
  { pattern: /\bnew zealand\b|\bauckland\b|\bwellington\b|\bchristchurch\b|\bhamilton\b/i, country: "nz" },
  { pattern: /\bsingapore\b/i, country: "sg" },
  { pattern: /\bhong kong\b/i, country: "hk" },
  { pattern: /\btaiwan\b|\btaipei\b/i, country: "tw" },
  { pattern: /\bthailand\b|\bbangkok\b|\bchiang mai\b/i, country: "th" },
  { pattern: /\bindonesia\b|\bjakarta\b|\bsurabaya\b|\bbandung\b/i, country: "id" },
  { pattern: /\bmalaysia\b|\bkuala lumpur\b|\bpenang\b/i, country: "my" },
  { pattern: /\bphilippines\b|\bmanila\b|\bcebu\b/i, country: "ph" },
  { pattern: /\bvietnam\b|\bho chi minh\b|\bhanoi\b/i, country: "vn" },

  // ── Middle East & Africa ──────────────────────────────────────────────────
  { pattern: /\buae\b|\bunited arab emirates\b|\bdubai\b|\babu dhabi\b|\bsharjah\b/i, country: "ae" },
  { pattern: /\bisrael\b|\btel aviv\b|\bjerusalem\b|\bhaifa\b/i, country: "il" },
  { pattern: /\bsaudi arabia\b|\briyadh\b|\bjeddah\b|\bdammam\b/i, country: "sa" },
  { pattern: /\bsouth africa\b|\bjohannesburg\b|\bcape town\b|\bdurban\b|\bpretoria\b/i, country: "za" },
  { pattern: /\begypt\b|\bcairo\b|\balexandria\b/i, country: "eg" },
  { pattern: /\bkenya\b|\bnairobi\b/i, country: "ke" },
  { pattern: /\bnigeria\b|\blagos\b|\babuja\b/i, country: "ng" },
];

export function inferCountry(location: string, queryCountry = ""): string {
  if (queryCountry) return queryCountry;
  for (const { pattern, country } of COUNTRY_HINTS) {
    if (pattern.test(location)) return country;
  }
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
