import { env } from "../config/env.js";
import { isAllowedOrigin } from "../config/http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const createRequestOriginVerifier = ({
  production = env.NODE_ENV === "production",
  originAllowed = isAllowedOrigin,
} = {}) => (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  const fetchSite = req.get("sec-fetch-site");
  const hasBearer = req.get("authorization")?.startsWith("Bearer ");
  const hasAuthCookie = Boolean(req.cookies?.accessToken || req.cookies?.refreshToken || req.cookies?.demoSession);

  // A separately hosted, explicitly allowlisted frontend is legitimately
  // cross-site (for example Vercel -> Render). Origin remains the authority;
  // Sec-Fetch-Site is only a rejection signal when the browser omits Origin.
  if ((origin && !originAllowed(origin)) || (!origin && fetchSite === "cross-site")) {
    return res.status(403).json({
      success: false,
      message: "Request origin is not allowed",
      error: { code: "CSRF_ORIGIN_REJECTED", message: "Request origin is not allowed" },
    });
  }

  if (production && hasAuthCookie && !hasBearer && !origin) {
    return res.status(403).json({
      success: false,
      message: "Origin header required for cookie-authenticated requests",
      error: { code: "CSRF_ORIGIN_REQUIRED", message: "Origin header required for cookie-authenticated requests" },
    });
  }

  next();
};

export const verifyRequestOrigin = createRequestOriginVerifier();
