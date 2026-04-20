// ─── Country code → full name map (top discovery markets) ────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  se: "Sweden",
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  nl: "Netherlands",
  dk: "Denmark",
  no: "Norway",
  fi: "Finland",
  au: "Australia",
  ca: "Canada",
  sg: "Singapore",
  in: "India",
  jp: "Japan",
  br: "Brazil",
  es: "Spain",
  it: "Italy",
  pl: "Poland",
  ch: "Switzerland",
  be: "Belgium",
  at: "Austria",
  nz: "New Zealand",
  ie: "Ireland",
  pt: "Portugal",
  ae: "United Arab Emirates",
  za: "South Africa",
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
