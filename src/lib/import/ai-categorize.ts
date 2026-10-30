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
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/**
 * Single model: NVIDIA Nemotron 3 Ultra via OpenRouter. If this model fails or
 * errors, we DO NOT silently switch to another model — the per-batch error is
 * surfaced in the debug array and the deterministic keyword categorizer takes
 * over (that is a non-AI rule-based fallback, not another model).
 */
export const MODELS = ["nvidia/nemotron-3-ultra-550b-a55b:free"];
const BATCH_SIZE = 25;
export const RATE_LIMIT_RETRY_DELAY_MS = 2_000;
const PARALLEL = 3;
const TIMEOUT_MS = 55_000;
const RETRIES = 1;

const ALL_CATEGORIES = [
  ...INCOME_SUBS,
  ...FIXED_SUBS,
  ...INVEST_SUBS,
  ...BASE_SAVINGS_SUBS,
  ...GUILT_SUBS,
];
const ALLOWED = new Set(ALL_CATEGORIES);

/**
 * Few-shot examples drawn from real UCO Bank + HDFC / ICICI UPI merchant
 * patterns. These teach the model the mapping once; the per-batch prompt only
 * needs to list the transactions themselves.
 */
const FEW_SHOT = `Examples:
MPAY/UPI/TRTR/.../UPPowerCorp/AIRP/XXX   debit  1808 → Utilities
MPAY/UPI/TRTR/.../MYJIO/HDFC/XXX         debit   706 → Phone
MPAY/UPI/TRTR/.../ZEPTO/HDFC/XXX          debit    68 → Groceries
MPAY/UPI/TRTR/.../Hanshdudhbha/YESB/XXX   debit    85 → Groceries
MPAY/UPI/TRTR/.../HaryanaStore/YESB/XXX   debit    80 → Groceries
MPAY/UPI/TRTR/.../Balajigenera/YESB/XXX   debit    50 → Groceries
MPAY/UPI/TRTR/.../KanhiyaSweets/YESB/XXX  debit   200 → Guilt-Free Spending
MPAY/UPI/TRTR/.../Foodiesjuncti/YESB/XXX  debit    20 → Guilt-Free Spending
MPAY/UPI/TRTR/.../Zoyachickens/YESB/XXX   debit   220 → Guilt-Free Spending
MPAY/UPI/TRTR/.../ekart/YESB/XXX          debit   797 → Car Payment / Transportation
MPAY/UPI/TRTR/.../XpressBees/ICIC/XXX     debit   599 → Car Payment / Transportation
MPAY/UPI/TRTR/.../IRCTCRailAPP/YESB/XXX   debit   186 → Car Payment / Transportation
MPAY/UPI/TRTR/.../MEESHOTECHNOL/YESB/XXX  debit   278 → Clothes
MPAY/UPI/TRTR/.../MAXFASHIONIN/HDFC/XXX   debit   568 → Clothes
MPAY/UPI/TRTR/.../Aqualogica/HDFC/XXX     debit  2695 → Subscriptions
UPIMANDBTSI/.../GooglePlay/UTIB/XXX       debit   299 → Subscriptions
MPAY/UPI/TRTR/.../AmazonBillPa/UTIB/XXX   debit   299 → Subscriptions
MPAY/UPI/TRTR/.../AmazonPayGro/UTIB/XXX   debit   404 → Guilt-Free Spending
MPAY/UPI/TRTR/.../slicesmallfi/NESF/XXX   debit   200 → Debt Payments
MPAY/UPI/TRTR/.../SONUKUMARYAD/HDFC/XXX   debit  2000 → Miscellaneous
MPAY/UPI/TRTR/.../8115440893pty/UCBA/XXX  debit 10000 → Miscellaneous
MPAY/IMPSI/TRTR/.../ICIC/SANDEEPKUMAR    credit 30000 → Net monthly income
MPAY/UPI/TRTR/.../ShivamPandey/NESF/XXX  credit  2100 → Net monthly income
06510110065815:Int.Pd:...                 credit    56 → Net monthly income
SMS CHRG FOR: SEP QTR 2026-27             debit    20 → Miscellaneous
CGST For SMS CHRG ...                     debit     1 → Miscellaneous`;

function buildPrompt(batch: AiTxn[]): string {
  const list = batch
    .map(
      (t, i) =>
        `${i}\t${t.type}\t${t.amount}\t${t.particulars.replace(/\s+/g, " ").slice(0, 200)}`,
    )
    .join("\n");
  return `You are categorizing Indian bank statement transactions for a personal-finance app.

Pick the SINGLE best category from this closed list (copy the string EXACTLY):
${ALL_CATEGORIES.map((c) => `  • ${c}`).join("\n")}

Rules:
1. Reply with ONLY one JSON object: {"categories":["<cat 0>","<cat 1>", ...]}. No prose, no markdown fence.
2. The array length must be EXACTLY ${batch.length}.
3. credit transactions default to "Net monthly income" unless clearly interest, refund, or cashback.
4. UPI/MPAY/IMPS person-to-person transfers without a merchant hint → "Miscellaneous" (for debits) or "Net monthly income" (for credits).
5. Bank fees, GST, SMS charges, interest paid → "Miscellaneous" (debit) / "Net monthly income" (credit when interest earned).
6. If unsure, pick the closest category above — never invent new ones.

${FEW_SHOT}

Now classify these ${batch.length} transactions (format: index TAB type TAB amount TAB particulars):
${list}

Respond with only the JSON object.`;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

class OpenRouterBillingError extends Error {
  constructor(body: string) {
    super(`HTTP 402 — billing or no credits: ${body.slice(0, 150)}`);
    this.name = "OpenRouterBillingError";
  }
}

class OpenRouterRateLimitError extends Error {
  constructor(body: string) {
    super(`HTTP 429 — rate limited: ${body.slice(0, 150)}`);
    this.name = "OpenRouterRateLimitError";
  }
}

async function callOpenRouter(
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
      models: MODELS,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      // Disable chain-of-thought on reasoning models — we need a fast JSON reply.
      reasoning: { enabled: false },
      // No model fallbacks — use only Nemotron free. Disable provider-side
      // fallbacks too so OpenRouter can't silently serve a different model.
      provider: { sort: "throughput", allow_fallbacks: false },
      messages: [
        {
          role: "system",
          content:
            "You classify Indian bank transactions into a fixed category list. Respond with one JSON object only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 402) throw new OpenRouterBillingError(body);
    if (res.status === 429) throw new OpenRouterRateLimitError(body);
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as ChatResponse;
  if (data.error) throw new Error(data.error.message ?? "OpenRouter error");
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

function extractJsonObject(text: string): string | null {
  const fenced = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i.exec(text);
  if (fenced) return fenced[1];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return null;
}

function parseCategories(raw: string, expected: number): string[] | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;
  try {
    const obj = JSON.parse(jsonText) as { categories?: unknown };
    if (!Array.isArray(obj.categories)) return null;
    if (obj.categories.length !== expected) return null;
    return obj.categories.map((c) => (typeof c === "string" ? c : ""));
  } catch {
    return null;
  }
}

async function runBatch(
  bi: number,
  items: AiTxn[],
  debug: string[],
): Promise<string[]> {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const t0 = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const raw = await callOpenRouter(buildPrompt(items), controller.signal);
      clearTimeout(timer);
      if (!raw) {
        debug.push(`[ai] batch ${bi} attempt ${attempt}: no response from ${MODELS[0]}`);
      } else {
        const cats = parseCategories(raw, items.length);
        if (!cats) {
          debug.push(
            `[ai] batch ${bi} attempt ${attempt}: parse failed (preview: ${raw.slice(0, 100).replace(/\n/g, " ")})`,
          );
        } else {
          const mapped = cats.map((c, i) =>
            ALLOWED.has(c) ? c : fallbackCategorize(items[i].particulars, items[i].type),
          );
          const ms = Math.round(performance.now() - t0);
          debug.push(`[ai] batch ${bi}: ${items.length} txns in ${ms}ms via ${MODELS[0]} (attempt ${attempt})`);
          return mapped;
        }
      }
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof OpenRouterBillingError) {
        debug.push(
          `[ai] batch ${bi}: 402 payment required / no credits — keyword fallback (no retry)`,
        );
        break; // retrying won't fix a billing issue
      }
      if (e instanceof OpenRouterRateLimitError) {
        const willRetry = attempt < RETRIES;
        debug.push(
          `[ai] batch ${bi} attempt ${attempt}: 429 rate limited — ${willRetry ? `waiting ${RATE_LIMIT_RETRY_DELAY_MS}ms before retry` : "keyword fallback"}`,
        );
        if (willRetry) await new Promise<void>((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS));
      } else {
        const msg = (e as Error).message;
        debug.push(`[ai] batch ${bi} attempt ${attempt}: ${msg.slice(0, 140)}`);
      }
    }
  }
  debug.push(
    `[ai] batch ${bi}: ${MODELS[0]} failed — keyword fallback (no model switch)`,
  );
  return items.map((t) => fallbackCategorize(t.particulars, t.type));
}

/**
 * Categorize transactions. Runs batches with capped concurrency so free-tier
 * rate limits don't fire all 6+ requests at once. Each batch has its own
 * timeout + one retry; any batch that still fails falls back to deterministic
 * keyword rules per-transaction. Pushes per-batch debug lines into `debug`.
 */
export async function aiCategorize(
  txns: AiTxn[],
  debug: string[],
): Promise<AiCategorized[]> {
  if (txns.length === 0) return [];
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  if (!hasKey) {
    debug.push(`[ai] OPENROUTER_API_KEY not set — keyword fallback`);
    return txns.map((t) => ({ ...t, category: fallbackCategorize(t.particulars, t.type) }));
  }

  const batches: Array<{ start: number; items: AiTxn[] }> = [];
  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    batches.push({ start: i, items: txns.slice(i, i + BATCH_SIZE) });
  }
  debug.push(
    `[ai] models=${MODELS.join(",")} batches=${batches.length} size=${BATCH_SIZE} parallel=${PARALLEL} timeout=${TIMEOUT_MS}ms`,
  );

  const out: AiCategorized[] = new Array(txns.length);
  // Simple windowed concurrency: run PARALLEL batches at a time.
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= batches.length) return;
      const { start, items } = batches[i];
      const cats = await runBatch(i, items, debug);
      for (let j = 0; j < items.length; j++) {
        out[start + j] = { ...items[j], category: cats[j] };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, () => worker()));
  return out;
}
