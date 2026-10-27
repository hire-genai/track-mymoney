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

// 60s is the Vercel Hobby cap. We rely on this instead of the previous 300s
// so a stalled model never leaves the user staring at a spinner for 5 minutes.
export const maxDuration = 60;

export async function POST(request: Request) {
  const reqId = newReqId();

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", reqId },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    importLog.error("formData parse failed", { reqId, message: errMsg(e) });
    return NextResponse.json(
      { error: "Invalid form data", reqId },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const person = form.get("person");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided", reqId },
      { status: 400 },
    );
  }
  if (person !== "A" && person !== "B") {
    return NextResponse.json(
      { error: "Invalid person", reqId },
      { status: 400 },
    );
  }

  try {
    await ensureSchema();
  } catch (e) {
    importLog.error("ensureSchema failed", {
      reqId,
      message: errMsg(e),
      stack: errStack(e),
    });
    return NextResponse.json(
      {
        error: "Database is not configured or unreachable.",
        code: "DB_UNAVAILABLE",
        detail: safeDetail(e),
        reqId,
      },
      { status: 500 },
    );
  }

  importLog.info("parse started", {
    reqId,
    user: user.id,
    person,
    file: file.name,
    bytes: file.size,
    mime: file.type,
  });

  let extracted;
  const tExtract = startTimer();
  try {
    extracted = await extractDocumentText(file);
    importLog.step("text extracted", {
      reqId,
      ms: tExtract(),
      pages: extracted.pages ?? "?",
      chars: extracted.text.length,
    });
  } catch (e) {
    if (e instanceof ImportError) {
      importLog.warn("extract rejected", {
        reqId,
        ms: tExtract(),
        reason: e.message,
      });
      return NextResponse.json(
        { error: e.message, code: "EXTRACT_REJECTED", reqId },
        { status: 400 },
      );
    }
    importLog.error("extract error", {
      reqId,
      ms: tExtract(),
      message: errMsg(e),
      stack: errStack(e),
    });
    return NextResponse.json(
      {
        error: "Could not read the file.",
        code: "EXTRACT_FAILED",
        detail: safeDetail(e),
        reqId,
      },
      { status: 500 },
    );
  }

  let parseResult;
  const tAi = startTimer();
  try {
    parseResult = await parseStatementWithAI(
      extracted.text,
      allowedCategories(),
    );
    importLog.step("AI parse complete", {
      reqId,
      ms: tAi(),
      txns: parseResult.transactions.length,
      model: parseResult.modelUsed,
      attempted: parseResult.attemptedModels.length,
    });
  } catch (e) {
    importLog.error("AI parse failed", {
      reqId,
      ms: tAi(),
      message: errMsg(e),
      stack: errStack(e),
    });
    if (e instanceof NoFreeModelAvailableError) {
      return NextResponse.json(
        {
          error:
            "No eligible free AI model is available on OpenRouter right now. Please try again in a few minutes.",
          code: "NO_FREE_MODEL",
          reqId,
        },
        { status: 503 },
      );
    }
    if (e instanceof OpenRouterDiscoveryError) {
      return NextResponse.json(
        {
          error:
            "Could not reach OpenRouter to discover available models. Check your network and OPENROUTER_API_KEY.",
          code: "DISCOVERY_FAILED",
          reqId,
        },
        { status: 503 },
      );
    }
    if (e instanceof NoModelSucceededError) {
      return NextResponse.json(
        {
          error:
            "All eligible free models failed to extract transactions. You can retry — a different model may be picked.",
          code: "ALL_MODELS_FAILED",
          attemptedModels: e.attemptedModels,
          detail: safeDetail(e),
          reqId,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Could not extract transactions from this file.",
        code: "PARSE_FAILED",
        detail: safeDetail(e),
        reqId,
      },
      { status: 502 },
    );
  }

  let report;
  try {
    report = reconcile(parseResult.transactions);
  } catch (e) {
    importLog.error("reconcile failed", {
      reqId,
      message: errMsg(e),
      stack: errStack(e),
    });
    return NextResponse.json(
      {
        error: "Could not reconcile parsed transactions.",
        code: "RECONCILE_FAILED",
        detail: safeDetail(e),
        reqId,
      },
      { status: 500 },
    );
  }

  let duplicates: Array<{ month: string; count: number }> = [];
  try {
    const q = sql();
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
  } catch (e) {
    importLog.error("duplicate lookup failed", {
      reqId,
      message: errMsg(e),
      stack: errStack(e),
    });
    return NextResponse.json(
      {
        error: "Could not check for duplicate months.",
        code: "DB_QUERY_FAILED",
        detail: safeDetail(e),
        reqId,
      },
      { status: 500 },
    );
  }

  importLog.step("parse ok", {
    reqId,
    total: parseResult.transactions.length,
    months: parseResult.monthsSeen.length,
    duplicates: duplicates.length,
  });

  return NextResponse.json({
    ok: true,
    reqId,
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

function errStack(e: unknown): string | undefined {
  return e instanceof Error && e.stack ? e.stack.split("\n").slice(0, 6).join("\n") : undefined;
}

/**
 * Short error summary safe to surface to the browser. Strips newlines and caps
 * length so an unexpected stack trace from a dependency can't flood the client,
 * and never includes raw PDF content (which the import pipeline doesn't put
 * into error messages anyway).
 */
function safeDetail(e: unknown): string {
  const raw = errMsg(e).replace(/\s+/g, " ").trim();
  return raw.length > 240 ? raw.slice(0, 237) + "..." : raw;
}

function newReqId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `imp_${t}_${r}`;
}
