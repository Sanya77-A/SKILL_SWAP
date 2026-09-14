import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import AIInteraction from "../models/AIInteraction.js";
import MatchCache from "../models/MatchCache.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Database-grounded SkillSwap assistant", () => {
  const marker = `${Date.now()}`;
  let learner;
  let mentor;
  let outsider;
  let learnerCookie;
  let outsiderCookie;
  let wantedSkill;
  let suggestedSkill;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Assistant`, email: `test-assistant-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [learnerAuth, mentorAuth, outsiderAuth] = await Promise.all([register("Learner"), register("Mentor"), register("Outsider")]);
    learnerCookie = learnerAuth.headers["set-cookie"];
    outsiderCookie = outsiderAuth.headers["set-cookie"];
    [learner, mentor, outsider] = await Promise.all([
      User.findByIdAndUpdate(learnerAuth.body.user._id, { learningGoals: ["Build production web applications"] }, { new: true }),
      User.findByIdAndUpdate(mentorAuth.body.user._id, { headline: "Production web mentor", ratingAvg: 4.8, ratingCount: 8 }, { new: true }),
      User.findById(outsiderAuth.body.user._id),
    ]);
    wantedSkill = await Skill.create({ name: `Assistant Web ${marker}`, slug: `assistant-web-${marker}`, category: "Technology", popularity: 100 });
    suggestedSkill = await Skill.create({ name: `Assistant Cloud ${marker}`, slug: `assistant-cloud-${marker}`, category: "Technology", popularity: 90 });
    await Promise.all([
      UserSkill.create({ user: learner._id, skill: wantedSkill._id, type: "learn", proficiency: "Beginner" }),
      UserSkill.create({ user: mentor._id, skill: wantedSkill._id, type: "teach", proficiency: "Expert", yearsExperience: 7 }),
    ]);
  });

  afterAll(async () => {
    const ids = [learner?._id, mentor?._id, outsider?._id].filter(Boolean);
    await Promise.all([
      AIInteraction.deleteMany({ user: { $in: ids } }),
      MatchCache.deleteMany({ $or: [{ userId: { $in: ids } }, { matchedUserId: { $in: ids } }] }),
      UserSkill.deleteMany({ user: { $in: ids } }),
      Skill.deleteMany({ _id: { $in: [wantedSkill?._id, suggestedSkill?._id].filter(Boolean) } }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
    await mongoose.disconnect();
  });

  test("mentor recommendations reference only eligible database users", async () => {
    const response = await request(app).post("/api/assistant/ask").set("Cookie", learnerCookie)
      .send({ message: "Find mentors who can teach my skills", intent: "find_mentors" }).expect(200);
    expect(response.body.data.grounded).toBe(true);
    expect(response.body.data.provider).toBe("grounded_fallback");
    expect(response.body.data.cards.some((card) => card.id === mentor._id.toString())).toBe(true);
    expect(response.body.data.cards.every((card) => card.type === "mentor" && card.link === `/user/${card.id}`)).toBe(true);
  });

  test("skill suggestions use canonical catalog records and history does not expose prompts", async () => {
    const response = await request(app).post("/api/assistant/ask").set("Cookie", learnerCookie)
      .send({ message: "What should I learn next?", intent: "suggest_skills" }).expect(200);
    expect(response.body.data.cards.some((card) => card.id === suggestedSkill._id.toString())).toBe(true);
    expect(response.body.data.cards.every((card) => card.type === "skill")).toBe(true);

    const history = await request(app).get("/api/assistant/history").set("Cookie", learnerCookie).expect(200);
    expect(history.body.pagination.total).toBe(2);
    expect(history.body.data[0]).not.toHaveProperty("requestHash");
    expect(history.body.data[0]).not.toHaveProperty("prompt");
    const outsiderHistory = await request(app).get("/api/assistant/history").set("Cookie", outsiderCookie).expect(200);
    expect(outsiderHistory.body.pagination.total).toBe(0);
  });

  test("unsupported intents and empty prompts are rejected before context loading", async () => {
    await request(app).post("/api/assistant/ask").set("Cookie", learnerCookie).send({ message: "Hello", intent: "invent_users" }).expect(400);
    await request(app).post("/api/assistant/ask").set("Cookie", learnerCookie).send({ message: " " }).expect(400);
  });
});
