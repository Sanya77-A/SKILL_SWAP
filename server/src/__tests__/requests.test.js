import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/User.js";
import SwapRequest from "../models/SwapRequest.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Swap requests", () => {
  let accessToken;
  let userId;
  let receiverId;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [sender, receiver] = await Promise.all([
      User.create({ name: "Sender", email: `sender-${Date.now()}@test.com`, password: "pass12345" }),
      User.create({ name: "Receiver", email: `receiver-${Date.now()}@test.com`, password: "pass12345" }),
    ]);
    userId = sender._id;
    receiverId = receiver._id;
    const loginRes = await request(app).post("/api/auth/login").send({ email: sender.email, password: "pass12345" });
    accessToken = loginRes.headers["set-cookie"]?.find((c) => c.startsWith("accessToken="))?.split(";")[0]?.split("=")[1] || loginRes.body.accessToken;
    if (!accessToken) accessToken = "dummy";
  });
  afterAll(async () => {
    await User.deleteMany({ email: /@test\.com$/ });
    await SwapRequest.deleteMany({});
    await mongoose.disconnect();
  });

  test("POST /api/requests requires auth", async () => {
    await request(app)
      .post("/api/requests")
      .send({ receiverId, skillToLearn: "DSA", skillToTeach: "React" })
      .expect(401);
  });

  test("POST /api/requests with auth creates request", async () => {
    const res = await request(app)
      .post("/api/requests")
      .set("Cookie", [`accessToken=${accessToken}`])
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ receiverId, skillToLearn: "DSA", skillToTeach: "React" })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.request).toHaveProperty("status", "PENDING");
  });
});
