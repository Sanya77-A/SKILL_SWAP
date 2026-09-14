import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const response = {
  success: false,
  message: "Too many requests. Please try again later.",
  error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: response,
  skip: () => env.IS_TEST,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ...response, message: "Too many authentication attempts", error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts" } },
  skip: () => env.IS_TEST,
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ...response, message: "AI request limit reached. Please try again later.", error: { code: "AI_RATE_LIMITED", message: "AI request limit reached. Please try again later." } },
  skip: () => env.IS_TEST,
});
