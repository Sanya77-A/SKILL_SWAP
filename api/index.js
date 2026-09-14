import app from "../server/src/app.js";
import { databaseService } from "../server/src/config/db.js";
import { logger } from "../server/src/utils/logger.js";

export function normalizeVercelApiRequest(req) {
  const requestUrl = new URL(req.url || "/api", "http://localhost");
  const rewrittenPath = req.query?.__path || requestUrl.searchParams.get("__path");
  if (!rewrittenPath) return;

  const pathValue = Array.isArray(rewrittenPath) ? rewrittenPath.join("/") : rewrittenPath;
  requestUrl.pathname = `/api/${String(pathValue).replace(/^\/+/, "")}`;
  requestUrl.searchParams.delete("__path");
  req.url = `${requestUrl.pathname}${requestUrl.search}`;
  if (req.query) delete req.query.__path;
}

export default async function handler(req, res) {
  normalizeVercelApiRequest(req);
  try {
    await databaseService.ensureAvailable();
    return app(req, res);
  } catch (error) {
    logger.error("vercel_database_connection_failed", { error });
    if (res.headersSent) return res.end();
    return res.status(503).json({
      success: false,
      message: error.code === "DATABASE_CONFIGURATION_ERROR" ? error.message : "Database is temporarily unavailable.",
      error: {
        code: error.code === "DATABASE_CONFIGURATION_ERROR" ? error.code : "DATABASE_UNAVAILABLE",
        message: error.code === "DATABASE_CONFIGURATION_ERROR" ? error.message : "Database is temporarily unavailable.",
      },
    });
  }
}
