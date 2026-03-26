import mammoth from "mammoth";

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = getDocument({ data: uint8Array });
  const pdfDoc = await loadingTask.promise;

  let fullText = "";
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<string> {
  const ext = originalname.toLowerCase().split(".").pop();

  if (mimetype === "application/pdf" || ext === "pdf") {
    return extractTextFromPdf(buffer);
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    return extractTextFromDocx(buffer);
  }

  if (mimetype === "text/plain" || ext === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimetype} (${ext})`);
}
