import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { z } from "zod";
import { extractTextFromFile } from "../services/fileParser.js";
import { parseCv } from "../services/ai.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Multer Configuration ───────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = /\.(pdf|docx|doc|txt)$/i;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_MIME_TYPES.has(file.mimetype) ||
      ALLOWED_EXTENSIONS.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error("Unsupported file type. Upload a PDF, DOCX, DOC, or TXT file."), {
          code: "INVALID_FILE_TYPE",
        }),
      );
    }
  },
});

// Wraps multer so its errors are caught and returned as JSON instead of crashing the server
function uploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: `File exceeds the 10 MB size limit. Compress or paste the text manually.`,
          code: "FILE_TOO_LARGE",
        });
        return;
      }
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }

    const message =
      err instanceof Error ? err.message : "File upload failed";
    const code = (err as { code?: string }).code ?? "UPLOAD_ERROR";
    res.status(400).json({ error: message, code });
  });
}

// ─── POST /upload-cv ────────────────────────────────────────────────────────

router.post("/upload-cv", uploadMiddleware, async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file was included in the request.", code: "NO_FILE" });
    return;
  }

  const { buffer, mimetype, originalname, size } = req.file;

  // Extract raw text
  let extractedText: string;
  try {
    extractedText = await extractTextFromFile(buffer, mimetype, originalname);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Text extraction failed";
    logger.error({ err, originalname, mimetype }, "CV text extraction failed");
    res.status(422).json({ error: `Could not extract text: ${message}`, code: "EXTRACTION_FAILED" });
    return;
  }

  if (!extractedText || extractedText.trim().length < 20) {
    res.status(422).json({
      error: "The file appears to be empty or contains no readable text.",
      code: "EMPTY_CONTENT",
    });
    return;
  }

  // Parse CV with AI (non-fatal — extraction succeeds even if parsing fails)
  let parsedCv: Awaited<ReturnType<typeof parseCv>> | null = null;
  try {
    parsedCv = await parseCv(extractedText);
  } catch (err) {
    logger.warn({ err, originalname }, "CV AI parse failed (non-fatal)");
  }

  res.json({
    extractedText,
    parsedCv,
    fileName: originalname,
    fileSize: size,
  });
});

// ─── POST /parse-cv ─────────────────────────────────────────────────────────

const ParseCvBodySchema = z.object({
  rawText: z
    .string()
    .min(50, "CV text must be at least 50 characters")
    .max(100_000, "CV text exceeds the 100 000 character limit"),
});

router.post("/parse-cv", async (req: Request, res: Response) => {
  const parsed = ParseCvBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const { rawText } = parsed.data;

  let parsedCv: Awaited<ReturnType<typeof parseCv>>;
  try {
    parsedCv = await parseCv(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "CV parsing failed";
    logger.error({ err }, "CV parsing failed");
    res.status(500).json({ error: message, code: "PARSE_FAILED" });
    return;
  }

  res.json({ parsedCv, parsedText: rawText, sections: [] });
});

export default router;
