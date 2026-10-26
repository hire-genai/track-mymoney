import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { extractDocumentText, ImportError } from "@/lib/import/extract";
import { allowedCategories, parseStatementWithAI } from "@/lib/import/parser";
import { reconcile } from "@/lib/import/reconcile";
import {
  NoFreeModelAvailableError,
  OpenRouterDiscoveryError,
} from "@/lib/import/model-registry";
import { NoModelSucceededError } from "@/lib/import/openrouter";
import { importLog, startTimer } from "@/lib/import/log";

export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const person = form.get("person");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (person !== "A" && person !== "B") {
    return NextResponse.json({ error: "Invalid person" }, { status: 400 });
  }

  try {
    await ensureSchema();
  } catch (e) {
    console.error("DB schema error", { message: errMsg(e) });
    return NextResponse.json(
      { error: "Database is not configured. Set DATABASE_URL." },
      { status: 500 },
    );
  }

  importLog.info("parse started", {
    user: user.id,
    person,
    file: file.name,
    bytes: file.size,
  });

  let extracted;
  const tExtract = startTimer();
  try {
    extracted = await extractDocumentText(file);
    importLog.step("text extracted", {
      ms: tExtract(),
      pages: extracted.pages ?? "?",
      chars: extracted.text.length,
    });
  } catch (e) {
    if (e instanceof ImportError) {
      importLog.warn("extract rejected", { ms: tExtract(), reason: e.message });
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    importLog.error("extract error", { ms: tExtract(), message: errMsg(e) });
    return NextResponse.json({ error: "Could not read the file" }, { status: 500 });
  }

  let parseResult;
  const tAi = startTimer();
  try {
    parseResult = await parseStatementWithAI(extracted.text, allowedCategories());
    importLog.step("AI parse complete", {
      ms: tAi(),
      txns: parseResult.transactions.length,
      model: parseResult.modelUsed,
      attempted: parseResult.attemptedModels.length,
    });
  } catch (e) {
    importLog.error("AI parse failed", { ms: tAi(), message: errMsg(e) });
    if (e instanceof NoFreeModelAvailableError) {
      return NextResponse.json(
        {
          error:
            "No eligible free AI model is available on OpenRouter right now. Please try again in a few minutes.",
          code: "NO_FREE_MODEL",
        },
        { status: 503 },
      );
    }
    if (e instanceof OpenRouterDiscoveryError) {
      return NextResponse.json(
        {
          error: "Could not reach OpenRouter to discover available models. Check your network and OPENROUTER_API_KEY.",
          code: "DISCOVERY_FAILED",
        },
        { status: 503 },
      );
    }
    if (e instanceof NoModelSucceededError) {
      return NextResponse.json(
        {
          error: "All eligible free models failed to extract transactions. You can retry — a different model may be picked.",
          code: "ALL_MODELS_FAILED",
          attemptedModels: e.attemptedModels,
        },
        { status: 502 },
      );
    }
    // Don't echo statement contents in logs
    console.error("AI parse error", { message: errMsg(e) });
    return NextResponse.json(
      { error: "Could not extract transactions from this file.", code: "PARSE_FAILED" },
      { status: 502 },
    );
  }

  const report = reconcile(parseResult.transactions);

  const q = sql();
  let duplicates: Array<{ month: string; count: number }> = [];
  if (parseResult.monthsSeen.length) {
    const rows = (await q`
      SELECT month, COUNT(*)::int AS count
      FROM transactions
      WHERE user_id = ${user.id}
        AND person = ${person}
        AND month = ANY(${parseResult.monthsSeen}::text[])
      GROUP BY month
    `) as unknown as Array<{ month: string; count: number }>;
    duplicates = rows;
  }

  return NextResponse.json({
    ok: true,
    filename: extracted.filename,
    mime: extracted.mime,
    pages: extracted.pages,
    person,
    total: parseResult.transactions.length,
    transactions: parseResult.transactions,
    monthsSeen: parseResult.monthsSeen,
    duplicates,
    categories: allowedCategories(),
    modelUsed: parseResult.modelUsed,
    attemptedModels: parseResult.attemptedModels,
    reconciliation: report,
  });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
