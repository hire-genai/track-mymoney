import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import {
  createSession,
  hashOtp,
  isValidEmail,
  nameFromEmail,
  normalizeEmail,
} from "@/lib/auth";

interface UserRow {
  id: number;
  email: string;
  name: string;
}

interface OtpRow {
  id: number;
  code_hash: string;
  expires_at: string;
  consumed: boolean;
  attempts: number;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const b = body as { email?: unknown; code?: unknown; name?: unknown } | null;
  if (typeof b?.email !== "string" || typeof b?.code !== "string") {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const email = normalizeEmail(b.email);
  const code = b.code.trim();
  const providedName = typeof b.name === "string" ? b.name.trim() : "";
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid email and 6-digit code" }, { status: 400 });
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

  const otpRows = (await q`
    SELECT id, code_hash, expires_at, consumed, attempts
    FROM otps
    WHERE email = ${email} AND consumed = FALSE
    ORDER BY id DESC
    LIMIT 1
  `) as unknown as OtpRow[];

  const otp = otpRows[0];
  if (!otp) {
    return NextResponse.json({ error: "No active code found. Request a new one." }, { status: 400 });
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }
  if (otp.attempts >= 5) {
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
  }

  const providedHash = hashOtp(code);
  if (providedHash !== otp.code_hash) {
    await q`UPDATE otps SET attempts = attempts + 1 WHERE id = ${otp.id}`;
    return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
  }

  await q`UPDATE otps SET consumed = TRUE WHERE id = ${otp.id}`;

  const existing = (await q`
    SELECT id, email, name FROM users WHERE email = ${email}
  `) as unknown as UserRow[];

  let user: UserRow;
  if (existing[0]) {
    user = existing[0];
    await q`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;
  } else {
    const displayName = providedName || nameFromEmail(email);
    const inserted = (await q`
      INSERT INTO users (email, name, last_login_at)
      VALUES (${email}, ${displayName}, NOW())
      RETURNING id, email, name
    `) as unknown as UserRow[];
    user = inserted[0];
  }

  await createSession(user);
  return NextResponse.json({ ok: true, user });
}
