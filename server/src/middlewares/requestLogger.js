import crypto from "crypto";
import { logger } from "../utils/logger.js";

const safeRequestId = (value) => typeof value === "string" && /^[A-Za-z0-9._:-]{8,100}$/.test(value);

export function requestContext(req, res, next) {
  req.requestId = safeRequestId(req.get("x-request-id")) ? req.get("x-request-id") : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const context = {
      requestId: req.requestId,
      method: req.method,
      path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ...(req.user?._id ? { userId: req.user._id.toString() } : {}),
    };
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("http_request_completed", context);
  });
  next();
}
