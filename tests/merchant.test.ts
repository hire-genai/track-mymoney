import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMerchant } from "../src/lib/merchant";

test("extractMerchant: known UPI merchant strings map to canonical names", () => {
  assert.equal(extractMerchant("MPAY/UPI/TRTR/627518473580/HSBC/MYNTRADESIGN"), "Myntra");
  assert.equal(extractMerchant("UPI/BLINKIT/ORDER/8827"), "Blinkit");
  assert.equal(extractMerchant("GooglePlay"), "Google Play");
  assert.equal(extractMerchant("UPI/slicesmallfi/REF/1122"), "Slice Small Finance");
  assert.equal(extractMerchant("POS AMAZON INDIA"), "Amazon");
  assert.equal(extractMerchant("UPI/SNITCHAPPAREL/ORDR"), "Snitch Apparel");
  assert.equal(extractMerchant("UPI/EKART/LOGISTICS/993"), "Ekart");
  assert.equal(extractMerchant("UPI/HARYANASTORE/VPA"), "Haryana Store");
  assert.equal(extractMerchant("UPI/BALAJIGENERAL/VPA"), "Balaji General");
  assert.equal(extractMerchant("UPI/HANSHDUDHBHANDAR/VPA"), "Hansh Dudhbhandar");
});

test("extractMerchant: credit side", () => {
  assert.equal(extractMerchant("NEFT CR SAL CR OCT2026"), "Salary Credit");
  assert.equal(extractMerchant("INT.PD TILL 30-SEP-2026"), "Interest Credit");
});

test("extractMerchant: fallback cleans unknown descriptions", () => {
  // Unknown merchant — picks the longest alphabetic token, title-cases.
  const out = extractMerchant("UPI/UNKNOWNMERCHANT/REF/9988");
  assert.equal(out, "Unknownmerchant");
});

test("extractMerchant: fallback inserts spaces at camelCase boundaries", () => {
  assert.equal(extractMerchant("someRandomVendor"), "Some Random Vendor");
});

test("extractMerchant: never fabricates — empty/garbage returns something readable", () => {
  assert.equal(extractMerchant(""), "Unknown");
  // Pure digits + rail prefix — nothing recognisable, falls through to the trimmed original.
  const only = extractMerchant("UPI/");
  assert.equal(typeof only, "string");
  assert.ok(only.length > 0);
});

test("extractMerchant: pattern specificity — Myntra wins over generic 'amazon' noise", () => {
  // Even if the string also mentions Amazon Pay rail, Myntra should match first.
  assert.equal(
    extractMerchant("UPI/AMAZONPAY/MYNTRADESIGN/ORDER"),
    "Myntra",
  );
});

test("extractMerchant: whitespace-only input doesn't crash", () => {
  const out = extractMerchant("   ");
  assert.equal(typeof out, "string");
});
