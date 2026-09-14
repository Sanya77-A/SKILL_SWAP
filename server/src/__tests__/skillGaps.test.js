import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import CareerPath from "../models/CareerPath.js";
import Skill from "../models/Skill.js";
import SkillGapAnalysis from "../models/SkillGapAnalysis.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Canonical career skill-gap analysis", () => {
  const marker = `${Date.now()}`;
  let adminCookie;
  let learnerCookie;
  let outsiderCookie;
  let learner;
  let mentor;
  let path;
  let skills;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Gap`, email: `test-gap-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [adminAuth, learnerAuth, mentorAuth, outsiderAuth] = await Promise.all([
      register("Admin"), register("Learner"), register("Mentor"), register("Outsider"),
    ]);
    adminCookie = adminAuth.headers["set-cookie"];
    learnerCookie = learnerAuth.headers["set-cookie"];
    outsiderCookie = outsiderAuth.headers["set-cookie"];
    await User.findByIdAndUpdate(adminAuth.body.user._id, { role: "admin" });
    learner = await User.findById(learnerAuth.body.user._id);
    mentor = await User.findByIdAndUpdate(mentorAuth.body.user._id, { headline: "AI systems mentor", ratingAvg: 4.8, ratingCount: 12 }, { new: true });
    skills = await Skill.create([
      { name: `Python ${marker}`, slug: `python-${marker}`, category: "Technology" },
      { name: `Machine Learning ${marker}`, slug: `machine-learning-${marker}`, category: "Technology" },
      { name: `MLOps ${marker}`, slug: `mlops-${marker}`, category: "Technology" },
    ]);
    await UserSkill.create([
      { user: learner._id, skill: skills[0]._id, type: "both", proficiency: "Advanced", verificationStatus: "verified" },
      { user: learner._id, skill: skills[1]._id, type: "learn", proficiency: "Beginner" },
      { user: mentor._id, skill: skills[1]._id, type: "teach", proficiency: "Expert", yearsExperience: 8, verificationStatus: "verified" },
      { user: mentor._id, skill: skills[2]._id, type: "teach", proficiency: "Advanced", yearsExperience: 5 },
    ]);
  });

  afterAll(async () => {
    const users = await User.find({ email: new RegExp(`^test-gap-.*-${marker}@test\\.com$`) }).select("_id");
    const userIds = users.map((user) => user._id);
    await Promise.all([
      SkillGapAnalysis.deleteMany({ user: { $in: userIds } }),
      CareerPath.deleteMany({ slug: `ai-engineer-${marker}` }),
      UserSkill.deleteMany({ user: { $in: userIds } }),
      Skill.deleteMany({ _id: { $in: skills?.map((skill) => skill._id) || [] } }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
    await mongoose.disconnect();
  });

  test("only admins define versioned career frameworks backed by active canonical skills", async () => {
    await request(app).post("/api/career-paths").set("Cookie", learnerCookie).send({
      title: `AI Engineer ${marker}`,
      requiredSkills: [{ skillId: skills[0]._id.toString() }],
    }).expect(403);

    const response = await request(app).post("/api/career-paths").set("Cookie", adminCookie).send({
      title: `AI Engineer ${marker}`,
      description: "Build and operate reliable machine-learning systems.",
      requiredSkills: [
        { skillId: skills[0]._id.toString(), minimumProficiency: "Intermediate", importance: "core", order: 1 },
        { skillId: skills[1]._id.toString(), minimumProficiency: "Advanced", importance: "core", order: 2 },
        { skillId: skills[2]._id.toString(), minimumProficiency: "Intermediate", importance: "supporting", order: 3 },
      ],
    }).expect(201);
    path = response.body.data;
    expect(path.version).toBe(1);
    expect(path.requiredSkills[0].skill.name).toBe(skills[0].name);

    const catalog = await request(app).get("/api/career-paths").set("Cookie", learnerCookie).expect(200);
    expect(catalog.body.data.some((item) => item._id === path._id)).toBe(true);
  });

  test("analysis separates actual state, deterministic gaps, recommendations, mentors, and narrative", async () => {
    const response = await request(app).post("/api/skill-gaps/analyze").set("Cookie", learnerCookie)
      .send({ careerPathId: path._id }).expect(201);
    const analysis = response.body.data;
    expect(analysis.actualSkillSnapshot.map((item) => item.skill)).toEqual(expect.arrayContaining([skills[0]._id.toString(), skills[1]._id.toString()]));
    expect(analysis.requiredSkillSnapshot).toHaveLength(3);
    expect(analysis.missingSkills.map((item) => item.skill)).toEqual([skills[2]._id.toString()]);
    expect(analysis.weakSkills.map((item) => item.skill)).toEqual([skills[1]._id.toString()]);
    expect(analysis.recommendedNextSkills.map((item) => item.skill)).toEqual([skills[1]._id.toString(), skills[2]._id.toString()]);
    expect(analysis.mentorRecommendations.some((item) => item.user === mentor._id.toString() && item.mentor._id === mentor._id.toString())).toBe(true);
    expect(analysis.generatedNarrative).toContain(`AI Engineer ${marker}`);
    expect(analysis.narrativeProvider).toBe("grounded_fallback");
    expect(analysis).not.toHaveProperty("prompt");

    const detail = await request(app).get(`/api/skill-gaps/${analysis._id}`).set("Cookie", learnerCookie).expect(200);
    expect(detail.body.data.actualSkillSnapshot).toHaveLength(2);
    await request(app).get(`/api/skill-gaps/${analysis._id}`).set("Cookie", outsiderCookie).expect(404);
  });
});
