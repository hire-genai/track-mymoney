-- Track-MyMoney schema (Neon Postgres)
-- Applied automatically at runtime via src/lib/db.ts::ensureSchema().
-- Kept here as a reference; safe to run manually.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

CREATE TABLE IF NOT EXISTS imports (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person CHAR(1) NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_imports_user ON imports(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person CHAR(1) NOT NULL,                 -- 'A' or 'B'
  month TEXT NOT NULL,                     -- e.g. 'Sep 2026'
  date TEXT NOT NULL,                      -- e.g. '03-09'
  particulars TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,          -- always positive magnitude
  type TEXT NOT NULL,                      -- 'credit' | 'debit'
  category TEXT NOT NULL,                  -- sub-category name
  import_id BIGINT REFERENCES imports(id) ON DELETE SET NULL,
  fingerprint TEXT NOT NULL,               -- SHA-256(person|date|amount|desc) for idempotent re-import
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_user_fingerprint ON transactions(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_tx_user_month ON transactions(user_id, person, month);
