import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
  hashToken,
} from "../utils/tokens.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import crypto from "crypto";
import { env } from "../config/env.js";
import { serializePrivateUser } from "../serializers/userSerializer.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export const authCookieOptions = ({ production = env.NODE_ENV === "production" } = {}) => ({
  httpOnly: true,
  secure: production,
  sameSite: "lax",
  path: "/",
});
const COOKIE_OPTIONS = authCookieOptions();
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const usernameBase = (value) =>
  value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "member";

async function availableUsername(requested, email) {
  const base = usernameBase(requested || email.split("@")[0]);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 24)}_${attempt}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base.slice(0, 20)}_${crypto.randomBytes(3).toString("hex")}`;
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE * 1000 });
  res.cookie("refreshToken", refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE * 1000 });
}

function authResponse(user, accessToken) {
  return {
    success: true,
    user: serializePrivateUser(user),
    expiresIn: ACCESS_MAX_AGE,
    ...(env.AUTH_EXPOSE_ACCESS_TOKEN && { accessToken }),
  };
}

/**
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, username, email, password, location, availability, experienceLevel } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: "Email already registered" });
  }
  const user = await User.create({
    name,
    fullName: name,
    username: await availableUsername(username, email),
    email,
    password,
    location: location || "",
    availability: availability || [],
    experienceLevel: experienceLevel || "intermediate",
  });
  const accessToken = generateAccessToken(user._id);
  const familyId = crypto.randomUUID();
  const refreshToken = generateRefreshToken(user._id, familyId);
  await RefreshToken.create({
    user: user._id,
    familyId,
    token: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
  });
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json(authResponse(user, accessToken));
});

/**
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, isDeleted: false })
    .select("+password +failedLoginAttempts +lockUntil");
  if (!user) {
    logger.warn("login_failed", { requestId: req.requestId, reason: "invalid_credentials" });
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }
  if (user.isBlocked || user.status !== "active") {
    logger.warn("login_failed", { requestId: req.requestId, reason: "account_disabled", userId: user._id.toString() });
    return res.status(403).json({ success: false, message: "Account is disabled" });
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    logger.warn("login_failed", { requestId: req.requestId, reason: "account_locked", userId: user._id.toString() });
    return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
  }
  const valid = await user.comparePassword(password);
  if (!valid) {
    const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    await User.findByIdAndUpdate(user._id, {
      failedLoginAttempts: failedLoginAttempts >= MAX_FAILED_LOGINS ? 0 : failedLoginAttempts,
      lockUntil: failedLoginAttempts >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
    });
    logger.warn("login_failed", { requestId: req.requestId, reason: "invalid_credentials", userId: user._id.toString(), accountLocked: failedLoginAttempts >= MAX_FAILED_LOGINS });
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }
  if (user.failedLoginAttempts || user.lockUntil) {
    await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockUntil: null });
  }
  const accessToken = generateAccessToken(user._id);
  const familyId = crypto.randomUUID();
  const refreshToken = generateRefreshToken(user._id, familyId);
  await RefreshToken.create({
    user: user._id,
    familyId,
    token: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
  });
  setAuthCookies(res, accessToken, refreshToken);
  res.json(authResponse(user, accessToken));
});

/**
 * POST /api/auth/refresh — refresh token rotation (middleware already verified)
 */
export const refresh = asyncHandler(async (req, res) => {
  const { refreshTokenStored, refreshPayload } = req;
  const newAccessToken = generateAccessToken(refreshPayload.userId);
  const familyId = refreshTokenStored.familyId || refreshPayload.familyId || crypto.randomUUID();
  const newRefreshToken = generateRefreshToken(refreshPayload.userId, familyId);
  const newRefreshHash = hashToken(newRefreshToken);
  const rotation = await RefreshToken.updateOne({ _id: refreshTokenStored._id, revokedAt: null }, { revokedAt: new Date(), rotatedAt: new Date(), replacedByHash: newRefreshHash });
  if (!rotation.modifiedCount) {
    await RefreshToken.updateMany({ user: refreshTokenStored.user, familyId, revokedAt: null }, { revokedAt: new Date() });
    throw new ApiError(401, "REFRESH_TOKEN_REUSED", "Refresh token reuse detected");
  }
  await RefreshToken.create({
    user: refreshPayload.userId,
    familyId,
    token: newRefreshHash,
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
  });
  setAuthCookies(res, newAccessToken, newRefreshToken);
  res.json({
    success: true,
    expiresIn: ACCESS_MAX_AGE,
    ...(env.AUTH_EXPOSE_ACCESS_TOKEN && { accessToken: newAccessToken }),
  });
});

/**
 * POST /api/auth/logout — invalidate refresh token (from cookie or body)
 */
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken) {
    await RefreshToken.updateOne({ token: { $in: [hashToken(refreshToken), refreshToken] } }, { revokedAt: new Date() });
  }
  res.cookie("accessToken", "", { ...COOKIE_OPTIONS, maxAge: 0 });
  res.cookie("refreshToken", "", { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json({ success: true, message: "Logged out" });
});

/**
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    return res.json({ success: true, message: "If email exists, reset link will be sent" });
  }
  const token = generateRandomToken();
  user.passwordResetToken = crypto.createHash("sha256").update(token).digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const resetUrl = `${env.CLIENT_URL.split(",")[0]}/reset-password?token=${token}`;
  await sendPasswordResetEmail(email, resetUrl);
  res.json({ success: true, message: "If email exists, reset link will be sent" });
});

/**
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
  res.json({ success: true, message: "Password reset successful" });
});

/**
 * PATCH /api/auth/change-password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.comparePassword(currentPassword))) {
    return res.status(400).json({
      success: false,
      message: "Current password is incorrect",
      error: { code: "CURRENT_PASSWORD_INVALID", message: "Current password is incorrect" },
    });
  }

  user.password = newPassword;
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });

  const accessToken = generateAccessToken(user._id);
  const familyId = crypto.randomUUID();
  const refreshToken = generateRefreshToken(user._id, familyId);
  await RefreshToken.create({
    user: user._id,
    familyId,
    token: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
  });
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true, message: "Password changed successfully" });
});
