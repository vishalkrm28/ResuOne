import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  BorderStyle,
  TabStopType,
} from "docx";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactItem = {
  kind: "phone" | "email" | "linkedin" | "github" | "location" | "url";
  display: string;   // human-readable label
  href?: string;     // optional link (for HTML)
};

type LineKind =
  | { type: "name"; text: string }
  | { type: "title"; text: string }
  | { type: "contact"; items: ContactItem[] }
  | { type: "heading"; text: string; compact: boolean }
  | { type: "bullet"; text: string; compact: boolean }
  | { type: "job"; company: string; jobTitle: string; dates: string }
  | { type: "edu"; text: string; date?: string }   // education entry (institution or degree+date)
  | { type: "body"; text: string }
  | { type: "blank" };

// ─── Patterns ─────────────────────────────────────────────────────────────────

const HEADING_RE = /^[A-Z][A-Z\s&\/\-]{2,}$/;
const BULLET_RE  = /^[•\-\*▸►▶–]\s+(.+)$/;   // accept common bullet chars incl. dash/em-dash
const JOB_RE     = /^([A-Z0-9].{0,70}?)\s*\|\s*(.{2,})$/;

// Realistic date-range pattern (1900–2099). Used for education date extraction
// and for detecting when a JOB_RE second segment is a date not a title.
const YEAR    = "(?:19|20)\\d{2}";
const MON_YR  = `(?:\\d{1,2}\\/${YEAR})`;  // MM/YYYY
const DATE_PART = `(?:${MON_YR}|${YEAR})`;
const DATE_RANGE_RE = new RegExp(
  `^${DATE_PART}(?:\\s*[-–]\\s*(?:${DATE_PART}|[Pp]resent))?$`,
);
// Matches a date at the END of an education line (with or without preceding space).
// Restricted to 1900–2099 to avoid false positives on large numbers.
const EDU_DATE_RE = new RegExp(
  `\\s*(${MON_YR}(?:\\s*[-–]\\s*(?:${MON_YR}|[Pp]resent))?|${YEAR}(?:\\s*[-–]\\s*(?:${YEAR}|[Pp]resent))?)\\s*$`,
);
const CONTACT_RE = /@|linkedin\.com|github\.com|\+\d{2}|\b\d{9,}\b|http/i;

// Phone: +31 682349489  or  +1 (555) 123-4567  or  0612345678
const PHONE_RE    = /^\+?[\d][\d\s\-().]{6,18}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_RE = /linkedin\.com/i;
const GITHUB_RE   = /github\.com/i;

// Known section heading names — prevents all-caps skill abbreviations and entity
// names from being misclassified as section headings inside non-compact sections.
const KNOWN_SECTIONS = new Set([
  "PROFESSIONAL SUMMARY", "SUMMARY", "EXECUTIVE SUMMARY", "PROFILE",
  "OBJECTIVE", "CAREER OBJECTIVE", "PROFESSIONAL OBJECTIVE", "ABOUT",
  "WORK EXPERIENCE", "EXPERIENCE", "PROFESSIONAL EXPERIENCE",
  "EMPLOYMENT HISTORY", "CAREER HISTORY", "WORK HISTORY",
  "EDUCATION", "ACADEMIC BACKGROUND", "ACADEMIC QUALIFICATIONS",
  "QUALIFICATIONS", "ACADEMIC HISTORY", "TRAINING", "TRAINING & DEVELOPMENT",
  "PROFESSIONAL DEVELOPMENT", "COURSES", "ONLINE COURSES",
  "SKILLS", "TECHNICAL SKILLS", "KEY SKILLS", "CORE SKILLS", "HARD SKILLS", "SOFT SKILLS",
  "CORE COMPETENCIES", "COMPETENCIES", "AREAS OF EXPERTISE", "EXPERTISE",
  "CERTIFICATIONS", "CERTIFICATION", "LICENCES", "LICENSES", "CERTIFICATES",
  "AWARDS", "HONOURS", "HONORS", "ACHIEVEMENTS",
  "LANGUAGES",
  "INTERESTS", "HOBBIES", "VOLUNTEER EXPERIENCE", "VOLUNTEERING",
  "PROJECTS", "SIDE PROJECTS", "PERSONAL PROJECTS", "KEY PROJECTS",
  "PUBLICATIONS", "REFERENCES", "EXTRA-CURRICULAR ACTIVITIES",
  "ADDITIONAL INFORMATION", "ADDITIONAL", "PROFESSIONAL AFFILIATIONS",
]);

// Compact sections — bullets/plain lines rendered inline, dot-separated
const COMPACT_SECTIONS = new Set([
  "SKILLS", "TECHNICAL SKILLS", "KEY SKILLS", "CORE SKILLS", "HARD SKILLS", "SOFT SKILLS",
  "CORE COMPETENCIES", "COMPETENCIES", "AREAS OF EXPERTISE", "EXPERTISE",
  "CERTIFICATIONS", "CERTIFICATION", "LICENCES", "LICENSES", "CERTIFICATES",
  "LANGUAGES", "INTERESTS", "HOBBIES", "AWARDS", "HONOURS", "HONORS", "ACHIEVEMENTS",
]);

// Sections where job-line (JOB_RE pipe-format) detection is suppressed
const NON_JOB_SECTIONS = new Set([
  "PROFESSIONAL SUMMARY", "SUMMARY", "EXECUTIVE SUMMARY", "PROFILE",
  "OBJECTIVE", "CAREER OBJECTIVE", "PROFESSIONAL OBJECTIVE", "ABOUT",
]);

// Sections where all-caps sub-lines must NOT become headings.
// Applies to any section where entity names (institutions, companies, project names)
// might appear in ALL CAPS but are content, not section headings.
const SUPPRESS_SUBHEADING_SECTIONS = new Set([
  "EDUCATION", "ACADEMIC BACKGROUND", "ACADEMIC QUALIFICATIONS",
  "QUALIFICATIONS", "ACADEMIC HISTORY", "TRAINING", "TRAINING & DEVELOPMENT",
  "PROFESSIONAL DEVELOPMENT", "COURSES", "ONLINE COURSES",
  "PROJECTS", "SIDE PROJECTS", "PERSONAL PROJECTS", "KEY PROJECTS",
  "PUBLICATIONS", "EXTRA-CURRICULAR ACTIVITIES",
]);

// Education-type sections — within these, plain lines get the "edu" line type
// (date extraction + institution/degree formatting). Subset of SUPPRESS_SUBHEADING_SECTIONS.
const EDU_SECTIONS = new Set([
  "EDUCATION", "ACADEMIC BACKGROUND", "ACADEMIC QUALIFICATIONS",
  "QUALIFICATIONS", "ACADEMIC HISTORY",
]);

// ─── Contact tokeniser ────────────────────────────────────────────────────────

/**
 * PDF text extractors frequently concatenate contact fields with no spaces.
 * This pre-processor inserts spaces at known boundaries before we tokenise:
 *   "682349489VISHALKRM@GMAIL.COMHTTPS://linkedin…ALMERE"
 *   → "682349489 VISHALKRM@GMAIL.COM HTTPS://linkedin…ALMERE"
 */
function preNormalizeContact(s: string): string {
  return s
    // Space before https?:// when directly attached to the previous token
    .replace(/(?<=[^\s])(https?:\/\/)/gi, " $1")
    // Space between a run of digits and a following letter-then-@ sequence
    // Catches "682349489VISHALKRM@…" → "682349489 VISHALKRM@…"
    .replace(/(\d)([A-Za-z][^\s@]*@)/g, "$1 $2")
    // Space before a bare "linkedin" or "github" keyword if preceded by non-space
    .replace(/(?<=[^\s])(linkedin\.com|github\.com)/gi, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Takes one or more raw contact lines (e.g. "+31 682… vishalkrm@gmail.com https://…linkedin… Almere")
 * and returns a structured list of ContactItem, one per piece of info.
 */
function parseContactItems(rawLines: string[]): ContactItem[] {
  // Flatten, pre-normalise to separate concatenated fields, then split on whitespace.
  const flat = preNormalizeContact(rawLines.join(" "));
  const tokens = flat.split(/\s+/).filter(Boolean);

  // Pass 1 — re-merge phone fragments: "+31" separated from "682349489"
  const pass1: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("+") && /^\+\d{1,4}$/.test(t)) {
      let phone = t;
      while (i + 1 < tokens.length && /^\d[\d\-().]{3,14}$/.test(tokens[i + 1])) {
        phone += " " + tokens[++i];
      }
      pass1.push(phone);
    } else {
      pass1.push(t);
    }
  }

  // Pass 2 — re-merge split URL fragments.
  // PDF extractors sometimes insert spaces inside a URL (e.g. "HTTPS://WWW." + "LINKEDIN.COM/…").
  // Merge a URL token with following tokens whenever it ends with "." or "/" (clearly incomplete).
  const merged: string[] = [];
  for (let i = 0; i < pass1.length; i++) {
    const t = pass1[i];
    if (/^https?:\/\//i.test(t)) {
      let url = t;
      while ((url.endsWith(".") || url.endsWith("/") || url.endsWith("//")) && i + 1 < pass1.length) {
        url += pass1[++i];
      }
      merged.push(url);
    } else {
      merged.push(t);
    }
  }

  // Classify each token
  const items: ContactItem[] = [];
  const locationBuf: string[] = [];

  for (const tok of merged) {
    if (!tok.trim()) continue;

    const tokLower = tok.toLowerCase();
    if (LINKEDIN_RE.test(tok)) {
      let url = /^https?:\/\//i.test(tok) ? tokLower : `https://${tokLower}`;
      // Strip trailing plain-word path segments that look like a city/location glued on
      // by the PDF extractor (e.g. "linkedin.com/in/nitishkrm/almere" → strip "almere").
      // LinkedIn profile URLs are "linkedin.com/in/{slug}" — anything extra is noise.
      // Save the stripped word so we can add it as a location item.
      let strippedCity = "";
      url = url.replace(/(linkedin\.com\/in\/[^/]+)\/?([a-z]{3,})\s*$/, (_m, base, city) => {
        strippedCity = city;
        return base;
      });
      if (strippedCity) locationBuf.push(strippedCity);
      const label = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      items.push({ kind: "linkedin", display: label, href: url });
    } else if (GITHUB_RE.test(tok)) {
      const url = /^https?:\/\//i.test(tok) ? tok.toLowerCase() : `https://${tokLower}`;
      const label = tokLower.replace(/^https?:\/\//, "").replace(/\/$/, "");
      items.push({ kind: "github", display: label, href: url });
    } else if (/^https?:\/\//i.test(tok)) {
      items.push({ kind: "url", display: tokLower, href: tokLower });
    } else if (EMAIL_RE.test(tok)) {
      items.push({ kind: "email", display: tokLower, href: `mailto:${tokLower}` });
    } else if (PHONE_RE.test(tok)) {
      items.push({ kind: "phone", display: tok });
    } else {
      // Accumulate as location
      locationBuf.push(tok);
    }
  }

  // Flush location (trim trailing punctuation / label artifacts like "LinkedIn:")
  const loc = locationBuf
    .filter((w) => !/^(linkedin|github|email|phone|tel|website):?$/i.test(w))
    .join(" ").trim();
  if (loc) {
    // Insert location first (before phone/email) for a natural left-to-right order
    items.unshift({ kind: "location", display: loc });
  }

  return items;
}

/**
 * Merge text-parsed ContactItems with AI-extracted parsedCvJson data.
 *
 * Strategy:
 *  • Text-parsing (raw CV) is the base — it catches everything, including URLs
 *    that span multiple tokens in the original PDF.
 *  • parsedCvJson overrides individual fields (location, phone, email) with
 *    clean, AI-normalised values so fragmented fragments are fixed.
 *  • linkedin/github from parsedCvJson are ADDED if not already present in the
 *    text-parsed list — this covers new applications where the AI extracted
 *    them cleanly. For old applications without parsedCvJson.linkedin the
 *    text-parsed URL is kept unchanged.
 *
 * The merge never removes an item; it only replaces or appends.
 */
function mergeContactItems(
  textItems: ContactItem[],
  parsedCv: Record<string, unknown>,
): ContactItem[] {
  // Work on a mutable copy
  const merged: ContactItem[] = textItems.map((i) => ({ ...i }));

  const replaceOrAppend = (item: ContactItem, atFront = false) => {
    const idx = merged.findIndex((i) => i.kind === item.kind);
    if (idx >= 0) {
      merged[idx] = item;
    } else {
      atFront ? merged.unshift(item) : merged.push(item);
    }
  };

  // Override location, phone, email with clean AI-extracted values
  const loc = typeof parsedCv.location === "string" ? parsedCv.location.trim() : null;
  if (loc) replaceOrAppend({ kind: "location", display: loc }, true);

  const phone = typeof parsedCv.phone === "string" ? parsedCv.phone.trim() : null;
  if (phone) replaceOrAppend({ kind: "phone", display: phone });

  const email = typeof parsedCv.email === "string" ? parsedCv.email.trim().toLowerCase() : null;
  if (email) replaceOrAppend({ kind: "email", display: email, href: `mailto:${email}` });

  // linkedin/github: add from AI if not already present from text-parsing
  const linkedin = typeof parsedCv.linkedin === "string" ? parsedCv.linkedin.trim() : null;
  if (linkedin) {
    const url = /^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`;
    replaceOrAppend({ kind: "linkedin", display: linkedin.replace(/^https?:\/\//i, ""), href: url });
  }

  const github = typeof parsedCv.github === "string" ? parsedCv.github.trim() : null;
  if (github) {
    const url = /^https?:\/\//i.test(github) ? github : `https://${github}`;
    replaceOrAppend({ kind: "github", display: github.replace(/^https?:\/\//i, ""), href: url });
  }

  return merged;
}

// ─── CV line parser ───────────────────────────────────────────────────────────

function parseLines(text: string): LineKind[] {
  const raw = text.split("\n").map((l) => l.trim());
  const result: LineKind[] = [];

  // Find first ALL-CAPS section heading (skip line 0 = always the name)
  let firstHeadingIdx = -1;
  for (let i = 1; i < raw.length; i++) {
    const l = raw[i];
    if (l.length >= 4 && l.length <= 60 && HEADING_RE.test(l)) {
      firstHeadingIdx = i;
      break;
    }
  }
  const headerEnd = firstHeadingIdx === -1 ? raw.length : firstHeadingIdx;

  // ── Header block ───────────────────────────────────────────────────────────
  const headerLines = raw.slice(0, headerEnd).filter((l) => l.length > 0);

  if (headerLines.length === 0) {
    // nothing to do
  } else {
    // Line 0: always the name
    result.push({ type: "name", text: headerLines[0] });

    if (headerLines.length > 1) {
      const line1 = headerLines[1];
      const line1HasContact = CONTACT_RE.test(line1);

      if (!line1HasContact && line1.length <= 80) {
        // Line 1 is a role/title subtitle
        result.push({ type: "title", text: line1 });
        // Remaining lines = contact
        const contactRaw = headerLines.slice(2);
        if (contactRaw.length) {
          result.push({ type: "contact", items: parseContactItems(contactRaw) });
        }
      } else {
        // Line 1 already has contact info — no separate title
        result.push({ type: "contact", items: parseContactItems(headerLines.slice(1)) });
      }
    }
  }

  // ── Body: from first heading onwards ──────────────────────────────────────
  let isCompact            = false;
  let isJobSection         = true;
  let isSuppressSubheading = false; // true inside EDUCATION/PROJECTS/etc. — prevents all-caps heading false positives
  let isEduSection         = false; // true only inside EDUCATION-type sections — triggers edu line type

  for (let i = headerEnd; i < raw.length; i++) {
    const trimmed = raw[i];

    if (!trimmed) {
      result.push({ type: "blank" });
      continue;
    }

    // Section heading detection
    const looksLikeHeading =
      trimmed.length >= 4 &&
      trimmed.length <= 60 &&
      HEADING_RE.test(trimmed);
    const isKnownSection = KNOWN_SECTIONS.has(trimmed);

    // Promote to heading only when:
    //   • it's a known section name (always safe), OR
    //   • we're NOT in a compact section AND NOT in a suppress-subheading section.
    // Without the latter guard, institution names like "ANTWERP MANAGEMENT SCHOOL"
    // and project names in ALL CAPS would be wrongly treated as section headings.
    if (looksLikeHeading && (isKnownSection || (!isCompact && !isSuppressSubheading))) {
      isCompact            = COMPACT_SECTIONS.has(trimmed);
      isJobSection         = !NON_JOB_SECTIONS.has(trimmed);
      isSuppressSubheading = SUPPRESS_SUBHEADING_SECTIONS.has(trimmed);
      isEduSection         = EDU_SECTIONS.has(trimmed);
      result.push({ type: "heading", text: trimmed, compact: isCompact });
      continue;
    }

    // Bullet (explicit prefix: •, -, *, ▸, ►, ▶, –)
    const bm = BULLET_RE.exec(trimmed);
    if (bm) {
      result.push({ type: "bullet", text: bm[1].trim(), compact: isCompact });
      continue;
    }

    // Plain line inside a compact section (AI often emits skills without bullet char)
    if (isCompact) {
      result.push({ type: "bullet", text: trimmed, compact: true });
      continue;
    }

    // ── Education entries — checked BEFORE JOB_RE so pipe-format degree lines
    //    ("Bachelor of Science | 2018") don't get misclassified as job entries. ──
    if (isEduSection) {
      // 1. "Degree | Year" or "Degree | Date Range" — explicit pipe separator
      const pipeIdx = trimmed.lastIndexOf(" | ");
      if (pipeIdx >= 0) {
        const afterPipe = trimmed.slice(pipeIdx + 3).trim();
        if (DATE_RANGE_RE.test(afterPipe)) {
          result.push({ type: "edu", text: trimmed.slice(0, pipeIdx).trim(), date: afterPipe });
          continue;
        }
      }
      // 2. End-of-line date — handles concatenated formats like "Management06/2018"
      const dm = EDU_DATE_RE.exec(trimmed);
      if (dm) {
        const date = dm[1].trim();
        const text = trimmed.slice(0, trimmed.length - dm[0].length).trim();
        result.push({ type: "edu", text, date });
      } else {
        result.push({ type: "edu", text: trimmed });
      }
      continue;
    }

    // Job line (pipe-separated: "Company | Title | Date range")
    // Only applies outside summary-type and compact sections.
    if (isJobSection && trimmed.length <= 150) {
      const jm = JOB_RE.exec(trimmed);
      if (jm) {
        const parts = jm[2].split(/\s*\|\s*/);
        let jobTitle = "";
        let dates = "";
        if (parts.length >= 2) {
          // Standard 3-part format: Title | Date range
          jobTitle = parts[0].trim();
          dates    = parts.slice(1).join(" – ").trim();
        } else if (DATE_RANGE_RE.test(parts[0])) {
          // Second segment is a date range (no separate title field)
          dates = parts[0].trim();
        } else {
          // Single second field — treat as title, no date on this line
          jobTitle = parts[0].trim();
        }
        result.push({ type: "job", company: jm[1].trim(), jobTitle, dates });
        continue;
      }
    }

    // All other sections (PROJECTS, PUBLICATIONS, etc.) — use body type
    result.push({ type: "body", text: trimmed });
  }

  return result;
}

// ─── Style tokens — matches on-screen tailored CV renderer ────────────────────
// Primary:  #6E42F0  (hsl 255 85% 60% — app purple)
// Text:     #111827  (near-black)
// Body:     #374151  (dark grey)
// Muted:    #6B7280  (subdued labels / dates)
// Border:   #E5E7EB  (divider lines)
// Font:     Calibri (DOCX) / system sans-serif (HTML)

const CL_NEAR_BLACK = "111827";   // headings, name, company
const CL_CHARCOAL   = "374151";   // body text, bullets
const CL_GOLD       = "6E42F0";   // purple accent — section rules, role text, icons
const CL_PARCHMENT  = "E5E7EB";   // divider / separator lines
const CL_GREY       = "6B7280";   // dates, muted labels
const CL_FONT       = "Calibri";  // sans-serif matches UI

// Legacy aliases kept to avoid touching HTML render path
const NAVY     = CL_NEAR_BLACK;
const NAVY_MID = CL_GOLD;
const RULE     = CL_PARCHMENT;
const MUTED    = CL_GREY;

// ─── Cover letter parser ──────────────────────────────────────────────────────

interface CoverLetterParts {
  salutation: string;          // "Dear Hiring Manager,"
  paragraphs: string[];        // body paragraphs
  signOffLine: string;         // "Kind regards,"
  signOffName: string;         // candidate name
}

/**
 * Parses AI-generated cover letter text into discrete sections.
 * Expected format:
 *   Dear Hiring Manager,
 *   <blank>
 *   Paragraph one text...
 *   <blank>
 *   Paragraph two text...
 *   <blank>
 *   Kind regards,
 *   Candidate Name
 */
function parseCoverLetter(text: string): CoverLetterParts {
  const lines = text.split("\n");
  let salutation = "Dear Hiring Manager,";
  let signOffLine = "Kind regards,";
  let signOffName = "";
  const paragraphs: string[] = [];

  let i = 0;

  // Find salutation
  while (i < lines.length) {
    const l = lines[i].trim();
    if (/^dear\b/i.test(l)) { salutation = l; i++; break; }
    i++;
  }

  // Find sign-off block (from the end)
  let end = lines.length - 1;
  while (end >= 0 && !lines[end].trim()) end--;
  // Last non-blank line = name
  if (end >= 0 && !/^(kind regards|sincerely|yours (sincerely|faithfully|truly)|best regards)/i.test(lines[end].trim())) {
    signOffName = lines[end].trim();
    end--;
  }
  // Second-to-last non-blank = sign-off phrase
  while (end >= 0 && !lines[end].trim()) end--;
  if (end >= 0 && /^(kind regards|sincerely|yours|best regards)/i.test(lines[end].trim())) {
    signOffLine = lines[end].trim();
    end--;
  }

  // Everything between salutation and sign-off = paragraphs
  let buf = "";
  for (let j = i; j <= end; j++) {
    const l = lines[j].trim();
    if (!l) {
      if (buf) { paragraphs.push(buf); buf = ""; }
    } else {
      buf = buf ? buf + " " + l : l;
    }
  }
  if (buf) paragraphs.push(buf);

  return { salutation, paragraphs, signOffLine, signOffName };
}

// ─── DOCX Builder ─────────────────────────────────────────────────────────────

export async function buildDocxBuffer(
  cvText: string,
  _jobTitle: string,
  _company: string,
  coverLetterText?: string,
  parsedCvJson?: Record<string, unknown>,
): Promise<Buffer> {
  // ── Cover letter DOCX ──────────────────────────────────────────────────────
  if (coverLetterText !== undefined) {
    return buildCoverDocx(coverLetterText, cvText, _company);
  }
  const lines = parseLines(cvText);
  // Merge text-parsed contact items with AI-extracted structured data
  if (parsedCvJson) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].type === "contact") {
        const merged = mergeContactItems(
          (lines[i] as { type: "contact"; items: ContactItem[] }).items,
          parsedCvJson,
        );
        lines[i] = { type: "contact", items: merged };
        break;
      }
    }
  }
  const children: Paragraph[] = [];

  let compactBuf: string[] = [];
  let regularBuf: string[] = [];

  const flushCompact = () => {
    if (!compactBuf.length) return;
    children.push(new Paragraph({
      children: [new TextRun({ text: compactBuf.join("  ·  "), size: 20, font: CL_FONT, color: CL_CHARCOAL })],
      spacing: { after: 60 },
    }));
    compactBuf = [];
  };

  const flushRegular = () => {
    if (!regularBuf.length) return;
    for (const b of regularBuf) {
      children.push(new Paragraph({
        children: [new TextRun({ text: b, size: 20, font: CL_FONT, color: CL_CHARCOAL })],
        bullet: { level: 0 },
        spacing: { after: 30 },
        indent: { left: 360, hanging: 180 },
      }));
    }
    regularBuf = [];
  };

  // Contact icon prefixes for DOCX
  const contactIcon: Record<ContactItem["kind"], string> = {
    location: "⊙  ",
    phone:    "☏  ",
    email:    "✉  ",
    linkedin: "in  ",
    github:   "⌥  ",
    url:      "🌐  ",
  };

  for (const line of lines) {
    if (line.type !== "bullet") { flushCompact(); flushRegular(); }

    switch (line.type) {
      case "name":
        // Large name in near-black
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, bold: true, size: 52, color: CL_NEAR_BLACK, font: CL_FONT })],
          alignment: AlignmentType.CENTER, spacing: { after: 60 },
        }));
        // Short gold accent bar below name
        children.push(new Paragraph({
          children: [new TextRun({ text: "", size: 4 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          border: { bottom: { color: CL_GOLD, size: 8, style: BorderStyle.SINGLE, space: 4 } },
          indent: { left: 3200, right: 3200 },
        }));
        break;

      case "title":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, size: 22, color: CL_GREY, font: CL_FONT, italics: true })],
          alignment: AlignmentType.CENTER, spacing: { after: 60 },
        }));
        break;

      case "contact": {
        const runs: TextRun[] = [];
        line.items.forEach((item, idx) => {
          if (idx > 0) runs.push(new TextRun({ text: "   ·   ", size: 16, color: CL_PARCHMENT, font: CL_FONT }));
          runs.push(new TextRun({
            text: `${contactIcon[item.kind]}${item.display.toUpperCase()}`,
            size: 15, color: CL_GREY, font: CL_FONT,
          }));
        });
        children.push(new Paragraph({
          children: runs,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          border: { bottom: { color: CL_PARCHMENT, size: 4, style: BorderStyle.SINGLE, space: 8 } },
        }));
        break;
      }

      case "heading":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, bold: true, size: 20, color: CL_NEAR_BLACK, font: CL_FONT, allCaps: true })],
          spacing: { before: 280, after: 80 },
          border: { bottom: { color: CL_GOLD, size: 6, style: BorderStyle.SINGLE, space: 4 } },
        }));
        break;

      case "job": {
        const datesText = (line.dates ?? "").trim();
        children.push(new Paragraph({
          children: [
            new TextRun({ text: line.company, bold: true, size: 22, color: CL_NEAR_BLACK, font: CL_FONT }),
            ...(datesText
              ? [
                  new TextRun({ text: "\t", size: 22 }),
                  new TextRun({ text: datesText, size: 19, color: CL_GREY, italics: true, font: CL_FONT }),
                ]
              : []),
          ],
          tabStops: datesText ? [{ type: TabStopType.RIGHT, position: 9360 }] : [],
          spacing: { before: 120, after: 20 },
        }));
        if (line.jobTitle) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.jobTitle, size: 20, color: CL_GOLD, font: CL_FONT, italics: true })],
            spacing: { after: 50 },
          }));
        }
        break;
      }

      case "bullet":
        if (line.compact) compactBuf.push(line.text);
        else regularBuf.push(line.text);
        break;

      case "edu":
        flushCompact();
        flushRegular();
        if (line.date) {
          // Degree line: text left, date right-aligned via tab stop
          children.push(new Paragraph({
            children: [
              new TextRun({ text: line.text, size: 20, font: CL_FONT, color: CL_CHARCOAL }),
              new TextRun({ text: "\t", size: 19 }),
              new TextRun({ text: line.date, size: 19, color: CL_GREY, italics: true, font: CL_FONT }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
            spacing: { before: 20, after: 40 },
          }));
        } else {
          // Institution name: bold like a company name
          children.push(new Paragraph({
            children: [new TextRun({ text: line.text, bold: true, size: 22, color: CL_NEAR_BLACK, font: CL_FONT })],
            spacing: { before: 120, after: 20 },
          }));
        }
        break;

      case "body":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, size: 20, font: CL_FONT, color: CL_CHARCOAL })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60 },
        }));
        break;

      case "blank":
        children.push(new Paragraph({ spacing: { after: 30 } }));
        break;
    }
  }
  flushCompact();
  flushRegular();

  const doc = new Document({
    creator: "ParsePilot AI",
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 1008, right: 1440, bottom: 1008, left: 1440 } } },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── Cover letter DOCX ────────────────────────────────────────────────────────

async function buildCoverDocx(
  coverText: string,
  cvText: string,
  company: string,
): Promise<Buffer> {
  const cvLines  = parseLines(cvText);
  const { salutation, paragraphs, signOffLine, signOffName } = parseCoverLetter(coverText);

  // Extract name and contact from CV header lines
  const nameLine = cvLines.find((l) => l.type === "name");
  const titleLine = cvLines.find((l) => l.type === "title");
  const contactLine = cvLines.find((l) => l.type === "contact");
  const candidateName = nameLine?.text ?? signOffName ?? "";
  const displayName   = signOffName || candidateName;

  const children: Paragraph[] = [];

  const candidateTitle = titleLine?.text ?? "";

  // ── Candidate name — large, spaced, near-black ───────────────────────────
  children.push(new Paragraph({
    children: [new TextRun({
      text: candidateName, bold: true, size: 52,
      color: CL_NEAR_BLACK, font: CL_FONT,
    })],
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
  }));

  // ── Gold accent rule below name (thin full-width border on an empty para) ─
  children.push(new Paragraph({
    children: [new TextRun({ text: "", size: 4 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    border: { bottom: { color: CL_GOLD, size: 8, style: BorderStyle.SINGLE, space: 4 } },
    // Indent left+right to centre a short rule (~52px)
    indent: { left: 3200, right: 3200 },
  }));

  // ── Professional title ────────────────────────────────────────────────────
  if (titleLine) {
    children.push(new Paragraph({
      children: [new TextRun({ text: titleLine.text, size: 22, color: CL_GREY, italics: true, font: CL_FONT })],
      alignment: AlignmentType.CENTER, spacing: { after: 60 },
    }));
  }

  // ── Contact bar — subtle, uppercase-spaced ────────────────────────────────
  if (contactLine) {
    const contactIcon: Record<ContactItem["kind"], string> = {
      location: "⊙  ", phone: "☏  ", email: "✉  ", linkedin: "in  ", github: "⌥  ", url: "⊕  ",
    };
    const runs: TextRun[] = [];
    contactLine.items.forEach((item, idx) => {
      if (idx > 0) runs.push(new TextRun({ text: "   ·   ", size: 16, color: CL_PARCHMENT, font: CL_FONT }));
      runs.push(new TextRun({
        text: `${contactIcon[item.kind]}${item.display.toUpperCase()}`,
        size: 15, color: CL_GREY, font: CL_FONT,
      }));
    });
    children.push(new Paragraph({
      children: runs,
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }));
  }

  // ── Warm parchment divider ────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [],
    spacing: { before: 80, after: 360 },
    border: { bottom: { color: CL_PARCHMENT, size: 4, style: BorderStyle.SINGLE, space: 8 } },
  }));

  // ── Date — right-aligned, italic ─────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  children.push(new Paragraph({
    children: [new TextRun({ text: dateStr, size: 20, font: CL_FONT, color: CL_GREY, italics: true })],
    alignment: AlignmentType.RIGHT, spacing: { after: 300 },
  }));

  // ── Recipient block ───────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [new TextRun({
      text: "HIRING MANAGER", size: 16, bold: true,
      font: CL_FONT, color: CL_GREY,
    })],
    spacing: { after: 40 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: company, size: 24, font: CL_FONT, color: CL_NEAR_BLACK, italics: true })],
    spacing: { after: 300 },
  }));

  // ── Salutation ────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [new TextRun({ text: salutation, size: 24, font: CL_FONT, color: CL_NEAR_BLACK })],
    spacing: { after: 260 },
  }));

  // ── Body paragraphs — justified, Georgia serif ────────────────────────────
  for (const para of paragraphs) {
    children.push(new Paragraph({
      children: [new TextRun({ text: para, size: 23, font: CL_FONT, color: CL_CHARCOAL })],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 220 },
    }));
  }

  // ── Sign-off ──────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [new TextRun({ text: signOffLine, size: 23, font: CL_FONT, color: CL_CHARCOAL })],
    spacing: { before: 320, after: 600 },   // 600 twips ≈ handwritten-signature space
  }));
  // Signature line — gold-tinted
  children.push(new Paragraph({
    children: [new TextRun({ text: "", size: 22 })],
    spacing: { after: 100 },
    border: { bottom: { color: "C4B99A", size: 4, style: BorderStyle.SINGLE, space: 4 } },
    indent: { right: 7500 },   // restrict line width to ~150px
  }));
  // Name — bold, larger
  children.push(new Paragraph({
    children: [new TextRun({ text: displayName, bold: true, size: 28, color: CL_NEAR_BLACK, font: CL_FONT })],
    spacing: { after: candidateTitle ? 40 : 0 },
  }));
  // Title — italic, muted
  if (candidateTitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: candidateTitle, size: 20, font: CL_FONT, color: CL_GREY, italics: true })],
      spacing: { after: 0 },
    }));
  }

  const doc = new Document({
    creator: "ParsePilot AI",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── HTML / PDF Builder ───────────────────────────────────────────────────────

export function buildPrintHtml(
  text: string,
  jobTitleParam: string,
  companyParam: string,
  docType: "cv" | "cover",
  cvText?: string,                        // for cover letters: source CV
  parsedCvJson?: Record<string, unknown>, // structured CV data — preferred contact source
): string {
  const pageTitle =
    docType === "cover"
      ? `Cover Letter — ${companyParam}`
      : `CV — ${jobTitleParam} at ${companyParam}`;

  let body: string;
  if (docType === "cover") {
    body = renderCoverLetter(text, cvText ?? "", companyParam);
  } else {
    const lines = parseLines(text);
    // Merge text-parsed contact items with AI-extracted structured data.
    // Text-parsing is the base (catches everything inc. PDF-split URLs).
    // parsedCvJson overrides clean fields and adds any AI-detected URLs
    // not found by the text parser (e.g. LinkedIn missing from raw text).
    if (parsedCvJson) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].type === "contact") {
          const merged = mergeContactItems(
            (lines[i] as { type: "contact"; items: ContactItem[] }).items,
            parsedCvJson,
          );
          lines[i] = { type: "contact", items: merged };
          break;
        }
      }
    }
    body = renderCv(lines);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(pageTitle)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ════════════════════════════════════════════════════
   PALETTE — matches on-screen tailored CV renderer
     #111827  near-black  — name, headings, company
     #374151  body text   — bullets, paragraphs
     #6E42F0  purple      — section rule, role text, icons (app primary)
     #6B7280  muted grey  — dates, contact labels, sub-title
     #E5E7EB  light grey  — divider lines, borders
   Font: system sans-serif (Calibri/Segoe UI/Arial)
   ════════════════════════════════════════════════════ */

body{font-family:'Calibri','Segoe UI',system-ui,-apple-system,Arial,sans-serif;
     font-size:11pt;line-height:1.6;color:#374151;background:#f3f4f6}


/* ── Page — A4 proportions on screen ── */
.doc{
  width:794px;max-width:100%;
  margin:24px auto 52px;
  background:#fff;
  padding:56px 80px 64px;
  border-radius:4px;
  box-shadow:0 2px 20px rgba(0,0,0,.12);
}

/* ── CV Header ── */
.cv-name{
  font-family:'Calibri','Segoe UI',Arial,sans-serif;
  font-size:24pt;font-weight:700;color:#111827;
  letter-spacing:-.01em;line-height:1.15;margin-bottom:6px;
}

.cv-sub-title{
  font-size:10.5pt;color:#6B7280;margin-bottom:8px;
}

/* Contact bar — compact, left-aligned, purple icons */
.cv-contact-bar{
  display:flex;flex-wrap:wrap;align-items:center;
  gap:2px 0;
  padding-bottom:10px;margin-bottom:14px;
  border-bottom:1px solid #E5E7EB;
  font-size:8pt;color:#6B7280;
}
.cv-ci{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;padding:0 8px}
.cv-ci:first-child{padding-left:0}
.cv-ci a{color:#6B7280;text-decoration:none}
.cv-ci a:hover{color:#6E42F0;text-decoration:underline}
.cv-ci-icon{
  display:inline-flex;align-items:center;justify-content:center;
  width:14px;height:14px;font-size:9pt;flex-shrink:0;
  color:#6E42F0;
}
.ci-li{background:#0a66c2;color:#fff!important;border-radius:2px;
       font-size:6.5pt;font-weight:700;letter-spacing:0;padding:1px 2px;width:auto;height:auto}
.ci-gh{background:#1a1a1a;color:#fff!important;border-radius:2px;
       font-size:6.5pt;font-weight:700;padding:1px 2px;width:auto;height:auto}
.cv-ci-sep{color:#E5E7EB;font-size:9pt;padding:0 2px}

/* ── Section heading — purple small-caps label + thin rule beneath ── */
.cv-section{
  display:flex;align-items:center;gap:10px;
  margin-top:16px;margin-bottom:5px;
}
.cv-section span{
  font-size:7.5pt;font-weight:800;color:#6E42F0;
  letter-spacing:.18em;text-transform:uppercase;
  white-space:nowrap;flex-shrink:0;
}
.cv-section-rule{flex:1;height:1px;background:#E5E7EB}

/* ── Job entry ── */
.cv-job-header{display:flex;justify-content:space-between;
               align-items:baseline;margin-top:9px;margin-bottom:1px;gap:12px}
.cv-company{font-weight:700;font-size:10pt;color:#111827}
.cv-dates{font-size:8.5pt;color:#6B7280;white-space:nowrap;flex-shrink:0}
.cv-role{font-size:9.5pt;font-weight:600;color:#6E42F0;margin-bottom:3px}

/* ── Education entry ── */
.cv-edu-institution{font-weight:700;font-size:10pt;color:#111827;margin-top:9px;margin-bottom:1px}
.cv-edu-institution + .cv-job-header{margin-top:2px!important}
.cv-edu-text{font-size:9.5pt;color:#374151}

/* ── Regular bullets ── */
.cv-bullets{margin:3px 0 4px 16px}
.cv-bullets li{font-size:9.5pt;margin-bottom:2px;line-height:1.55;list-style-type:disc;color:#374151}

/* ── Compact inline skills/certs ── */
.cv-tags{font-size:9.5pt;color:#374151;line-height:1.7;margin-bottom:2px}
.cv-tag-sep{color:#9CA3AF;margin:0 4px}

/* ── Body paragraph (summary, etc.) ── */
.cv-body{font-size:9.5pt;margin-bottom:4px;line-height:1.7;color:#374151}

/* ════════════════════════════════════════════════════
   COVER LETTER — clean sans-serif business letter
   Matching the same purple + grey palette as CV
   ════════════════════════════════════════════════════ */

.cl-wrap{font-family:'Calibri','Segoe UI',Arial,sans-serif}

/* ── Candidate name ── */
.cl-name{
  font-size:24pt;font-weight:700;color:#111827;
  letter-spacing:-.01em;line-height:1.15;margin-bottom:6px;
}
.cl-name-bar{
  width:40px;height:3px;
  background:#6E42F0;
  margin-bottom:10px;border-radius:2px;
}
.cl-sub-title{
  font-size:10.5pt;color:#6B7280;margin-bottom:8px;
}

/* Contact bar — shared styles, no bottom border for cover letter */
.cl-wrap .cv-contact-bar{
  border-bottom:none;padding-bottom:4px;
}

/* ── Horizontal divider ── */
.cl-divider{
  border:none;border-top:1px solid #E5E7EB;
  margin:8px 0 28px;
}

/* ── Date ── */
.cl-date{
  font-size:9.5pt;color:#6B7280;
  text-align:right;
  margin-bottom:24px;
}

/* ── Recipient block ── */
.cl-recipient{margin-bottom:20px;line-height:1.6}
.cl-recipient-label{
  font-size:7.5pt;font-weight:700;
  color:#9CA3AF;letter-spacing:.1em;
  text-transform:uppercase;
  display:block;margin-bottom:2px;
}
.cl-recipient-company{
  font-size:11pt;color:#111827;font-weight:600;
}

/* ── Salutation ── */
.cl-salutation{
  font-size:11pt;color:#111827;font-weight:500;
  margin-top:4px;margin-bottom:22px;
}

/* ── Body paragraphs ── */
.cl-para{
  font-size:11pt;line-height:1.85;
  color:#374151;
  margin-bottom:18px;
}

/* ── Sign-off ── */
.cl-sign-off{margin-top:40px}
.cl-sign-off-phrase{
  font-size:11pt;color:#374151;
  margin-bottom:48px;
}
.cl-sig-line{
  width:180px;border-top:2px solid #6E42F0;
  margin-bottom:10px;border-radius:1px;
}
.cl-sign-name{
  font-weight:700;font-size:13pt;
  color:#111827;
}
.cl-sign-title{
  font-size:9.5pt;color:#6B7280;
  margin-top:3px;
}

/* ── Print overrides ── */
@media print{
  body{background:#fff}
  /* @page margins handle spacing on every page incl. overflow pages */
  .doc{margin:0;padding:0;box-shadow:none;border-radius:0;width:100%;max-width:100%}
  .cv-ci a{color:#6B7280!important}
  .cv-section{break-after:avoid;page-break-after:avoid}
  .cv-job-header{break-after:avoid;page-break-after:avoid}
  .cv-edu-institution{break-after:avoid;page-break-after:avoid}
  .cv-bullets li{text-align:left}
}
/* Proper margins applied to every page (including overflow pages).
   In Chrome print dialog → uncheck "Headers and footers" to hide the URL strip. */
@page{size:A4;margin:18mm 22mm}
</style>
</head>
<body>
<div class="doc">${body}</div>
<script>
if(!window.location.search.includes('noprint')){
  window.addEventListener('load',()=>setTimeout(()=>window.print(),700));
}
</script>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Unicode/text icons for each contact kind */
const CONTACT_ICONS: Record<ContactItem["kind"], string> = {
  location: "&#9673;",   // ⊙ filled circle
  phone:    "&#9743;",   // ☏ telephone
  email:    "&#9993;",   // ✉ envelope
  linkedin: "",          // rendered as badge below
  github:   "",          // rendered as badge below
  url:      "&#127760;", // 🌐
};

function renderContactBar(items: ContactItem[]): string {
  if (!items.length) return "";

  const parts = items.map((item, idx) => {
    let icon = "";
    if (item.kind === "linkedin") {
      icon = `<span class="cv-ci-icon ci-li">in</span>`;
    } else if (item.kind === "github") {
      icon = `<span class="cv-ci-icon ci-gh">gh</span>`;
    } else {
      icon = `<span class="cv-ci-icon">${CONTACT_ICONS[item.kind]}</span>`;
    }

    const label = item.href
      ? `<a href="${esc(item.href)}" target="_blank" rel="noopener">${esc(item.display)}</a>`
      : esc(item.display);

    const sep = idx > 0 ? `<span class="cv-ci-sep">|</span>` : "";
    return `${sep}<span class="cv-ci">${icon}${label}</span>`;
  });

  return `<div class="cv-contact-bar">${parts.join("")}</div>`;
}

function renderCv(lines: LineKind[]): string {
  const out: string[] = [];
  let regularBullets: string[] = [];
  let compactBullets: string[] = [];

  const flushBullets = () => {
    if (regularBullets.length) {
      out.push(
        `<ul class="cv-bullets">${regularBullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`,
      );
      regularBullets = [];
    }
    if (compactBullets.length) {
      const inner = compactBullets
        .map((b, i) =>
          i < compactBullets.length - 1
            ? `${esc(b)}<span class="cv-tag-sep">·</span>`
            : esc(b),
        )
        .join(" ");
      out.push(`<p class="cv-tags">${inner}</p>`);
      compactBullets = [];
    }
  };

  for (const line of lines) {
    if (line.type !== "bullet") flushBullets();

    switch (line.type) {
      case "name":
        out.push(`<div class="cv-name">${esc(line.text)}</div>`);
        break;
      case "title":
        out.push(`<div class="cv-sub-title">${esc(line.text)}</div>`);
        break;
      case "contact":
        out.push(renderContactBar(line.items));
        break;
      case "heading":
        out.push(`<div class="cv-section"><span>${esc(line.text)}</span><div class="cv-section-rule"></div></div>`);
        break;
      case "job": {
        const datePart = line.dates ? `<span class="cv-dates">${esc(line.dates)}</span>` : "";
        out.push(
          `<div class="cv-job-header">` +
          `<span class="cv-company">${esc(line.company)}</span>` +
          datePart +
          `</div>` +
          (line.jobTitle ? `<div class="cv-role">${esc(line.jobTitle)}</div>` : ""),
        );
        break;
      }
      case "edu":
        if (line.date) {
          // Degree line: text left, date right-aligned — same layout as job header
          out.push(
            `<div class="cv-job-header">` +
            `<span class="cv-edu-text">${esc(line.text)}</span>` +
            `<span class="cv-dates">${esc(line.date)}</span>` +
            `</div>`,
          );
        } else {
          // Institution name: bold, like a company name
          out.push(`<div class="cv-edu-institution">${esc(line.text)}</div>`);
        }
        break;
      case "bullet":
        if (line.compact) compactBullets.push(line.text);
        else regularBullets.push(line.text);
        break;
      case "body":
        out.push(`<p class="cv-body">${esc(line.text)}</p>`);
        break;
      case "blank":
        break;
    }
  }

  flushBullets();
  return out.join("\n");
}

/**
 * Renders the cover letter as a proper business letter layout.
 * @param coverText  Raw AI-generated cover letter text
 * @param cvText     Source CV text (used to extract candidate name/contact for the header)
 * @param company    Company name for the recipient block
 */
function renderCoverLetter(coverText: string, cvText: string, company: string): string {
  const { salutation, paragraphs, signOffLine, signOffName } = parseCoverLetter(coverText);

  // Extract header from CV
  const cvLines = parseLines(cvText);
  const nameLine    = cvLines.find((l) => l.type === "name");
  const titleLine   = cvLines.find((l) => l.type === "title");
  const contactLine = cvLines.find((l) => l.type === "contact");
  const candidateName = nameLine?.text ?? signOffName ?? "";
  const displayName   = signOffName || candidateName;

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const candidateTitle = titleLine?.text ?? "";

  const out: string[] = [];

  // ── Open root wrapper (inherits serif, scopes contact-bar overrides) ──────
  out.push(`<div class="cl-wrap">`);

  // ── Candidate header — elegant serif treatment ────────────────────────────
  if (candidateName) {
    out.push(`<div class="cl-name">${esc(candidateName)}</div>`);
    out.push(`<div class="cl-name-bar"></div>`);   // short gold accent bar
  }
  if (titleLine)   out.push(`<div class="cl-sub-title">${esc(titleLine.text)}</div>`);
  if (contactLine) out.push(renderContactBar(contactLine.items));  // overridden by .cl-wrap selectors

  // ── Warm parchment divider ────────────────────────────────────────────────
  out.push(`<hr class="cl-divider">`);

  // ── Date (right-aligned, italic) ─────────────────────────────────────────
  out.push(`<p class="cl-date">${esc(dateStr)}</p>`);

  // ── Recipient block ───────────────────────────────────────────────────────
  out.push(
    `<div class="cl-recipient">` +
    `<span class="cl-recipient-label">Hiring Manager</span>` +
    `<div class="cl-recipient-company">${esc(company)}</div>` +
    `</div>`,
  );

  // ── Salutation ────────────────────────────────────────────────────────────
  out.push(`<p class="cl-salutation">${esc(salutation)}</p>`);

  // ── Body paragraphs ───────────────────────────────────────────────────────
  for (const para of paragraphs) {
    out.push(`<p class="cl-para">${esc(para)}</p>`);
  }

  // ── Sign-off: phrase → blank space → signature line → name → title ───────
  out.push(
    `<div class="cl-sign-off">` +
    `<p class="cl-sign-off-phrase">${esc(signOffLine)}</p>` +
    `<div class="cl-sig-line"></div>` +
    `<p class="cl-sign-name">${esc(displayName)}</p>` +
    (candidateTitle ? `<p class="cl-sign-title">${esc(candidateTitle)}</p>` : ``) +
    `</div>`,
  );

  out.push(`</div>`);  // close .cl-wrap

  return out.join("\n");
}
