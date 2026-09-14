import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isTest = nodeEnv === "test" || Boolean(process.env.JEST_WORKER_ID);
const databaseMode = (process.env.DATABASE_MODE || "mongo").trim().toLowerCase();

if (!new Set(["mongo", "demo"]).has(databaseMode)) {
  throw new Error("DATABASE_MODE must be mongo or demo");
}

const requiredInProduction = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CLIENT_URL",
  "ANALYTICS_SALT",
];

const missing = requiredInProduction.filter((key) => !process.env[key]?.trim());
if (nodeEnv === "production" && missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const insecureSecrets = new Set([
  "access-secret-change-me",
  "refresh-secret-change-me",
  "change-me-in-production",
  "your-access-secret-min-32-chars",
  "your-refresh-secret-min-32-chars",
]);

for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
  const value = process.env[key];
  if (nodeEnv === "production" && (insecureSecrets.has(value) || value.length < 32)) {
    throw new Error(`${key} must be at least 32 characters and must not use a default value`);
  }
}

const supportedAiProviders = new Set(["disabled", "openai", "gemini", "groq"]);
const aiProvider = (process.env.AI_PROVIDER || "disabled").toLowerCase();
if (!supportedAiProviders.has(aiProvider)) throw new Error(`AI_PROVIDER must be one of: ${[...supportedAiProviders].join(", ")}`);
const logLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
if (!new Set(["debug", "info", "warn", "error"]).has(logLevel)) throw new Error("LOG_LEVEL must be debug, info, warn, or error");

if (nodeEnv === "production") {
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error("JWT access and refresh secrets must be different");
  if (process.env.AUTH_EXPOSE_ACCESS_TOKEN === "true") throw new Error("AUTH_EXPOSE_ACCESS_TOKEN must remain false in production");
  const clientUrls = process.env.CLIENT_URL.split(",").map((value) => value.trim()).filter(Boolean);
  if (!clientUrls.length || clientUrls.some((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.origin !== value.replace(/\/$/, "");
    } catch {
      return true;
    }
  })) throw new Error("CLIENT_URL must contain only credential-free HTTPS origins in production");
  if (process.env.ANALYTICS_SALT.length < 32) throw new Error("ANALYTICS_SALT must be at least 32 characters in production");
  if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 16) throw new Error("CRON_SECRET must be at least 16 characters when configured in production");
  if (aiProvider !== "disabled") {
    const providerKey = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY" }[aiProvider];
    if (!process.env.AI_MODEL?.trim() || !process.env[providerKey]?.trim()) throw new Error(`${aiProvider} requires AI_MODEL and ${providerKey}`);
  }
  for (const group of [["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]]) {
    const configured = group.filter((key) => process.env[key]?.trim());
    if (configured.length && configured.length !== group.length) throw new Error(`${group.join(", ")} must be configured together`);
  }
  if (/[\r\n]/.test(process.env.SMTP_FROM || "")) throw new Error("SMTP_FROM must not contain control characters");
}

const port = Number.parseInt(process.env.PORT || "5003", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535");
const mongoMaxPoolSize = Number.parseInt(process.env.MONGO_MAX_POOL_SIZE || "10", 10);
if (!Number.isInteger(mongoMaxPoolSize) || mongoMaxPoolSize < 1 || mongoMaxPoolSize > 100) throw new Error("MONGO_MAX_POOL_SIZE must be an integer from 1 to 100");

export const env = Object.freeze({
  NODE_ENV: nodeEnv,
  IS_TEST: isTest,
  DATABASE_MODE: databaseMode,
  PORT: port,
  MONGO_URI: process.env.MONGO_URI?.trim() || "",
  MONGO_MAX_POOL_SIZE: mongoMaxPoolSize,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5174",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "test-access-secret-only",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "test-refresh-secret-only",
  JWT_ACCESS_EXPIRE: process.env.JWT_ACCESS_EXPIRE || "15m",
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "7d",
  AUTH_EXPOSE_ACCESS_TOKEN: process.env.AUTH_EXPOSE_ACCESS_TOKEN === "true",
  CRON_SECRET: process.env.CRON_SECRET || "",
  AI_PROVIDER: aiProvider,
  AI_MODEL: process.env.AI_MODEL || "",
  AI_TIMEOUT_MS: Math.min(60_000, Math.max(1_000, Number.parseInt(process.env.AI_TIMEOUT_MS || "15000", 10))),
  AI_MAX_RETRIES: Math.min(3, Math.max(0, Number.parseInt(process.env.AI_MAX_RETRIES || "1", 10))),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  ANALYTICS_SALT: process.env.ANALYTICS_SALT || "skillswap-local-analytics-salt",
  LOG_LEVEL: logLevel,
});
