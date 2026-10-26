import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawEmail = (body as { email?: unknown } | null)?.email;
  if (typeof rawEmail !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  try {
    await ensureSchema();
  } catch (e) {
    console.error("DB schema error", e);
    return NextResponse.json(
      { error: "Database is not configured. Set DATABASE_URL in .env." },
      { status: 500 },
    );
  }

  const q = sql();
  const rows = (await q`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `) as unknown as { id: number }[];

  return NextResponse.json({ exists: rows.length > 0 });
}
