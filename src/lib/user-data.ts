import "server-only";
import { sql, ensureSchema } from "@/lib/db";
import { MONTHS } from "@/lib/finance-data";
import type { PersonId, Transaction } from "@/lib/types";

export type TxnStore = Record<PersonId, Record<string, Transaction[]>>;

interface Row {
  id: number;
  person: "A" | "B";
  month: string;
  date: string;
  particulars: string;
  amount: string | number;
  type: "credit" | "debit";
  category: string;
}

export interface UserDataResult {
  txns: TxnStore;
  importsCount: number;
  importsByPerson: Record<PersonId, number>;
}

export async function loadUserData(userId: number): Promise<UserDataResult> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`
    SELECT id, person, month, date, particulars, amount, type, category
    FROM transactions
    WHERE user_id = ${userId}
    ORDER BY person ASC, month DESC, date ASC, id ASC
  `) as unknown as Row[];

  const store: TxnStore = {
    A: Object.fromEntries(MONTHS.map((m) => [m, []])) as Record<string, Transaction[]>,
    B: Object.fromEntries(MONTHS.map((m) => [m, []])) as Record<string, Transaction[]>,
  };

  for (const row of rows) {
    const bucket = store[row.person];
    if (!bucket) continue;
    // Any month present in the DB is bucketed, even if outside the default recent window.
    const list = (bucket[row.month] ??= []);
    list.push({
      id: `db-${row.id}`,
      date: row.date,
      particulars: row.particulars,
      amount: typeof row.amount === "string" ? Number(row.amount) : row.amount,
      type: row.type,
      category: row.category,
    });
  }

  const importRows = (await q`
    SELECT person, COUNT(*)::int AS n
    FROM imports
    WHERE user_id = ${userId}
    GROUP BY person
  `) as unknown as Array<{ person: "A" | "B"; n: number }>;

  const importsByPerson: Record<PersonId, number> = { A: 0, B: 0 };
  for (const r of importRows) importsByPerson[r.person] = r.n;
  const importsCount = importsByPerson.A + importsByPerson.B;

  return { txns: store, importsCount, importsByPerson };
}

/** Kept for backward compatibility. */
export async function loadUserTransactions(userId: number): Promise<TxnStore> {
  const { txns } = await loadUserData(userId);
  return txns;
}
