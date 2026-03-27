import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, applicationsTable } from "@workspace/db";
import { buildDocxBuffer, buildPrintHtml } from "../services/exporter.js";
import { logger } from "../lib/logger.js";
import { userCanAccessFullResult } from "../lib/billing.js";

const router: IRouter = Router();

// ─── DOCX Export (Pro or one-time unlock) ────────────────────────────────────

router.get("/export/application/:id/docx", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }

  const { id } = req.params;
  const cvType = (req.query.type as string) === "cover" ? "cover" : "cv";

  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    if (app.userId !== req.user.id) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    // ── Access gate: Pro subscription OR one-time unlock for this result ──────
    const canAccess = await userCanAccessFullResult(req.user.id, id);
    if (!canAccess) {
      res.status(403).json({
        error: "Export requires a Pro subscription or a one-time unlock for this result.",
        code: "PRO_REQUIRED",
      });
      return;
    }

    const text = cvType === "cover" ? app.coverLetterText : app.tailoredCvText;
    if (!text) {
      res.status(400).json({
        error: `No ${cvType === "cover" ? "cover letter" : "tailored CV"} to export. Run analysis first.`,
        code: "NO_CONTENT",
      });
      return;
    }

    const cvSourceText = app.tailoredCvText ?? app.originalCvText ?? "";
    const buffer =
      cvType === "cover"
        ? await buildDocxBuffer(cvSourceText, app.jobTitle, app.company, text)
        : await buildDocxBuffer(text, app.jobTitle, app.company);
    const safeCompany = app.company.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename =
      cvType === "cover"
        ? `cover_letter_${safeCompany}.docx`
        : `tailored_cv_${safeCompany}.docx`;

    if (app.status === "analyzed") {
      await db
        .update(applicationsTable)
        .set({ status: "exported", updatedAt: new Date() })
        .where(eq(applicationsTable.id, id));
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    logger.error({ err, id, cvType }, "DOCX export failed");
    res.status(500).json({ error: "Export failed. Please try again.", code: "EXPORT_ERROR" });
  }
});

// ─── PDF Export (Pro or one-time unlock) ─────────────────────────────────────
// Returns print-optimized HTML that auto-triggers window.print().
// Users save as PDF from the browser's print dialog.

router.get("/export/application/:id/pdf", async (req, res) => {
  if (!req.user) {
    res.status(401).send("<h1>401 — Authentication required</h1>");
    return;
  }

  const { id } = req.params;
  const cvType = (req.query.type as string) === "cover" ? "cover" : "cv";

  try {
    const [app] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id));

    if (!app) {
      res.status(404).send("<h1>404 — Application not found</h1>");
      return;
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    if (app.userId !== req.user.id) {
      res.status(403).send("<h1>403 — Access denied</h1>");
      return;
    }

    // ── Access gate: Pro subscription OR one-time unlock for this result ──────
    const canAccess = await userCanAccessFullResult(req.user.id, id);
    if (!canAccess) {
      res.status(403).send(`
        <html><body style="font-family:sans-serif;padding:2rem">
          <h2>Export not available</h2>
          <p>Export requires a Pro subscription or a one-time unlock for this result.</p>
          <a href="javascript:window.close()">Close</a>
        </body></html>
      `);
      return;
    }

    const text = cvType === "cover" ? app.coverLetterText : app.tailoredCvText;
    if (!text) {
      res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:2rem">
          <h2>Nothing to export yet</h2>
          <p>Run the AI analysis first, then export to PDF.</p>
          <a href="javascript:window.close()">Close</a>
        </body></html>
      `);
      return;
    }

    const cvSourceText = app.tailoredCvText ?? app.originalCvText ?? "";
    const html = buildPrintHtml(text, app.jobTitle, app.company, cvType, cvSourceText);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    logger.error({ err, id, cvType }, "PDF export failed");
    res.status(500).send("<h1>Export failed — please try again</h1>");
  }
});

export default router;
