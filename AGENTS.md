# AGENTS.md — Track-MyMoney

Project-specific rules for AI coding agents working in this Next.js 16 app.

---

## Coding Behaviour (from Karpathy Guidelines)

**Think first, code second.**
- State assumptions before implementing. If unclear, ask — don't guess.
- If multiple approaches exist, name them. Don't pick silently.
- Push back on requests where a simpler path exists.

**Simplicity first.**
- Write the minimum code that solves the problem. Nothing speculative.
- No extra abstractions, configurability, or error handling for impossible cases.
- If it could be 50 lines, don't write 200.

**Surgical changes.**
- Touch only what the request requires. Don't improve adjacent code.
- Match existing style (indentation, naming, patterns) even if you'd do it differently.
- Remove imports/variables YOUR changes orphan. Leave pre-existing dead code alone.

**Goal-driven execution.**
- For multi-step tasks, state a brief plan with a verify step for each stage.
- Run `npm test` and `npm run build` after changes. Both must pass before reporting done.

---

## Project Stack

- **Framework:** Next.js 16 (App Router, Turbopack). Read `node_modules/next/dist/docs/` before using Next APIs — this version has breaking changes.
- **DB:** Neon Postgres via `@neondatabase/serverless`. Client is `src/lib/db.ts`.
- **Auth:** JWT / OTP email flow. Session helper: `src/lib/auth.ts → getSessionUser()`.
- **PDF parsing:** `unpdf` (serverless pdfjs). Deterministic regex parser in `src/lib/import/parser.ts`.
- **AI categorization:** OpenRouter via `src/lib/import/ai-categorize.ts`. Primary model `meta-llama/llama-3.3-70b-instruct:free` with `google/gemini-2.0-flash-exp:free` and `mistralai/mistral-small-3.1-24b-instruct:free` as router-side fallbacks. Reads `OPENROUTER_API_KEY`. Degrades to deterministic keyword rules (`src/lib/import/categorize.ts`) on any failure. Reasoning tokens disabled; batches of 25, concurrency 3, 55 s timeout + 1 retry.
- **Transaction storage:** ONE ROW PER STATEMENT in `imports.transactions` (JSONB). Do NOT re-introduce per-row inserts into the legacy `transactions` table. Composite transaction id is `{importId}-{index}` where `index` is the position inside the JSONB array.
- **Styles:** CSS Modules (`*.module.css`). No Tailwind in this repo.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/import/utils.ts` | `allowedCategories`, `formatMonth`, `monthLabelFromIso` — shared across import pipeline. |
| `src/lib/import/parser.ts` | Deterministic PDF-text + CSV parser (regex, balance-delta debit/credit). |
| `src/lib/import/categorize.ts` | Keyword-rule categorizer (fallback when AI is unavailable). |
| `src/lib/import/ai-categorize.ts` | OpenRouter LLM categorizer. Batches of 25, concurrency 3, 55s timeout, graceful fallback. |
| `src/lib/user-data.ts` | `loadUserData(userId)` — reads `imports.transactions` JSONB and expands into per-month `Transaction[]`. |
| `src/app/api/import/parse/route.ts` | Extract text (unpdf for PDF) → regex parse → AI categorize → JSON. |
| `src/app/api/import/commit/route.ts` | Writes **one row per statement** to `imports.transactions` JSONB. `ON CONFLICT (user_id, file_hash) DO UPDATE` for idempotent re-upload. |
| `src/app/api/transactions/[id]/route.ts` | PATCH a transaction cell. Id format `{importId}-{index}` → `jsonb_set` in place. `legacy-{rowId}` for pre-JSONB rows. |
| `src/components/import/ImportFlow.tsx` | Full-page import flow (also usable). File picker + person selector + results table. |
| `src/components/dashboard/UploadSection.tsx` | Dashboard upload widget — Parse Statement runs the full pipeline in-place and refreshes KPIs. |

## Vercel / Serverless Rules

- Do NOT add `export const runtime = "nodejs"` on routes — it conflicts with `cacheComponents` in `next.config.ts`.
- If adding a new native npm package, add it to `serverExternalPackages` in `next.config.ts`.
- Never log PDF content, statement text, API keys, or user tokens in any log or error response.

## Error Response Shape

API routes return structured JSON on failure:
```json
{ "error": "...", "code": "SNAKE_CASE", "detail": "...", "reqId": "imp_..." }
```
Keep this shape. The client reads `code` and `detail` to display meaningful messages.

## Tests & Build

```bash
npm test        # 53 tests, all must pass
npm run build   # Turbopack production build, must succeed
```
