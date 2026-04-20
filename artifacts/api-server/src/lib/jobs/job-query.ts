// ─── Country code → full name map ────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  af: "Afghanistan",
  al: "Albania",
  dz: "Algeria",
  ao: "Angola",
  ar: "Argentina",
  am: "Armenia",
  au: "Australia",
  at: "Austria",
  az: "Azerbaijan",
  bh: "Bahrain",
  bd: "Bangladesh",
  by: "Belarus",
  be: "Belgium",
  bz: "Belize",
  bo: "Bolivia",
  ba: "Bosnia and Herzegovina",
  bw: "Botswana",
  br: "Brazil",
  bn: "Brunei",
  bg: "Bulgaria",
  kh: "Cambodia",
  cm: "Cameroon",
  ca: "Canada",
  cl: "Chile",
  cn: "China",
  co: "Colombia",
  cd: "Congo (DRC)",
  cr: "Costa Rica",
  hr: "Croatia",
  cu: "Cuba",
  cy: "Cyprus",
  cz: "Czech Republic",
  dk: "Denmark",
  do: "Dominican Republic",
  ec: "Ecuador",
  eg: "Egypt",
  sv: "El Salvador",
  ee: "Estonia",
  et: "Ethiopia",
  fi: "Finland",
  fr: "France",
  ge: "Georgia",
  de: "Germany",
  gh: "Ghana",
  gr: "Greece",
  gt: "Guatemala",
  hn: "Honduras",
  hk: "Hong Kong",
  hu: "Hungary",
  is: "Iceland",
  in: "India",
  id: "Indonesia",
  iq: "Iraq",
  ie: "Ireland",
  il: "Israel",
  it: "Italy",
  jm: "Jamaica",
  jp: "Japan",
  jo: "Jordan",
  kz: "Kazakhstan",
  ke: "Kenya",
  kw: "Kuwait",
  kg: "Kyrgyzstan",
  la: "Laos",
  lv: "Latvia",
  lb: "Lebanon",
  ly: "Libya",
  lt: "Lithuania",
  lu: "Luxembourg",
  mo: "Macao",
  mk: "North Macedonia",
  my: "Malaysia",
  mv: "Maldives",
  mt: "Malta",
  mx: "Mexico",
  md: "Moldova",
  mn: "Mongolia",
  me: "Montenegro",
  ma: "Morocco",
  mz: "Mozambique",
  mm: "Myanmar",
  na: "Namibia",
  np: "Nepal",
  nl: "Netherlands",
  nz: "New Zealand",
  ni: "Nicaragua",
  ng: "Nigeria",
  no: "Norway",
  om: "Oman",
  pk: "Pakistan",
  pa: "Panama",
  py: "Paraguay",
  pe: "Peru",
  ph: "Philippines",
  pl: "Poland",
  pt: "Portugal",
  pr: "Puerto Rico",
  qa: "Qatar",
  ro: "Romania",
  ru: "Russia",
  rw: "Rwanda",
  sa: "Saudi Arabia",
  sn: "Senegal",
  rs: "Serbia",
  sg: "Singapore",
  sk: "Slovakia",
  si: "Slovenia",
  za: "South Africa",
  kr: "South Korea",
  es: "Spain",
  lk: "Sri Lanka",
  se: "Sweden",
  ch: "Switzerland",
  tw: "Taiwan",
  tj: "Tajikistan",
  tz: "Tanzania",
  th: "Thailand",
  tn: "Tunisia",
  tr: "Turkey",
  tm: "Turkmenistan",
  ug: "Uganda",
  ua: "Ukraine",
  ae: "United Arab Emirates",
  gb: "United Kingdom",
  us: "United States",
  uy: "Uruguay",
  uz: "Uzbekistan",
  ve: "Venezuela",
  vn: "Vietnam",
  ye: "Yemen",
  zm: "Zambia",
  zw: "Zimbabwe",
};

/** Normalize a country code to its full English name for query use. */
export function normalizeCountryInput(country: string): string {
  if (!country) return "";
  const code = country.toLowerCase().trim();
  return COUNTRY_NAMES[code] ?? country;
}

/** Returns the Google Jobs `gl` parameter (two-letter country code). */
export function toGlParam(country: string): string {
  if (!country) return "";
  const code = country.toLowerCase().trim();
  if (code.length === 2) return code;
  const entry = Object.entries(COUNTRY_NAMES).find(
    ([, name]) => name.toLowerCase() === code,
  );
  return entry ? entry[0] : "";
}

/** Whether the search should add a "remote" modifier. */
export function shouldUseRemoteModifier(remoteOnly: boolean): boolean {
  return remoteOnly === true;
}

/**
 * Build the primary Google Jobs query string.
 *
 * Examples:
 *   query="software engineer", country="se", location="Stockholm"
 *   => "software engineer Stockholm Sweden"
 *
 *   query="product manager", remoteOnly=true
 *   => "product manager remote"
 */
export function buildGoogleJobsQuery({
  query,
  country = "",
  location = "",
  remoteOnly = false,
}: {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
}): string {
  const parts: string[] = [query.trim()];

  if (remoteOnly) {
    parts.push("remote");
  } else {
    if (location) parts.push(location.trim());
    if (country) {
      const countryName = normalizeCountryInput(country);
      // Only add country name if it's not already in the query or location
      const combined = `${query} ${location}`.toLowerCase();
      if (countryName && !combined.includes(countryName.toLowerCase())) {
        parts.push(countryName);
      }
    }
  }

  return parts.filter(Boolean).join(" ");
}

/**
 * Build multiple search phrases for broader coverage:
 * - bare query (already country-aware via Google `gl`)
 * - location-qualified query
 * - remote fallback when remoteOnly
 */
export function buildCountryAwareSearchPhrases({
  query,
  country = "",
  location = "",
  remoteOnly = false,
}: {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
}): string[] {
  const primary = buildGoogleJobsQuery({ query, country, location, remoteOnly });
  const phrases: string[] = [primary];

  if (!remoteOnly && location) {
    const withoutLocation = buildGoogleJobsQuery({ query, country, remoteOnly });
    if (withoutLocation !== primary) phrases.push(withoutLocation);
  }

  return [...new Set(phrases)];
}

/** General-purpose discovery query builder (used by non-SerpApi sources). */
export function buildDiscoveryQuery({
  query,
  country = "",
  location = "",
  remoteOnly = false,
}: {
  query: string;
  country?: string;
  location?: string;
  remoteOnly?: boolean;
}): { queryString: string; countryName: string; glParam: string } {
  return {
    queryString: buildGoogleJobsQuery({ query, country, location, remoteOnly }),
    countryName: normalizeCountryInput(country),
    glParam: toGlParam(country),
  };
}
