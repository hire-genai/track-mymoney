import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/lib/import/reconcile";
import type { ParsedTxn } from "../src/lib/import/parser";

function tx(partial: Partial<ParsedTxn>): ParsedTxn {
  return {
    date: partial.date ?? "01-09",
    isoDate: partial.isoDate ?? "2026-09-01",
    particulars: partial.particulars ?? "Test",
    amount: partial.amount ?? 100,
    type: partial.type ?? "debit",
    category: partial.category ?? "Miscellaneous",
    confidence: partial.confidence ?? 0.9,
    reason: partial.reason ?? "",
    balance: partial.balance ?? null,
    needsReview: partial.needsReview ?? false,
  };
}

test("reconcile sums debits and credits", () => {
  const r = reconcile([
    tx({ type: "credit", amount: 1000 }),
    tx({ type: "debit", amount: 250.55 }),
    tx({ type: "debit", amount: 49.45 }),
  ]);
  assert.equal(r.totals.credits, 1000);
  assert.equal(r.totals.debits, 300);
  assert.equal(r.totals.net, 700);
  assert.equal(r.totals.count, 3);
});

test("reconcile flags low confidence and review flags", () => {
  const r = reconcile([
    tx({ confidence: 0.9 }),
    tx({ confidence: 0.4, needsReview: true }),
    tx({ confidence: 0.3, needsReview: true }),
  ]);
  assert.equal(r.reviewFlags.lowConfidence, 2);
  assert.equal(r.reviewFlags.needsReview, 2);
});

test("reconcile running-balance walk detects mismatch", () => {
  const txns = [
    tx({ type: "credit", amount: 100, balance: 1000, isoDate: "2026-09-01" }),
    tx({ type: "debit", amount: 50, balance: 950, isoDate: "2026-09-02" }), // 1000-50 = 950 OK
    tx({ type: "debit", amount: 25, balance: 900, isoDate: "2026-09-03" }), // 950-25 = 925 but printed 900 → mismatch
  ];
  const r = reconcile(txns);
  assert.equal(r.balance.walkOk, false);
  assert.equal(r.balance.firstMismatchIndex, 2);
});

test("reconcile walk is null when no balance printed", () => {
  const r = reconcile([tx({}), tx({})]);
  assert.equal(r.balance.walkOk, null);
  assert.equal(r.balance.first, null);
  assert.equal(r.balance.last, null);
});

test("reconcile category breakdown sorts by total desc", () => {
  const r = reconcile([
    tx({ category: "Groceries", amount: 100 }),
    tx({ category: "Rent / Mortgage", amount: 500 }),
    tx({ category: "Groceries", amount: 50 }),
  ]);
  assert.equal(r.categoryBreakdown[0].category, "Rent / Mortgage");
  assert.equal(r.categoryBreakdown[0].total, 500);
  assert.equal(r.categoryBreakdown[1].category, "Groceries");
  assert.equal(r.categoryBreakdown[1].total, 150);
  assert.equal(r.categoryBreakdown[1].count, 2);
});
