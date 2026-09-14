import request from "supertest";
import app from "../app.js";
import { createRequestOriginVerifier } from "../middlewares/csrf.js";

const makeResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return response;
};

const makeRequest = ({ method = "POST", origin, fetchSite, cookie, authorization } = {}) => ({
  method,
  cookies: cookie ? { accessToken: "opaque-cookie" } : {},
  get(name) {
    const headers = { origin, "sec-fetch-site": fetchSite, authorization };
    return headers[name.toLowerCase()];
  },
});

describe("CORS and CSRF production boundaries", () => {
  const productionVerifier = createRequestOriginVerifier({
    production: true,
    originAllowed: (origin) => origin === "https://skillswap-nine-jet.vercel.app",
  });

  test("allows the exact Vercel frontend origin even when the browser marks it cross-site", () => {
    const req = makeRequest({ origin: "https://skillswap-nine-jet.vercel.app", fetchSite: "cross-site", cookie: true });
    const res = makeResponse();
    let nextCalled = false;
    productionVerifier(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  test("rejects a foreign origin", () => {
    const req = makeRequest({ origin: "https://attacker.example", fetchSite: "cross-site", cookie: true });
    const res = makeResponse();
    productionVerifier(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("CSRF_ORIGIN_REJECTED");
  });

  test("rejects a cookie-authenticated production mutation with no Origin", () => {
    const req = makeRequest({ cookie: true, fetchSite: "same-site" });
    const res = makeResponse();
    productionVerifier(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("CSRF_ORIGIN_REQUIRED");
  });

  test("allows an OPTIONS preflight from the production frontend", async () => {
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://skillswap-nine-jet.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://skillswap-nine-jet.vercel.app");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("allows the exact current Vercel preview origin", async () => {
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://skillswap-preview-example.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://skillswap-preview-example.vercel.app");
  });
});
