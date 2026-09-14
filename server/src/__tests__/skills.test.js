import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Canonical skills and profile skills", () => {
  const marker = `${Date.now()}`;
  let adminCookie;
  let memberCookie;
  let otherCookie;
  let skill;
  let member;

  const register = async (name) => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name, email: `test-skills-${name.toLowerCase()}-${marker}@test.com`, password: "password123" })
      .expect(201);
    return { response, cookie: response.headers["set-cookie"] };
  };

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const adminAuth = await register("Admin");
    const memberAuth = await register("Member");
    const otherAuth = await register("Other");
    adminCookie = adminAuth.cookie;
    memberCookie = memberAuth.cookie;
    otherCookie = otherAuth.cookie;
    member = await User.findById(memberAuth.response.body.user._id);
    await User.findByIdAndUpdate(adminAuth.response.body.user._id, { role: "admin" });
  });

  afterAll(async () => {
    const users = await User.find({ email: new RegExp(`^test-skills-.*-${marker}@test\\.com$`) }).select("_id");
    const userIds = users.map((user) => user._id);
    await UserSkill.deleteMany({ user: { $in: userIds } });
    await Skill.deleteMany({ name: new RegExp(marker) });
    await User.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  });

  test("admin creates a canonical skill and public catalog can find it", async () => {
    const response = await request(app)
      .post("/api/skills")
      .set("Cookie", adminCookie)
      .send({
        name: `Architecture ${marker}`,
        description: "Designing resilient systems",
        category: "Technology",
        tags: ["systems"],
      })
      .expect(201);
    skill = response.body.data;
    expect(skill.slug).toBe(`architecture-${marker}`);

    const catalog = await request(app)
      .get("/api/skills")
      .query({ q: marker })
      .expect(200);
    expect(catalog.body.data.some((item) => item._id === skill._id)).toBe(true);

    await request(app).post("/api/skills").set("Cookie", memberCookie).send({
      name: `Forbidden ${marker}`,
      category: "Technology",
    }).expect(403);
  });

  test("member owns CRUD lifecycle and legacy arrays stay compatible", async () => {
    const created = await request(app)
      .post("/api/user-skills/me")
      .set("Cookie", memberCookie)
      .send({ skillId: skill._id, type: "teach", proficiency: "Advanced", yearsExperience: 6 })
      .expect(201);
    expect(created.body.data.teachingEnabled).toBe(true);
    expect(created.body.data.learningEnabled).toBe(false);
    const recordId = created.body.data._id;

    member = await User.findById(member._id);
    expect(member.skillsOffered).toContain(skill.name);

    await request(app)
      .patch(`/api/user-skills/me/${recordId}`)
      .set("Cookie", otherCookie)
      .send({ type: "learn" })
      .expect(404);

    const updated = await request(app)
      .patch(`/api/user-skills/me/${recordId}`)
      .set("Cookie", memberCookie)
      .send({ type: "both", proficiency: "Expert" })
      .expect(200);
    expect(updated.body.data.teachingEnabled).toBe(true);
    expect(updated.body.data.learningEnabled).toBe(true);

    member = await User.findById(member._id);
    expect(member.skillsWanted).toContain(skill.name);

    await request(app)
      .delete(`/api/user-skills/me/${recordId}`)
      .set("Cookie", memberCookie)
      .expect(200);
    expect(await UserSkill.countDocuments({ _id: recordId })).toBe(0);

    member = await User.findById(member._id);
    expect(member.skillsOffered).not.toContain(skill.name);
    expect(member.skillsWanted).not.toContain(skill.name);
  });
});
