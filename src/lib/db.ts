import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | null = null;
let ensured = false;

export function sql() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  cached = neon(url);
  return cached;
}

export async function ensureSchema(): Promise<void> {
  if (ensured) return;
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    )
  `;
  await q`
    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT FALSE,
      attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email)`;

  await q`
    CREATE TABLE IF NOT EXISTS imports (
      id BIGSERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person CHAR(1) NOT NULL,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      row_count INT NOT NULL DEFAULT 0,
      raw_response JSONB,
      transactions JSONB NOT NULL DEFAULT '[]'::jsonb,
      file_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS idx_imports_user ON imports(user_id)`;
  // Idempotent migrations for existing databases that pre-date the JSONB redesign.
  await q`ALTER TABLE imports ADD COLUMN IF NOT EXISTS transactions JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await q`ALTER TABLE imports ADD COLUMN IF NOT EXISTS file_hash TEXT`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS idx_imports_user_file_hash ON imports(user_id, file_hash) WHERE file_hash IS NOT NULL`;

  // The per-row `transactions` table was retired — all transactions now live
  // inside imports.transactions (JSONB). Drop it if an older deployment still
  // has it so the schema stays single-source.
  await q`DROP TABLE IF EXISTS transactions`;

  ensured = true;
}
