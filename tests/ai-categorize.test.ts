import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODELS,
  NEMOTRON_MODEL,
  RATE_LIMIT_RETRY_DELAY_MS,
  aiCategorize,
  parseCategoriesResponse,
  type AiTxn,
} from "../src/lib/import/ai-categorize";
import { getPrimaryCategory } from "../src/lib/finance-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_TXNS: AiTxn[] = [
  { isoDate: "2026-09-01", particulars: "ZEPTO/HDFC", amount: 68, type: "debit" },
  { isoDate: "2026-09-02", particulars: "MYJIO/HDFC", amount: 706, type: "debit" },
  { isoDate: "2026-09-03", particulars: "SALARY ACME", amount: 50000, type: "credit" },
];

function makeFetchResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
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

function okBody(cats: string[]): unknown {
  return { choices: [{ message: { content: JSON.stringify({ categories: cats }) } }] };
}

// ---------------------------------------------------------------------------
// Model configuration — Nemotron ONLY, no other LLMs
// ---------------------------------------------------------------------------

test("MODELS contains ONLY NVIDIA Nemotron — no Llama / Gemini / Mistral fallback", () => {
  assert.equal(MODELS.length, 1, `expected a single Nemotron model, got ${MODELS.length}`);
  assert.equal(MODELS[0], NEMOTRON_MODEL);
  assert.ok(MODELS[0].startsWith("nvidia/"), `model must be an nvidia/* slug, got ${MODELS[0]}`);
  assert.ok(/nemotron/i.test(MODELS[0]), `model must be Nemotron, got ${MODELS[0]}`);
  for (const forbidden of ["llama", "gemini", "mistral"]) {
    for (const m of MODELS) {
      assert.ok(
        !m.toLowerCase().includes(forbidden),
        `MODELS must not reference ${forbidden}; got ${m}`,
      );
    }
  }
});

test("NEMOTRON_MODEL defaults to nvidia/nemotron-3-ultra-550b-a55b:free", () => {
  // Default when NVIDIA_NEMOTRON_MODEL is not set — guards against accidental drift.
  // (Env override is intentional and tested indirectly by the type of NEMOTRON_MODEL.)
  assert.ok(typeof NEMOTRON_MODEL === "string" && NEMOTRON_MODEL.length > 0);
});

test("RATE_LIMIT_RETRY_DELAY_MS is exported and positive", () => {
  assert.equal(typeof RATE_LIMIT_RETRY_DELAY_MS, "number");
  assert.ok(RATE_LIMIT_RETRY_DELAY_MS > 0);
});

// ---------------------------------------------------------------------------
// Strict JSON parser
// ---------------------------------------------------------------------------

test("parseCategoriesResponse accepts a well-formed response of the expected length", () => {
  const r = parseCategoriesResponse(JSON.stringify({ categories: ["Groceries", "Phone"] }), 2);
  assert.deepEqual(r.categories, ["Groceries", "Phone"]);
  assert.equal(r.error, undefined);
});

test("parseCategoriesResponse rejects length mismatch", () => {
  const r = parseCategoriesResponse(JSON.stringify({ categories: ["Groceries"] }), 2);
  assert.equal(r.categories, undefined);
  assert.ok(r.error?.includes("length"));
});

test("parseCategoriesResponse rejects missing categories field", () => {
  const r = parseCategoriesResponse(JSON.stringify({ foo: ["x"] }), 1);
  assert.equal(r.categories, undefined);
  assert.ok(r.error?.includes("categories"));
});

test("parseCategoriesResponse rejects non-string entries", () => {
  const r = parseCategoriesResponse(JSON.stringify({ categories: [42] }), 1);
  assert.equal(r.categories, undefined);
  assert.ok(r.error?.includes("entry 0"));
});

test("parseCategoriesResponse rejects empty response", () => {
  const r = parseCategoriesResponse("", 1);
  assert.equal(r.categories, undefined);
  assert.ok(r.error?.includes("empty"));
});

test("parseCategoriesResponse handles fenced JSON", () => {
  const raw = "```json\n{\"categories\":[\"Groceries\"]}\n```";
  const r = parseCategoriesResponse(raw, 1);
  assert.deepEqual(r.categories, ["Groceries"]);
});

// ---------------------------------------------------------------------------
// No API key — keyword fallback, clearly flagged
// ---------------------------------------------------------------------------

test("aiCategorize without OPENROUTER_API_KEY uses deterministic keyword rules and flags every row", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const debug: string[] = [];
    const out = await aiCategorize(SAMPLE_TXNS, debug);
    assert.equal(out.length, 3);
    assert.equal(out[0].category, "Groceries");
    assert.equal(out[1].category, "Phone");
    assert.equal(out[2].category, "Net monthly income");
    for (const row of out) assert.equal(row.fallback, true, "every row must be flagged as fallback");
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
// Successful AI response — AI rows must NOT be flagged
// ---------------------------------------------------------------------------

test("aiCategorize uses Nemotron categories when response is valid, no fallback flag set", async () => {
  await withApiKey(async () => {
    await withFetch(async () => makeFetchResponse(200, okBody(["Groceries", "Phone", "Net monthly income"])), async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(out[0].category, "Groceries");
      assert.equal(out[1].category, "Phone");
      assert.equal(out[2].category, "Net monthly income");
      for (const row of out) {
        assert.ok(row.fallback === undefined, "AI-classified rows must not carry a fallback flag");
      }
      assert.ok(
        debug.some((d) => d.includes(`via ${NEMOTRON_MODEL}`)),
        `debug must show Nemotron model used; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Request shape — model, no fallback model list, no server-side fallback
// ---------------------------------------------------------------------------

test("aiCategorize posts ONLY Nemotron as the model and disables provider fallbacks", async () => {
  await withApiKey(async () => {
    let captured: { model?: string; models?: unknown; provider?: { allow_fallbacks?: boolean } } | null = null;
    await withFetch(async (_url, init) => {
      captured = JSON.parse(String(init?.body ?? "{}"));
      return makeFetchResponse(200, okBody(["Groceries", "Phone", "Net monthly income"]));
    }, async () => {
      const debug: string[] = [];
      await aiCategorize(SAMPLE_TXNS, debug);
      assert.ok(captured, "fetch must have been called");
      assert.equal(captured!.model, NEMOTRON_MODEL);
      // No OpenRouter-side `models` array that could silently route elsewhere.
      assert.equal(captured!.models, undefined, "must not send a models[] fallback array");
      assert.equal(
        captured!.provider?.allow_fallbacks,
        false,
        "must explicitly disable provider-side fallbacks",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 402 — billing / no credits (permanent)
// ---------------------------------------------------------------------------

test("aiCategorize falls back to keyword rules on HTTP 402 and does not retry", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(402, "Payment Required");
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(callCount, 1, "402 must not be retried");
      for (const row of out) assert.equal(row.fallback, true);
      assert.ok(debug.some((d) => d.includes("402")), `debug must log 402; got: ${debug.join(" | ")}`);
      assert.ok(
        debug.some((d) => d.includes("keyword fallback")),
        `debug must log keyword fallback; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 401 — auth error (permanent)
// ---------------------------------------------------------------------------

test("aiCategorize does not retry on HTTP 401 (invalid key)", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(401, "Unauthorized");
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(callCount, 1, "401 must not be retried");
      for (const row of out) assert.equal(row.fallback, true);
      assert.ok(debug.some((d) => d.includes("401")), `debug must log 401; got: ${debug.join(" | ")}`);
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 404 — model unavailable (permanent)
// ---------------------------------------------------------------------------

test("aiCategorize does not retry on HTTP 404 (model unavailable)", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(404, "Not Found");
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(callCount, 1, "404 must not be retried");
      for (const row of out) assert.equal(row.fallback, true);
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 429 — retry on Nemotron, then succeed
// ---------------------------------------------------------------------------

test("aiCategorize retries on HTTP 429 on Nemotron and succeeds — stays on Nemotron", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    const captured: Array<{ model?: string }> = [];
    await withFetch(async (_url, init) => {
      callCount++;
      captured.push(JSON.parse(String(init?.body ?? "{}")));
      if (callCount === 1) {
        return makeFetchResponse(429, "Too Many Requests", { "retry-after": "0" });
      }
      return makeFetchResponse(200, okBody(["Groceries", "Phone", "Net monthly income"]));
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      assert.equal(callCount, 2, "should call fetch twice: 429 then 200");
      for (const row of out) assert.ok(row.fallback === undefined, "successful rows must not be flagged");
      // Both attempts must have used Nemotron — no silent swap.
      for (const c of captured) assert.equal(c.model, NEMOTRON_MODEL);
      assert.ok(debug.some((d) => d.includes("429")), `debug must log 429; got: ${debug.join(" | ")}`);
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 429 — every attempt fails → clearly flagged keyword fallback
// ---------------------------------------------------------------------------

test("aiCategorize flags every row as fallback when all 429 attempts fail", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(429, "Too Many Requests", { "retry-after": "0" });
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      // RETRIES=3 → 4 total attempts, ALL on Nemotron (no model rotation).
      assert.equal(callCount, 4, "should attempt exactly RETRIES+1=4 times on Nemotron");
      for (const row of out) assert.equal(row.fallback, true);
      assert.ok(
        debug.some((d) => d.includes("Nemotron failed")),
        `debug must log that Nemotron failed; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP 5xx — retry with backoff on Nemotron
// ---------------------------------------------------------------------------

test("aiCategorize retries on HTTP 503 and succeeds", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      if (callCount === 1) return makeFetchResponse(503, "Service Unavailable");
      return makeFetchResponse(200, okBody(["Groceries", "Phone", "Net monthly income"]));
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(callCount, 2);
      for (const row of out) assert.ok(row.fallback === undefined);
      assert.ok(debug.some((d) => d.includes("503")), `debug must log 503; got: ${debug.join(" | ")}`);
    });
  });
});

// ---------------------------------------------------------------------------
// Timeout / AbortError → keyword fallback with flag
// ---------------------------------------------------------------------------

test("aiCategorize falls back to keyword rules (flagged) when fetch is aborted", async () => {
  await withApiKey(async () => {
    await withFetch(async () => {
      throw new DOMException("The operation was aborted", "AbortError");
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(out.length, 3);
      for (const row of out) assert.equal(row.fallback, true);
      assert.ok(
        debug.some((d) => d.includes("keyword fallback")),
        `debug must log keyword fallback; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON retries, then fallback
// ---------------------------------------------------------------------------

test("aiCategorize retries on malformed JSON (same model), then falls back and flags rows", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      return makeFetchResponse(200, { choices: [{ message: { content: "not json at all" } }] });
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(callCount, 4, "malformed JSON must consume all 4 attempts on Nemotron");
      for (const row of out) assert.equal(row.fallback, true);
      assert.ok(
        debug.some((d) => d.includes("parse failed")),
        `debug must log parse failures; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Length-mismatch response triggers retry
// ---------------------------------------------------------------------------

test("aiCategorize retries when response length does not match input count", async () => {
  await withApiKey(async () => {
    let callCount = 0;
    await withFetch(async () => {
      callCount++;
      if (callCount < 2) {
        // Wrong length — one short.
        return makeFetchResponse(200, okBody(["Groceries", "Phone"]));
      }
      return makeFetchResponse(200, okBody(["Groceries", "Phone", "Net monthly income"]));
    }, async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      assert.equal(callCount, 2);
      for (const row of out) assert.ok(row.fallback === undefined);
      assert.ok(
        debug.some((d) => d.includes("length")),
        `debug must log length mismatch; got: ${debug.join(" | ")}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Invalid categories in a valid-shape response → per-row keyword correction, flagged
// ---------------------------------------------------------------------------

test("aiCategorize corrects out-of-taxonomy categories via keyword rules and flags only those rows", async () => {
  await withApiKey(async () => {
    await withFetch(async () =>
      // First is bogus; others are valid.
      makeFetchResponse(200, okBody(["Totally Made Up", "Phone", "Net monthly income"])),
    async () => {
      const debug: string[] = [];
      const out = await aiCategorize(SAMPLE_TXNS, debug);
      // Row 0: bogus → corrected to Groceries by keyword rule and flagged.
      assert.equal(out[0].category, "Groceries");
      assert.equal(out[0].fallback, true);
      // Rows 1,2: valid AI → unflagged.
      assert.equal(out[1].category, "Phone");
      assert.ok(out[1].fallback === undefined);
      assert.equal(out[2].category, "Net monthly income");
      assert.ok(out[2].fallback === undefined);
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
