import "server-only";
import { sql, ensureSchema } from "@/lib/db";
import { MONTHS, monthLabel, getPrimaryCategory } from "@/lib/finance-data";
import type { PersonId, Transaction } from "@/lib/types";

export type TxnStore = Record<PersonId, Record<string, Transaction[]>>;

export interface UserDataResult {
  txns: TxnStore;
  importsCount: number;
  importsByPerson: Record<PersonId, number>;
}

interface ImportRow {
  id: number;
  person: "A" | "B";
  transactions: unknown;
}

interface JsonTxn {
  isoDate?: string;
  date?: string;
  month?: string;
  particulars?: string;
  amount?: number | string;
  type?: "credit" | "debit";
  category?: string;
}

function monthFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return monthLabel(d);
}

/**
 * Load every statement for the user and expand the stored JSONB arrays into
 * the per-month TxnStore the dashboard expects. Each in-memory transaction gets
 * a composite id of the form `db-{importId}-{index}` so PATCH/DELETE routes can
 * locate it inside the JSONB blob.
 */
export async function loadUserData(userId: number): Promise<UserDataResult> {
  await ensureSchema();
  const q = sql();

  const imports = (await q`
    SELECT id, person, transactions
    FROM imports
    WHERE user_id = ${userId}
    ORDER BY created_at ASC, id ASC
  `) as unknown as ImportRow[];

  const store: TxnStore = {
    A: Object.fromEntries(MONTHS.map((m) => [m, []])) as Record<string, Transaction[]>,
    B: Object.fromEntries(MONTHS.map((m) => [m, []])) as Record<string, Transaction[]>,
  };
  const importsByPerson: Record<PersonId, number> = { A: 0, B: 0 };

  for (const imp of imports) {
    importsByPerson[imp.person] = (importsByPerson[imp.person] ?? 0) + 1;
    const list = Array.isArray(imp.transactions) ? (imp.transactions as JsonTxn[]) : [];
    const bucket = store[imp.person];
    if (!bucket) continue;
    list.forEach((row, idx) => {
      if (!row || typeof row !== "object") return;
      const particulars = typeof row.particulars === "string" ? row.particulars : "";
      const type = row.type === "credit" || row.type === "debit" ? row.type : "debit";
      const amount =
        typeof row.amount === "number"
          ? row.amount
          : typeof row.amount === "string"
            ? Number(row.amount)
            : NaN;
      if (!Number.isFinite(amount) || amount <= 0) return;
      const date = typeof row.date === "string" && row.date ? row.date : "";
      const month =
        typeof row.month === "string" && row.month
          ? row.month
          : typeof row.isoDate === "string"
            ? monthFromIso(row.isoDate)
            : "Unknown";
      const category = typeof row.category === "string" && row.category ? row.category : "Miscellaneous";
      const monthList = (bucket[month] ??= []);
      monthList.push({
        id: `db-${imp.id}-${idx}`,
        date,
        particulars,
        amount,
        type,
        category,
        primaryCategory: getPrimaryCategory(category),
      });
    });
  }

  const importsCount = importsByPerson.A + importsByPerson.B;
  return { txns: store, importsCount, importsByPerson };
}

/** Kept for backward compatibility. */
export async function loadUserTransactions(userId: number): Promise<TxnStore> {
  const { txns } = await loadUserData(userId);
  return txns;
}
