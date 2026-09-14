import request from "supertest";
import app from "../app.js";
import { redactLogValue } from "../utils/logger.js";
import { httpUrl } from "../validators/common.js";

describe("Observability boundaries", () => {
  test("recursively redacts credentials and token-shaped values", () => {
    const sanitized = redactLogValue({
      password: "do-not-log",
      nested: { authorization: "Bearer abc.def.ghi", safe: "visible" },
      message: "request used Bearer opaque-token",
    });
    expect(sanitized).toEqual({
      password: "[REDACTED]",
      nested: { authorization: "[REDACTED]", safe: "visible" },
      message: "request used Bearer [REDACTED]",
    });
  });

  test("assigns a safe correlation id without reflecting invalid input", async () => {
    const response = await request(app).get("/not-a-real-route").set("X-Request-Id", "bad request id").expect(404);
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("preserves a valid upstream correlation id", async () => {
    const requestId = "gateway-01HZZZ1234567890";
    const response = await request(app).get("/not-a-real-route").set("X-Request-Id", requestId).expect(404);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  test("returns a non-sensitive health response", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toMatch(/^(ok|degraded)$/);
    expect(response.body.data.database).toMatch(/^(connected|disconnected)$/);
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
    expect(JSON.stringify(response.body)).not.toMatch(/mongodb(?:\+srv)?:\/\//i);
  });

  test("rejects executable and non-web URL schemes", () => {
    expect(httpUrl.safeParse("https://skillswap.example/resource").success).toBe(true);
    expect(httpUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpUrl.safeParse("data:text/html,unsafe").success).toBe(false);
  });
});
