import crypto from "crypto";
import { env } from "../config/env.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { recomputeAllMatchCaches } from "../services/matchService.js";
import { runWithScheduledJobLock } from "../services/scheduledJobService.js";

export function cronAuthorizationMatches(authorization, secret = env.CRON_SECRET) {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export const recomputeMatchCaches = asyncHandler(async (req, res) => {
  if (!env.CRON_SECRET) {
    return res.status(503).json({
      success: false,
      message: "Scheduled processing is not configured.",
      error: { code: "CRON_DISABLED", message: "Scheduled processing is not configured." },
    });
  }
  if (!cronAuthorizationMatches(req.get("authorization"))) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
      error: { code: "CRON_UNAUTHORIZED", message: "Unauthorized" },
    });
  }

  const result = await runWithScheduledJobLock("match-cache-recompute", recomputeAllMatchCaches);
  return res.status(result.started ? 200 : 202).json({ success: true, data: result });
});
