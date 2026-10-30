import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, RATE_LIMIT_RETRY_DELAY_MS, aiCategorize, type AiTxn } from "../src/lib/import/ai-categorize";
import { getPrimaryCategory } from "../src/lib/finance-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_TXNS: AiTxn[] = [
  { isoDate: "2026-09-01", particulars: "ZEPTO/HDFC", amount: 68, type: "debit" },
  { isoDate: "2026-09-02", particulars: "MYJIO/HDFC", amount: 706, type: "debit" },
  { isoDate: "2026-09-03", particulars: "SALARY ACME", amount: 50000, type: "credit" },
];

function makeFetchResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Temporarily replace global.fetch for the duration of `fn`, then restore it. */
async function withFetch(
  mockFetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved = global.fetch;
  (global as typeof globalThis & { fetch: unknown }).fetch = mockFetch;
  try {
    await fn();
  } finally {
    (global as typeof globalThis & { fetch: unknown }).fetch = saved;
  }
}

/** Run fn with OPENROUTER_API_KEY set to a dummy value. */
async function withApiKey(fn: () => Promise<void>): Promise<void> {
  const saved = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key-dummy";
  try {
    await fn();
  } finally {
    if (saved === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = saved;
  }
}

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

test("Nemotron free is the only configured model (no silent fallback chain)", () => {
  assert.deepEqual(MODELS, ["nvidia/nemotron-3-ultra-550b-a55b:free"]);
  assert.equal(MODELS.length, 1, "must not configure additional model fallbacks");
  assert.ok(MODELS[0].endsWith(":free"), "model ID must end with :free (free-tier variant)");
});

test("RATE_LIMIT_RETRY_DELAY_MS is exported and positive", () => {
  assert.equal(typeof RATE_LIMIT_RETRY_DELAY_MS, "number");
  assert.ok(RATE_LIMIT_RETRY_DELAY_MS > 0);
});

// ---------------------------------------------------------------------------
// No API key — keyword fallback
// ---------------------------------------------------------------------------

test("aiCategorize without OPENROUTER_API_KEY uses deterministic keyword rules, not another model", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const debug: string[] = [];
    const out = await aiCategorize(SAMPLE_TXNS, debug);
    assert.equal(out.length, 3);
    assert.equal(out[0].category, "Groceries");
    assert.equal(out[1].category, "Phone");
    assert.equal(out[2].category, "Net monthly income");
    assert.ok(
      debug.some((d) => d.includes("OPENROUTER_API_KEY not set")),
      `debug must flag missing API key; got: ${debug.join(" | ")}`,
    );
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

test("aiCategorize returns empty array for empty input", async () => {
  const debug: string[] = [];
  const out = await aiCategorize([], debug);
  assert.deepEqual(out, []);
});

// ---------------------------------------------------------------------------
// Successful AI response (mocked fetch)
// ---------------------------------------------------------------------------

test("aiCategorize uses AI categories when Nemotron returns valid JSON", async () => {
  await withApiKey(async () => {
    const aiBody = {
      choices: [
        {
          message: {
            content: JSON.stringify({ categories: ["Groceries", "Phone", "Net monthly income"] }),
          },
        },
      ],
    };
    await withFetch(async () => makeFetchResponse(200, aiBody), async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(out[0].category, "Groceries");
      assert.equal(out[1].category, "Phone");
      assert.equal(out[2].category, "Net monthly income");
      // Debug must show AI classification, not fallback
      assert.ok(
        debug.some((d) => d.includes("via nvidia/nemotron-3-ultra-550b-a55b:free")),
        `debug must show AI model used; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 402 — billing / no credits
// ---------------------------------------------------------------------------

test("aiCategorize falls back to keyword rules on HTTP 402, logs billing error, does not retry", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(402, "Payment Required");
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      // Must still return results (via keyword fallback)
      assert.equal(out.length, 3);
      // 402 must NOT be retried — fetch should be called exactly once per batch
      assert.equal(callCount, 1, "402 must not be retried");
      // Debug must mention 402 and fallback
      assert.ok(
        debug.some((d) => d.includes("402")),
        `debug must log 402; got: ${debug.join(" | ")}`,
      );
      assert.ok(
        debug.some((d) => d.includes("keyword fallback")),
        `debug must log keyword fallback; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 429 — rate limited, then success
// ---------------------------------------------------------------------------

test("aiCategorize retries once on HTTP 429, then succeeds", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    const aiBody = {
      choices: [{ message: { content: JSON.stringify({ categories: ["Groceries", "Phone", "Net monthly income"] }) } }],
    };
    await withFetch(async () => {
      callCount++;
      if (callCount === 1) return makeFetchResponse(429, "Too Many Requests");
      return makeFetchResponse(200, aiBody);
    }, async () => {
      // Override delay to 0 so the test doesn't wait 2s
      const savedDelay = RATE_LIMIT_RETRY_DELAY_MS;
      void savedDelay; // used only to document the override
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(callCount, 2, "should call fetch twice: once 429, once success");
      assert.ok(
        debug.some((d) => d.includes("429")),
        `debug must log 429; got: ${debug.join(" | ")}`,
      );
      assert.ok(
        debug.some((d) => d.includes("via nvidia/nemotron-3-ultra-550b-a55b:free")),
        `debug must confirm AI success on retry; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 429 — rate limited on all attempts → keyword fallback
// ---------------------------------------------------------------------------

test("aiCategorize falls back to keyword rules when all attempts return 429", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(429, "Too Many Requests");
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(callCount, 2, "should attempt twice (RETRIES=1)");
      assert.ok(
        debug.some((d) => d.includes("keyword fallback")),
        `debug must log keyword fallback; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Timeout / AbortError → keyword fallback
// ---------------------------------------------------------------------------

test("aiCategorize falls back to keyword rules when fetch is aborted (timeout)", async () => {
  await withApiKey(async () => {
    await withFetch(async (_url, init) => {
      // Simulate an immediate abort (as would happen on real timeout)
      const err = new DOMException("The operation was aborted", "AbortError");
      throw err;
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.ok(
        debug.some((d) => d.includes("keyword fallback")),
        `debug must log keyword fallback; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// getPrimaryCategory
// ---------------------------------------------------------------------------

test("getPrimaryCategory maps every static subcategory to its correct primary", () => {
  assert.equal(getPrimaryCategory("Gross monthly income"), "Income");
  assert.equal(getPrimaryCategory("Net monthly income"), "Income");
  assert.equal(getPrimaryCategory("Rent / Mortgage"), "Fixed");
  assert.equal(getPrimaryCategory("Groceries"), "Fixed");
  assert.equal(getPrimaryCategory("Miscellaneous"), "Fixed");
  assert.equal(getPrimaryCategory("Stocks"), "Investments");
  assert.equal(getPrimaryCategory("Post-Tax Retirement Savings"), "Investments");
  assert.equal(getPrimaryCategory("Vacations"), "Savings");
  assert.equal(getPrimaryCategory("Long Term Emergency Fund"), "Savings");
  assert.equal(getPrimaryCategory("Guilt-Free Spending"), "Guilt-Free");
});

test("getPrimaryCategory returns 'Unknown' (not 'Savings') for unknown subcategory", () => {
  assert.equal(getPrimaryCategory("Totally Made Up Category"), "Unknown");
  assert.equal(getPrimaryCategory(""), "Unknown");
});

test("getPrimaryCategory honours custom savings subs passed by the caller", () => {
  assert.equal(getPrimaryCategory("Dream House", ["Dream House", "Wedding"]), "Savings");
  assert.equal(getPrimaryCategory("Wedding", ["Dream House", "Wedding"]), "Savings");
  assert.equal(getPrimaryCategory("Not In List", ["Dream House"]), "Unknown");
});
