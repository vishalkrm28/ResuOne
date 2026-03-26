import { Router, type IRouter } from "express";
import multer from "multer";
import { extractTextFromFile } from "../services/fileParser.js";

const router: IRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|doc|txt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, DOC, and TXT files are allowed"));
    }
  },
});

router.post("/upload-cv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const extractedText = await extractTextFromFile(
    req.file.buffer,
    req.file.mimetype,
    req.file.originalname,
  );

  res.json({
    extractedText,
    fileName: req.file.originalname,
    fileSize: req.file.size,
  });
});

export default router;
