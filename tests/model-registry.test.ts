import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFreePricing,
  isTextChatCapable,
  orderCandidates,
  type FreeModel,
} from "../src/lib/import/model-registry";

// ─── orderCandidates ────────────────────────────────────────────────────────

test("orderCandidates places preferred IDs first", () => {
  const models: FreeModel[] = [
    { id: "random/other:free", contextLength: 8_000, supportsJsonMode: false, supportsStructuredOutput: false },
    { id: "deepseek/deepseek-chat-v3-0324:free", contextLength: 64_000, supportsJsonMode: true, supportsStructuredOutput: true },
    { id: "google/gemini-2.0-flash-exp:free", contextLength: 1_000_000, supportsJsonMode: true, supportsStructuredOutput: true },
  ];
  const ordered = orderCandidates(models);
  // gemini-2.0-flash-exp:free is first in the preference list, so it wins.
  assert.equal(ordered[0].id, "google/gemini-2.0-flash-exp:free");
  assert.equal(ordered[1].id, "deepseek/deepseek-chat-v3-0324:free");
  assert.equal(ordered.at(-1)?.id, "random/other:free");
});

test("orderCandidates with no preferred matches sorts by context length desc", () => {
  const models: FreeModel[] = [
    { id: "a:free", contextLength: 8_000, supportsJsonMode: false, supportsStructuredOutput: false },
    { id: "b:free", contextLength: 32_000, supportsJsonMode: false, supportsStructuredOutput: false },
    { id: "c:free", contextLength: 128_000, supportsJsonMode: false, supportsStructuredOutput: false },
  ];
  const ordered = orderCandidates(models);
  assert.deepEqual(
    ordered.map((m) => m.id),
    ["c:free", "b:free", "a:free"],
  );
});

// ─── isFreePricing: the fix for the Lyria 402 bug ───────────────────────────

test("isFreePricing accepts a plainly-free model", () => {
  assert.equal(
    isFreePricing({
      id: "deepseek/deepseek-chat-v3-0324:free",
      pricing: { prompt: "0", completion: "0", request: "0" },
    }),
    true,
  );
});

test("isFreePricing REJECTS Lyria-shape pricing (prompt=0 but audio>0)", () => {
  // This is the exact bug from the user's log: lyria-3-pro-preview reports
  // prompt="0" and completion="0" but charges via audio pricing.
  assert.equal(
    isFreePricing({
      id: "google/lyria-3-pro-preview",
      pricing: { prompt: "0", completion: "0", audio: "0.003" },
    }),
    false,
    "A non-zero audio price must disqualify a model",
  );
});

test("isFreePricing REJECTS a model with non-zero image price", () => {
  assert.equal(
    isFreePricing({
      id: "fake/imagen:free",
      pricing: { prompt: "0", completion: "0", image: "0.0025" },
    }),
    false,
  );
});

test("isFreePricing REJECTS a model with non-zero video or web_search price", () => {
  assert.equal(
    isFreePricing({
      id: "fake/veo",
      pricing: { prompt: "0", completion: "0", video: "0.01" },
    }),
    false,
  );
  assert.equal(
    isFreePricing({
      id: "fake/search",
      pricing: { prompt: "0", completion: "0", web_search: "0.001" },
    }),
    false,
  );
});

test("isFreePricing REJECTS a model with missing prompt or completion pricing", () => {
  assert.equal(isFreePricing({ id: "x", pricing: { completion: "0" } }), false);
  assert.equal(isFreePricing({ id: "x", pricing: { prompt: "0" } }), false);
  assert.equal(isFreePricing({ id: "x" }), false);
  assert.equal(isFreePricing({ id: "x", pricing: {} }), false);
});

test("isFreePricing REJECTS a model whose prompt pricing is an empty string", () => {
  // Previously Number("") → 0 was treated as free. Must be treated as unknown.
  assert.equal(
    isFreePricing({ id: "x", pricing: { prompt: "", completion: "0" } }),
    false,
  );
});

test("isFreePricing REJECTS a paid chat model", () => {
  assert.equal(
    isFreePricing({
      id: "openai/gpt-4o",
      pricing: { prompt: "0.0000025", completion: "0.00001", request: "0" },
    }),
    false,
  );
});

test("isFreePricing accepts numeric 0 as well as string '0'", () => {
  assert.equal(
    isFreePricing({ id: "x", pricing: { prompt: 0, completion: 0 } }),
    true,
  );
});

// ─── isTextChatCapable: no music/image/audio-only models ─────────────────────

test("isTextChatCapable accepts a plain text-to-text model", () => {
  assert.equal(
    isTextChatCapable({
      id: "x",
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    }),
    true,
  );
});

test("isTextChatCapable accepts text+image input, text output", () => {
  assert.equal(
    isTextChatCapable({
      id: "x",
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    }),
    true,
  );
});

test("isTextChatCapable REJECTS audio-output models (Lyria shape)", () => {
  assert.equal(
    isTextChatCapable({
      id: "google/lyria-3-pro-preview",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["audio"],
      },
    }),
    false,
  );
});

test("isTextChatCapable REJECTS image-generation models", () => {
  assert.equal(
    isTextChatCapable({
      id: "x",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["image"],
      },
    }),
    false,
  );
});

test("isTextChatCapable REJECTS text+image output (hybrid gen)", () => {
  assert.equal(
    isTextChatCapable({
      id: "x",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text", "image"],
      },
    }),
    false,
    "A model that can also emit images shouldn't be used for our structured text extraction",
  );
});

test("isTextChatCapable REJECTS a model with no architecture declaration", () => {
  assert.equal(isTextChatCapable({ id: "x" }), false);
});

test("isTextChatCapable REJECTS a model that accepts no text input", () => {
  assert.equal(
    isTextChatCapable({
      id: "x",
      architecture: {
        input_modalities: ["image"],
        output_modalities: ["text"],
      },
    }),
    false,
  );
});
