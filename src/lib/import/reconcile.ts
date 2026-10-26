import type { ParsedTxn } from "./parser";

export interface ReconciliationReport {
  totals: {
    debits: number;
    credits: number;
    net: number;
    count: number;
  };
  reviewFlags: {
    lowConfidence: number;
    needsReview: number;
  };
  balance: {
    first: number | null;
    last: number | null;
    walkOk: boolean | null;
    firstMismatchIndex: number | null;
  };
  categoryBreakdown: Array<{ category: string; count: number; total: number }>;
}

/**
 * Pure deterministic calculations over parsed transactions. The AI is never
 * trusted for arithmetic — only interpretation.
 */
export function reconcile(txns: ParsedTxn[]): ReconciliationReport {
  let debits = 0;
  let credits = 0;
  let lowConf = 0;
  let needsReview = 0;
  const byCat = new Map<string, { count: number; total: number }>();

  for (const t of txns) {
    const amt = round2(t.amount);
    if (t.type === "debit") debits = round2(debits + amt);
    else credits = round2(credits + amt);
    if (t.confidence < 0.5) lowConf++;
    if (t.needsReview) needsReview++;
    const bucket = byCat.get(t.category) ?? { count: 0, total: 0 };
    bucket.count++;
    bucket.total = round2(bucket.total + amt);
    byCat.set(t.category, bucket);
  }

  const net = round2(credits - debits);

  const balanceReport = checkRunningBalance(txns);

  const categoryBreakdown = Array.from(byCat.entries())
    .map(([category, info]) => ({ category, count: info.count, total: info.total }))
    .sort((a, b) => b.total - a.total);

  return {
    totals: { debits, credits, net, count: txns.length },
    reviewFlags: { lowConfidence: lowConf, needsReview },
    balance: balanceReport,
    categoryBreakdown,
  };
}

/**
 * Validate the running balance where the AI returned per-row balances.
 * We only verify consecutive rows that both have a balance printed, so sparse
 * balance data doesn't false-flag the whole statement.
 */
function checkRunningBalance(txns: ParsedTxn[]): ReconciliationReport["balance"] {
  const withBalance = txns.filter((t) => typeof t.balance === "number");
  if (withBalance.length === 0) {
    return { first: null, last: null, walkOk: null, firstMismatchIndex: null };
  }

  const first = withBalance[0].balance ?? null;
  const last = withBalance[withBalance.length - 1].balance ?? null;

  let walkOk = true;
  let mismatch: number | null = null;
  for (let i = 1; i < withBalance.length; i++) {
    const prev = withBalance[i - 1];
    const cur = withBalance[i];
    if (prev.balance === null || cur.balance === null) continue;
    const delta = cur.type === "credit" ? cur.amount : -cur.amount;
    const expected = round2(prev.balance + delta);
    const actual = round2(cur.balance);
    // Tolerate 0.02 rounding drift
    if (Math.abs(expected - actual) > 0.02) {
      walkOk = false;
      // Index relative to the full txns array (not just those with balances)
      mismatch = txns.indexOf(cur);
      break;
    }
  }

  return { first, last, walkOk, firstMismatchIndex: mismatch };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
