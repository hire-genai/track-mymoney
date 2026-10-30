import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

interface Row {
  id: number;
  person: "A" | "B";
  filename: string;
  mime: string;
  row_count: number;
  created_at: string;
  transactions: unknown;
}

interface JsonTxn {
  isoDate?: string;
  amount?: number | string;
  type?: "credit" | "debit";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

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
  const rows = (await q`
    SELECT id, person, filename, mime, row_count, created_at, transactions
    FROM imports
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC, id DESC
  `) as unknown as Row[];

  const statements = rows.map((r) => {
    const list = Array.isArray(r.transactions) ? (r.transactions as JsonTxn[]) : [];
    let credit = 0;
    let debit = 0;
    let minIso: string | null = null;
    let maxIso: string | null = null;
    for (const t of list) {
      const amt =
        typeof t.amount === "number"
          ? t.amount
          : typeof t.amount === "string"
            ? Number(t.amount)
            : NaN;
      if (Number.isFinite(amt)) {
        if (t.type === "credit") credit += amt;
        else debit += amt;
      }
      const iso = typeof t.isoDate === "string" ? t.isoDate : "";
      if (iso) {
        if (!minIso || iso < minIso) minIso = iso;
        if (!maxIso || iso > maxIso) maxIso = iso;
      }
    }
    return {
      id: r.id,
      person: r.person,
      filename: r.filename,
      mime: r.mime,
      rowCount: r.row_count,
      createdAt: r.created_at,
      totalCredit: Math.round(credit * 100) / 100,
      totalDebit: Math.round(debit * 100) / 100,
      firstDate: minIso,
      lastDate: maxIso,
    };
  });

  return NextResponse.json({ ok: true, statements });
}
