import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { allowedCategories, fingerprintRow, formatMonth } from "@/lib/import/parser";

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.message },
      { status: 400 },
    );
  }
  const { person, filename, mime, transactions } = parsed.data;

  const allowed = new Set(allowedCategories());
  const q = sql();

  try {
    await ensureSchema();
  } catch (e) {
    console.error("DB schema error", e);
    return NextResponse.json(
      { error: "Database not configured. Set DATABASE_URL." },
      { status: 500 },
    );
  }

  const importRows = (await q`
    INSERT INTO imports (user_id, person, filename, mime, row_count)
    VALUES (${user.id}, ${person}, ${filename}, ${mime}, ${transactions.length})
    RETURNING id
  `) as unknown as Array<{ id: number }>;
  const importId = importRows[0]?.id;

  let inserted = 0;
  let skipped = 0;
  const chunkSize = 100;

  for (let i = 0; i < transactions.length; i += chunkSize) {
    const chunk = transactions.slice(i, i + chunkSize);

    const values: Array<Record<string, unknown>> = [];
    for (const row of chunk) {
      let category = row.category;
      if (!allowed.has(category)) {
        category = row.type === "credit" ? "Net monthly income" : "Miscellaneous";
      }
      const d = new Date(row.isoDate);
      if (Number.isNaN(d.getTime())) {
        skipped++;
        continue;
      }
      const month = formatMonth(d);
      const fp = fingerprintRow(person, row.isoDate, row.amount, row.particulars, row.type);
      values.push({
        user_id: user.id,
        person,
        month,
        date: row.date,
        particulars: row.particulars,
        amount: row.amount,
        type: row.type,
        category,
        import_id: importId,
        fingerprint: fp,
      });
    }

    if (values.length === 0) continue;

    const result = (await q`
      INSERT INTO transactions
        (user_id, person, month, date, particulars, amount, type, category, import_id, fingerprint)
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(values)}::jsonb) AS x(
        user_id INT,
        person CHAR(1),
        month TEXT,
        date TEXT,
        particulars TEXT,
        amount NUMERIC,
        type TEXT,
        category TEXT,
        import_id BIGINT,
        fingerprint TEXT
      )
      ON CONFLICT (user_id, fingerprint) DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: number }>;

    inserted += result.length;
    skipped += values.length - result.length;
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skipped,
    importId,
  });
}
