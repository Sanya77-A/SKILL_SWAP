import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Listing from "../models/Listing.js";
import MatchCache from "../models/MatchCache.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Explainable smart match API", () => {
  const marker = `${Date.now()}`;
  let current;
  let target;
  let hidden;
  let cookie;
  let python;
  let react;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const currentAuth = await request(app).post("/api/auth/register").send({
      name: "Current Matcher", email: `test-match-current-${marker}@test.com`, password: "password123",
    }).expect(201);
    cookie = currentAuth.headers["set-cookie"];
    current = await User.findByIdAndUpdate(currentAuth.body.user._id, {
      timezone: "Asia/Kolkata", location: "Pune", languages: ["English"], availability: ["weekends"],
      learningGoals: ["Build Python APIs"], preferredLearningMode: "online",
      preferredExchangeModels: ["credits"], maxCreditCost: 60,
    }, { new: true });
    target = await User.create({
      name: "Target Matcher", username: `target_${marker}`.slice(0, 30), email: `test-match-target-${marker}@test.com`, password: "password123",
      timezone: "Asia/Kolkata", location: "Pune", languages: ["English"], availability: ["weekends"],
      headline: "Python API mentor", preferredTeachingMode: "online", experienceLevel: "advanced",
      ratingAvg: 4.8, ratingCount: 15, visibility: "members", profileVisibility: "members",
    });
    hidden = await User.create({
      name: "Hidden Matcher", username: `hidden_${marker}`.slice(0, 30), email: `test-match-hidden-${marker}@test.com`, password: "password123",
      visibility: "private", profileVisibility: "private",
    });
    python = await Skill.create({ name: `Python Match ${marker}`, slug: `python-match-${marker}`, category: "Technology" });
    react = await Skill.create({ name: `React Match ${marker}`, slug: `react-match-${marker}`, category: "Technology" });
    await UserSkill.create({ user: current._id, skill: python._id, type: "learn", proficiency: "Beginner" });
    await UserSkill.create({ user: current._id, skill: react._id, type: "teach", proficiency: "Advanced" });
    await UserSkill.create({ user: target._id, skill: python._id, type: "teach", proficiency: "Expert" });
    await UserSkill.create({ user: target._id, skill: react._id, type: "learn", proficiency: "Beginner" });
    await UserSkill.create({ user: hidden._id, skill: python._id, type: "teach", proficiency: "Expert" });
    await Listing.create({
      owner: target._id, skill: python._id, slug: `match-listing-${marker}`, title: `Python API coaching ${marker}`,
      description: "A focused session for building maintainable and reliable Python application programming interfaces.",
      learningOutcomes: ["Build a Python API"], deliveryMode: ["video"], sessionDurations: [60],
      exchangeEnabled: false, creditsEnabled: true, creditCost: 50, status: "published", publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    const ids = [current?._id, target?._id, hidden?._id].filter(Boolean);
    await MatchCache.deleteMany({ $or: [{ userId: { $in: ids } }, { matchedUserId: { $in: ids } }] });
    await Listing.deleteMany({ owner: { $in: ids } });
    await UserSkill.deleteMany({ user: { $in: ids } });
    await Skill.deleteMany({ _id: { $in: [python?._id, react?._id].filter(Boolean) } });
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  });

  test("returns normalized factors, strengths, conflicts, and reasons without private candidates", async () => {
    const response = await request(app).get("/api/matches").set("Cookie", cookie).expect(200);
    const match = response.body.data.find((item) => item.user._id === target._id.toString());
    expect(match).toBeDefined();
    expect(match.matchScore).toBeGreaterThanOrEqual(70);
    expect(match.matchScore).toBeLessThanOrEqual(100);
    expect(match.factors).toHaveProperty("skill");
    expect(match.factors).toHaveProperty("price");
    expect(match.strengths).toContain("Mutual skill match");
    expect(match.reasons.length).toBeGreaterThan(0);
    expect(response.body.data.some((item) => item.user._id === hidden._id.toString())).toBe(false);

    const cached = await MatchCache.findOne({ userId: current._id, matchedUserId: target._id }).lean();
    expect(cached?.factors?.skill?.score).toBe(100);

    await request(app).get("/api/matches").set("Cookie", cookie).expect(200);
    const reused = await MatchCache.findOne({ userId: current._id, matchedUserId: target._id }).lean();
    expect(reused.updatedAt.getTime()).toBe(cached.updatedAt.getTime());
  });
});
