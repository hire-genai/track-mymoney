import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatementText, parseCsvText } from "../src/lib/import/parser";

test("parses UCO Bank-style line with running balance", () => {
  const text = `
    01-09-2026 MPAY/UPI/TRTR/651485202094/DHEERAJYADAV/HDFC/XXX3 200.00 15,473.95
    01-09-2026 MPAY/UPI/TRTR/624458976934/MANISHSINGHS/BARB/XXX6 400.00 8,753.95
    01-09-2026 MPAY/UPI/TRTR/624401062127/DEVANSHUSHUKL/BARB/XXX 3,000.00 11,753.95
  `;
  const { transactions } = parseStatementText(text);
  assert.equal(transactions.length, 3);
  assert.equal(transactions[0].amount, 200);
  assert.equal(transactions[0].type, "debit");
  assert.equal(transactions[0].isoDate, "2026-09-01");
  assert.equal(transactions[2].amount, 3000);
  assert.equal(transactions[2].type, "credit");
});

test("ignores lines without a date", () => {
  const text = `Statement of Account\n01-09-2026 Groceries 150.00 100.00\nFooter line`;
  const { transactions } = parseStatementText(text);
  assert.equal(transactions.length, 1);
});

test("parses CSV with Withdrawal/Deposit columns", () => {
  const csv = `Date,Particulars,Withdrawal,Deposit,Balance
01-09-2026,UPI payment,200,,15473.95
02-09-2026,Salary credit,,30000,45473.95`;
  const { transactions } = parseCsvText(csv);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].amount, 200);
  assert.equal(transactions[0].type, "debit");
  assert.equal(transactions[1].amount, 30000);
  assert.equal(transactions[1].type, "credit");
});

test("CSV with signed Amount column", () => {
  const csv = `Date,Description,Amount
01-09-2026,ATM Withdrawal,-500
02-09-2026,Deposit,1500`;
  const { transactions } = parseCsvText(csv);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].amount, 500);
  assert.equal(transactions[0].type, "debit");
  assert.equal(transactions[1].type, "credit");
});

test("returns warning when no dates found", () => {
  const { transactions, warnings } = parseStatementText("just some random text no dates");
  assert.equal(transactions.length, 0);
  assert.ok(warnings.length > 0);
});
