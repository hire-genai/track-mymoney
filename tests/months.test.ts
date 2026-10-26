import { test } from "node:test";
import assert from "node:assert/strict";
import { monthLabel, recentMonths } from "../src/lib/finance-data";

test("monthLabel formats as 'Mmm YYYY'", () => {
  assert.equal(monthLabel(new Date(2026, 9, 15)), "Oct 2026");
  assert.equal(monthLabel(new Date(2026, 0, 1)), "Jan 2026");
  assert.equal(monthLabel(new Date(2025, 11, 31)), "Dec 2025");
});

test("recentMonths returns current month first, descending", () => {
  const list = recentMonths(4, new Date(2026, 9, 25)); // Oct 25, 2026
  assert.deepEqual(list, ["Oct 2026", "Sep 2026", "Aug 2026", "Jul 2026"]);
});

test("recentMonths crosses year boundary correctly", () => {
  const list = recentMonths(4, new Date(2026, 1, 10)); // Feb 2026
  assert.deepEqual(list, ["Feb 2026", "Jan 2026", "Dec 2025", "Nov 2025"]);
});

test("recentMonths defaults to 4 months", () => {
  const list = recentMonths(undefined, new Date(2026, 9, 1));
  assert.equal(list.length, 4);
});
