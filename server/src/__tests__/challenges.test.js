import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Challenge from "../models/Challenge.js";
import ChallengeBadgeGrant from "../models/ChallengeBadgeGrant.js";
import ChallengeDayCompletion from "../models/ChallengeDayCompletion.js";
import ChallengeEnrollment from "../models/ChallengeEnrollment.js";
import CreditOperation from "../models/CreditOperation.js";
import CreditTransaction from "../models/CreditTransaction.js";
import Notification from "../models/Notification.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import XPTransaction from "../models/XPTransaction.js";
import { completeChallengeDay } from "../services/challengeService.js";
const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Rule-based skill challenges", () => {
  const marker = `${Date.now()}`; let adminCookie; let memberCookie; let admin; let member; let skill; let challenge; let enrollment;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Challenge`, email: `test-challenge-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);
  beforeAll(async () => { await mongoose.connect(TEST_URI); const [a, m] = await Promise.all([register("Admin"), register("Member")]); adminCookie = a.headers["set-cookie"]; memberCookie = m.headers["set-cookie"]; admin = await User.findByIdAndUpdate(a.body.user._id, { role: "admin" }, { new: true }); member = await User.findById(m.body.user._id); skill = await Skill.create({ name: `Challenge Skill ${marker}`, slug: `challenge-skill-${marker}`, category: "Technology" }); });
  afterAll(async () => { const users = [admin?._id, member?._id].filter(Boolean); const challenges = await Challenge.find({ createdBy: admin?._id }).select("_id"); const challengeIds = challenges.map((item) => item._id); const enrollments = await ChallengeEnrollment.find({ challenge: { $in: challengeIds } }).select("_id"); const enrollmentIds = enrollments.map((item) => item._id); await Promise.all([ChallengeDayCompletion.deleteMany({ enrollment: { $in: enrollmentIds } }), ChallengeBadgeGrant.deleteMany({ challenge: { $in: challengeIds } }), ChallengeEnrollment.deleteMany({ challenge: { $in: challengeIds } }), XPTransaction.collection.deleteMany({ enrollment: { $in: enrollmentIds } }), CreditTransaction.collection.deleteMany({ user: { $in: users } }), CreditOperation.deleteMany({ user: { $in: users } }), Wallet.deleteMany({ user: { $in: users } }), Notification.deleteMany({ user: { $in: users } }), Challenge.deleteMany({ _id: { $in: challengeIds } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]); await mongoose.disconnect(); });

  test("only admins create bounded challenges and publish them", async () => {
    const payload = { title: `3-Day Systems Challenge ${marker}`, description: "Practice one evidence-backed systems task on three consecutive days.", skillId: skill._id.toString(), durationDays: 3, dailyTasks: [{ day: 1, title: "Model a failure", description: "Write a concrete failure-mode analysis.", xp: 10 }, { day: 2, title: "Test recovery", description: "Run a recovery exercise and link evidence.", evidenceRequired: true, xp: 10 }, { day: 3, title: "Review trade-offs", description: "Summarize the reliability trade-offs.", xp: 10 }], completionBonusXp: 20, rewardCredits: 3, badge: { key: `systems-finisher-${marker}`, title: "Systems Challenge Finisher", description: "Completed all daily systems tasks." } };
    await request(app).post("/api/challenges").set("Cookie", memberCookie).send(payload).expect(403);
    const created = await request(app).post("/api/challenges").set("Cookie", adminCookie).send(payload).expect(201); challenge = created.body.data;
    expect(challenge.status).toBe("draft");
    await request(app).post(`/api/challenges/${challenge._id}/publish`).set("Cookie", adminCookie).expect(200);
  });

  test("enrollment is idempotent and daily rules block shortcuts", async () => {
    const first = await request(app).post(`/api/challenges/${challenge._id}/enroll`).set("Cookie", memberCookie).expect(200);
    enrollment = first.body.data.enrollment;
    expect(first.body.data.replayed).toBe(false);
    expect((await request(app).post(`/api/challenges/${challenge._id}/enroll`).set("Cookie", memberCookie).expect(200)).body.data.replayed).toBe(true);
    await request(app).post(`/api/challenges/${challenge._id}/days/2/complete`).set("Cookie", memberCookie).send({ evidenceUrl: "https://example.com/evidence" }).expect(409);
    await request(app).post(`/api/challenges/${challenge._id}/days/1/complete`).set("Cookie", memberCookie).send({ note: "Mapped timeout and retry failure modes." }).expect(200);
    await request(app).post(`/api/challenges/${challenge._id}/days/2/complete`).set("Cookie", memberCookie).send({ evidenceUrl: "https://example.com/evidence" }).expect(409);
  });

  test("sequential evidence-backed completion grants exact XP, credits, and one badge", async () => {
    const base = new Date(Date.now() - 3 * 86400000);
    await ChallengeEnrollment.updateOne({ _id: enrollment._id }, { startedAt: base, targetEndAt: new Date(base.getTime() + 3 * 86400000) });
    await ChallengeDayCompletion.updateOne({ enrollment: enrollment._id, day: 1 }, { activityDay: base.toISOString().slice(0, 10), completedAt: base });
    await expect(completeChallengeDay(member._id, challenge._id, 2, { evidenceUrl: "", note: "missing evidence" }, new Date(base.getTime() + 86400000))).rejects.toMatchObject({ code: "CHALLENGE_EVIDENCE_REQUIRED" });
    await completeChallengeDay(member._id, challenge._id, 2, { evidenceUrl: "https://example.com/recovery", note: "Recovery passed." }, new Date(base.getTime() + 86400000));
    const result = await completeChallengeDay(member._id, challenge._id, 3, { note: "Reviewed consistency and availability." }, new Date(base.getTime() + 2 * 86400000));
    expect(result.enrollment).toMatchObject({ status: "completed", progress: 100, progressDays: 3, currentStreak: 3, longestStreak: 3, xp: 50, rewardGranted: true, badgeGranted: true });
    expect(await XPTransaction.countDocuments({ enrollment: enrollment._id })).toBe(4);
    expect(await ChallengeBadgeGrant.countDocuments({ enrollment: enrollment._id })).toBe(1);
    expect((await Wallet.findOne({ user: member._id })).balance).toBe(3);
    expect((await User.findById(member._id)).achievements.filter((item) => item.key === `systems-finisher-${marker}`)).toHaveLength(1);
    expect(await Notification.countDocuments({ user: member._id, type: "badge", dedupeKey: `challenge:${challenge._id}:user:${member._id}:completed` })).toBe(1);
    const xp = await request(app).get("/api/challenges/xp/me").set("Cookie", memberCookie).expect(200);
    expect(xp.body.data).toMatchObject({ totalXp: 50, events: 4 });
  });
});
