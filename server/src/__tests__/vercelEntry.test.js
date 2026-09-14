import request from "supertest";
import mongoose from "mongoose";
import handler, { normalizeVercelApiRequest } from "../../../api/index.js";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("single-project Vercel API entry", () => {
  const email = `test-vercel-entry-${Date.now()}@test.com`;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
  });

  afterAll(async () => {
    const user = await User.findOne({ email }).select("_id").lean();
    if (user) await RefreshToken.deleteMany({ user: user._id });
    await User.deleteOne({ email });
    await mongoose.disconnect();
  });

  test("restores the original API path without retaining the internal rewrite query", () => {
    const req = { url: "/api/index?__path=auth%2Flogin&next=one" };
    normalizeVercelApiRequest(req);
    expect(req.url).toBe("/api/auth/login?next=one");
  });

  test("serves health through the rewritten Function route", async () => {
    const response = await request(handler).get("/api/index?__path=health").expect(200);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.database).toBe("connected");
  });

  test("supports POST auth, cookies, protected GET, and logout without SPA routing", async () => {
    const registered = await request(handler)
      .post("/api/index?__path=auth/register")
      .send({ name: "Vercel Entry User", email, password: "password123" })
      .expect(201);
    expect(registered.headers["content-type"]).toMatch(/application\/json/);
    const cookies = registered.headers["set-cookie"];

    await request(handler)
      .get("/api/index?__path=users/me")
      .set("Cookie", cookies)
      .expect(200);

    await request(handler)
      .post("/api/index?__path=auth/logout")
      .set("Cookie", cookies)
      .expect(200);
  });
});
