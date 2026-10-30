import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { id: rawId } = await params;
  const importId = Number(rawId);
  if (!Number.isInteger(importId) || importId <= 0) {
    return NextResponse.json(
      { error: "Invalid import id", code: "BAD_ID" },
      { status: 400 },
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
  // All transactions for a statement live in imports.transactions JSONB on the
  // same row — deleting the row removes every related transaction atomically.
  const rows = (await q`
    DELETE FROM imports
    WHERE id = ${importId} AND user_id = ${user.id}
    RETURNING id
  `) as unknown as Array<{ id: number }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Statement not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, deletedId: importId });
}
