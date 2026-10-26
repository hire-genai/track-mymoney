import "server-only";

/**
 * Lightweight structured logger for the import pipeline. Prints to the server
 * terminal with elapsed-time context so the operator can see each stage.
 * Never logs statement contents.
 */

const palette = {
  dim: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

function stamp(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function line(tag: string, color: string, msg: string, extra?: Record<string, unknown>) {
  const extras = extra
    ? " " +
      Object.entries(extra)
        .map(([k, v]) => `${palette.dim}${k}=${palette.reset}${format(v)}`)
        .join(" ")
    : "";
  // eslint-disable-next-line no-console
  console.log(`${palette.dim}[${stamp()}]${palette.reset} ${color}${tag}${palette.reset} ${msg}${extras}`);
}

function format(v: unknown): string {
  if (typeof v === "number") return v.toString();
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const importLog = {
  info: (msg: string, extra?: Record<string, unknown>) => line("[import]", palette.cyan, msg, extra),
  step: (msg: string, extra?: Record<string, unknown>) => line("[import ✓]", palette.green, msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => line("[import ⚠]", palette.yellow, msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => line("[import ✗]", palette.red, msg, extra),
};

/** Returns a function that reports elapsed ms since this call. */
export function startTimer(): () => number {
  const t0 = Date.now();
  return () => Date.now() - t0;
}
