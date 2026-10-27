# Track-MyMoney — Project Map

Living document. Add a short section after each session describing what you touched
and why. Keep each file row to one line.

---

## Stack snapshot

- Next.js 16.4.3 (App Router, Turbopack)
- React 19.3
- Neon Postgres (`@neondatabase/serverless`)
- JWT/OTP email auth (`jose`, `nodemailer`)
- `unpdf` for serverless PDF text extraction
- OpenRouter LLM for categorization (meta-llama 3.3 70B free, with gemini-flash + mistral-small fallbacks)
- CSS Modules — no Tailwind

Build: `npm run build` · Tests: `npm test` · Dev: `npm run dev`

## Markdown files

Only two markdown files are kept at the repo root:

- `AGENTS.md` — rules + conventions for AI agents working in this repo. Auto-loaded by Claude Code.
- `TRACK-MYMONEY.md` — this file. Project map + per-session log.

Do NOT create additional `.md` files for notes, plans, or summaries.

---

## File map

### App routes

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Landing page. |
| `src/app/dashboard/page.tsx` | Main dashboard shell. |
| `src/app/dashboard/import/page.tsx` | Full-page import flow. |
| `src/app/login/page.tsx` | Email + OTP login screen. |

### API routes

| File | Purpose |
|---|---|
| `src/app/api/auth/send-otp/route.ts` | Email a 6-digit OTP. |
| `src/app/api/auth/verify-otp/route.ts` | Verify OTP, mint session cookie. |
| `src/app/api/auth/me/route.ts` | Return current session user. |
| `src/app/api/auth/logout/route.ts` | Clear session cookie. |
| `src/app/api/auth/lookup/route.ts` | Email-exists check. |
| `src/app/api/import/parse/route.ts` | **Parse uploaded PDF/CSV/TXT → transactions. No LLM. Deterministic regex + unpdf for PDF text.** |
| `src/app/api/import/commit/route.ts` | Insert validated transactions to DB, dedup by fingerprint. |
| `src/app/api/transactions/[id]/route.ts` | PATCH category/type, DELETE a transaction. |

### Lib

| File | Purpose |
|---|---|
| `src/lib/db.ts` | Neon SQL client + `ensureSchema()`. |
| `src/lib/auth.ts` | OTP generation/hashing, session JWT, `getSessionUser()`. |
| `src/lib/mailer.ts` | Nodemailer SMTP wrapper. |
| `src/lib/finance-data.ts` | Allowed category lists (`FIXED_SUBS`, `INCOME_SUBS`, etc.), demo seed data, month helpers. |
| `src/lib/types.ts` | `PersonId`, `TxType`, `Transaction`, `Goal`, …shared types. |
| `src/lib/import/utils.ts` | `allowedCategories()`, `formatMonth()`, `fingerprintRow()` — shared by parse + commit + transactions routes. |
| `src/lib/import/parser.ts` | **Deterministic parser. `parseStatementText()` for PDF/TXT, `parseCsvText()` for CSV. Line-by-line regex: date → particulars → amount → balance. Decides debit/credit via balance delta.** |
| `src/lib/import/categorize.ts` | Keyword-rule categorizer. Fallback when the AI call is unavailable. |
| `src/lib/import/ai-categorize.ts` | **OpenRouter LLM categorizer. Model `nvidia/nemotron-3-ultra-550b-a55b:free`. Batches of 40 txns, parallel calls, 25s timeout, strict JSON response. Degrades gracefully to keyword rules on 4xx/5xx/timeout.** |

### Components

| File | Purpose |
|---|---|
| `src/components/import/ImportFlow.tsx` | Full-page import flow. File picker + person selector + results table + debug log. |
| `src/components/dashboard/UploadSection.tsx` | **Dashboard upload widget. "Parse Statement" runs the full pipeline (parse → AI categorize → commit to DB → `router.refresh()`) in place, with a spinner on the button and a status strip underneath. No navigation.** |
| `src/components/Icon.tsx` | SVG icon map. |
| `src/components/dashboard/*` | Dashboard widgets (BuckOverview, GoalsSection, etc.). |

### Context

| File | Purpose |
|---|---|
| `src/context/FinanceContext.tsx` | React context: txns, people, auth state, pending import file hand-off. |

### Tests (`tests/*.test.ts`)

| File | Purpose |
|---|---|
| `tests/auth.test.ts` | OTP generation, hash, email normalization, verify-otp flow. |
| `tests/months.test.ts` | Month label / rolling window helpers. |
| `tests/upload-state.test.ts` | Finance context auth/upload counting rules. |
| `tests/parser.test.ts` | **PDF-text + CSV parser cases (UCO-style lines, Withdrawal/Deposit cols, signed Amount, empty-input warning).** |

---

## How parsing works

The pipeline runs end-to-end in-place on the dashboard. The user never leaves `/dashboard`.

1. **Client** (`UploadSection.tsx`): user picks file → clicks **Parse Statement**.
   - Button disables, shows spinner + "Parsing…".
   - Status strip below the dropzone shows the live step.
2. **Extraction** (`POST /api/import/parse`):
   - PDF → `unpdf.extractText({ mergePages: true })` → single text blob.
   - CSV/TXT → `file.text()`.
3. **Deterministic parser** (`lib/import/parser.ts`):
   - Splits text into lines.
   - Finds `DD-MM-YYYY` on each line → extracts all numbers after it.
   - If ≥2 numbers: last = running balance, second-last = txn amount. Direction (debit/credit) inferred from the balance delta vs. the prior row.
   - If 1 number: direction from keyword hints.
   - Particulars = text between the date and the first amount.
4. **AI categorizer** (`lib/import/ai-categorize.ts`):
   - Batches of 25 transactions. Max 3 in flight at once (free-tier throttle). 55 s per batch, 1 retry.
   - Sends `models: [llama-3.3-70b:free, gemini-2.0-flash-exp:free, mistral-small-3.1-24b:free]` and `provider: {sort: "throughput"}` so OpenRouter routes to the fastest available model.
   - `reasoning: {enabled: false}` — reasoning tokens were the reason nemotron 550B was timing out at 25s on every batch.
   - Few-shot prompt with real UCO/HDFC merchant → category mappings; strict JSON response.
   - Any batch that fails (missing key, non-OK, bad JSON, timeout, unknown category) falls back to the deterministic `categorize()` keyword rules per txn.
5. **Commit** (`POST /api/import/commit`):
   - **One row per statement.** The whole transactions array is written to `imports.transactions` (JSONB).
   - `file_hash` SHA-256 of (person + filename + extracted content) is the idempotency key — re-uploading the same file UPDATEs the existing row instead of creating a duplicate.
6. **Refresh**: client calls `router.refresh()`. `app/dashboard/layout.tsx` re-runs `loadUserData()`, which `SELECT`s imports, unpacks `transactions` JSONB into per-month `Transaction[]`, and passes fresh `initialTxns` to `FinanceProvider`. The `useEffect` on `initialTxns` in `FinanceContext.tsx` syncs the new rows into state — Months / Comparison / Couple / Goals KPIs all update without a full page reload.

Debug (server + client) is prefixed `[parse]`, `[route]`, `[ai]`, `[UploadSection]`.

## Database shape

```
imports
├─ id BIGSERIAL
├─ user_id INT
├─ person CHAR(1)              -- 'A' | 'B'
├─ filename TEXT
├─ mime TEXT
├─ row_count INT
├─ transactions JSONB          -- [{isoDate, date, month, particulars, amount, type, category}, …]
├─ file_hash TEXT              -- SHA-256; unique per (user_id, file_hash)
└─ created_at TIMESTAMPTZ
```

One statement = one row. Composite transaction id for PATCH/DELETE is
`{importId}-{index}` (position inside the JSONB array). The legacy per-row
`transactions` table is preserved so old data still loads but is no longer
written to — new ids there get the prefix `legacy-{rowId}`.

---

## Session log

### 2026-10-27 (session 4) — JSONB per-statement schema + fast AI model

**Why.** Prior session stored one row per transaction in `transactions` table (209 rows per statement). User wants one row per statement with the whole transaction array as JSON — easier to use for AI fine-tuning / few-shot prompting, and matches how the statement is logically grouped. Previous session also used nemotron 550B which timed out on all 6 batches (25 s abort each → 25 s wasted + full keyword fallback).

**Schema changes** (`src/lib/db.ts`, `drizzle/schema.sql`):
- `imports` gains `transactions JSONB NOT NULL DEFAULT '[]'::jsonb` and `file_hash TEXT`.
- Unique partial index `(user_id, file_hash) WHERE file_hash IS NOT NULL` → re-uploading the same statement UPDATEs the existing row via `ON CONFLICT DO UPDATE`.
- Legacy `transactions` per-row table kept in place but no longer written.
- `ensureSchema()` uses `ALTER TABLE … ADD COLUMN IF NOT EXISTS` so existing Neon dbs upgrade in place.

**Commit route** (`src/app/api/import/commit/route.ts`): completely rewritten. Zod-validates the array, normalizes each txn, computes `file_hash`, writes a single row via `INSERT … ON CONFLICT (user_id, file_hash) DO UPDATE`. Returns `{inserted, updated, rowCount, importId}`.

**Load path** (`src/lib/user-data.ts`): now `SELECT id, person, transactions FROM imports`, unpacks each JSONB array into per-month `Transaction[]`. Ids: `db-{importId}-{idx}`. Also pulls remaining rows from the legacy table so old data still appears (prefixed `db-legacy-{rowId}`).

**PATCH route** (`src/app/api/transactions/[id]/route.ts`): parses composite id; for JSON cells does `jsonb_set(transactions, '{idx,category}', …)` in place; for legacy rows keeps the old UPDATE. 404s if the import/row is missing or the index is out of range.

**FinanceContext.tsx**: `moveTransaction` passes the composite id straight through (`encodeURIComponent(txId.slice(3))`) instead of coercing to a number.

**AI fixes** (`src/lib/import/ai-categorize.ts`):
- Model: `meta-llama/llama-3.3-70b-instruct:free` (primary) with gemini-2.0-flash-exp:free and mistral-small-3.1-24b:free as OpenRouter-side fallbacks via the `models` array. Nemotron 550B removed — reasoning model, too slow for free tier.
- Timeout 25 s → 55 s; batch size 40 → 25; concurrency capped at 3 via a worker pool (not fire-and-forget `Promise.all`).
- `reasoning: {enabled: false}` and `provider: {sort: "throughput"}` added.
- One retry per batch.
- Prompt rewritten with ~25 few-shot examples drawn from real UCO/HDFC/ICICI UPI merchant patterns.

**Keyword fallback** (`src/lib/import/categorize.ts`): rules reordered most-specific-first; added SMS CHRG/CGST/SGST → Miscellaneous, Amazon Pay → Subscriptions/Guilt-Free split, Ekart/XpressBees/IRCTC → Transportation, Hanshdudhbha/HaryanaStore/Balajigenera/AjitVegetable → Groceries, KanhiyaSweets/Foodies/Zoyachickens → Guilt-Free.

**Docs cleanup**: deleted `README.md` and `agent.md` (lowercase). Only `AGENTS.md` + `TRACK-MYMONEY.md` remain at repo root.

**Verified**: `npm test` → 29/29. `npx tsc --noEmit` → clean. `npm run build` → clean.

**Expected timing on the UCO 8-page / 209-txn statement**: extract ~130 ms + regex ~6 ms + AI 9 batches × ~5–15 s with concurrency 3 ≈ 15–45 s + commit (single INSERT) ~300 ms. Full round-trip under 60 s even on the free tier.

### 2026-10-27 (session 3) — In-place dashboard parse + OpenRouter categorizer

- **Removed the `/dashboard/import` navigation** from the dashboard's "Parse Statement" button. The button now runs the full pipeline right there without changing routes.
- `src/components/dashboard/UploadSection.tsx`:
  - Added `parsing` / `parseStatus` / `parseError` state.
  - `runParseAndCommit(file)` posts to `/api/import/parse` → `/api/import/commit` → `router.refresh()`.
  - Button disables + shows an inline spinner + "Parsing…" while running. Status strip under the dropzone shows "Extracting text…" → "Parsing transactions…" → "Saving N transactions…" → "✓ N saved, …ms".
  - Clears status on file replace / clear.
- `src/lib/import/ai-categorize.ts` (NEW):
  - OpenRouter client. Model `nvidia/nemotron-3-ultra-550b-a55b:free`.
  - Batches 40 txns per call, parallel. 25 s per batch. `response_format: {type: "json_object"}`, temp 0, max_tokens 2000.
  - Prompt enumerates the exact allowed categories (INCOME/FIXED/INVEST/BASE_SAVINGS/GUILT subs) with short Indian-bank-specific disambiguation rules (UPI/MPAY, Jio, Zepto, SliceSmallFi, etc.).
  - Falls back to `categorize()` keyword rules per txn on: missing key, non-OK response, invalid JSON, wrong array length, unknown category, timeout.
  - Every batch outcome written to the server's `debug[]` log.
- `src/app/api/import/parse/route.ts`:
  - After regex parse, awaits `aiCategorize(...)` and overwrites each transaction's `category`.
  - `timings` now reports `extractMs`, `parseMs`, `aiMs`, `totalMs`.
- `AGENTS.md`: removed stale "do NOT add OpenRouter back" rule; replaced with description of the current OpenRouter + fallback-rule architecture; added new file rows.
- `npm test` → 29/29. `npm run build` → clean.

### 2026-10-27 (session 2) — Enable parse button + deterministic PDF/CSV parser

- Installed `unpdf` for serverless PDF text extraction (already listed in `next.config.ts serverExternalPackages`).
- Added `src/lib/import/parser.ts`: regex-based line parser; balance-delta heuristic for debit/credit.
- Added `src/lib/import/categorize.ts`: keyword-rule categorizer mapping to allowed `FIXED_SUBS` / `INCOME_SUBS` / `INVEST_SUBS` / `GUILT_SUBS` / `BASE_SAVINGS_SUBS`.
- Added `src/app/api/import/parse/route.ts`: auth-gated multipart endpoint. Returns `{transactions, counts, warnings, debug, timings}`. Logs `[import/parse] <reqId>` to server console.
- Edited `src/components/import/ImportFlow.tsx`:
  - Removed `disabled` + "Parsing coming soon" title.
  - Wired `onClick → handleParse()` → POST `/api/import/parse` with `FormData {file, person}`.
  - Renders a results table (date, particulars, type, category, amount), a summary strip (counts + timings), and a collapsible debug log.
  - Browser `console.log` entries prefixed `[ImportFlow]` and mirrored `[server] …` lines for every debug entry returned by the API.
- Added `tests/parser.test.ts`: 5 cases covering UCO-style lines, no-date input, CSV columns, signed amounts.
- `npm test` → 29/29 pass. `npm run build` → clean.
