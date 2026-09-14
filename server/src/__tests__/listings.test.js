import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Listing from "../models/Listing.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Teaching listing lifecycle", () => {
  const marker = `${Date.now()}`;
  let owner;
  let ownerCookie;
  let intruderCookie;
  let skill;
  let listing;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const ownerAuth = await request(app).post("/api/auth/register").send({
      name: "Listing Owner", email: `test-listing-owner-${marker}@test.com`, password: "password123",
    }).expect(201);
    const intruderAuth = await request(app).post("/api/auth/register").send({
      name: "Listing Intruder", email: `test-listing-intruder-${marker}@test.com`, password: "password123",
    }).expect(201);
    owner = await User.findById(ownerAuth.body.user._id);
    ownerCookie = ownerAuth.headers["set-cookie"];
    intruderCookie = intruderAuth.headers["set-cookie"];
    skill = await Skill.create({
      name: `Mentoring ${marker}`, slug: `mentoring-${marker}`, category: "Technology",
    });
    await UserSkill.create({ user: owner._id, skill: skill._id, type: "teach", proficiency: "Advanced" });
  });

  afterAll(async () => {
    const users = await User.find({ email: new RegExp(`^test-listing-.*-${marker}@test\\.com$`) }).select("_id");
    const ids = users.map((user) => user._id);
    await Listing.deleteMany({ owner: { $in: ids } });
    await UserSkill.deleteMany({ user: { $in: ids } });
    await Skill.deleteMany({ _id: skill?._id });
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  });

  test("owner creates a validated draft while unauthorized edits are hidden", async () => {
    const payload = {
      skillId: skill._id.toString(),
      title: `Reliable architecture mentoring ${marker}`,
      description: "A practical mentoring session focused on resilient service boundaries and tradeoffs.",
      learningOutcomes: ["Choose service boundaries", "Explain reliability tradeoffs"],
      prerequisites: ["Basic backend experience"],
      experienceLevel: "intermediate",
      deliveryMode: ["video"],
      sessionDurations: [60, 90],
      exchangeEnabled: true,
      creditsEnabled: true,
      paidEnabled: false,
      creditCost: 50,
      price: 0,
      currency: "USD",
      capacity: 1,
    };
    const response = await request(app).post("/api/listings").set("Cookie", ownerCookie).send(payload).expect(201);
    listing = response.body.data;
    expect(listing.status).toBe("draft");

    await request(app).get(`/api/listings/${listing._id}`).expect(404);
    await request(app).get(`/api/listings/${listing._id}`).set("Cookie", ownerCookie).expect(200);
    await request(app).patch(`/api/listings/${listing._id}`).set("Cookie", intruderCookie).send({ title: "A forbidden listing update" }).expect(404);
  });

  test("lifecycle transitions publish, pause, republish, and archive safely", async () => {
    await request(app).post(`/api/listings/${listing._id}/pause`).set("Cookie", ownerCookie).expect(409);
    await request(app).post(`/api/listings/${listing._id}/publish`).set("Cookie", ownerCookie).expect(200);

    const catalog = await request(app).get("/api/listings").query({ q: marker }).expect(200);
    expect(catalog.body.data.some((item) => item._id === listing._id)).toBe(true);

    await request(app).post(`/api/listings/${listing._id}/pause`).set("Cookie", ownerCookie).expect(200);
    const pausedCatalog = await request(app).get("/api/listings").query({ q: marker }).expect(200);
    expect(pausedCatalog.body.data.some((item) => item._id === listing._id)).toBe(false);

    await request(app).post(`/api/listings/${listing._id}/publish`).set("Cookie", ownerCookie).expect(200);
    await request(app).post(`/api/listings/${listing._id}/archive`).set("Cookie", ownerCookie).expect(200);
    await request(app).patch(`/api/listings/${listing._id}`).set("Cookie", ownerCookie).send({ title: "Archived listings stay immutable" }).expect(409);
    await request(app).get(`/api/listings/${listing._id}`).expect(404);
    const archivedCatalog = await request(app).get("/api/listings").query({ q: marker }).expect(200);
    expect(archivedCatalog.body.data.some((item) => item._id === listing._id)).toBe(false);
  });
});
