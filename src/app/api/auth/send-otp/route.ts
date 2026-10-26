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

  // Rate-limit: one OTP per 60 seconds per email.
  const recent = (await q`
    SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age_secs
    FROM otps
    WHERE email = ${email} AND consumed = FALSE
    ORDER BY id DESC
    LIMIT 1
  `) as unknown as { age_secs: number }[];
  if (recent[0] && recent[0].age_secs < 60) {
    const wait = 60 - recent[0].age_secs;
    return NextResponse.json(
      { error: `Please wait ${wait}s before requesting a new code.`, retryAfter: wait },
      { status: 429 },
    );
  }

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
