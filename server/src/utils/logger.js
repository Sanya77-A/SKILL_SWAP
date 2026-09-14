const levels = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const sensitiveKey = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|credential|smtp_pass)/i;
const jwtLike = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const bearer = /Bearer\s+[^\s,]+/gi;

const configuredLevel = () => levels[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? levels.info;

export function redactLogValue(value, key = "", seen = new WeakSet()) {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(bearer, "Bearer [REDACTED]").replace(jwtLike, "[REDACTED_JWT]");
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactLogValue(value.message),
      code: value.code || value.errorCode,
      ...(process.env.NODE_ENV !== "production" && value.stack ? { stack: redactLogValue(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactLogValue(item, "", seen));
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([entryKey, entryValue]) => [entryKey, redactLogValue(entryValue, entryKey, seen)]));
}

function write(level, event, context = {}) {
  if (levels[level] < configuredLevel()) return;
  if ((process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) && process.env.LOG_TEST_OUTPUT !== "true") return;
  const record = redactLogValue({
    timestamp: new Date().toISOString(),
    level,
    service: "skillswap-api",
    event: typeof event === "string" ? event : "application_event",
    ...(context && typeof context === "object" && !Array.isArray(context) ? context : { detail: context }),
  });
  const destination = level === "error" ? process.stderr : process.stdout;
  destination.write(`${JSON.stringify(record)}\n`);
}

export const logger = Object.freeze({
  debug: (event, context) => write("debug", event, context),
  info: (event, context) => write("info", event, context),
  warn: (event, context) => write("warn", event, context),
  error: (event, context) => write("error", event, context),
});
