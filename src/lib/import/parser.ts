import type { TxType } from "@/lib/types";
import { categorize } from "./categorize";

export interface ParsedTransaction {
  isoDate: string;
  date: string;
  particulars: string;
  amount: number;
  type: TxType;
  category: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  debug: string[];
  warnings: string[];
}

const DATE_RX = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;
const NUMBER_RX = /-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?/g;

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toIsoDate(d: string, m: string, y: string): string | null {
  let day = Number(d);
  let month = Number(m);
  let year = Number(y);
  if (year < 100) year += 2000;
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12) {
    if (day >= 1 && day <= 12 && month >= 1 && month <= 31) {
      [day, month] = [month, day];
    } else return null;
  }
  if (day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function shortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}`;
}

/**
 * Parse raw text (from PDF/TXT/CSV) line by line, extracting transactions.
 * Strategy:
 *  1. Look for lines starting (or containing early) a date pattern.
 *  2. Extract all numbers from the line.
 *  3. If 2+ numbers: last = running balance, previous = amount.
 *     Decide debit vs credit by delta from prior balance.
 *  4. If 1 number: that is the amount; direction heuristic from keywords.
 *  5. Particulars = line text between date and first amount.
 */
export function parseStatementText(raw: string): ParseResult {
  const debug: string[] = [];
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const normalized = raw.replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");
  debug.push(`[parser] received ${raw.length} chars, ${rawLines.length} raw lines`);

  const lines: string[] = [];
  for (const l of rawLines) {
    const trimmed = l.replace(/\s+/g, " ").trim();
    if (trimmed) lines.push(trimmed);
  }
  debug.push(`[parser] ${lines.length} non-empty lines after normalize`);

  let prevBalance: number | null = null;
  let dateHits = 0;
  let skippedNoAmount = 0;
  let creditCount = 0;
  let debitCount = 0;

  const CREDIT_HINTS = /\b(cr|credit|deposit|received|refund|cashback|salary|interest|int\.pd)\b/i;
  const DEBIT_HINTS = /\b(dr|debit|withdrawal|payment|purchase|charge|chrg|gst|upi|mpay)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = DATE_RX.exec(line);
    if (!dateMatch) continue;
    dateHits++;

    const iso = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (!iso) {
      debug.push(`[parser] line ${i}: date match but invalid ${dateMatch[0]}`);
      continue;
    }

    const afterDateIdx = dateMatch.index + dateMatch[0].length;
    const rest = line.slice(afterDateIdx).trim();

    const numMatches = Array.from(rest.matchAll(NUMBER_RX));
    const nums = numMatches
      .map((m) => ({ value: parseAmount(m[0]), index: m.index ?? 0, raw: m[0] }))
      .filter((n) => n.value !== null && Math.abs(n.value as number) >= 0.01) as Array<{ value: number; index: number; raw: string }>;

    if (nums.length === 0) {
      skippedNoAmount++;
      debug.push(`[parser] line ${i}: date ${iso} but NO numbers (${rest.slice(0, 60)})`);
      continue;
    }

    let amount: number;
    let balance: number | null = null;
    let particularsEndIdx: number;
    let type: TxType;

    if (nums.length >= 2) {
      balance = nums[nums.length - 1].value;
      amount = nums[nums.length - 2].value;
      particularsEndIdx = nums[nums.length - 2].index;

      if (prevBalance !== null && Number.isFinite(balance) && Number.isFinite(prevBalance)) {
        const delta = (balance as number) - prevBalance;
        if (Math.abs(delta - amount) < 0.5) type = "credit";
        else if (Math.abs(delta + amount) < 0.5) type = "debit";
        else {
          type = delta >= 0 ? "credit" : "debit";
        }
      } else {
        if (CREDIT_HINTS.test(line) && !DEBIT_HINTS.test(line)) type = "credit";
        else type = "debit";
      }
    } else {
      amount = nums[0].value;
      particularsEndIdx = nums[0].index;
      if (CREDIT_HINTS.test(line) && !DEBIT_HINTS.test(line)) type = "credit";
      else type = "debit";
    }

    if (balance !== null) prevBalance = balance;

    let particulars = rest.slice(0, particularsEndIdx).trim();
    if (!particulars) {
      particulars = `Txn ${iso}`;
    }
    particulars = particulars.slice(0, 280);

    if (!Number.isFinite(amount) || amount <= 0) {
      debug.push(`[parser] line ${i}: skipping non-positive amount ${amount}`);
      continue;
    }

    const category = categorize(particulars, type);
    if (type === "credit") creditCount++;
    else debitCount++;

    transactions.push({
      isoDate: iso,
      date: shortDate(iso),
      particulars,
      amount: Math.round(amount * 100) / 100,
      type,
      category,
    });
  }

  debug.push(`[parser] date hits: ${dateHits}, parsed txns: ${transactions.length}, skipped (no amount): ${skippedNoAmount}`);
  debug.push(`[parser] credits: ${creditCount}, debits: ${debitCount}`);

  if (transactions.length === 0 && dateHits > 0) {
    warnings.push("Found dates but no amounts could be extracted. The statement format may be unusual.");
  }
  if (transactions.length === 0 && dateHits === 0) {
    warnings.push("No date-like lines found. If this is a PDF, text may be image-based.");
  }

  return { transactions, debug, warnings };
}

/**
 * Parse CSV where header row names columns.
 * Picks up common Indian bank headers: Date, Particulars/Description/Narration,
 * Withdrawal/Debit, Deposit/Credit, Amount, Balance.
 */
export function parseCsvText(raw: string): ParseResult {
  const debug: string[] = [];
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const lines = raw.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  debug.push(`[csv] ${lines.length} non-empty rows`);

  if (lines.length === 0) {
    warnings.push("Empty CSV");
    return { transactions, debug, warnings };
  }

  const headerRow = splitCsvRow(lines[0]);
  const headerIdx: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    headerIdx[h.toLowerCase().trim()] = i;
  });

  function findCol(candidates: string[]): number {
    for (const c of candidates) {
      for (const key of Object.keys(headerIdx)) {
        if (key.includes(c)) return headerIdx[key];
      }
    }
    return -1;
  }

  const dateCol = findCol(["date", "txn date", "transaction date"]);
  const particularsCol = findCol(["particular", "description", "narration", "details", "remark"]);
  const withdrawalCol = findCol(["withdrawal", "debit", "dr "]);
  const depositCol = findCol(["deposit", "credit", "cr "]);
  const amountCol = findCol(["amount"]);

  debug.push(`[csv] columns: date=${dateCol}, particulars=${particularsCol}, wd=${withdrawalCol}, dep=${depositCol}, amount=${amountCol}`);

  if (dateCol < 0) {
    debug.push(`[csv] no date column — falling back to text parser`);
    return parseStatementText(raw);
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const dateStr = cols[dateCol] ?? "";
    const dateMatch = DATE_RX.exec(dateStr);
    if (!dateMatch) continue;
    const iso = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (!iso) continue;

    const particulars = (particularsCol >= 0 ? cols[particularsCol] : "")?.trim() || `Txn ${iso}`;
    let amount: number | null = null;
    let type: TxType = "debit";

    if (withdrawalCol >= 0 || depositCol >= 0) {
      const wd = withdrawalCol >= 0 ? parseAmount(cols[withdrawalCol] ?? "") : null;
      const dep = depositCol >= 0 ? parseAmount(cols[depositCol] ?? "") : null;
      if (wd !== null && wd > 0) {
        amount = wd;
        type = "debit";
      } else if (dep !== null && dep > 0) {
        amount = dep;
        type = "credit";
      }
    } else if (amountCol >= 0) {
      const a = parseAmount(cols[amountCol] ?? "");
      if (a !== null) {
        amount = Math.abs(a);
        type = a < 0 ? "debit" : "credit";
      }
    }

    if (amount === null || amount <= 0) continue;

    transactions.push({
      isoDate: iso,
      date: shortDate(iso),
      particulars: particulars.slice(0, 280),
      amount: Math.round(amount * 100) / 100,
      type,
      category: categorize(particulars, type),
    });
  }

  debug.push(`[csv] extracted ${transactions.length} transactions`);
  if (transactions.length === 0) {
    warnings.push("CSV parsed but no transactions extracted. Checking as plain text…");
    const fallback = parseStatementText(raw);
    return {
      transactions: fallback.transactions,
      debug: [...debug, ...fallback.debug],
      warnings: [...warnings, ...fallback.warnings],
    };
  }
  return { transactions, debug, warnings };
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
