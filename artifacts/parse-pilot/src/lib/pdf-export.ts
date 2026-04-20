import type { TailoredCvJson } from "./application-api";
import { authedFetch } from "./authed-fetch";

// ─── CV PDF ───────────────────────────────────────────────────────────────────

export function buildCvPrintHtml(tcv: TailoredCvJson, versionName?: string | null): string {
  const title = versionName ?? tcv.full_name ?? "Tailored CV";

  const contactParts = [
    tcv.email && `<span>${esc(tcv.email)}</span>`,
    tcv.phone && `<span>${esc(tcv.phone)}</span>`,
    tcv.location && `<span>${esc(tcv.location)}</span>`,
    tcv.linkedin && `<span>${esc(tcv.linkedin)}</span>`,
    tcv.portfolio && `<span>${esc(tcv.portfolio)}</span>`,
  ].filter(Boolean);

  const skillsHtml = tcv.core_skills.length > 0
    ? `<section>
        <h2>Core Skills</h2>
        <p class="skills">${tcv.core_skills.map(esc).join(" &nbsp;·&nbsp; ")}</p>
      </section>`
    : "";

  const summaryHtml = tcv.professional_summary
    ? `<section>
        <h2>Professional Summary</h2>
        <p>${esc(tcv.professional_summary)}</p>
      </section>`
    : "";

  const experienceHtml = tcv.tailored_experience.length > 0
    ? `<section>
        <h2>Professional Experience</h2>
        ${tcv.tailored_experience.map((role) => `
          <div class="role">
            <div class="role-header">
              <strong>${esc(role.title)}</strong>
              <span class="role-meta">${esc(role.company)}${role.start_date ? ` &nbsp;·&nbsp; ${esc(role.start_date)} – ${esc(role.end_date ?? "Present")}` : ""}</span>
            </div>
            <ul>${role.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
          </div>
        `).join("")}
      </section>`
    : "";

  const educationHtml = tcv.education.length > 0
    ? `<section>
        <h2>Education</h2>
        ${tcv.education.map((edu) => `
          <div class="edu-item">
            <strong>${esc(edu.degree)}</strong>
            <span class="role-meta">${esc(edu.institution)}${edu.year ? ` &nbsp;·&nbsp; ${esc(edu.year)}` : ""}</span>
          </div>
        `).join("")}
      </section>`
    : "";

  const certsHtml = tcv.certifications.length > 0
    ? `<section>
        <h2>Certifications</h2>
        <ul>${tcv.certifications.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #111;
      background: #fff;
      padding: 2cm 2.2cm;
      max-width: 21cm;
      margin: 0 auto;
    }
    h1 {
      font-size: 22pt;
      font-weight: bold;
      letter-spacing: -0.3px;
      margin-bottom: 2px;
    }
    .headline {
      font-size: 11pt;
      color: #444;
      margin-bottom: 6px;
    }
    .contact {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: 9.5pt;
      color: #555;
      border-bottom: 1.5px solid #222;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    section {
      margin-bottom: 16px;
    }
    h2 {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 0.75px solid #aaa;
      padding-bottom: 2px;
      margin-bottom: 8px;
      color: #222;
    }
    p { margin-bottom: 4px; }
    .skills { font-size: 10pt; line-height: 1.7; }
    .role { margin-bottom: 12px; }
    .role-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }
    .role-meta { font-size: 9.5pt; color: #555; }
    ul { padding-left: 16px; margin-top: 2px; }
    li { margin-bottom: 3px; font-size: 10.5pt; }
    .edu-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 1.8cm 2cm; size: A4; }
    }
  </style>
</head>
<body>
  <h1>${esc(tcv.full_name ?? "")}</h1>
  ${tcv.headline ? `<p class="headline">${esc(tcv.headline)}</p>` : ""}
  ${contactParts.length > 0 ? `<div class="contact">${contactParts.join("")}</div>` : ""}
  ${summaryHtml}
  ${skillsHtml}
  ${experienceHtml}
  ${educationHtml}
  ${certsHtml}
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

// ─── Cover Letter PDF ─────────────────────────────────────────────────────────

export function buildCoverLetterPrintHtml(
  text: string,
  jobTitle?: string | null,
  jobCompany?: string | null,
): string {
  const label = [jobTitle, jobCompany].filter(Boolean).join(" @ ") || "Cover Letter";
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(label)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111;
      background: #fff;
      padding: 2.2cm 2.5cm;
      max-width: 21cm;
      margin: 0 auto;
    }
    .date { margin-bottom: 2em; color: #444; font-size: 10.5pt; }
    .subject {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 1.5em;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5em;
    }
    p { margin-bottom: 1em; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm 2.2cm; size: A4; }
    }
  </style>
</head>
<body>
  <p class="date">${date}</p>
  ${label !== "Cover Letter" ? `<p class="subject">Re: ${esc(label)}</p>` : ""}
  ${paragraphs}
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

// ─── Shared open-print helper ─────────────────────────────────────────────────

export function openPrintWindow(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Fallback: download the HTML file directly
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  // Revoke after a delay so the window has time to load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ─── DOCX download via authenticated fetch ────────────────────────────────────

const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? "/api";

export async function downloadDocx(path: string, filename: string): Promise<void> {
  const res = await authedFetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Export failed");
  }
  const buffer = await res.arrayBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── HTML escape ──────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
