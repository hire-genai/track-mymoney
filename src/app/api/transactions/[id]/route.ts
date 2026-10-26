import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { allowedCategories } from "@/lib/import/parser";

const patchSchema = z.object({
  category: z.string().min(1).max(100),
  type: z.enum(["credit", "debit"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const txId = Number(rawId);
  if (!Number.isInteger(txId) || txId <= 0) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.message },
      { status: 400 },
    );
  }

  const allowed = new Set(allowedCategories());
  if (!allowed.has(parsed.data.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  try {
    await ensureSchema();
  } catch (e) {
    console.error("DB schema error", e);
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const q = sql();
  const nextType = parsed.data.type ?? null;
  const rows = (await q`
    UPDATE transactions
    SET category = ${parsed.data.category},
        type = COALESCE(${nextType}, type)
    WHERE id = ${txId} AND user_id = ${user.id}
    RETURNING id, category, type
  `) as unknown as Array<{ id: number; category: string; type: string }>;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, transaction: rows[0] });
}
