import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/User.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Professional profile privacy and serialization", () => {
  const marker = `${Date.now()}`;
  const email = `test-profile-${marker}@test.com`;
  let cookie;
  let username;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ name: "Profile Test", email, password: "password123" })
      .expect(201);
    cookie = registered.headers["set-cookie"];
    username = registered.body.user.username;
  });

  afterAll(async () => {
    await User.deleteMany({ email });
    await mongoose.disconnect();
  });

  test("private serializer exposes account email without auth secrets", async () => {
    const response = await request(app).get("/api/users/me").set("Cookie", cookie).expect(200);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("passwordResetToken");
    expect(response.body.user).not.toHaveProperty("failedLoginAttempts");
    expect(response.body.user).not.toHaveProperty("profileImagePublicId");
  });

  test("public handle returns a professional profile without private fields", async () => {
    await request(app)
      .put("/api/users/me")
      .set("Cookie", cookie)
      .send({
        headline: "Systems mentor",
        bio: "I help peers build reliable software.",
        languages: ["English", "Hindi"],
        visibility: "public",
        profileVisibility: "public",
        onboardingCompleted: true,
      })
      .expect(200);

    const response = await request(app).get(`/api/users/by-username/${username}`).expect(200);
    expect(response.body.data.user.headline).toBe("Systems mentor");
    expect(response.body.data.user.languages).toEqual(["English", "Hindi"]);
    expect(response.body.data.user).not.toHaveProperty("email");
    expect(response.body.data.user).not.toHaveProperty("status");
    expect(response.body.data.stats.skillScore).toBeGreaterThanOrEqual(0);
    expect(response.body.data.stats.skillScore).toBeLessThanOrEqual(100);
  });

  test("private visibility hides the profile except from its owner", async () => {
    await request(app)
      .put("/api/users/me")
      .set("Cookie", cookie)
      .send({ visibility: "private", profileVisibility: "private" })
      .expect(200);

    await request(app).get(`/api/users/by-username/${username}`).expect(404);
    const preview = await request(app)
      .get(`/api/users/by-username/${username}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(preview.body.data.isOwner).toBe(true);
  });
});
