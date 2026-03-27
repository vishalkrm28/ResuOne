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

type LineKind =
  | { type: "name"; text: string }
  | { type: "title"; text: string }        // person's current/applied-for title below name
  | { type: "contact"; text: string }      // contact bar
  | { type: "heading"; text: string }      // ALL-CAPS section heading
  | { type: "job"; company: string; jobTitle: string; dates: string }
  | { type: "bullet"; text: string }
  | { type: "body"; text: string }
  | { type: "blank" };

// ─── Patterns ─────────────────────────────────────────────────────────────────

const HEADING_RE = /^[A-Z][A-Z\s&\/\-]{2,}$/;
const BULLET_RE = /^[•\-\*]\s+(.+)$/;
// Job line: capital-starting text, pipe separator. Must be < 150 chars.
const JOB_RE = /^([A-Z0-9].{0,70}?)\s*\|\s*(.{2,})$/;
// Sections where job-line detection must be suppressed
const NON_JOB_SECTIONS = new Set([
  "PROFESSIONAL SUMMARY", "SUMMARY", "PROFILE",
  "OBJECTIVE", "CAREER OBJECTIVE", "ABOUT",
]);
// Contact signals: email, phone, linkedin, github, location hint
const CONTACT_RE = /@|linkedin\.com|github\.com|\+\d{2}|\b\d{10}\b|http/i;

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseLines(text: string): LineKind[] {
  const raw = text.split("\n").map((l) => l.trim());
  const result: LineKind[] = [];

  // ── Find the first ALL-CAPS section heading (skip line 0 — that's always the name)
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
  // Line 0: name
  // Line 1: may be their current/applied title (short, no @/http)
  // Remaining header lines: contact info
  const headerLines = raw.slice(0, headerEnd).filter((l) => l.length > 0);

  if (headerLines.length > 0) {
    result.push({ type: "name", text: headerLines[0] });
  }
  if (headerLines.length > 1) {
    // If line 1 looks like contact info, go straight to contact; otherwise it's a subtitle title
    const line1 = headerLines[1];
    if (CONTACT_RE.test(line1)) {
      result.push({ type: "contact", text: headerLines.slice(1).join("   ·   ") });
    } else {
      result.push({ type: "title", text: line1 });
      if (headerLines.length > 2) {
        result.push({ type: "contact", text: headerLines.slice(2).join("   ·   ") });
      }
    }
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  let currentSection: string | null = null;

  for (let i = headerEnd; i < raw.length; i++) {
    const trimmed = raw[i];

    if (!trimmed) {
      result.push({ type: "blank" });
      continue;
    }

    // Section heading (must be ALL-CAPS, 4–60 chars)
    if (trimmed.length >= 4 && trimmed.length <= 60 && HEADING_RE.test(trimmed)) {
      currentSection = trimmed;
      result.push({ type: "heading", text: trimmed });
      continue;
    }

    // Bullet
    const bulletMatch = BULLET_RE.exec(trimmed);
    if (bulletMatch) {
      result.push({ type: "bullet", text: bulletMatch[1] });
      continue;
    }

    // Job line — only in non-summary sections, and only if short enough
    const inJobSection = !NON_JOB_SECTIONS.has(currentSection ?? "");
    if (inJobSection && trimmed.length <= 150) {
      const jobMatch = JOB_RE.exec(trimmed);
      if (jobMatch) {
        const company = jobMatch[1].trim();
        const rest = jobMatch[2].trim();
        // Try to split rest into title | dates
        const restParts = rest.split(/\s*\|\s*/);
        const jobTitle = restParts[0].trim();
        const dates = restParts.slice(1).join(" – ").trim();
        result.push({ type: "job", company, jobTitle, dates });
        continue;
      }
    }

    result.push({ type: "body", text: trimmed });
  }

  return result;
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const NAVY     = "1e3a5f";
const NAVY_MID = "2d5a8e";
const RULE     = "c8d4e0";
const MUTED    = "666666";

// ─── DOCX Builder ─────────────────────────────────────────────────────────────

export async function buildDocxBuffer(
  cvText: string,
  _jobTitle: string,
  _company: string,
): Promise<Buffer> {
  const lines = parseLines(cvText);
  const children: Paragraph[] = [];

  for (const line of lines) {
    switch (line.type) {

      case "name":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, bold: true, size: 52, color: NAVY, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
        }));
        break;

      case "title":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, size: 26, color: NAVY_MID, font: "Calibri", italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
        }));
        break;

      case "contact":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, size: 18, color: MUTED, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          border: { bottom: { color: RULE, size: 4, style: BorderStyle.SINGLE, space: 8 } },
        }));
        break;

      case "heading":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, bold: true, size: 22, color: NAVY, font: "Calibri", allCaps: true })],
          spacing: { before: 300, after: 80 },
          border: { bottom: { color: NAVY_MID, size: 8, style: BorderStyle.SINGLE, space: 4 } },
        }));
        break;

      case "job":
        // Row 1: Company (bold left) + Dates (muted right)
        children.push(new Paragraph({
          children: [
            new TextRun({ text: line.company, bold: true, size: 22, color: "111111", font: "Calibri" }),
            new TextRun({ text: "\t", size: 22 }),
            new TextRun({ text: line.dates, size: 20, color: MUTED, italics: true, font: "Calibri" }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          spacing: { before: 140, after: 20 },
        }));
        // Row 2: Job title
        if (line.jobTitle) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.jobTitle, size: 20, color: NAVY_MID, font: "Calibri", italics: true })],
            spacing: { after: 60 },
          }));
        }
        break;

      case "bullet":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, size: 20, font: "Calibri" })],
          bullet: { level: 0 },
          spacing: { after: 40 },
          indent: { left: 360, hanging: 180 },
        }));
        break;

      case "body":
        children.push(new Paragraph({
          children: [new TextRun({ text: line.text, size: 20, font: "Calibri" })],
          spacing: { after: 80 },
        }));
        break;

      case "blank":
        children.push(new Paragraph({ spacing: { after: 40 } }));
        break;
    }
  }

  const doc = new Document({
    creator: "ParsePilot AI",
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } },
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
): string {
  const lines = parseLines(text);
  const pageTitle =
    docType === "cover"
      ? `Cover Letter — ${companyParam}`
      : `CV — ${jobTitleParam} at ${companyParam}`;

  const body = docType === "cover" ? renderCover(lines) : renderCv(lines);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(pageTitle)}</title>
<style>
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── Screen chrome ── */
body{font-family:'Calibri','Arial',sans-serif;font-size:11pt;line-height:1.6;
     color:#1a1a1a;background:#e8ecf0}

.banner{background:#1e3a5f;color:#fff;padding:10px 28px;
        display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.banner strong{font-size:13px}
.banner p{font-size:11px;opacity:.65;margin-top:1px}
.btn{background:#2d5a8e;color:#fff;border:none;padding:7px 20px;
     border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.btn:hover{background:#3a72b5}

/* ── Page card ── */
.doc{max-width:800px;margin:28px auto 56px;background:#fff;
     padding:52px 60px 56px;border-radius:4px;
     box-shadow:0 4px 28px rgba(0,0,0,.13)}

/* ── Header ── */
.cv-name{font-size:28pt;font-weight:700;color:#1e3a5f;
         text-align:center;letter-spacing:.015em;line-height:1.15;margin-bottom:4px}
.cv-sub-title{font-size:12pt;color:#2d5a8e;text-align:center;
              font-style:italic;margin-bottom:6px}
.cv-contact{font-size:9pt;color:#666;text-align:center;
            padding-bottom:13px;margin-bottom:20px;
            border-bottom:1.5px solid #c8d4e0}

/* ── Section heading ── */
.cv-section{margin-top:22px;margin-bottom:8px;padding-bottom:4px;
            border-bottom:2.5px solid #2d5a8e}
.cv-section span{font-size:9.5pt;font-weight:700;color:#1e3a5f;
                 letter-spacing:.12em;text-transform:uppercase}

/* ── Job entry ── */
.cv-job-header{display:flex;justify-content:space-between;
               align-items:baseline;margin-top:14px;margin-bottom:2px;gap:12px}
.cv-company{font-weight:700;font-size:10.5pt;color:#111;flex-shrink:0}
.cv-dates{font-size:9pt;color:#666;white-space:nowrap;font-style:italic}
.cv-role{font-size:10pt;color:#2d5a8e;font-style:italic;margin-bottom:5px}

/* ── Bullets ── */
.cv-bullets{margin:4px 0 6px 22px}
.cv-bullets li{font-size:10pt;margin-bottom:3px;line-height:1.5;list-style-type:disc}

/* ── Body text ── */
.cv-body{font-size:10pt;margin-bottom:5px;line-height:1.65;color:#1a1a1a}

/* ── Cover letter ── */
.cover-p{font-size:11pt;line-height:1.8;margin-bottom:1em}

/* ── Print overrides ── */
@media print{
  body{background:#fff}
  .banner{display:none!important}
  .doc{margin:0;padding:0;box-shadow:none;border-radius:0;max-width:100%}
  .cv-section{break-after:avoid}
  .cv-job-header{break-after:avoid}
}
@page{size:A4;margin:15mm 14mm}
</style>
</head>
<body>

<div class="banner">
  <div>
    <strong>ParsePilot AI — ${esc(pageTitle)}</strong>
    <p>Ctrl+P (Cmd+P on Mac) → Save as PDF. In print settings set margins to "None" or "Minimum".</p>
  </div>
  <button class="btn" onclick="window.print()">⬇ Save as PDF</button>
</div>

<div class="doc">
${body}
</div>

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

function renderCv(lines: LineKind[]): string {
  const out: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    out.push(`<ul class="cv-bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    bullets = [];
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
        out.push(`<div class="cv-contact">${esc(line.text)}</div>`);
        break;
      case "heading":
        out.push(`<div class="cv-section"><span>${esc(line.text)}</span></div>`);
        break;
      case "job":
        out.push(
          `<div class="cv-job-header">` +
          `<span class="cv-company">${esc(line.company)}</span>` +
          `<span class="cv-dates">${esc(line.dates)}</span>` +
          `</div>` +
          (line.jobTitle ? `<div class="cv-role">${esc(line.jobTitle)}</div>` : ""),
        );
        break;
      case "bullet":
        bullets.push(line.text);
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

function renderCover(lines: LineKind[]): string {
  return lines.map((line) => {
    if (line.type === "blank") return `<div style="margin-bottom:.5em"></div>`;
    const txt = "text" in line ? line.text : ("company" in line ? `${line.company} | ${line.jobTitle}` : "");
    return `<p class="cover-p">${esc(txt)}</p>`;
  }).join("\n");
}
