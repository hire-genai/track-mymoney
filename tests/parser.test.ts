import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedCategories,
  fingerprintRow,
  formatMonth,
  monthLabelFromIso,
  splitTextIntoChunks,
} from "../src/lib/import/parser";

test("allowedCategories includes income, fixed, and guilt-free buckets", () => {
  const cats = allowedCategories();
  assert.ok(cats.includes("Net monthly income"));
  assert.ok(cats.includes("Rent / Mortgage"));
  assert.ok(cats.includes("Groceries"));
  assert.ok(cats.includes("Guilt-Free Spending"));
  assert.ok(cats.includes("Miscellaneous"));
});

test("allowedCategories respects extra savings sub-categories (goals)", () => {
  const extra = ["Goal: Family Vacation"];
  const cats = allowedCategories(extra);
  assert.ok(cats.includes("Goal: Family Vacation"));
});

test("fingerprintRow is stable + case/whitespace insensitive on description", () => {
  const a = fingerprintRow("A", "2026-09-01", 500, "  UPI  Payment  ", "debit");
  const b = fingerprintRow("A", "2026-09-01", 500, "upi payment", "debit");
  assert.equal(a, b);
});

test("fingerprintRow differentiates on person, amount, type, date", () => {
  const base = fingerprintRow("A", "2026-09-01", 500, "x", "debit");
  assert.notEqual(base, fingerprintRow("B", "2026-09-01", 500, "x", "debit"));
  assert.notEqual(base, fingerprintRow("A", "2026-09-02", 500, "x", "debit"));
  assert.notEqual(base, fingerprintRow("A", "2026-09-01", 501, "x", "debit"));
  assert.notEqual(base, fingerprintRow("A", "2026-09-01", 500, "x", "credit"));
});

test("formatMonth / monthLabelFromIso produce 'Mmm YYYY'", () => {
  assert.equal(formatMonth(new Date("2026-09-15T00:00:00Z")), "Sep 2026");
  assert.equal(monthLabelFromIso("2026-01-02"), "Jan 2026");
  assert.equal(monthLabelFromIso("2026-12-31"), "Dec 2026");
});

test("splitTextIntoChunks returns single chunk when under target", () => {
  const text = "a\nb\nc";
  const chunks = splitTextIntoChunks(text);
  assert.deepEqual(chunks, [text]);
});

test("splitTextIntoChunks splits large text at newline boundaries", () => {
  const line = "line of text".padEnd(100, " ");
  const text = Array.from({ length: 400 }).map(() => line).join("\n");
  const chunks = splitTextIntoChunks(text, { target: 10_000, overlap: 500 });
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(c.length <= 10_500); // target + a little slack
  }
  // Concatenation (minus overlaps) should contain the full input content
  const combined = chunks.join("");
  assert.ok(combined.length >= text.length);
});
