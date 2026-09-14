import fs from "fs";
import mongoose from "mongoose";
import request from "supertest";

const TEST_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/skillswap_test";
const managedKeys = [
  "NODE_ENV", "VERCEL", "DATABASE_MODE", "MONGO_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRE", "JWT_REFRESH_EXPIRE", "CLIENT_URL", "ANALYTICS_SALT",
  "CRON_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
];

describe("production core APIs with optional services disabled", () => {
  const originalEnvironment = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
  const email = `test-optional-services-${Date.now()}@test.com`;
  let app;
  let User;
  let RefreshToken;
  let authCookies;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL: "1",
      DATABASE_MODE: "mongo",
      MONGO_URI: TEST_URI,
      JWT_ACCESS_SECRET: "test-production-access-secret-value-123456789",
      JWT_REFRESH_SECRET: "test-production-refresh-secret-value-987654321",
      JWT_ACCESS_EXPIRE: "15m",
      JWT_REFRESH_EXPIRE: "7d",
      CLIENT_URL: "https://skillswap-nine-jet.vercel.app",
      ANALYTICS_SALT: "test-production-analytics-salt-value-123456789",
    });
    for (const key of ["CRON_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) process.env[key] = "";

    ({ default: app } = await import(`../app.js?optional-services=${Date.now()}`));
    ({ default: User } = await import("../models/User.js"));
    ({ default: RefreshToken } = await import("../models/RefreshToken.js"));
    await mongoose.connect(TEST_URI);
  });

  afterAll(async () => {
    const user = await User.findOne({ email }).select("_id").lean();
    if (user) await RefreshToken.deleteMany({ user: user._id });
    await User.deleteOne({ email });
    await mongoose.disconnect();
    for (const key of managedKeys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  });

  test("starts and serves health without Cloudinary or cron configuration", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.data).toMatchObject({ databaseMode: "mongo", persistence: true });
    expect(response.body.data.status).toMatch(/^(ok|degraded)$/);
  });

  test("registers, logs in, and serves the authenticated profile", async () => {
    await request(app)
      .post("/api/auth/register")
      .set("Origin", "https://skillswap-nine-jet.vercel.app")
      .send({ name: "Optional Services User", email, password: "password123" })
      .expect(201);
    const login = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://skillswap-nine-jet.vercel.app")
      .send({ email, password: "password123" })
      .expect(200);
    authCookies = login.headers["set-cookie"];
    const profile = await request(app).get("/api/users/me").set("Cookie", authCookies).expect(200);
    expect(profile.body.user.email).toBe(email);
  });

  test("rejects uploads gracefully and removes their temporary staging file", async () => {
    const unlink = fs.promises.unlink;
    const calls = [];
    fs.promises.unlink = async (filePath) => {
      calls.push(filePath);
      return unlink.call(fs.promises, filePath);
    };
    try {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const response = await request(app)
        .put("/api/users/me")
        .set("Cookie", authCookies)
        .set("Origin", "https://skillswap-nine-jet.vercel.app")
        .attach("profileImage", png, { filename: "avatar.png", contentType: "image/png" })
        .expect(503);
      expect(response.body.error.code).toBe("UPLOAD_STORAGE_UNAVAILABLE");
      await new Promise((resolve) => setImmediate(resolve));
      expect(calls.some((filePath) => filePath.includes("skillswap-uploads"))).toBe(true);
      await Promise.all(calls.map((filePath) => expect(fs.promises.access(filePath)).rejects.toMatchObject({ code: "ENOENT" })));
    } finally {
      fs.promises.unlink = unlink;
    }
  });

  test("keeps the cron endpoint disabled when its secret is absent", async () => {
    const response = await request(app).get("/api/internal/jobs/match-cache").expect(503);
    expect(response.body.error.code).toBe("CRON_DISABLED");
  });

  test("still rejects production startup when core secrets are missing", async () => {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = " ";
    await expect(import(`../config/env.js?missing-jwt=${Date.now()}`)).rejects.toThrow(/JWT_ACCESS_SECRET/);
    process.env.JWT_ACCESS_SECRET = accessSecret;

    const { validateDatabaseConfiguration } = await import("../services/databaseService.js");
    expect(validateDatabaseConfiguration({ mode: "mongo", uri: "" })).toMatchObject({ valid: false, code: "DATABASE_CONFIGURATION_ERROR" });
  });
});
