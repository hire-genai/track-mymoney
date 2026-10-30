import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { allowedCategories } from "@/lib/import/utils";

const patchSchema = z.object({
  category: z.string().min(1).max(100),
  type: z.enum(["credit", "debit"]).optional(),
});

/**
 * The composite id looks like `{importId}-{index}` where importId points at
 * imports.id and index is the position inside imports.transactions JSONB array.
 */
function parseCompositeId(raw: string): { importId: number; index: number } | null {
  const [a, b] = raw.split("-");
  const importId = Number(a);
  const index = Number(b);
  if (!Number.isInteger(importId) || importId <= 0) return null;
  if (!Number.isInteger(index) || index < 0) return null;
  return { importId, index };
}

export async function PATCH(
  request: Request,
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
  const parsedId = parseCompositeId(rawId);
  if (!parsedId) {
    return NextResponse.json(
      { error: "Invalid transaction id", code: "BAD_ID" },
      { status: 400 },
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

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", code: "BAD_PAYLOAD", detail: parsed.error.message },
      { status: 400 },
    );
  }

  const allowed = new Set(allowedCategories());
  if (!allowed.has(parsed.data.category)) {
    return NextResponse.json(
      { error: "Unknown category", code: "BAD_CATEGORY" },
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

  // JSONB in-place update: jsonb_set at the array index.
  const { importId, index } = parsedId;
  const categoryPath = `{${index},category}`;
  const typePath = `{${index},type}`;
  const categoryJson = JSON.stringify(parsed.data.category);
  const typeJson = parsed.data.type ? JSON.stringify(parsed.data.type) : null;

  const rows = (await q`
    UPDATE imports
    SET transactions = CASE
      WHEN ${typeJson}::text IS NULL THEN
        jsonb_set(transactions, ${categoryPath}::text[], ${categoryJson}::jsonb, false)
      ELSE
        jsonb_set(
          jsonb_set(transactions, ${categoryPath}::text[], ${categoryJson}::jsonb, false),
          ${typePath}::text[], ${typeJson}::jsonb, false
        )
    END
    WHERE id = ${importId} AND user_id = ${user.id}
      AND jsonb_array_length(transactions) > ${index}
    RETURNING id
  `) as unknown as Array<{ id: number }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Transaction not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    transaction: {
      id: `${importId}-${index}`,
      category: parsed.data.category,
      type: parsed.data.type ?? null,
    },
  });
}
