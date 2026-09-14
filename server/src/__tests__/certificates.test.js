import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Certificate from "../models/Certificate.js";
import Challenge from "../models/Challenge.js";
import ChallengeEnrollment from "../models/ChallengeEnrollment.js";
import Notification from "../models/Notification.js";
import Roadmap from "../models/Roadmap.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Eligibility-backed certificates", () => {
  const marker = `${Date.now()}`;
  let learner; let outsider; let admin; let learnerCookie; let outsiderCookie; let adminCookie; let skill; let roadmap; let challenge; let certificate;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Certificate`, email: `test-certificate-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [learnerResponse, outsiderResponse, adminResponse] = await Promise.all([register("Learner"), register("Outsider"), register("Admin")]);
    learnerCookie = learnerResponse.headers["set-cookie"]; outsiderCookie = outsiderResponse.headers["set-cookie"]; adminCookie = adminResponse.headers["set-cookie"];
    learner = await User.findById(learnerResponse.body.user._id); outsider = await User.findById(outsiderResponse.body.user._id); admin = await User.findByIdAndUpdate(adminResponse.body.user._id, { role: "admin" }, { new: true });
    skill = await Skill.create({ name: `Certificate Skill ${marker}`, slug: `certificate-skill-${marker}`, category: "Technology" });
    roadmap = await Roadmap.create({ user: learner._id, targetSkill: skill._id, goal: "Demonstrate certificate-grade system design", milestones: [{ title: "Pass the architecture review", order: 1, status: "pending" }], tasks: [], startDate: new Date(Date.now() - 86400000), targetDate: new Date(Date.now() + 86400000), progress: 0, status: "active" });
  });

  afterAll(async () => {
    const userIds = [learner?._id, outsider?._id, admin?._id].filter(Boolean);
    await Promise.all([Certificate.deleteMany({ learner: { $in: userIds } }), ChallengeEnrollment.deleteMany({ user: { $in: userIds } }), Challenge.deleteMany({ createdBy: admin?._id }), Notification.deleteMany({ user: { $in: userIds } }), Roadmap.deleteMany({ user: { $in: userIds } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: userIds } })]);
    await mongoose.disconnect();
  });

  test("issuance requires completed owned evidence and is idempotent", async () => {
    await request(app).post("/api/certificates/issue").set("Cookie", learnerCookie).send({ sourceType: "roadmap", sourceId: roadmap._id.toString() }).expect(409);
    await request(app).post("/api/certificates/issue").set("Cookie", outsiderCookie).send({ sourceType: "roadmap", sourceId: roadmap._id.toString() }).expect(404);
    roadmap.milestones[0].status = "completed"; roadmap.milestones[0].completedAt = new Date(); roadmap.progress = 100; roadmap.status = "completed"; await roadmap.save();
    const first = await request(app).post("/api/certificates/issue").set("Cookie", learnerCookie).send({ sourceType: "roadmap", sourceId: roadmap._id.toString() }).expect(201);
    certificate = first.body.data.certificate;
    expect(first.body.data.replayed).toBe(false);
    expect(certificate.certificateId).toMatch(/^SKSW-\d{4}-[A-F0-9]{12}$/);
    const replay = await request(app).post("/api/certificates/issue").set("Cookie", learnerCookie).send({ sourceType: "roadmap", sourceId: roadmap._id.toString() }).expect(201);
    expect(replay.body.data).toMatchObject({ replayed: true });
    expect(replay.body.data.certificate._id).toBe(certificate._id);
    expect(await Certificate.countDocuments({ sourceKey: `roadmap:${roadmap._id}:learner:${learner._id}` })).toBe(1);
    expect(await Notification.countDocuments({ user: learner._id, type: "certificate" })).toBe(1);
  });

  test("completed milestones and challenges appear as separately auditable sources", async () => {
    challenge = await Challenge.create({ title: `Certificate Challenge ${marker}`, slug: `certificate-challenge-${marker}`, skill: skill._id, description: "Finish two bounded daily tasks to prove consistent practice.", durationDays: 2, dailyTasks: [{ day: 1, title: "Task one", description: "Complete the first evidence task.", xp: 10 }, { day: 2, title: "Task two", description: "Complete the second evidence task.", xp: 10 }], completionBonusXp: 10, rewardCredits: 0, badge: { key: `certificate-badge-${marker}`, title: "Certificate Badge" }, status: "published", createdBy: admin._id });
    await ChallengeEnrollment.create({ challenge: challenge._id, user: learner._id, status: "completed", startedAt: new Date(Date.now() - 2 * 86400000), targetEndAt: new Date(), completedAt: new Date(), progressDays: 2, progress: 100, xp: 30, rewardGranted: true, badgeGranted: true });
    const eligible = await request(app).get("/api/certificates/eligibility").set("Cookie", learnerCookie).expect(200);
    expect(eligible.body.data.some((item) => item.sourceType === "roadmap_milestone" && item.milestoneId === roadmap.milestones[0]._id.toString())).toBe(true);
    expect(eligible.body.data.some((item) => item.sourceType === "challenge" && item.sourceId === challenge._id.toString())).toBe(true);
    const issued = await request(app).post("/api/certificates/issue").set("Cookie", learnerCookie).send({ sourceType: "challenge", sourceId: challenge._id.toString() }).expect(201);
    expect(issued.body.data.certificate).toMatchObject({ sourceType: "challenge", achievement: `Completed ${challenge.title}` });
  });

  test("public verification is privacy-safe and revocation is admin-only", async () => {
    const verified = await request(app).get(`/api/certificates/verify/${certificate.certificateId}`).expect(200);
    expect(verified.body.data).toMatchObject({ certificateId: certificate.certificateId, status: "active", verified: true, integrityValid: true });
    expect(verified.body.data.learner.email).toBeUndefined();
    await request(app).post(`/api/certificates/${certificate._id}/revoke`).set("Cookie", learnerCookie).send({ reason: "Credential evidence was invalidated" }).expect(403);
    await request(app).post(`/api/certificates/${certificate._id}/revoke`).set("Cookie", adminCookie).send({ reason: "Credential evidence was invalidated" }).expect(200);
    const revoked = await request(app).get(`/api/certificates/verify/${certificate.certificateId}`).expect(200);
    expect(revoked.body.data).toMatchObject({ status: "revoked", verified: false, revocationReason: "Credential evidence was invalidated" });
    await request(app).get("/api/certificates/verify/SKSW-2099-NOTFOUND").expect(404);
  });
});
