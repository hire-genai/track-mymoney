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

-- One row PER STATEMENT. All extracted transactions live in the `transactions`
-- JSONB column as an array of objects — this keeps a statement's context
-- together, which is what the AI categorizer uses as training/inference input.
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
);
CREATE INDEX IF NOT EXISTS idx_imports_user ON imports(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_imports_user_file_hash
  ON imports(user_id, file_hash) WHERE file_hash IS NOT NULL;

-- The per-row `transactions` table was retired. All transactions live inside
-- imports.transactions (JSONB). Drop it if an older deployment still has it.
DROP TABLE IF EXISTS transactions;
