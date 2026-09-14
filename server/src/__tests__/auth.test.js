import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { authCookieOptions } from "../controllers/authController.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Auth routes", () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
  });
  afterAll(async () => {
    await User.deleteMany({ email: /^test-auth-/ });
    await RefreshToken.deleteMany({});
    await mongoose.disconnect();
  });

  test("POST /api/auth/register returns 201 and user", async () => {
    const email = `test-auth-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email, password: "password123" })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty("email", email);
    expect(res.body).not.toHaveProperty("accessToken");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"].every((cookie) => cookie.includes("HttpOnly"))).toBe(true);

    const refreshCookie = res.headers["set-cookie"]
      .find((cookie) => cookie.startsWith("refreshToken="))
      ?.split(";")[0]
      ?.split("=")[1];
    const stored = await RefreshToken.findOne({ user: res.body.user._id }).lean();
    expect(stored?.token).toBeTruthy();
    expect(stored?.token).not.toBe(refreshCookie);
  });

  test("uses host-only SameSite=Lax cookies for same-origin production auth", () => {
    expect(authCookieOptions({ production: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  test("POST /api/auth/login with invalid credentials returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@test.com", password: "wrong" })
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  test("rejects invalid and expired access tokens", async () => {
    await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    const expired = jwt.sign({ userId: new mongoose.Types.ObjectId() }, env.JWT_ACCESS_SECRET, { expiresIn: -1 });
    await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${expired}`)
      .expect(401);
  });

  test("logout revokes the current refresh token", async () => {
    const email = `test-auth-logout-${Date.now()}@test.com`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ name: "Logout Test", email, password: "password123" })
      .expect(201);
    const cookies = registered.headers["set-cookie"];

    await request(app).post("/api/auth/logout").set("Cookie", cookies).expect(200);
    await request(app).post("/api/auth/refresh").set("Cookie", cookies).expect(401);
  });

  test("refresh rotation detects reuse and revokes the token family", async () => {
    const email = `test-auth-reuse-${Date.now()}@test.com`;
    const registered = await request(app).post("/api/auth/register")
      .send({ name: "Reuse Test", email, password: "password123" }).expect(201);
    const originalCookies = registered.headers["set-cookie"];
    const rotated = await request(app).post("/api/auth/refresh").set("Cookie", originalCookies).expect(200);
    const rotatedCookies = rotated.headers["set-cookie"];

    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", originalCookies).expect(401);
    expect(reuse.body.error.code).toBe("REFRESH_TOKEN_REUSED");
    await request(app).post("/api/auth/refresh").set("Cookie", rotatedCookies).expect(401);
  });

  test("a reset token can only be used once and revokes sessions", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const email = `test-auth-reset-${Date.now()}@test.com`;
    const user = await User.create({
      name: "Reset Test",
      email,
      password: "password123",
      passwordResetToken: crypto.createHash("sha256").update(rawToken).digest("hex"),
      passwordResetExpires: new Date(Date.now() + 60_000),
    });
    await RefreshToken.create({ user: user._id, token: "existing-session-hash", expiresAt: new Date(Date.now() + 60_000) });

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "newPassword123" })
      .expect(200);
    expect(await RefreshToken.countDocuments({ user: user._id })).toBe(0);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "anotherPassword123" })
      .expect(400);
  });

  test("change password requires the current password and rotates sessions", async () => {
    const email = `test-auth-change-${Date.now()}@test.com`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ name: "Change Test", email, password: "password123" })
      .expect(201);
    const cookies = registered.headers["set-cookie"];

    await request(app)
      .patch("/api/auth/change-password")
      .set("Cookie", cookies)
      .send({ currentPassword: "wrong-password", newPassword: "newPassword123" })
      .expect(400);

    const changed = await request(app)
      .patch("/api/auth/change-password")
      .set("Cookie", cookies)
      .send({ currentPassword: "password123", newPassword: "newPassword123" })
      .expect(200);
    expect(changed.headers["set-cookie"]).toBeDefined();

    await request(app).post("/api/auth/login").send({ email, password: "password123" }).expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "newPassword123" }).expect(200);
  });

  test("rejects a cross-site state-changing request", async () => {
    await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://attacker.example")
      .set("Sec-Fetch-Site", "cross-site")
      .send({ email: "nobody@test.com", password: "password123" })
      .expect(403);
  });

  test("allows a cross-site state-changing request from an allowlisted frontend", async () => {
    await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://skillswap-nine-jet.vercel.app")
      .set("Sec-Fetch-Site", "cross-site")
      .send({ email: "nobody@test.com", password: "password123" })
      .expect(401);
  });
});
