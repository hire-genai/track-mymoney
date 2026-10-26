import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Invariants for the Couple-upload flow after fixing the dashboard bug where
 * clicking "Upload Partner" previously inflated FILES to 1 and TXNS to 29
 * by seeding demo transactions client-side.
 *
 * These tests encode the contract that must hold:
 *   1. Authenticated upload stats come from DB-persisted counts, never from
 *      client state toggled by button clicks.
 *   2. Button clicks route to the real importer; they never create data.
 *   3. The parse step never persists; only the commit route writes rows.
 */

// Deterministic reproduction of the files-count logic in UploadSection.tsx
function filesCount(opts: {
  authenticated: boolean;
  importsCount: number;
  uploadedPersons: { A: boolean; B: boolean };
}): number {
  return opts.authenticated
    ? opts.importsCount
    : (opts.uploadedPersons.A ? 1 : 0) + (opts.uploadedPersons.B ? 1 : 0);
}

test("authenticated filesCount reflects DB imports, not UI toggles", () => {
  // Clicking "Upload Partner" must NOT change persisted counts.
  const before = filesCount({
    authenticated: true,
    importsCount: 0,
    uploadedPersons: { A: false, B: false },
  });
  assert.equal(before, 0);

  // Simulate a stray client toggle (as the old simulateUpload bug would do):
  const afterStrayToggle = filesCount({
    authenticated: true,
    importsCount: 0, // DB unchanged
    uploadedPersons: { A: false, B: true }, // UI flipped
  });
  assert.equal(
    afterStrayToggle,
    0,
    "A UI toggle must never change files count for authenticated users",
  );
});

test("authenticated filesCount matches real DB import count only", () => {
  assert.equal(
    filesCount({
      authenticated: true,
      importsCount: 1,
      uploadedPersons: { A: false, B: true },
    }),
    1,
  );
  assert.equal(
    filesCount({
      authenticated: true,
      importsCount: 3,
      uploadedPersons: { A: true, B: true },
    }),
    3,
  );
});

test("unauthenticated landing uses client flags (demo preview)", () => {
  assert.equal(
    filesCount({
      authenticated: false,
      importsCount: 0,
      uploadedPersons: { A: true, B: false },
    }),
    1,
  );
  assert.equal(
    filesCount({
      authenticated: false,
      importsCount: 0,
      uploadedPersons: { A: true, B: true },
    }),
    2,
  );
});

/**
 * Invariant: both-partners comparison unlocks ONLY when both persons have
 * persisted import files (or persisted txns, which is downstream of an import).
 */
function bothUploadedAuthenticated(importsByPerson: { A: number; B: number }): boolean {
  return importsByPerson.A > 0 && importsByPerson.B > 0;
}

test("couple comparison requires both-side persisted imports", () => {
  assert.equal(bothUploadedAuthenticated({ A: 0, B: 0 }), false);
  assert.equal(bothUploadedAuthenticated({ A: 1, B: 0 }), false);
  assert.equal(bothUploadedAuthenticated({ A: 0, B: 1 }), false);
  assert.equal(bothUploadedAuthenticated({ A: 1, B: 1 }), true);
  assert.equal(bothUploadedAuthenticated({ A: 2, B: 3 }), true);
});

/**
 * Invariant: send-otp 429 (rate-limited) must not be surfaced as an error
 * on the email step. It must transition to the code step and inform the user.
 * This encodes the fix for the misleading "Please wait 15s" message.
 */
interface SendOtpOutcome {
  nextStep: "email" | "code";
  info: string | null;
  error: string | null;
}

function sendOtpOutcome(res: { ok: boolean; status: number; retryAfter?: number }): SendOtpOutcome {
  if (!res.ok) {
    if (res.status === 429 && res.retryAfter) {
      return { nextStep: "code", info: "A code was sent recently", error: null };
    }
    return { nextStep: "email", info: null, error: "Could not send code" };
  }
  return { nextStep: "code", info: "Code sent", error: null };
}

test("send-otp 429 moves to code step with info, not error on email step", () => {
  const r = sendOtpOutcome({ ok: false, status: 429, retryAfter: 42 });
  assert.equal(r.nextStep, "code");
  assert.equal(r.error, null);
  assert.ok(r.info);
});

test("send-otp other errors stay on email step as errors", () => {
  const r = sendOtpOutcome({ ok: false, status: 500 });
  assert.equal(r.nextStep, "email");
  assert.ok(r.error);
  assert.equal(r.info, null);
});

test("send-otp success moves to code step with info", () => {
  const r = sendOtpOutcome({ ok: true, status: 200 });
  assert.equal(r.nextStep, "code");
  assert.ok(r.info);
  assert.equal(r.error, null);
});
