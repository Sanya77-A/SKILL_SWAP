import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Centralized error handler
 * Consistent API response: { success: false, message, errors? }
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = Number(err.statusCode || err.status) || (err.name === "MulterError" ? 400 : 500);
  const internalMessage = err.message || "Internal server error";
  const message = statusCode >= 500 && env.NODE_ENV === "production"
    ? "Internal server error"
    : internalMessage;
  const code = statusCode >= 500 ? "INTERNAL_ERROR" : (err.errorCode || err.code || "REQUEST_FAILED");

  logger[statusCode >= 500 ? "error" : "warn"]("api_request_failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    status: statusCode,
    code,
    ...(req.user?._id ? { userId: req.user._id.toString() } : {}),
    error: err,
  });

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
    },
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
    ...(err.errors && { errors: err.errors }),
  });
};

/**
 * 404 not found handler
 */
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
    error: { code: "NOT_FOUND", message: "Resource not found" },
  });
};
