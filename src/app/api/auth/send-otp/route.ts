import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import {
  generateOtp,
  hashOtp,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mailer";

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
  const code = generateOtp();
  const codeHash = hashOtp(code);
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await q`
      INSERT INTO otps (email, code_hash, expires_at)
      VALUES (${email}, ${codeHash}, ${expires.toISOString()})
    `;
  } catch (e) {
    console.error("DB insert error", e);
    return NextResponse.json({ error: "Could not store verification code" }, { status: 500 });
  }

  try {
    await sendOtpEmail(email, code);
  } catch (e) {
    console.error("SMTP error", e);
    return NextResponse.json(
      { error: "Could not send verification email. Check SMTP settings." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
