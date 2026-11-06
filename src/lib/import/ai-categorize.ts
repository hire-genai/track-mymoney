import "server-only";
import {
  BASE_SAVINGS_SUBS,
  FIXED_SUBS,
  GUILT_SUBS,
  INCOME_SUBS,
  INVEST_SUBS,
} from "@/lib/finance-data";
import type { TxType } from "@/lib/types";
import { categorize as fallbackCategorize } from "./categorize";

export interface AiTxn {
  isoDate: string;
  particulars: string;
  amount: number;
  type: TxType;
}

export interface AiCategorized extends AiTxn {
  category: string;
  /** True when this txn's category did NOT come from Nemotron — either the
   * batch failed after all retries, or Nemotron returned a category outside
   * the allowed taxonomy and the keyword rules picked it. Surfaced so the UI
   * can flag "AI did not actually classify this row". */
  fallback?: boolean;
}

// ----------------------------------------------------------------------------
// Nemotron-only configuration
// ----------------------------------------------------------------------------
// This pipeline sends requests to NVIDIA Nemotron exclusively. There is no
// Llama / Gemini / Mistral fallback. If Nemotron fails after all retries we
// degrade to the deterministic keyword categorizer (rules, not another LLM)
// and clearly flag every affected row with `fallback: true`.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** OpenRouter slug for NVIDIA Nemotron. Override via env if the slug changes. */
export const NEMOTRON_MODEL: string =
  (process.env.NVIDIA_NEMOTRON_MODEL ?? "").trim() ||
  "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Historical export, kept for compatibility. Always a one-element array now. */
export const MODELS: readonly string[] = [NEMOTRON_MODEL];

const BATCH_SIZE = 40;
const PARALLEL = 2;
const TIMEOUT_MS = 55_000;
const RETRIES = 3; // total attempts per batch = RETRIES + 1 = 4
export const RATE_LIMIT_RETRY_DELAY_MS = 4_000;
const MAX_BACKOFF_MS = 30_000;
const DISPATCH_GAP_MS = 400;

function stamp(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
}
function liveLog(msg: string): void {
  console.log(`[ai-cat ${stamp()}] ${msg}`);
}

const ALL_CATEGORIES = [
  ...INCOME_SUBS,
  ...FIXED_SUBS,
  ...INVEST_SUBS,
  ...BASE_SAVINGS_SUBS,
  ...GUILT_SUBS,
];
const ALLOWED = new Set(ALL_CATEGORIES);

// ----------------------------------------------------------------------------
// Prompt
// ----------------------------------------------------------------------------

const FEW_SHOT = `Examples:
MPAY/UPI/TRTR/.../UPPowerCorp/AIRP/XXX   debit  1808 → Utilities
MPAY/UPI/TRTR/.../MYJIO/HDFC/XXX         debit   706 → Phone
MPAY/UPI/TRTR/.../ZEPTO/HDFC/XXX          debit    68 → Groceries
MPAY/UPI/TRTR/.../Hanshdudhbha/YESB/XXX   debit    85 → Groceries
MPAY/UPI/TRTR/.../HaryanaStore/YESB/XXX   debit    80 → Groceries
MPAY/UPI/TRTR/.../KanhiyaSweets/YESB/XXX  debit   200 → Guilt-Free Spending
MPAY/UPI/TRTR/.../Zoyachickens/YESB/XXX   debit   220 → Guilt-Free Spending
MPAY/UPI/TRTR/.../ekart/YESB/XXX          debit   797 → Car Payment / Transportation
MPAY/UPI/TRTR/.../IRCTCRailAPP/YESB/XXX   debit   186 → Car Payment / Transportation
MPAY/UPI/TRTR/.../MEESHOTECHNOL/YESB/XXX  debit   278 → Clothes
MPAY/UPI/TRTR/.../MAXFASHIONIN/HDFC/XXX   debit   568 → Clothes
MPAY/UPI/TRTR/.../Aqualogica/HDFC/XXX     debit  2695 → Subscriptions
UPIMANDBTSI/.../GooglePlay/UTIB/XXX       debit   299 → Subscriptions
MPAY/UPI/TRTR/.../AmazonBillPa/UTIB/XXX   debit   299 → Subscriptions
MPAY/UPI/TRTR/.../slicesmallfi/NESF/XXX   debit   200 → Debt Payments
MPAY/UPI/TRTR/.../SONUKUMARYAD/HDFC/XXX   debit  2000 → Miscellaneous
MPAY/IMPSI/TRTR/.../ICIC/SANDEEPKUMAR    credit 30000 → Net monthly income
06510110065815:Int.Pd:...                 credit    56 → Net monthly income
SMS CHRG FOR: SEP QTR 2026-27             debit    20 → Miscellaneous
CGST For SMS CHRG ...                     debit     1 → Miscellaneous`;

function buildPrompt(batch: AiTxn[]): string {
  const list = batch
    .map(
      (t, i) =>
        `${i}\t${t.isoDate}\t${t.type}\t${t.amount}\t${t.particulars
          .replace(/\s+/g, " ")
          .slice(0, 220)}`,
    )
    .join("\n");

  return `You are categorizing Indian bank statement transactions for a personal-finance app.

Pick the SINGLE best category for EACH row from this CLOSED list — copy the string EXACTLY, with the same punctuation and capitalization:
${ALL_CATEGORIES.map((c) => `  • ${c}`).join("\n")}

Hard rules:
1. Reply with EXACTLY ONE JSON object and nothing else. No prose, no explanation, no markdown fences.
2. Shape: {"categories":["<cat for row 0>","<cat for row 1>", ...]}
3. The "categories" array length MUST equal ${batch.length}. One entry per input row, in the same order.
4. Every entry MUST be one of the listed categories verbatim. Do NOT invent categories. Do NOT translate or paraphrase them.
5. Transfers between the user's own accounts (self-transfers, own-account UPI with no merchant, IMPS to self) → "Miscellaneous" for debit and "Miscellaneous" for credit. Do NOT label these as income or expense.
6. Credits that look like salary, interest paid by the bank ("Int.Pd"), refunds from merchants, or cashback → "Net monthly income".
7. Bank fees (SMS CHRG, CGST, SGST, min balance, ATM charge, service charge) → "Miscellaneous".
8. Prefer the most SPECIFIC category over Miscellaneous when the merchant is identifiable. Only use "Miscellaneous" when truly ambiguous.
9. Do not default everything to "Miscellaneous" — classify as many rows as the evidence supports.

${FEW_SHOT}

Now classify these ${batch.length} transactions (format: index \\t iso-date \\t type \\t amount \\t particulars):
${list}

Respond with only the JSON object described in rule 2.`;
}

// ----------------------------------------------------------------------------
// HTTP errors we distinguish
// ----------------------------------------------------------------------------

class NemotronBillingError extends Error {
  constructor(body: string) {
    super(`HTTP 402 — billing or no credits: ${body.slice(0, 150)}`);
    this.name = "NemotronBillingError";
  }
}

class NemotronAuthError extends Error {
  constructor(status: number, body: string) {
    super(`HTTP ${status} — auth / invalid key: ${body.slice(0, 150)}`);
    this.name = "NemotronAuthError";
  }
}

class NemotronModelError extends Error {
  constructor(status: number, body: string) {
    super(`HTTP ${status} — model unavailable / bad request: ${body.slice(0, 150)}`);
    this.name = "NemotronModelError";
  }
}

class NemotronRateLimitError extends Error {
  retryAfterMs: number;
  /** true when the 429 body indicates a DAILY/quota cap, not a short burst.
   * These should abort the whole run — retrying wastes minutes. */
  quotaExhausted: boolean;
  constructor(body: string, retryAfterMs: number, quotaExhausted: boolean) {
    super(`HTTP 429 — rate limited: ${body.slice(0, 150)}`);
    this.name = "NemotronRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.quotaExhausted = quotaExhausted;
  }
}

/** Detect "daily cap exhausted" style 429s from OpenRouter so we stop hammering. */
function isQuotaExhausted(body: string): boolean {
  const s = body.toLowerCase();
  return (
    s.includes("free-models-per-day") ||
    s.includes("per-day") ||
    s.includes("daily") ||
    s.includes("quota") ||
    s.includes("add 10 credits")
  );
}

class NemotronServerError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`HTTP ${status} — server error: ${body.slice(0, 150)}`);
    this.name = "NemotronServerError";
    this.status = status;
  }
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: number | string };
}

async function callNemotron(
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://track-mymoney.local",
      "X-Title": "Track-MyMoney",
    },
    body: JSON.stringify({
      // SINGLE model, no server-side `models` fallback array. OpenRouter must
      // not silently route to another provider.
      model: NEMOTRON_MODEL,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      reasoning: { enabled: false },
      // Disable server-side model fallbacks so Nemotron is the only model that
      // can satisfy this request. If Nemotron is down, we get a real error.
      provider: { allow_fallbacks: false },
      messages: [
        {
          role: "system",
          content:
            "You classify Indian bank transactions into a fixed category list. Respond with one JSON object only — no prose, no markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new NemotronAuthError(res.status, body);
    }
    if (res.status === 402) {
      throw new NemotronBillingError(body);
    }
    if (res.status === 404 || res.status === 400) {
      throw new NemotronModelError(res.status, body);
    }
    if (res.status === 429) {
      const header = res.headers.get("retry-after");
      let retryAfterMs = RATE_LIMIT_RETRY_DELAY_MS;
      if (header) {
        const asNum = Number(header);
        if (Number.isFinite(asNum) && asNum > 0) {
          retryAfterMs = Math.min(asNum * 1000, MAX_BACKOFF_MS);
        }
      }
      throw new NemotronRateLimitError(body, retryAfterMs, isQuotaExhausted(body));
    }
    if (res.status >= 500 && res.status < 600) {
      throw new NemotronServerError(res.status, body);
    }
    throw new Error(`Nemotron HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as ChatResponse;
  if (data.error) {
    throw new Error(`Nemotron error: ${data.error.message ?? "unknown"}`);
  }
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

// ----------------------------------------------------------------------------
// Strict JSON parsing
// ----------------------------------------------------------------------------

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i.exec(text);
  if (fenced) return fenced[1];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return null;
}

export interface ParseResult {
  categories?: string[];
  /** Human-readable reason for rejection. */
  error?: string;
}

/**
 * Parse Nemotron's JSON response. Returns { categories } ONLY when:
 *   - the payload is a valid JSON object
 *   - it has a `categories` array
 *   - the array length EXACTLY matches `expected`
 *   - every entry is a non-empty string
 * Otherwise returns { error } with a short, logged reason. Membership in the
 * allowed-category set is checked separately by the caller so per-item invalid
 * categories can be surgically corrected without discarding the whole batch.
 */
export function parseCategoriesResponse(raw: string, expected: number): ParseResult {
  if (!raw || !raw.trim()) return { error: "empty response" };
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return { error: "no JSON object found" };

  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch (e) {
    return { error: `JSON.parse failed: ${(e as Error).message}` };
  }
  if (!obj || typeof obj !== "object") return { error: "root is not an object" };
  const cats = (obj as { categories?: unknown }).categories;
  if (!Array.isArray(cats)) return { error: "missing 'categories' array" };
  if (cats.length !== expected) {
    return { error: `length mismatch: got ${cats.length}, expected ${expected}` };
  }
  const out: string[] = new Array(expected);
  for (let i = 0; i < expected; i++) {
    const v = cats[i];
    if (typeof v !== "string" || v.trim() === "") {
      return { error: `entry ${i} is not a non-empty string` };
    }
    out[i] = v.trim();
  }
  return { categories: out };
}

// ----------------------------------------------------------------------------
// Batch driver
// ----------------------------------------------------------------------------

interface BatchOutcome {
  /** category per input item */
  categories: string[];
  /** true for each row whose category came from the keyword fallback */
  fallbackMask: boolean[];
  /** terminal error summary if Nemotron never produced usable output */
  nemotronError?: string;
  /** true when Nemotron said the daily/quota free tier is exhausted — caller
   * must stop dispatching further batches and send them straight to fallback. */
  quotaExhausted?: boolean;
}

/** Shared signal across all batches: once ANY batch sees a daily-quota 429,
 * every subsequent batch skips Nemotron entirely. Kept module-local because
 * the pipeline runs inside a single aiCategorize() call. */
class QuotaState {
  exhausted = false;
  reason = "";
}

function computeBackoff(attempt: number, base: number, batchIndex: number): number {
  // Exponential with cap, plus deterministic per-batch jitter so parallel
  // batches don't retry in lock-step. 2654435761 is the Knuth hash multiplier.
  const expo = Math.min(base * Math.pow(2, attempt), MAX_BACKOFF_MS);
  const jitter = ((batchIndex * 2654435761) >>> 0) % Math.max(1, Math.floor(expo * 0.25));
  return expo + jitter;
}

async function runBatch(
  bi: number,
  items: AiTxn[],
  debug: string[],
  quota: QuotaState,
): Promise<BatchOutcome> {
  // Short-circuit: free-tier daily quota is already exhausted — do NOT call
  // the API again. Every remaining batch goes straight to keyword fallback.
  if (quota.exhausted) {
    liveLog(`⏭️  batch ${bi}: skipping Nemotron (${quota.reason}) — keyword fallback for ${items.length} txns`);
    debug.push(`[ai] batch ${bi}: skipped Nemotron (${quota.reason}) — keyword fallback`);
    return {
      categories: items.map((t) => fallbackCategorize(t.particulars, t.type)),
      fallbackMask: new Array(items.length).fill(true),
      nemotronError: quota.reason,
      quotaExhausted: true,
    };
  }

  liveLog(`🚀 batch ${bi}: ${items.length} txns → Nemotron`);
  let lastError = "no attempts made";

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const t0 = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      liveLog(`📡 batch ${bi} attempt ${attempt + 1}/${RETRIES + 1} → ${NEMOTRON_MODEL}`);
      const raw = await callNemotron(buildPrompt(items), controller.signal);
      clearTimeout(timer);
      const latency = Math.round(performance.now() - t0);

      if (!raw) {
        lastError = "empty response from Nemotron";
        liveLog(`⚠️  batch ${bi} attempt ${attempt + 1}: ${lastError} (${latency}ms)`);
        debug.push(`[ai] batch ${bi} attempt ${attempt + 1}: ${lastError}`);
      } else {
        const parsed = parseCategoriesResponse(raw, items.length);
        if (parsed.error) {
          lastError = `parse failed: ${parsed.error}`;
          liveLog(
            `❌ batch ${bi} attempt ${attempt + 1}: ${lastError} (preview: ${raw.slice(0, 80).replace(/\n/g, " ")})`,
          );
          debug.push(
            `[ai] batch ${bi} attempt ${attempt + 1}: ${lastError} (preview: ${raw.slice(0, 100).replace(/\n/g, " ")})`,
          );
        } else {
          const cats = parsed.categories!;
          let invalid = 0;
          const fallbackMask: boolean[] = new Array(items.length).fill(false);
          const mapped = cats.map((c, i) => {
            if (ALLOWED.has(c)) return c;
            invalid++;
            fallbackMask[i] = true;
            return fallbackCategorize(items[i].particulars, items[i].type);
          });
          const ms = Math.round(performance.now() - t0);
          liveLog(
            `✅ batch ${bi}: Nemotron assigned ${items.length} categories in ${ms}ms (${invalid} outside allow-list, corrected by rules)`,
          );
          debug.push(
            `[ai] batch ${bi}: ${items.length} txns in ${ms}ms via ${NEMOTRON_MODEL} (attempt ${attempt + 1}, ${invalid} invalid-cat corrections)`,
          );
          return { categories: mapped, fallbackMask };
        }
      }
    } catch (e) {
      clearTimeout(timer);

      // Permanent errors — never retry.
      if (e instanceof NemotronBillingError) {
        lastError = e.message;
        liveLog(`💸 batch ${bi}: ${e.message} — no retry (billing)`);
        debug.push(`[ai] batch ${bi}: ${e.message} — no retry (billing)`);
        break;
      }
      if (e instanceof NemotronAuthError) {
        lastError = e.message;
        liveLog(`🔑 batch ${bi}: ${e.message} — no retry (auth)`);
        debug.push(`[ai] batch ${bi}: ${e.message} — no retry (auth)`);
        break;
      }
      if (e instanceof NemotronModelError) {
        lastError = e.message;
        liveLog(`🚫 batch ${bi}: ${e.message} — no retry (model/request)`);
        debug.push(`[ai] batch ${bi}: ${e.message} — no retry (model/request)`);
        break;
      }

      // Retryable errors — back off and try again on Nemotron.
      const willRetry = attempt < RETRIES;

      if (e instanceof NemotronRateLimitError) {
        lastError = e.message;
        // Daily/quota 429 → not a short burst. Abort this batch and tell the
        // driver to skip Nemotron for every remaining batch. No point retrying
        // and no point burning the next 60 batches on the same wall.
        if (e.quotaExhausted) {
          quota.exhausted = true;
          quota.reason = "Nemotron free-tier daily quota exhausted";
          liveLog(`🚷 batch ${bi}: ${quota.reason} — aborting AI for this run, keyword fallback for all remaining batches`);
          debug.push(`[ai] batch ${bi}: ${quota.reason} — AI disabled for remainder of this run`);
          break;
        }
        const wait = Math.min(
          e.retryAfterMs + computeBackoff(attempt, 500, bi),
          MAX_BACKOFF_MS,
        );
        liveLog(
          `🛑 batch ${bi} attempt ${attempt + 1}: 429 — ${willRetry ? `retry on Nemotron in ${wait}ms` : "no retries left"}`,
        );
        debug.push(
          `[ai] batch ${bi} attempt ${attempt + 1}: 429 — ${willRetry ? `waiting ${wait}ms before retry` : "giving up (keyword fallback)"}`,
        );
        if (willRetry) await new Promise<void>((r) => setTimeout(r, wait));
      } else if (e instanceof NemotronServerError) {
        lastError = e.message;
        const wait = computeBackoff(attempt, 1000, bi);
        liveLog(
          `🔥 batch ${bi} attempt ${attempt + 1}: ${e.status} server error — ${willRetry ? `retry in ${wait}ms` : "no retries left"}`,
        );
        debug.push(
          `[ai] batch ${bi} attempt ${attempt + 1}: ${e.message} — ${willRetry ? `retry in ${wait}ms` : "giving up"}`,
        );
        if (willRetry) await new Promise<void>((r) => setTimeout(r, wait));
      } else {
        const aborted = controller.signal.aborted;
        const msg = aborted ? `TIMEOUT after ${TIMEOUT_MS}ms` : (e as Error).message;
        lastError = msg;
        const wait = computeBackoff(attempt, 1500, bi);
        liveLog(
          `🔥 batch ${bi} attempt ${attempt + 1}: ${msg.slice(0, 120)} — ${willRetry ? `retry in ${wait}ms` : "no retries left"}`,
        );
        debug.push(
          `[ai] batch ${bi} attempt ${attempt + 1}: ${msg.slice(0, 140)} — ${willRetry ? `retry in ${wait}ms` : "giving up"}`,
        );
        if (willRetry) await new Promise<void>((r) => setTimeout(r, wait));
      }
    }
  }

  // All Nemotron attempts exhausted — fall back to deterministic keyword rules
  // for THIS batch only. Every row is flagged so the UI can surface that AI
  // did not actually categorize them.
  liveLog(
    `🔁 batch ${bi}: Nemotron failed after ${RETRIES + 1} attempts (${lastError}) — keyword fallback for ${items.length} txns`,
  );
  debug.push(
    `[ai] batch ${bi}: Nemotron failed (${lastError}) — keyword fallback for ${items.length} txns`,
  );
  return {
    categories: items.map((t) => fallbackCategorize(t.particulars, t.type)),
    fallbackMask: new Array(items.length).fill(true),
    nemotronError: lastError,
  };
}

// ----------------------------------------------------------------------------
// Public entry
// ----------------------------------------------------------------------------

/**
 * Categorize transactions using NVIDIA Nemotron exclusively. Processes in
 * batches of ${BATCH_SIZE} with capped concurrency. Each batch has its own
 * retry chain (exponential backoff + jitter, honoring Retry-After). Failed
 * batches fall through to deterministic keyword rules AND are flagged with
 * `fallback: true` so callers can clearly report them — we never silently
 * claim AI categorization when it did not succeed.
 *
 * Preserves input order; the index in the output array matches the input.
 */
export async function aiCategorize(
  txns: AiTxn[],
  debug: string[],
): Promise<AiCategorized[]> {
  if (txns.length === 0) return [];
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  if (!hasKey) {
    liveLog(`⚠️  OPENROUTER_API_KEY not set — keyword fallback for ${txns.length} txns`);
    debug.push(`[ai] OPENROUTER_API_KEY not set — keyword fallback (no AI used)`);
    return txns.map((t) => ({
      ...t,
      category: fallbackCategorize(t.particulars, t.type),
      fallback: true,
    }));
  }

  const batches: Array<{ start: number; items: AiTxn[] }> = [];
  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    batches.push({ start: i, items: txns.slice(i, i + BATCH_SIZE) });
  }
  const tStart = performance.now();
  liveLog(
    `🧠 AI categorize START: ${txns.length} txns → ${batches.length} batches × ${BATCH_SIZE}/batch, ${PARALLEL} workers, ${TIMEOUT_MS}ms timeout, model=${NEMOTRON_MODEL}`,
  );
  debug.push(
    `[ai] model=${NEMOTRON_MODEL} batches=${batches.length} size=${BATCH_SIZE} parallel=${PARALLEL} timeout=${TIMEOUT_MS}ms retries=${RETRIES}`,
  );

  const out: AiCategorized[] = new Array(txns.length);
  const quota = new QuotaState();
  let next = 0;
  let completed = 0;
  let fallbackRows = 0;
  let failedBatches = 0;
  let lastDispatchAt = 0;

  async function paceDispatch(): Promise<void> {
    const now = performance.now();
    const sinceLast = now - lastDispatchAt;
    if (sinceLast < DISPATCH_GAP_MS) {
      await new Promise<void>((r) => setTimeout(r, DISPATCH_GAP_MS - sinceLast));
    }
    lastDispatchAt = performance.now();
  }

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= batches.length) return;
      await paceDispatch();
      const { start, items } = batches[i];
      liveLog(
        `👷 worker ${workerId} → batch ${i} (${items.length} txns, ${completed}/${batches.length} done, ${fallbackRows} rows on fallback)`,
      );
      const outcome = await runBatch(i, items, debug, quota);
      if (outcome.nemotronError) failedBatches++;
      for (let j = 0; j < items.length; j++) {
        const fb = outcome.fallbackMask[j];
        if (fb) fallbackRows++;
        out[start + j] = {
          ...items[j],
          category: outcome.categories[j],
          ...(fb ? { fallback: true } : {}),
        };
      }
      completed++;
      liveLog(
        `📊 progress: ${completed}/${batches.length} batches (${Math.round((completed / batches.length) * 100)}%), ${fallbackRows} rows on fallback, ${failedBatches} batches failed`,
      );
    }
  }

  const workerCount = Math.min(PARALLEL, batches.length);
  await Promise.all(Array.from({ length: workerCount }, (_, k) => worker(k)));

  const totalMs = Math.round(performance.now() - tStart);
  const aiRows = txns.length - fallbackRows;
  liveLog(
    `🎉 AI categorize DONE: ${txns.length} txns in ${totalMs}ms — ${aiRows} via Nemotron, ${fallbackRows} via keyword fallback (${failedBatches}/${batches.length} batches failed)`,
  );
  debug.push(
    `[ai] total: ${totalMs}ms, ${aiRows}/${txns.length} via Nemotron, ${fallbackRows} on keyword fallback, ${failedBatches}/${batches.length} batches failed`,
  );
  return out;
}
