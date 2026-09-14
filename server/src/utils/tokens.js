import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";

const ACCESS_SECRET = env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRE;
const REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRE;

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (userId) => {
  return jwt.sign({ userId, jti: crypto.randomUUID() }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (userId, familyId = crypto.randomUUID()) => {
  return jwt.sign({ userId, familyId, jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Generate random token for password reset / email verification
 */
export const generateRandomToken = () => crypto.randomBytes(32).toString("hex");
