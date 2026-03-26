import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, applicationsTable } from "@workspace/db";
import { buildDocxBuffer } from "../services/exporter.js";

const router: IRouter = Router();

router.get("/export/application/:id/docx", async (req, res) => {
  const { id } = req.params;
  const cvType = (req.query.type as string) === "cover" ? "cover" : "cv";

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id));

  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const text = cvType === "cover" ? app.coverLetterText : app.tailoredCvText;
  if (!text) {
    res.status(400).json({ error: `No ${cvType} content to export. Run analysis first.` });
    return;
  }

  const buffer = await buildDocxBuffer(text, app.jobTitle, app.company);
  const safeCompany = app.company.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = cvType === "cover"
    ? `cover_letter_${safeCompany}.docx`
    : `cv_${safeCompany}.docx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

router.get("/export/application/:id/pdf", async (req, res) => {
  const { id } = req.params;
  const cvType = (req.query.type as string) === "cover" ? "cover" : "cv";

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, id));

  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const text = cvType === "cover" ? app.coverLetterText : app.tailoredCvText;
  if (!text) {
    res.status(400).json({ error: `No ${cvType} content to export. Run analysis first.` });
    return;
  }

  const docxBuffer = await buildDocxBuffer(text, app.jobTitle, app.company);
  const safeCompany = app.company.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = cvType === "cover"
    ? `cover_letter_${safeCompany}.docx`
    : `cv_${safeCompany}.docx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(docxBuffer);
});

export default router;
