import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadUserData } from "@/lib/user-data";
import type { PersonId } from "@/lib/types";

interface ClassifyRow {
  id: string;
  primaryCategory: string;
  subcategory: string;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let txns: Awaited<ReturnType<typeof loadUserData>>["txns"];
  try {
    ({ txns } = await loadUserData(user.id));
  } catch (e) {
    console.error("classify: loadUserData failed", (e as Error).message);
    return NextResponse.json(
      { error: "Database not configured. Set DATABASE_URL.", code: "DB_UNAVAILABLE" },
      { status: 500 },
    );
  }

  const rows: ClassifyRow[] = [];
  for (const personId of Object.keys(txns) as PersonId[]) {
    const byMonth = txns[personId];
    for (const month of Object.keys(byMonth)) {
      for (const tx of byMonth[month]) {
        rows.push({
          id: tx.id,
          primaryCategory: tx.primaryCategory ?? "Unknown",
          subcategory: tx.category,
        });
      }
    }
  }

  return NextResponse.json({ transactions: rows, count: rows.length });
}
