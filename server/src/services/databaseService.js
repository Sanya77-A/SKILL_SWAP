import mongoose from "mongoose";
import { env } from "../config/env.js";
import { isVercelRuntime } from "../config/runtime.js";
import { logger } from "../utils/logger.js";

const RETRY_DELAY_MS = 30_000;

export class DatabaseServiceError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = "DatabaseServiceError";
    this.code = code;
    this.statusCode = 503;
  }
}

export function validateDatabaseConfiguration({
  mode = env.DATABASE_MODE,
  uri = env.MONGO_URI,
  vercel = process.env.VERCEL,
} = {}) {
  if (mode === "demo") return { valid: true, mode, persistence: false };
  if (mode !== "mongo") {
    return { valid: false, mode, code: "DATABASE_CONFIGURATION_ERROR", reason: "DATABASE_MODE must be mongo or demo" };
  }
  if (!uri) {
    return { valid: false, mode, code: "DATABASE_CONFIGURATION_ERROR", reason: "MONGO_URI is required when DATABASE_MODE=mongo" };
  }
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    return { valid: false, mode, code: "DATABASE_CONFIGURATION_ERROR", reason: "MONGO_URI must use mongodb:// or mongodb+srv://" };
  }

  let hostname;
  try {
    hostname = new URL(uri).hostname.toLowerCase();
  } catch {
    return { valid: false, mode, code: "DATABASE_CONFIGURATION_ERROR", reason: "MONGO_URI is invalid" };
  }
  if (isVercelRuntime(vercel) && ["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return { valid: false, mode, code: "DATABASE_CONFIGURATION_ERROR", reason: "MONGO_URI cannot point to localhost in Vercel" };
  }
  return { valid: true, mode, persistence: true };
}

export function createDatabaseService({
  mode = env.DATABASE_MODE,
  uri = env.MONGO_URI,
  vercel = process.env.VERCEL,
  mongooseClient = mongoose,
  options = { maxPoolSize: env.MONGO_MAX_POOL_SIZE, serverSelectionTimeoutMS: 10_000 },
  log = logger,
  now = () => Date.now(),
} = {}) {
  let connectionPromise = null;
  let lastFailure = null;
  let retryAfter = 0;

  const configuration = () => validateDatabaseConfiguration({ mode, uri, vercel });
  const state = () => {
    const config = configuration();
    if (mode === "demo") return { mode, available: true, persistence: false, database: "demo" };
    return {
      mode,
      available: config.valid && mongooseClient.connection.readyState === 1,
      persistence: true,
      database: mongooseClient.connection.readyState === 1 ? "connected" : "disconnected",
      ...(!config.valid && { errorCode: config.code }),
    };
  };

  const ensureAvailable = async () => {
    const config = configuration();
    if (!config.valid) throw new DatabaseServiceError(config.code, config.reason);
    if (mode === "demo") return state();
    if (mongooseClient.connection.readyState === 1) return state();
    if (lastFailure && now() < retryAfter) {
      throw new DatabaseServiceError("DATABASE_UNAVAILABLE", "Database is temporarily unavailable", lastFailure);
    }
    if (!connectionPromise) {
      connectionPromise = mongooseClient.connect(uri, options)
        .then(() => {
          lastFailure = null;
          retryAfter = 0;
          log.info("database_connected", { database: mongooseClient.connection.name });
          return state();
        })
        .catch((error) => {
          lastFailure = error;
          retryAfter = now() + RETRY_DELAY_MS;
          log.error("database_connection_failed", { error });
          throw new DatabaseServiceError("DATABASE_UNAVAILABLE", "Database is temporarily unavailable", error);
        })
        .finally(() => { connectionPromise = null; });
    }
    return connectionPromise;
  };

  return Object.freeze({ configuration, ensureAvailable, state });
}

export const databaseService = createDatabaseService();
