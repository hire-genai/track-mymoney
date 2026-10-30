import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { aiCategorize, type AiTxn } from "@/lib/import/ai-categorize";
import { getPrimaryCategory } from "@/lib/finance-data";
import { allowedCategories } from "@/lib/import/utils";

const bodySchema = z
  .object({ importId: z.number().int().positive().optional() })
  .optional();

interface StoredTxn {
  isoDate?: string;
  date?: string;
  month?: string;
  particulars?: string;
  amount?: number | string;
  type?: "credit" | "debit";
  category?: string;
}

/**
 * Re-run the AI categorizer over transactions already stored in
 * imports.transactions (JSONB). Scope defaults to every import for the user;
 * pass {importId} to limit to one statement.
 *
 * Preserves all original transaction fields and only rewrites `category`.
 * Returns a compact {id, primary, subcategory} list — no particulars or
 * reasoning leaks to the caller.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    // Empty body is allowed — recategorize everything.
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", code: "BAD_PAYLOAD", detail: parsed.error.message },
      { status: 400 },
    );
  }
  const importId = parsed.data?.importId;

  try {
    await ensureSchema();
  } catch (e) {
    console.error("DB schema error", e);
    return NextResponse.json(
      { error: "Database not configured", code: "DB_UNAVAILABLE" },
      { status: 500 },
    );
  }

  const q = sql();
  const rows = (importId
    ? ((await q`
        SELECT id, transactions FROM imports
        WHERE user_id = ${user.id} AND id = ${importId}
      `) as unknown as Array<{ id: number; transactions: unknown }>)
    : ((await q`
        SELECT id, transactions FROM imports
        WHERE user_id = ${user.id}
        ORDER BY id ASC
      `) as unknown as Array<{ id: number; transactions: unknown }>));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No imports found", code: "NO_IMPORTS" },
      { status: 404 },
    );
  }

  const allowed = new Set(allowedCategories());
  const results: Array<{ id: string; primary: string; subcategory: string }> = [];
  const review: Array<{ id: string; reason: string }> = [];
  const debug: string[] = [];

  for (const row of rows) {
    const list: StoredTxn[] = Array.isArray(row.transactions)
      ? (row.transactions as StoredTxn[])
      : [];

    const indices: number[] = [];
    const aiInput: AiTxn[] = [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || typeof r !== "object") continue;
      const particulars = typeof r.particulars === "string" ? r.particulars : "";
      const amount =
        typeof r.amount === "number"
          ? r.amount
          : typeof r.amount === "string"
            ? Number(r.amount)
            : NaN;
      const type = r.type === "credit" || r.type === "debit" ? r.type : "debit";
      const isoDate = typeof r.isoDate === "string" ? r.isoDate : "";
      if (!particulars || !Number.isFinite(amount) || amount <= 0) continue;
      indices.push(i);
      aiInput.push({ isoDate, particulars, amount, type });
    }

    if (aiInput.length === 0) continue;

    const categorized = await aiCategorize(aiInput, debug);

    const updated = list.slice();
    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      const sub = categorized[k].category;
      const prev = updated[idx] as StoredTxn;
      const id = `${row.id}-${idx}`;

      if (!allowed.has(sub)) {
        review.push({ id, reason: "unknown_subcategory" });
        continue;
      }
      updated[idx] = { ...prev, category: sub };
      results.push({ id, primary: getPrimaryCategory(sub), subcategory: sub });
    }

    await q`
      UPDATE imports
      SET transactions = ${JSON.stringify(updated)}::jsonb
      WHERE id = ${row.id} AND user_id = ${user.id}
    `;
  }

  return NextResponse.json({ ok: true, results, review });
}
