import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { hashToken, verifyAccessToken, verifyRefreshToken } from "../utils/tokens.js";
import { logger } from "../utils/logger.js";

const authFailure = (req, reason, context = {}) => logger.warn("authentication_failed", {
  requestId: req.requestId,
  path: req.path,
  reason,
  ...context,
});

/**
 * Verify access token (from cookie or Authorization header), attach user to req
 */
export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
    if (!token) {
      authFailure(req, "missing_access_token");
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const { userId } = verifyAccessToken(token);
    const user = await User.findById(userId).select("+profileImagePublicId");
    if (!user) {
      authFailure(req, "unknown_user", { userId });
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (user.isBlocked || user.isDeleted || user.status !== "active") {
      authFailure(req, "account_disabled", { userId: user._id.toString() });
      return res.status(403).json({ success: false, message: "Account is disabled" });
    }
    req.user = user;
    next();
  } catch (err) {
    authFailure(req, "invalid_or_expired_access_token", { errorCode: err.code || err.name });
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/** Alias for protect (verifyAccessToken) */
export const verifyAccessTokenMiddleware = protect;

/** Attach a user when credentials are present, while allowing anonymous public requests. */
export const optionalAuth = (req, res, next) => {
  const hasToken = Boolean(req.cookies?.accessToken || req.headers.authorization?.startsWith("Bearer "));
  return hasToken ? protect(req, res, next) : next();
};

/**
 * Verify refresh token (cookie or body), attach stored token and payload to req
 */
export const verifyRefreshTokenMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      authFailure(req, "missing_refresh_token");
      return res.status(401).json({ success: false, message: "Refresh token required" });
    }
    const payload = verifyRefreshToken(token);
    // The raw-token fallback keeps pre-migration sessions valid until they rotate.
    const stored = await RefreshToken.findOne({ token: { $in: [hashToken(token), token] } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await RefreshToken.deleteOne({ _id: stored._id });
      authFailure(req, "invalid_or_expired_refresh_token");
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    }
    if (stored.revokedAt) {
      await RefreshToken.updateMany({ user: stored.user, ...(stored.familyId ? { familyId: stored.familyId } : {}), revokedAt: null }, { revokedAt: new Date() });
      authFailure(req, "refresh_token_reuse_detected", { userId: stored.user.toString(), familyId: stored.familyId });
      return res.status(401).json({ success: false, message: "Refresh token reuse detected", error: { code: "REFRESH_TOKEN_REUSED", message: "Refresh token reuse detected" } });
    }
    req.refreshTokenStored = stored;
    req.refreshPayload = payload;
    next();
  } catch (err) {
    authFailure(req, "invalid_refresh_token", { errorCode: err.code || err.name });
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};
