import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseStatementText, parseCsvText } from "@/lib/import/parser";
import { aiCategorize } from "@/lib/import/ai-categorize";

const MAX_BYTES = 10 * 1024 * 1024;

function reqId(): string {
  const n = Math.floor(performance.now() * 1000).toString(36);
  const r = Math.floor((performance.now() * 7919) % 1e9).toString(36);
  return `imp_${n}_${r}`;
}

export async function POST(request: Request) {
  const id = reqId();
  const t0 = performance.now();
  const debug: string[] = [`[route] ${id} start`];

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED", reqId: id },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return NextResponse.json(
      { error: "Expected multipart/form-data", code: "BAD_FORM", detail: (e as Error).message, reqId: id },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const person = String(form.get("person") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file", code: "NO_FILE", reqId: id },
      { status: 400 },
    );
  }
  if (person !== "A" && person !== "B") {
    return NextResponse.json(
      { error: "Invalid person", code: "BAD_PERSON", reqId: id },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)", code: "TOO_LARGE", reqId: id },
      { status: 400 },
    );
  }

  const name = file.name || "upload";
  const mime = file.type || "application/octet-stream";
  const lowerName = name.toLowerCase();
  const isPdf = lowerName.endsWith(".pdf") || mime === "application/pdf";
  const isCsv = lowerName.endsWith(".csv") || mime === "text/csv";
  const isTxt = lowerName.endsWith(".txt") || mime === "text/plain";

  debug.push(`[route] file=${name} size=${file.size} mime=${mime} isPdf=${isPdf} isCsv=${isCsv} isTxt=${isTxt}`);
  console.log(`[import/parse] ${id} file=${name} size=${file.size} mime=${mime}`);

  let text = "";
  let totalPages: number | undefined;

  try {
    if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      debug.push(`[route] read ${buf.byteLength} bytes for PDF`);
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buf);
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text;
      totalPages = extracted.totalPages;
      debug.push(`[route] pdf pages=${totalPages}, text chars=${text.length}`);
    } else if (isCsv || isTxt) {
      text = await file.text();
      debug.push(`[route] read ${text.length} chars from ${isCsv ? "CSV" : "TXT"}`);
    } else {
      try {
        text = await file.text();
        debug.push(`[route] unknown type, read ${text.length} chars as text`);
      } catch {
        return NextResponse.json(
          { error: "Unsupported file type", code: "BAD_TYPE", detail: mime, reqId: id },
          { status: 400 },
        );
      }
    }
  } catch (e) {
    console.error(`[import/parse] ${id} extraction failed`, (e as Error).message);
    return NextResponse.json(
      { error: "Failed to read file", code: "EXTRACT_FAIL", detail: (e as Error).message, reqId: id },
      { status: 500 },
    );
  }

  const tExtract = performance.now();
  debug.push(`[route] extracted in ${(tExtract - t0).toFixed(0)}ms`);

  const result = isCsv ? parseCsvText(text) : parseStatementText(text);
  debug.push(...result.debug);

  const tParse = performance.now();
  debug.push(`[route] parsed in ${(tParse - tExtract).toFixed(0)}ms`);
  debug.push(`[route] regex gave ${result.transactions.length} transactions`);

  const aiInput = result.transactions.map((t) => ({
    isoDate: t.isoDate,
    particulars: t.particulars,
    amount: t.amount,
    type: t.type,
  }));
  const aiResults = await aiCategorize(aiInput, debug);
  for (let i = 0; i < result.transactions.length; i++) {
    if (aiResults[i]) result.transactions[i].category = aiResults[i].category;
  }

  const tAi = performance.now();
  debug.push(`[route] categorized in ${(tAi - tParse).toFixed(0)}ms`);
  debug.push(`[route] total ${(tAi - t0).toFixed(0)}ms, ${result.transactions.length} transactions`);

  for (const d of debug) console.log(`[import/parse] ${id} ${d}`);

  return NextResponse.json({
    ok: true,
    reqId: id,
    person,
    filename: name,
    mime,
    totalPages,
    transactions: result.transactions,
    warnings: result.warnings,
    debug,
    counts: {
      total: result.transactions.length,
      credit: result.transactions.filter((t) => t.type === "credit").length,
      debit: result.transactions.filter((t) => t.type === "debit").length,
    },
    timings: {
      extractMs: Math.round(tExtract - t0),
      parseMs: Math.round(tParse - tExtract),
      aiMs: Math.round(tAi - tParse),
      totalMs: Math.round(tAi - t0),
    },
  });
}
