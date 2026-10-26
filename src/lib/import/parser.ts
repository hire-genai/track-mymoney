import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  BASE_SAVINGS_SUBS,
  FIXED_SUBS,
  GUILT_SUBS,
  INCOME_SUBS,
  INVEST_SUBS,
} from "@/lib/finance-data";
import type { PersonId, Transaction, TxType } from "@/lib/types";
import { openRouterChat, type ChatSuccess } from "./openrouter";
import { importLog, startTimer } from "./log";

/** The exact category labels the AI is allowed to return. */
export function allowedCategories(extraSavings: string[] = []): string[] {
  return [
    ...INCOME_SUBS,
    ...FIXED_SUBS,
    ...INVEST_SUBS,
    ...BASE_SAVINGS_SUBS,
    ...extraSavings,
    ...GUILT_SUBS,
  ];
}

const txnSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1).max(300),
  debit: z.number().nullable().optional(),
  credit: z.number().nullable().optional(),
  balance: z.number().nullable().optional(),
  amount: z.number().optional(),
  type: z.enum(["credit", "debit"]),
  category: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().max(240).optional(),
});

const aiResponseSchema = z.object({
  transactions: z.array(txnSchema).max(3000),
});

export interface ParsedTxn {
  date: string;           // DD-MM (child convention)
  isoDate: string;        // YYYY-MM-DD
  particulars: string;
  amount: number;         // positive magnitude
  type: TxType;
  category: string;
  confidence: number;     // 0..1
  reason: string;         // short rationale
  balance: number | null; // optional running balance from statement
  needsReview: boolean;   // true when confidence low OR likely internal transfer
}

export interface ParseResult {
  transactions: ParsedTxn[];
  monthsSeen: string[];
  modelUsed: string;
  attemptedModels: string[];
}

const SYSTEM_PROMPT = `You are an expert Indian bank-statement parser for a personal-finance app. You read PDFs, CSVs, and plain-text statements and return a clean JSON list of individual transactions. You never invent values. You preserve the original description verbatim.`;

function buildUserPrompt(statementText: string, allowed: string[]): string {
  const catBlock = allowed.map((c) => `- ${c}`).join("\n");
  const incomeOnly = INCOME_SUBS.join(", ");

  return `TASK
Analyze the bank statement below and extract EVERY individual transaction. The source may be a PDF export, a CSV, or plain text, from any Indian bank (HDFC, ICICI, SBI, Axis, Kotak, etc.).

For each transaction, output exactly these fields:
- date: ISO date YYYY-MM-DD. If a row shows only DD/MM or DD-MM, infer the year from the statement header or page footer.
- description: the original payee / narration VERBATIM (do not reword). Only strip control characters and collapse whitespace. Preserve UPI/NEFT/IMPS/RTGS references.
- debit: positive number if money LEFT the account; null if this is a credit row.
- credit: positive number if money ENTERED the account; null if this is a debit row.
- balance: the running balance printed on this row, if the statement shows it; otherwise null.
- amount: positive number equal to whichever of debit/credit is populated. Never negative.
- type: "debit" if money LEFT the account; "credit" if money ENTERED.
- category: EXACTLY one label from the CATEGORY LIST below. Never invent a new label. Pick the single best match. If nothing fits confidently, use "Miscellaneous" for debits or "Net monthly income" for credits.
- confidence: 0.0 to 1.0. Use ≥ 0.85 only when the merchant/purpose is unmistakable. Use ≤ 0.5 for cash withdrawals, internal transfers, generic UPI/NEFT with no merchant, or anything ambiguous.
- reason: 1 short sentence (≤ 120 chars) explaining the category choice.

RULES
- Only use INCOME-kind categories (${incomeOnly}) when type = "credit".
- Only use EXPENSE-kind categories when type = "debit". A "Goal: X" subcategory counts as savings for debits.
- Skip these rows entirely: opening balance, closing balance, carried-forward, running-balance-only lines, page headers, summary totals, interest-earned-summary rows that have no transaction date, period labels, column headers.
- INDIAN PAYMENT KEYWORDS and typical mapping:
  * UPI merchant payment (e.g. UPI-SWIGGY, UPI/ZOMATO) → debit; category based on merchant.
  * UPI person-to-person (name only, no merchant) → debit; "Miscellaneous"; confidence ≤ 0.4; reason mentions "likely P2P transfer".
  * NEFT / RTGS / IMPS to/from a known business → debit or credit accordingly; category by business type.
  * NEFT / IMPS between the user's own accounts (words like "SELF", "OWN ACCOUNT", "ACCOUNT TRANSFER", or the counterparty's name matches the account holder) → still output as "debit" or "credit" with category "Miscellaneous"; confidence 0.1; reason "possible internal transfer — review before saving".
  * ATM / NFS WDL / CASH WDL → debit; "Miscellaneous"; confidence 0.3; reason "ATM withdrawal — purpose unknown".
  * POS / VISA / MASTERCARD → debit; category based on merchant name after the gateway code.
  * EMI / LOAN REPAYMENT / HOME LOAN / PERSONAL LOAN → "Debt Payments".
  * SALARY, SAL, CMS SALARY → "Net monthly income".
  * INTEREST CREDIT, SB INT → "Net monthly income".
  * ELECTRICITY, BESCOM, MSEDCL, GAS, WATER BOARD → "Utilities".
  * BROADBAND, AIRTEL, JIO, VI, VODAFONE postpaid → "Phone".
  * NETFLIX, PRIME, SPOTIFY, HOTSTAR, YOUTUBE PREMIUM → "Subscriptions".
  * BIGBASKET, DMART, GROFERS, ZEPTO, BLINKIT, RELIANCE FRESH → "Groceries".
  * ZOMATO, SWIGGY, EATFIT, FRESHMENU, STARBUCKS → "Guilt-Free Spending" (treat restaurants/food delivery as discretionary).
  * UBER, OLA, RAPIDO, FUEL, PETROL, INDIAN OIL, BPCL, HPCL → "Car Payment / Transportation".
  * APOLLO, MEDPLUS, 1MG, PHARMEASY, HOSPITAL → "Miscellaneous"; confidence ≤ 0.5 (we have no healthcare bucket).
  * LIC, STAR HEALTH, HDFC ERGO, policy premium → "Insurance".
- Return ALL transactions you find, in chronological order (oldest first). Do NOT deduplicate.
- If a date is ambiguous DD/MM/YYYY vs MM/DD/YYYY, prefer DD/MM/YYYY (Indian convention).
- NEVER modify amounts or dates based on assumptions. If debit and credit columns both have values on the same row, the one that is non-zero wins; if both are non-zero (reversal), output two rows.
- Return ONLY a single JSON object matching the schema. No prose, no markdown fences.

CATEGORY LIST
${catBlock}

STATEMENT
"""
${statementText}
"""`;
}

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          debit: { type: ["number", "null"] },
          credit: { type: ["number", "null"] },
          balance: { type: ["number", "null"] },
          amount: { type: "number" },
          type: { type: "string", enum: ["credit", "debit"] },
          category: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["date", "description", "amount", "type", "category"],
      },
    },
  },
  required: ["transactions"],
} as const;

export async function parseStatementWithAI(
  statementText: string,
  allowedCats: string[],
): Promise<ParseResult> {
  const chunks = splitTextIntoChunks(statementText);
  importLog.info("prompt chunks ready", {
    chunks: chunks.length,
    chars: statementText.length,
  });

  const attemptedUnion = new Set<string>();
  let modelUsed = "";

  // Chunks are independent — call them concurrently so a 3-chunk statement
  // takes ~1x model latency instead of 3x.
  const chunkResults = await Promise.all(
    chunks.map(async (chunk, i) => {
      const tChunk = startTimer();
      importLog.info("chunk → AI", { idx: i + 1, of: chunks.length, chars: chunk.length });
      const chat = await openRouterChat({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(chunk, allowedCats),
        jsonSchema: {
          name: "statement_transactions",
          strict: true,
          schema: jsonSchema as unknown as Record<string, unknown>,
        },
        temperature: 0.1,
      });
      const normalized = normalizeAiResponse(chat.content, allowedCats);
      importLog.step("chunk parsed", {
        idx: i + 1,
        of: chunks.length,
        ms: tChunk(),
        model: chat.model,
        rows: normalized.transactions.length,
      });
      return { chat, normalized };
    }),
  );

  const allTxns: ParsedTxn[] = [];
  const monthsSet = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const { chat, normalized } of chunkResults) {
    rememberModels(chat, attemptedUnion);
    modelUsed = chat.model;
    for (const t of normalized.transactions) {
      // Chunk boundaries can duplicate rows that span the overlap; dedupe
      // across chunks using a composite key before we add to the final list.
      const fp = `${t.isoDate}|${t.amount.toFixed(2)}|${t.type}|${t.particulars.toLowerCase().slice(0, 60)}`;
      if (seenFingerprints.has(fp)) continue;
      seenFingerprints.add(fp);
      allTxns.push(t);
      monthsSet.add(monthLabelFromIso(t.isoDate));
    }
  }

  allTxns.sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  return {
    transactions: allTxns,
    monthsSeen: Array.from(monthsSet),
    modelUsed,
    attemptedModels: Array.from(attemptedUnion),
  };
}

function rememberModels(chat: ChatSuccess, acc: Set<string>): void {
  for (const id of chat.attemptedModels) acc.add(id);
}

interface NormalizedChunk {
  transactions: ParsedTxn[];
}

function normalizeAiResponse(content: string, allowedCats: string[]): NormalizedChunk {
  const parsed = safeJson(content);
  const validated = aiResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI returned malformed JSON: ${validated.error.message.slice(0, 200)}`);
  }

  const allowed = new Set(allowedCats);
  const out: ParsedTxn[] = [];

  for (const raw of validated.data.transactions) {
    const iso = raw.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;

    const credit = raw.credit ?? null;
    const debit = raw.debit ?? null;
    let amount: number;
    if (raw.type === "credit" && credit !== null && credit > 0) {
      amount = credit;
    } else if (raw.type === "debit" && debit !== null && debit > 0) {
      amount = debit;
    } else if (typeof raw.amount === "number") {
      amount = Math.abs(raw.amount);
    } else {
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;

    let category = raw.category.trim();
    if (!allowed.has(category)) {
      category = raw.type === "credit" ? "Net monthly income" : "Miscellaneous";
    }
    if (raw.type === "credit" && !INCOME_SUBS.includes(category)) {
      category = "Net monthly income";
    }
    if (raw.type === "debit" && INCOME_SUBS.includes(category)) {
      category = "Miscellaneous";
    }

    const confidence = typeof raw.confidence === "number" ? clamp01(raw.confidence) : 0.6;
    const reason = (raw.reason ?? "").trim().slice(0, 240);
    const [yyyy, mm, dd] = iso.split("-");
    void yyyy;

    out.push({
      date: `${dd}-${mm}`,
      isoDate: iso,
      particulars: sanitizeDescription(raw.description),
      amount: round2(amount),
      type: raw.type,
      category,
      confidence,
      reason,
      balance: typeof raw.balance === "number" && Number.isFinite(raw.balance) ? round2(raw.balance) : null,
      needsReview: confidence < 0.5,
    });
  }
  return { transactions: out };
}

function sanitizeDescription(input: string): string {
  // Collapse whitespace and strip control chars but preserve original words.
  return input
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown fences if the model wrapped the JSON
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        /* fall through */
      }
    }
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not locate JSON in AI response");
    return JSON.parse(match[0]);
  }
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatMonth(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthLabelFromIso(iso: string): string {
  const d = new Date(iso);
  return formatMonth(d);
}

export function fingerprintRow(
  personId: PersonId,
  isoDate: string,
  amount: number,
  particulars: string,
  type: TxType,
): string {
  const normDesc = particulars.toLowerCase().replace(/\s+/g, " ").trim();
  const key = [personId, isoDate, amount.toFixed(2), normDesc, type].join("|");
  return createHash("sha256").update(key).digest("hex");
}

export function toDbRow(
  parsed: ParsedTxn,
  personId: PersonId,
): Omit<Transaction, "id"> & {
  month: string;
  isoDate: string;
  fingerprint: string;
  person: PersonId;
} {
  return {
    date: parsed.date,
    particulars: parsed.particulars,
    amount: parsed.amount,
    type: parsed.type,
    category: parsed.category,
    month: monthLabelFromIso(parsed.isoDate),
    isoDate: parsed.isoDate,
    person: personId,
    fingerprint: fingerprintRow(
      personId,
      parsed.isoDate,
      parsed.amount,
      parsed.particulars,
      parsed.type,
    ),
  };
}

/**
 * Split long statement text into chunks that fit a free model's context.
 *
 * Strategy: split at double-newline (paragraph) or newline boundaries so we
 * don't cut a transaction row in half. Target ~24k chars per chunk, with ~1k
 * char overlap to keep context (headers, running balance) consistent.
 */
export function splitTextIntoChunks(
  text: string,
  opts: { target?: number; overlap?: number } = {},
): string[] {
  const target = opts.target ?? 24_000;
  const overlap = opts.overlap ?? 800;
  if (text.length <= target) return [text];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const end = Math.min(cursor + target, text.length);
    // Try to end at a newline near `end` to avoid cutting mid-row
    let safeEnd = end;
    if (end < text.length) {
      const slice = text.slice(cursor, end);
      const lastNl = slice.lastIndexOf("\n");
      if (lastNl > target * 0.5) {
        safeEnd = cursor + lastNl;
      }
    }
    chunks.push(text.slice(cursor, safeEnd));
    if (safeEnd >= text.length) break;
    cursor = Math.max(0, safeEnd - overlap);
  }
  return chunks;
}
