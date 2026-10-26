import "server-only";
import { importLog, startTimer } from "./log";

/**
 * Strict free-only model discovery for OpenRouter.
 *
 * Rules enforced here:
 * - A model is considered "free" ONLY when EVERY numeric pricing field present
 *   on the model entry parses to 0. If the model exposes an `audio`, `image`,
 *   `video`, `web_search`, `internal_reasoning`, `input_cache_read`, or
 *   `input_cache_write` pricing field with a non-zero value, it is paid.
 * - Missing/empty pricing strings are treated as UNKNOWN, not free. The
 *   `prompt` and `completion` fields must both be present AND equal to "0".
 * - The `:free` suffix is a hint, not proof.
 * - Models that cannot do text-in → text-out chat (image/audio/vision-only
 *   generators, embeddings, moderation, TTS/STT, agentic-only harnesses) are
 *   excluded by modality and by a dynamic session blacklist that remembers
 *   models which returned 402/403/404.
 *
 * We never fall back to a paid model — if discovery fails entirely, the caller
 * surfaces an error to the user.
 */

const MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const PREFERRED_FREE_IDS: readonly string[] = [
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-chat-v3.1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "qwen/qwq-32b:free",
];

/** Hard-exclude non-text-generation IDs by substring match. */
const EXCLUDE_SUBSTRINGS: readonly string[] = [
  "-image", "-vision-only", "-tts", "-stt",
  "whisper", "embed", "moderation", "guard",
  "lyria",       // music generation
  "imagen",      // image generation
  "dall-e",
  "sdxl", "stable-diffusion",
  "veo", "sora",  // video generation
  "tts-",
];

/** Pricing fields we recognize on OpenRouter model entries. */
const PRICING_FIELDS = [
  "prompt",
  "completion",
  "request",
  "image",
  "audio",
  "video",
  "web_search",
  "internal_reasoning",
  "input_cache_read",
  "input_cache_write",
] as const;

type PricingField = (typeof PRICING_FIELDS)[number];

interface RawModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: Partial<Record<PricingField, string | number>>;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
}

export interface FreeModel {
  id: string;
  contextLength: number;
  supportsJsonMode: boolean;
  supportsStructuredOutput: boolean;
}

interface CacheEntry {
  fetchedAt: number;
  models: FreeModel[];
}

let cache: CacheEntry | null = null;
let inflight: Promise<FreeModel[]> | null = null;

/**
 * In-process blacklist of model IDs that returned a definitive "not usable
 * for us" error (402 insufficient credits, 403 agentic-only, 404 not found)
 * during this session. We will not retry these on subsequent requests until
 * the process restarts.
 */
const sessionBlacklist = new Set<string>();

export class NoFreeModelAvailableError extends Error {
  constructor(message = "No eligible free OpenRouter model is available right now") {
    super(message);
    this.name = "NoFreeModelAvailableError";
  }
}

export class OpenRouterDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterDiscoveryError";
  }
}

export async function getFreeModels(opts: { force?: boolean } = {}): Promise<FreeModel[]> {
  const now = Date.now();
  if (!opts.force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.models.filter((m) => !sessionBlacklist.has(m.id));
  }
  if (inflight) return inflight.then((list) => list.filter((m) => !sessionBlacklist.has(m.id)));

  inflight = (async () => {
    const t = startTimer();
    importLog.info("discovering free models (OpenRouter /v1/models)");
    try {
      const models = await fetchAndFilter();
      cache = { fetchedAt: Date.now(), models };
      importLog.step("free models ready", {
        ms: t(),
        count: models.length,
        first: models[0]?.id ?? "(none)",
        blacklisted: sessionBlacklist.size,
      });
      return models;
    } catch (err) {
      importLog.error("discovery failed", {
        ms: t(),
        reason: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight.then((list) => list.filter((m) => !sessionBlacklist.has(m.id)));
}

async function fetchAndFilter(): Promise<FreeModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let data: { data?: RawModel[] };
  try {
    const res = await fetch(MODELS_ENDPOINT, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new OpenRouterDiscoveryError(`OpenRouter /models returned HTTP ${res.status}`);
    }
    data = (await res.json()) as { data?: RawModel[] };
  } finally {
    clearTimeout(timer);
  }

  const raw = data.data ?? [];
  const verifiedFree: FreeModel[] = [];
  let rejectedPaid = 0;
  let rejectedModality = 0;
  let rejectedSubstring = 0;

  for (const m of raw) {
    if (!m?.id) continue;
    if (isExcluded(m.id)) { rejectedSubstring++; continue; }
    if (!isFreePricing(m)) { rejectedPaid++; continue; }
    if (!isTextChatCapable(m)) { rejectedModality++; continue; }

    verifiedFree.push({
      id: m.id,
      contextLength: m.context_length ?? 0,
      supportsJsonMode: supportsJsonMode(m),
      supportsStructuredOutput: supportsStructuredOutput(m),
    });
  }

  importLog.info("discovery filter stats", {
    total: raw.length,
    free: verifiedFree.length,
    rejectedPaid,
    rejectedModality,
    rejectedSubstring,
  });

  return orderCandidates(verifiedFree);
}

/**
 * STRICT free check: every present pricing field must numerically parse to 0.
 * Missing `prompt` or `completion` is NOT treated as free — those must exist
 * and be "0". This catches cases like Lyria (music) which has prompt="0" but
 * also audio="0.003" — a non-zero `audio` price makes the model paid.
 */
export function isFreePricing(m: RawModel): boolean {
  const p = m.pricing;
  if (!p) return false;

  // prompt + completion MUST be present and zero
  const prompt = toPrice(p.prompt);
  const completion = toPrice(p.completion);
  if (prompt === null || completion === null) return false;
  if (prompt !== 0 || completion !== 0) return false;

  // Every OTHER known pricing field, if present, must also be zero
  for (const field of PRICING_FIELDS) {
    if (field === "prompt" || field === "completion") continue;
    const v = p[field];
    if (v === undefined || v === null) continue; // field absent → ignore
    const n = toPrice(v);
    if (n === null || n > 0) return false; // present but non-zero or unparseable → paid
  }
  return true;
}

/** Parse an OpenRouter pricing value. Returns null on empty/invalid; number otherwise. */
function toPrice(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "") return null; // empty string ≠ free
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Strict text-chat capability check:
 * - output modality must include "text" and must NOT include image/audio/video
 * - input modality (if declared) must include "text"
 */
export function isTextChatCapable(m: RawModel): boolean {
  const arch = m.architecture;
  const out = arch?.output_modalities;
  if (Array.isArray(out) && out.length > 0) {
    if (!out.includes("text")) return false;
    if (out.some((o) => o === "image" || o === "audio" || o === "video")) return false;
  } else {
    const modality = arch?.modality ?? "";
    if (!modality.includes("->text") && modality !== "text") return false;
  }
  const inp = arch?.input_modalities;
  if (Array.isArray(inp) && inp.length > 0 && !inp.includes("text")) return false;
  return true;
}

function isExcluded(id: string): boolean {
  const lower = id.toLowerCase();
  return EXCLUDE_SUBSTRINGS.some((frag) => lower.includes(frag));
}

function supportsJsonMode(m: RawModel): boolean {
  return (m.supported_parameters ?? []).includes("response_format");
}

function supportsStructuredOutput(m: RawModel): boolean {
  return (m.supported_parameters ?? []).includes("structured_outputs");
}

export function orderCandidates(models: FreeModel[]): FreeModel[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const ordered: FreeModel[] = [];
  const seen = new Set<string>();

  for (const id of PREFERRED_FREE_IDS) {
    const m = byId.get(id);
    if (m) {
      ordered.push(m);
      seen.add(id);
    }
  }
  const rest = models
    .filter((m) => !seen.has(m.id))
    .sort((a, b) => b.contextLength - a.contextLength);
  ordered.push(...rest);
  return ordered;
}

export async function pickFreeCandidates(limit = 8): Promise<FreeModel[]> {
  const list = await getFreeModels().catch((e) => {
    throw e instanceof Error ? e : new OpenRouterDiscoveryError(String(e));
  });
  if (list.length === 0) throw new NoFreeModelAvailableError();
  return list.slice(0, limit);
}

/**
 * Mark a model as unusable for the remainder of this process lifetime.
 * Called by openrouter.ts when a model returns 402/403/404 — those indicate
 * either hidden paid pricing, agentic-harness-only access, or model gone.
 */
export function blacklistModel(id: string, reason: string): void {
  if (sessionBlacklist.has(id)) return;
  sessionBlacklist.add(id);
  importLog.warn("model session-blacklisted", { model: id, reason });
}

/** For tests. */
export function _resetModelCache(): void {
  cache = null;
  inflight = null;
  sessionBlacklist.clear();
}

export function _blacklistSize(): number {
  return sessionBlacklist.size;
}
