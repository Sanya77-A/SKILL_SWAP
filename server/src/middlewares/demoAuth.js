import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { demoUsers } from "../data/demoData.js";

const DEMO_ISSUER = "skillswap-demo";
const DEMO_AUDIENCE = "skillswap-demo-session";
export const DEMO_SESSION_MAX_AGE_MS = 15 * 60 * 1000;

export const demoCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: DEMO_SESSION_MAX_AGE_MS,
});

export function createDemoSessionToken(role) {
  return jwt.sign(
    { demo: true, role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m", issuer: DEMO_ISSUER, audience: DEMO_AUDIENCE, subject: `demo:${role}` },
  );
}

export function verifyDemoSessionToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: DEMO_ISSUER, audience: DEMO_AUDIENCE });
  if (payload.demo !== true || !demoUsers[payload.role]) throw new Error("Invalid demo session");
  return payload;
}

export function demoOnly(_req, res, next) {
  if (env.DATABASE_MODE !== "demo") {
    return res.status(404).json({
      success: false,
      message: "Demo mode is not enabled.",
      error: { code: "DEMO_MODE_DISABLED", message: "Demo mode is not enabled." },
    });
  }
  next();
}

export function protectDemo(req, res, next) {
  try {
    const token = req.cookies?.demoSession;
    if (!token) throw new Error("Missing demo session");
    const payload = verifyDemoSessionToken(token);
    req.demoRole = payload.role;
    req.demoUser = demoUsers[payload.role];
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Demo session required.",
      error: { code: "DEMO_AUTH_REQUIRED", message: "Demo session required." },
    });
  }
}
