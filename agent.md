# track-mymoney — Agent State

## Plugin Pre-flight
> Note: Ponytail / Omni Route / Graphify / Agent Skills are not real tools.
> They do not exist in the Claude Code or npm ecosystem. Proceeding with
> actual available tooling.

- [INSTALLED] Next.js 16.4.3
- [INSTALLED] @neondatabase/serverless
- [INSTALLED] jose (JWT auth)
- [INSTALLED] nodemailer (OTP via Hostinger SMTP)
- [INSTALLED] pdf-parse ^2.4.5
- [INSTALLED] zod ^4.6.7
- [INSTALLED] server-only ^0.0.1
- [INSTALLED] tsx ^4.23.15 (dev, test runner)

## Commands
```
npm run dev     # http://localhost:3000
npm test        # tsx --conditions=react-server --test tests/*.test.ts
npm run build   # production build
npx tsc --noEmit  # type check
```

## Project Conventions
- App Router (Next.js 16), Cache Components enabled, `instant = false` for cookie pages
- DB: Neon Postgres via @neondatabase/serverless
- Auth: JWT (jose) + OTP email (nodemailer/Hostinger SMTP)
- CSS Modules, emerald/slate palette, inline SVG icons
- No `export const runtime` or `dynamic` on routes (Next 16 Cache Components incompatibility)
- pdf-parse v2: class API — `new PDFParse({data}).getText()`
- Tests: `--conditions=react-server` so `server-only` resolves to empty stub

## Key Decisions
- Free-only AI via OpenRouter: live /api/v1/models discovery + pricing filter (prompt==0 && completion==0)
- PDF fingerprint: SHA-256(person|isoDate|amount|desc|type), UNIQUE INDEX enforces idempotency
- Reconciliation is deterministic (no AI arithmetic)
- Scanned PDFs: rejected with meaningful error (no OCR, no paid services)
- No OPENROUTER_MODEL fallback — strict free model registry only

## Current State
- [DONE] OTP auth modal (name → email → OTP inline)
- [DONE] Dashboard landing with demo/real data split
- [DONE] Import feature: PDF/CSV parser with free-only OpenRouter AI
- [DONE] 14/14 tests pass, tsc clean, next build green (13 routes)
- [IDLE] Awaiting next task
