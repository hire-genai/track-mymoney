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
    return await extractPdfText(new Uint8Array(arrayBuf), filename);
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

/**
 * Extract text from a PDF using pdfjs-dist directly. We bypass pdf-parse (v2)
 * because its runtime pulls in @napi-rs/canvas and loads pdf.worker.mjs via a
 * file-URL dance that Vercel's bundler does not include in the serverless
 * function. pdfjs-dist's legacy build runs in Node without a worker and
 * without a canvas (we only need the text layer).
 */
async function extractPdfText(
  bytes: Uint8Array,
  filename: string,
): Promise<ExtractedDoc> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument: (src: Record<string, unknown>) => {
      promise: Promise<{
        numPages: number;
        getPage: (n: number) => Promise<{
          getTextContent: () => Promise<{
            items: Array<{ str?: string; hasEOL?: boolean }>;
          }>;
          cleanup: () => void;
        }>;
        destroy: () => Promise<void>;
      }>;
    };
    GlobalWorkerOptions: { workerSrc: unknown };
  };

  let doc:
    | Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>
    | null = null;
  try {
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
      verbosity: 0,
    });
    doc = await loadingTask.promise;

    const pages = doc.numPages;
    const parts: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        let line = "";
        for (const it of content.items) {
          const s = typeof it.str === "string" ? it.str : "";
          line += s;
          if (it.hasEOL) {
            parts.push(line);
            line = "";
          } else {
            line += " ";
          }
        }
        if (line.trim()) parts.push(line);
      } finally {
        page.cleanup();
      }
    }

    const text = truncate(parts.join("\n").replace(/[ \t]+\n/g, "\n").trim());
    const charsPerPage = pages > 0 ? text.length / pages : text.length;
    if (!text || (pages > 0 && charsPerPage < 40)) {
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
  } finally {
    if (doc) await doc.destroy().catch(() => {});
  }
}
