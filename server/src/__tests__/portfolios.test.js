import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Certificate from "../models/Certificate.js";
import GroupSession from "../models/GroupSession.js";
import Project from "../models/Project.js";
import Session from "../models/Session.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Public professional skill portfolio", () => {
  const marker = `${Date.now()}`;
  let owner; let viewer; let ownerCookie; let viewerCookie; let skill; let project;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Portfolio`, email: `test-portfolio-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [ownerResponse, viewerResponse] = await Promise.all([register("Owner"), register("Viewer")]);
    ownerCookie = ownerResponse.headers["set-cookie"]; viewerCookie = viewerResponse.headers["set-cookie"];
    owner = await User.findByIdAndUpdate(ownerResponse.body.user._id, { username: `portfolio_${marker.slice(-10)}`, profileVisibility: "public", visibility: "public", headline: "Evidence-led mentor" }, { new: true });
    viewer = await User.findById(viewerResponse.body.user._id);
    skill = await Skill.create({ name: `Portfolio Skill ${marker}`, slug: `portfolio-skill-${marker}`, category: "Technology" });
    await UserSkill.create({ user: owner._id, skill: skill._id, type: "both", proficiency: "Expert", verificationStatus: "verified" });
  });

  afterAll(async () => {
    const users = [owner?._id, viewer?._id].filter(Boolean);
    await Promise.all([Certificate.deleteMany({ learner: { $in: users } }), GroupSession.deleteMany({ mentor: { $in: users } }), Project.deleteMany({ owner: { $in: users } }), Session.deleteMany({ $or: [{ teacherId: { $in: users } }, { studentId: { $in: users } }] }), UserSkill.deleteMany({ user: { $in: users } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]);
    await mongoose.disconnect();
  });

  test("owners create canonical-skill projects while drafts stay private", async () => {
    await request(app).post("/api/projects").set("Cookie", ownerCookie).send({ title: "Invalid project", description: "This references a missing skill and must fail.", skillIds: [new mongoose.Types.ObjectId().toString()] }).expect(400);
    const created = await request(app).post("/api/projects").set("Cookie", ownerCookie).send({ title: "Resilient marketplace architecture", description: "Designed and validated a concurrency-safe marketplace booking architecture.", skillIds: [skill._id.toString()], role: "Principal architect", projectUrl: "https://example.com/project", repositoryUrl: "https://github.com/example/project", outcomes: ["Prevented double booking", "Documented failure modes"], featured: true }).expect(201);
    project = created.body.data;
    expect(project.status).toBe("draft");
    const draftProfile = await request(app).get(`/api/users/by-username/${owner.username}`).expect(200);
    expect(draftProfile.body.data.projects).toHaveLength(0);
    await request(app).patch(`/api/projects/${project._id}`).set("Cookie", viewerCookie).send({ title: "Stolen portfolio project" }).expect(404);
    await request(app).post(`/api/projects/${project._id}/publish`).set("Cookie", ownerCookie).expect(200);
  });

  test("public projection separates teaching and learning evidence", async () => {
    await Session.create([{ requestId: new mongoose.Types.ObjectId(), teacherId: owner._id, studentId: viewer._id, status: "COMPLETED" }, { requestId: new mongoose.Types.ObjectId(), teacherId: viewer._id, studentId: owner._id, status: "COMPLETED" }]);
    const startAt = new Date(Date.now() - 7200000);
    await GroupSession.create({ title: "Completed portfolio workshop", mentor: owner._id, skill: skill._id, description: "A completed group workshop used as teaching evidence.", startAt, endAt: new Date(startAt.getTime() + 3600000), duration: 60, timezone: "UTC", capacity: 10, mode: "video", meetingUrl: "https://example.com/meet", status: "completed" });
    await Certificate.create([{ certificateId: `PORT-ACTIVE-${marker}`, learner: owner._id, skill: skill._id, achievement: "Active public achievement", verificationCode: `portfolio-active-${marker}`, sourceKey: `portfolio:active:${marker}`, status: "active" }, { certificateId: `PORT-REVOKED-${marker}`, learner: owner._id, skill: skill._id, achievement: "Revoked hidden achievement", verificationCode: `portfolio-revoked-${marker}`, sourceKey: `portfolio:revoked:${marker}`, status: "revoked" }]);
    const response = await request(app).get(`/api/users/by-username/${owner.username}`).expect(200);
    const data = response.body.data;
    expect(data.user.email).toBeUndefined();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]).toMatchObject({ title: "Resilient marketplace architecture", status: "published", featured: true });
    expect(data.certificates).toHaveLength(1);
    expect(data.certificates[0]).toMatchObject({ achievement: "Active public achievement", status: "active" });
    expect(data.certificates[0].verificationCode).toBeUndefined();
    expect(data.stats).toMatchObject({ sessionsTaught: 2, sessionsLearned: 1, skillsLearned: 1, projects: 1, certificates: 1 });
    expect(data.stats.mentorStatus).toMatchObject({ isMentor: true, level: "verified", teachingSkills: 1 });
  });

  test("archived projects disappear from the shareable portfolio", async () => {
    await request(app).post(`/api/projects/${project._id}/archive`).set("Cookie", ownerCookie).expect(200);
    const response = await request(app).get(`/api/users/by-username/${owner.username}`).expect(200);
    expect(response.body.data.projects).toHaveLength(0);
  });
});
