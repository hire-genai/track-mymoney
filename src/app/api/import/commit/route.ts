import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { allowedCategories, formatMonth } from "@/lib/import/utils";

const rowSchema = z.object({
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date: z.string().min(1).max(10),
  particulars: z.string().min(1).max(300),
  amount: z.number().positive(),
  type: z.enum(["credit", "debit"]),
  category: z.string().min(1).max(100),
});

const bodySchema = z.object({
  person: z.enum(["A", "B"]),
  filename: z.string().min(1).max(300),
  mime: z.string().min(1).max(100),
  transactions: z.array(rowSchema).min(1).max(3000),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", code: "BAD_PAYLOAD", detail: parsed.error.message },
      { status: 400 },
    );
  }
  const { person, filename, mime, transactions } = parsed.data;

  const allowed = new Set(allowedCategories());
  const normalized = transactions.map((row) => {
    const category = allowed.has(row.category)
      ? row.category
      : row.type === "credit"
        ? "Net monthly income"
        : "Miscellaneous";
    const d = new Date(row.isoDate);
    const month = Number.isNaN(d.getTime()) ? "Unknown" : formatMonth(d);
    return {
      isoDate: row.isoDate,
      date: row.date,
      month,
      particulars: row.particulars,
      amount: row.amount,
      type: row.type,
      category,
    };
  });

  // Statement-level fingerprint — the whole file's extracted content.
  // Lets us re-import the same statement idempotently (replaces the prior row).
  const fingerprintSource = `${person}|${filename}|${normalized
    .map((r) => `${r.isoDate}|${r.amount}|${r.particulars}|${r.type}`)
    .join("\n")}`;
  const fileHash = createHash("sha256").update(fingerprintSource).digest("hex");

  try {
    await ensureSchema();
  } catch (e) {
    console.error("DB schema error", e);
    return NextResponse.json(
      { error: "Database not configured. Set DATABASE_URL.", code: "DB_UNAVAILABLE" },
      { status: 500 },
    );
  }

  const q = sql();
  const jsonBody = JSON.stringify(normalized);

  // ON CONFLICT handles the idempotent re-upload — same file by the same user
  // overwrites the earlier row rather than creating a duplicate statement.
  const rows = (await q`
    INSERT INTO imports (user_id, person, filename, mime, row_count, transactions, file_hash)
    VALUES (
      ${user.id},
      ${person},
      ${filename},
      ${mime},
      ${normalized.length},
      ${jsonBody}::jsonb,
      ${fileHash}
    )
    ON CONFLICT (user_id, file_hash)
    WHERE file_hash IS NOT NULL
    DO UPDATE SET
      person = EXCLUDED.person,
      filename = EXCLUDED.filename,
      mime = EXCLUDED.mime,
      row_count = EXCLUDED.row_count,
      transactions = EXCLUDED.transactions,
      created_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `) as unknown as Array<{ id: number; inserted: boolean }>;

  const importId = rows[0]?.id;
  const wasInsert = rows[0]?.inserted === true;

  return NextResponse.json({
    ok: true,
    importId,
    inserted: wasInsert ? normalized.length : 0,
    updated: wasInsert ? 0 : normalized.length,
    skipped: 0,
    rowCount: normalized.length,
  });
}
