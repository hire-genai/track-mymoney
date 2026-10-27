import "server-only";
import { importLog, startTimer } from "./log";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Keep well under Vercel's 60s route cap so a slow model returns a JSON error
// instead of letting Vercel kill the function with an opaque 504.
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Hard-pinned model. We no longer discover or fall back across free models —
 * every request goes to this one model id. Change here if the pin needs to move.
 *
 * `nvidia/nemotron-3-ultra-550b-a55b:free` was not a valid OpenRouter id — the
 * endpoint accepted the request but the backing model stalled indefinitely,
 * causing Vercel 504s on upload. `deepseek/deepseek-chat-v3.1:free` is a real,
 * fast, structured-output-capable free tier model on OpenRouter.
 */
export const PINNED_MODEL_ID =
  process.env.OPENROUTER_MODEL_ID ?? "deepseek/deepseek-chat-v3.1:free";

interface JsonSchema {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

interface ChatArgs {
  system?: string;
  user: string;
  jsonSchema?: JsonSchema;
  temperature?: number;
  maxTokens?: number;
  skipModels?: Set<string>;
}

export interface ChatSuccess {
  content: string;
  model: string;
  attemptedModels: string[];
}

export class OpenRouterError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

/**
 * Kept so the /api/import/parse route's existing error branches continue to
 * compile. With the single-model pin we only ever throw this one when the pin
 * fails after the schema-fallback retry.
 */
export class NoModelSucceededError extends Error {
  attemptedModels: string[];
  constructor(attempted: string[], lastMessage: string) {
    super(`Model ${PINNED_MODEL_ID} failed: ${lastMessage}`);
    this.name = "NoModelSucceededError";
    this.attemptedModels = attempted;
  }
}

export async function openRouterChat(args: ChatArgs): Promise<ChatSuccess> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError("OPENROUTER_API_KEY is not configured", 500);

  const t = startTimer();
  importLog.info("calling pinned model", { model: PINNED_MODEL_ID });
  try {
    const content = await callPinned(args, apiKey);
    importLog.step("pinned model responded", { model: PINNED_MODEL_ID, ms: t() });
    return { content, model: PINNED_MODEL_ID, attemptedModels: [PINNED_MODEL_ID] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    importLog.warn("pinned model failed", { model: PINNED_MODEL_ID, ms: t(), reason: msg.slice(0, 160) });
    if (err instanceof OpenRouterError && err.status === 401) throw err;
    throw new NoModelSucceededError([PINNED_MODEL_ID], msg);
  }
}

async function callPinned(args: ChatArgs, apiKey: string): Promise<string> {
  // Two slots: first attempt + one schema-fallback retry (plain json_object).
  let dropSchema = false;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const body = buildBody(PINNED_MODEL_ID, args, dropSchema);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      importLog.warn("model timeout — abandoning", {
        model: PINNED_MODEL_ID,
        limitMs: REQUEST_TIMEOUT_MS,
      });
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: headersFor(apiKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 400 && !dropSchema && args.jsonSchema) {
        const text = await res.text().catch(() => "");
        if (/response_format|json_schema|schema/i.test(text)) {
          dropSchema = true;
          continue;
        }
        throw new OpenRouterError(`OpenRouter 400: ${text.slice(0, 160)}`, 400);
      }

      if (res.status === 401) {
        const text = await res.text().catch(() => "");
        throw new OpenRouterError(`OpenRouter 401 (bad API key): ${text.slice(0, 160)}`, 401);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new OpenRouterError(`OpenRouter ${res.status}: ${text.slice(0, 160)}`, res.status);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string | Array<{ text?: string }> };
          finish_reason?: string;
          native_finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string; code?: number };
      };

      const choice = data.choices?.[0];
      const raw = choice?.message?.content;
      const content = typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map((p) => p.text ?? "").join("")
          : "";

      if (!content) {
        const finishReason = choice?.finish_reason ?? "unknown";
        const nativeFinish = choice?.native_finish_reason ?? "";
        const apiError = data.error?.message?.slice(0, 120) ?? "";
        throw new OpenRouterError(
          `OpenRouter returned no content (finish_reason=${finishReason}${nativeFinish ? "/" + nativeFinish : ""}${apiError ? "; " + apiError : ""})`,
          502,
        );
      }
      return content;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (err instanceof OpenRouterError && err.status === 401) throw err;
      if (!dropSchema) break;
      if (attempt >= 2) break;
    }
  }

  throw lastErr ?? new OpenRouterError("OpenRouter call failed", 500);
}

function headersFor(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_SITE_NAME) headers["X-Title"] = process.env.OPENROUTER_SITE_NAME;
  return headers;
}

function buildBody(modelId: string, args: ChatArgs, dropSchema: boolean): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];
  if (args.system) messages.push({ role: "system", content: args.system });
  messages.push({ role: "user", content: args.user });

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: args.temperature ?? 0.1,
  };
  if (args.maxTokens) body.max_tokens = args.maxTokens;

  if (args.jsonSchema && !dropSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: args.jsonSchema.name,
        strict: args.jsonSchema.strict ?? true,
        schema: args.jsonSchema.schema,
      },
    };
  } else if (args.jsonSchema && dropSchema) {
    body.response_format = { type: "json_object" };
  }
  return body;
}
