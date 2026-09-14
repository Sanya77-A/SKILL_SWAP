import { env } from "./env.js";

const defaultOrigins = env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://localhost:5174"];
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .map((host) => host?.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
  .filter(Boolean)
  .map((host) => `https://${host}`);

export const allowedOrigins = [...new Set([
  ...defaultOrigins,
  ...vercelOrigins,
  ...env.CLIENT_URL.split(",").map((url) => url.trim().replace(/\/$/, "")).filter(Boolean),
])];

export const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  return allowedOrigins.includes(origin.replace(/\/$/, ""));
};
