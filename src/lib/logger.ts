/** Structured JSON logger with sensitive-field redaction. Never log secrets or personal data. */
const SENSITIVE =
  /(otp|code|token|secret|password|cookie|authorization|phone|cnic|address|lat|lng|lon|coord|point|contact|storage_?key|session)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value;
  if (typeof value === "string") return value.length > 200 ? value.slice(0, 200) + "…" : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Masks phone-number-like and long digit sequences in free text (e.g. DB error messages). */
export function redactText(s: string): string {
  return s.replace(/\+?\d[\d\s-]{8,}\d/g, "[REDACTED_NUM]");
}

function emit(level: "info" | "warn" | "error", msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as object) : {}),
  });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  info: (msg: string, f?: Record<string, unknown>) => emit("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit("error", msg, f),
};

/** Monitoring hook: wire Sentry/etc. here. Currently logs a redacted line only. */
export function reportError(err: unknown, context?: Record<string, unknown>) {
  log.error("unhandled_error", { err, ...context });
}
