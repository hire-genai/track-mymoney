import "server-only";

export interface ExtractedDoc {
  text: string;
  pages: number | null;
  mime: string;
  filename: string;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_TEXT_CHARS = 180_000;

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

export function isAcceptedMime(mime: string, filename: string): boolean {
  if (ACCEPTED_MIME.has(mime)) return true;
  const lower = filename.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".csv") || lower.endsWith(".txt");
}

export async function extractDocumentText(
  file: File,
): Promise<ExtractedDoc> {
  const mime = file.type || inferMime(file.name);
  const filename = file.name || "upload";

  if (!isAcceptedMime(mime, filename)) {
    throw new ImportError(`Unsupported file type: ${mime || "unknown"}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImportError(
      `File is too large (${Math.round(file.size / 1024 / 1024)} MB). Max is 10 MB.`,
    );
  }

  const arrayBuf = await file.arrayBuffer();

  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    // unpdf is a pure-JS pdfjs-dist wrapper that works in Vercel's serverless
    // Node runtime without native deps. The previous `pdf-parse` v2 pulled in
    // `@napi-rs/canvas` whose native binaries weren't being traced into the
    // Vercel bundle, producing a bare 500 on upload.
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuf));
      const { totalPages, text: pageTexts } = await extractText(pdf, {
        mergePages: false,
      });
      const joined = pageTexts.join("\n").trim();
      const text = truncate(joined);
      const pages = totalPages ?? pageTexts.length ?? null;

      // Scanned-PDF heuristic: a PDF with pages but almost no text layer
      // is overwhelmingly a scanned document. We refuse rather than send
      // ~nothing to the AI (which would hallucinate transactions).
      const charsPerPage = pages && pages > 0 ? text.length / pages : text.length;
      if (!text || (pages && pages > 0 && charsPerPage < 40)) {
        throw new ImportError(
          "This PDF appears to be scanned (no selectable text). Please upload a CSV export or a text-based PDF from your bank's web portal.",
        );
      }

      return { text, pages, mime: "application/pdf", filename };
    } catch (e) {
      if (e instanceof ImportError) throw e;
      throw new ImportError(
        `Could not read this PDF: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    }
  }

  // CSV / TXT path
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuf).trim();
  if (!raw) throw new ImportError("The file appears to be empty.");
  return { text: truncate(raw), pages: null, mime, filename };
}

function truncate(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return text.slice(0, MAX_TEXT_CHARS);
}

function inferMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}
