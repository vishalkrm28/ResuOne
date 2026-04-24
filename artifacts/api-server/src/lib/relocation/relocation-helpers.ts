// ─── Generic helpers for the relocation engine ───────────────────────────────

/** Lowercase + trim + collapse spaces + remove accents */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Normalize a city name for DB lookup */
export function normalizeCityName(city: string): string {
  return normalizeText(city)
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a country name or ISO code for DB lookup */
export function normalizeCountryName(country: string): string {
  const map: Record<string, string> = {
    uk: "united kingdom",
    gb: "united kingdom",
    us: "united states",
    usa: "united states",
    de: "germany",
    nl: "netherlands",
    se: "sweden",
    dk: "denmark",
    fr: "france",
    ch: "switzerland",
    no: "norway",
    ie: "ireland",
    sg: "singapore",
    ae: "united arab emirates",
    uae: "united arab emirates",
    au: "australia",
    ca: "canada",
    nz: "new zealand",
    pl: "poland",
    cz: "czech republic",
    hu: "hungary",
    fi: "finland",
    be: "belgium",
    at: "austria",
    es: "spain",
    it: "italy",
    pt: "portugal",
    jp: "japan",
    kr: "south korea",
    hk: "hong kong",
    tw: "taiwan",
    cn: "china",
  };
  const normalized = normalizeText(country).replace(/[^a-z0-9 ]/g, "").trim();
  return map[normalized] ?? normalized;
}

/** Clamp a number to [min, max] */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Round to N decimal places */
export function round(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/** Convert numeric string or number to number, or return null */
export function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}

/** Normalize job title for benchmark lookup */
export function normalizeJobTitle(title: string): string {
  return normalizeText(title)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
