import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  BorderStyle,
  TabStopType,
  TabStopLeader,
  UnderlineType,
} from "docx";

// ─── CV Text Parser ───────────────────────────────────────────────────────────
// Turns the AI's plain-text CV into a structured list of typed lines.

type LineKind =
  | { type: "name"; text: string }
  | { type: "contact"; text: string }
  | { type: "heading"; text: string }
  | { type: "job"; company: string; titleAndDate: string; full: string }
  | { type: "bullet"; text: string }
  | { type: "body"; text: string }
  | { type: "blank" };

const HEADING_RE = /^[A-Z][A-Z\s&\/\-]{2,}$/;
const BULLET_RE = /^[•\-\*]\s+(.+)$/;
const JOB_RE = /^(.+?)\s*[|\/\\]\s*(.+)$/;
const CONTACT_RE = /[@|]\s|linkedin\.com|github\.com|\+\d|\d{3}[-.\s]\d{3}|\bphone\b|\bemail\b/i;

function parseLines(text: string): LineKind[] {
  const raw = text.split("\n");
  const result: LineKind[] = [];
  let nameFound = false;
  let contactFound = false;

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const trimmed = line.trim();

    if (!trimmed) {
      result.push({ type: "blank" });
      continue;
    }

    // First non-blank line: candidate name
    if (!nameFound) {
      nameFound = true;
      result.push({ type: "name", text: trimmed });
      continue;
    }

    // Second/third lines: contact info (email, phone, location, LinkedIn)
    if (!contactFound && (CONTACT_RE.test(trimmed) || (i < 5 && trimmed.length < 120))) {
      contactFound = true;
      result.push({ type: "contact", text: trimmed });
      continue;
    }

    // All-caps section heading
    if (HEADING_RE.test(trimmed) && trimmed.length < 60) {
      result.push({ type: "heading", text: trimmed });
      continue;
    }

    // Bullet point
    const bulletMatch = BULLET_RE.exec(trimmed);
    if (bulletMatch) {
      result.push({ type: "bullet", text: bulletMatch[1] });
      continue;
    }

    // Job/role line with pipe or slash separator
    const jobMatch = JOB_RE.exec(trimmed);
    if (jobMatch) {
      const parts = trimmed.split(/\s*[|\/\\]\s*/);
      const company = parts[0].trim();
      const rest = parts.slice(1).join("  ·  ");
      result.push({ type: "job", company, titleAndDate: rest, full: trimmed });
      continue;
    }

    result.push({ type: "body", text: trimmed });
  }

  return result;
}

// ─── ACCENT COLOR (dark navy blue) ───────────────────────────────────────────
const ACCENT = "1e3a5f";
const ACCENT_LIGHT = "2d5a8e";
const RULE_COLOR = "c8d4e0";
const TEXT_MUTED = "555555";

// ─── DOCX Builder ────────────────────────────────────────────────────────────

export async function buildDocxBuffer(
  cvText: string,
  jobTitle: string,
  company: string,
): Promise<Buffer> {
  const lines = parseLines(cvText);
  const children: Paragraph[] = [];

  for (const line of lines) {
    switch (line.type) {
      case "name":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                size: 44,
                color: ACCENT,
                font: "Calibri",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
        );
        break;

      case "contact":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                size: 18,
                color: TEXT_MUTED,
                font: "Calibri",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            border: {
              bottom: {
                color: RULE_COLOR,
                size: 4,
                style: BorderStyle.SINGLE,
                space: 6,
              },
            },
          }),
        );
        break;

      case "heading":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                size: 24,
                color: ACCENT,
                font: "Calibri",
                allCaps: true,
              }),
            ],
            spacing: { before: 320, after: 100 },
            border: {
              bottom: {
                color: ACCENT_LIGHT,
                size: 8,
                style: BorderStyle.SINGLE,
                space: 4,
              },
            },
          }),
        );
        break;

      case "job":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.company,
                bold: true,
                size: 22,
                color: "1a1a1a",
                font: "Calibri",
              }),
              new TextRun({
                text: "    ",
                size: 22,
              }),
              new TextRun({
                text: line.titleAndDate,
                size: 20,
                color: TEXT_MUTED,
                font: "Calibri",
                italics: true,
              }),
            ],
            spacing: { before: 140, after: 60 },
          }),
        );
        break;

      case "bullet":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                size: 20,
                font: "Calibri",
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 40 },
            indent: { left: 360 },
          }),
        );
        break;

      case "body":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                size: 20,
                font: "Calibri",
              }),
            ],
            spacing: { after: 80 },
          }),
        );
        break;

      case "blank":
        children.push(new Paragraph({ spacing: { after: 80 } }));
        break;
    }
  }

  const doc = new Document({
    creator: "ParsePilot AI",
    title: `${jobTitle} — ${company} CV`,
    description: "ATS-optimized CV generated by ParsePilot AI",
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 20,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 900,
              bottom: 720,
              left: 900,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ─── Print-optimized HTML Builder ────────────────────────────────────────────

export function buildPrintHtml(
  text: string,
  title: string,
  company: string,
  docType: "cv" | "cover",
): string {
  const lines = parseLines(text);
  const pageTitle =
    docType === "cover" ? `Cover Letter — ${company}` : `CV — ${title} at ${company}`;

  const bodyHtml = renderHtmlBody(lines, docType);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(pageTitle)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Calibri', 'Cambria', 'Georgia', serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1a1a1a;
      background: #eef1f4;
    }

    /* ── Top banner (screen only) ── */
    .print-banner {
      background: #1e3a5f;
      color: #fff;
      padding: 12px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .print-banner strong { font-size: 14px; }
    .print-banner p { font-size: 12px; opacity: 0.75; margin-top: 2px; }
    .print-btn {
      background: #2d5a8e;
      color: #fff;
      border: none;
      padding: 8px 22px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .print-btn:hover { background: #3a72b5; }

    /* ── Document card ── */
    .document {
      max-width: 820px;
      margin: 28px auto 48px;
      background: #fff;
      padding: 52px 60px;
      border-radius: 4px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }

    /* ── Header block ── */
    .cv-name {
      font-size: 26pt;
      font-weight: 700;
      color: #1e3a5f;
      text-align: center;
      letter-spacing: 0.02em;
      margin-bottom: 6px;
      line-height: 1.2;
    }
    .cv-contact {
      font-size: 9.5pt;
      color: #555;
      text-align: center;
      padding-bottom: 14px;
      margin-bottom: 20px;
      border-bottom: 1.5px solid #c8d4e0;
    }

    /* ── Section heading ── */
    .cv-heading {
      font-size: 10pt;
      font-weight: 700;
      color: #1e3a5f;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-top: 22px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #2d5a8e;
    }

    /* ── Job / role line ── */
    .cv-job {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 12px;
      margin-bottom: 4px;
      gap: 8px;
    }
    .cv-job-company {
      font-weight: 700;
      font-size: 10.5pt;
      color: #1a1a1a;
    }
    .cv-job-meta {
      font-size: 9.5pt;
      color: #555;
      font-style: italic;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Bullets ── */
    .cv-bullets { margin: 4px 0 6px 18px; }
    .cv-bullets li {
      font-size: 10pt;
      margin-bottom: 3px;
      line-height: 1.5;
      list-style-type: disc;
    }

    /* ── Body paragraph ── */
    .cv-body {
      font-size: 10pt;
      margin-bottom: 5px;
      line-height: 1.6;
      color: #222;
    }

    /* ── Cover letter ── */
    .cover-body {
      font-size: 11pt;
      line-height: 1.7;
      margin-bottom: 1em;
      color: #1a1a1a;
    }

    /* ── Print overrides ── */
    @media print {
      body { background: white; }
      .print-banner { display: none !important; }
      .document {
        margin: 0;
        padding: 0;
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }
      .cv-heading { break-after: avoid; }
      .cv-job { break-after: avoid; }
    }

    @page {
      size: A4;
      margin: 18mm 16mm;
    }
  </style>
</head>
<body>
  <div class="print-banner">
    <div>
      <strong>ParsePilot AI — ${escHtml(pageTitle)}</strong>
      <p>Press Ctrl+P (Cmd+P on Mac) → Save as PDF. In print settings, set margins to "None" or "Minimum".</p>
    </div>
    <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
  </div>

  <div class="document">
    ${bodyHtml}
  </div>

  <script>
    if (!window.location.search.includes('noprint')) {
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 700);
      });
    }
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtmlBody(lines: LineKind[], docType: "cv" | "cover"): string {
  if (docType === "cover") {
    return renderCoverHtml(lines);
  }
  return renderCvHtml(lines);
}

function renderCvHtml(lines: LineKind[]): string {
  const parts: string[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length === 0) return;
    parts.push(`<ul class="cv-bullets">${bulletBuffer.map(b => `<li>${escHtml(b)}</li>`).join("")}</ul>`);
    bulletBuffer = [];
  }

  for (const line of lines) {
    if (line.type !== "bullet") flushBullets();

    switch (line.type) {
      case "name":
        parts.push(`<div class="cv-name">${escHtml(line.text)}</div>`);
        break;
      case "contact":
        parts.push(`<div class="cv-contact">${escHtml(line.text)}</div>`);
        break;
      case "heading":
        parts.push(`<div class="cv-heading">${escHtml(line.text)}</div>`);
        break;
      case "job": {
        const metaParts = line.titleAndDate.split("·").map(s => s.trim());
        const title = metaParts[0] ?? "";
        const dates = metaParts.slice(1).join(" · ");
        parts.push(`<div class="cv-job">
          <span class="cv-job-company">${escHtml(line.company)}</span>
          <span class="cv-job-meta">${escHtml(title)}${dates ? ` &nbsp;·&nbsp; ${escHtml(dates)}` : ""}</span>
        </div>`);
        break;
      }
      case "bullet":
        bulletBuffer.push(line.text);
        break;
      case "body":
        parts.push(`<p class="cv-body">${escHtml(line.text)}</p>`);
        break;
      case "blank":
        break;
    }
  }
  flushBullets();
  return parts.join("\n");
}

function renderCoverHtml(lines: LineKind[]): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (line.type === "blank") {
      parts.push(`<div style="margin-bottom:0.8em"></div>`);
    } else if (line.type !== "blank") {
      const text = "text" in line ? line.text : line.full;
      parts.push(`<p class="cover-body">${escHtml(text ?? "")}</p>`);
    }
  }
  return parts.join("\n");
}
