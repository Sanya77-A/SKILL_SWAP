import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Booking from "../models/Booking.js";
import Certificate from "../models/Certificate.js";
import Roadmap from "../models/Roadmap.js";
import Session from "../models/Session.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { calculateLearningStreak } from "../services/learningService.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("My Learning real progress aggregation", () => {
  const marker = `${Date.now()}`;
  let learnerCookie;
  let outsiderCookie;
  let learner;
  let teacher;
  let skill;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Learning`, email: `test-learning-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [learnerAuth, teacherAuth, outsiderAuth] = await Promise.all([register("Learner"), register("Teacher"), register("Outsider")]);
    learnerCookie = learnerAuth.headers["set-cookie"];
    outsiderCookie = outsiderAuth.headers["set-cookie"];
    learner = await User.findByIdAndUpdate(learnerAuth.body.user._id, { learningGoals: ["Become production-ready"] }, { new: true });
    teacher = await User.findById(teacherAuth.body.user._id);
    skill = await Skill.create({ name: `Learning Skill ${marker}`, slug: `learning-skill-${marker}`, category: "Technology" });
    await UserSkill.create({ user: learner._id, skill: skill._id, type: "learn", proficiency: "Intermediate" });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const roadmap = new Roadmap({
      user: learner._id,
      targetSkill: skill._id,
      goal: "Complete a production-grade learning project",
      startDate: new Date(now.getTime() - 10 * 86400000),
      targetDate: new Date(now.getTime() + 30 * 86400000),
      milestones: [
        { title: "Foundations", order: 1, status: "completed", completedAt: now },
        { title: "Production project", order: 2, status: "pending", targetDate: new Date(now.getTime() + 20 * 86400000) },
      ],
      progress: 50,
      status: "active",
    });
    roadmap.tasks = [{ milestone: roadmap.milestones[0]._id, title: "Foundation exercise", order: 1, status: "completed", completedAt: yesterday }];
    await roadmap.save();

    await Booking.create([
      {
        bookingCode: `LEARN${marker}A`, proposal: new mongoose.Types.ObjectId(), leg: "requested", sequence: 1,
        teacher: teacher._id, student: learner._id, skill: skill._id, startAt: new Date(now.getTime() - 7200000), endAt: new Date(now.getTime() - 1800000), duration: 90,
        timezone: "UTC", teacherTimezone: "UTC", studentTimezone: "UTC", mode: "video", status: "completed", completedAt: now,
      },
      {
        bookingCode: `LEARN${marker}B`, proposal: new mongoose.Types.ObjectId(), leg: "requested", sequence: 1,
        teacher: teacher._id, student: learner._id, skill: skill._id, startAt: new Date(now.getTime() + 86400000), endAt: new Date(now.getTime() + 86400000 + 3600000), duration: 60,
        timezone: "UTC", teacherTimezone: "UTC", studentTimezone: "UTC", mode: "video", status: "confirmed",
      },
    ]);
    await Session.create({ requestId: new mongoose.Types.ObjectId(), teacherId: teacher._id, studentId: learner._id, status: "COMPLETED", acceptedSlot: now.toISOString() });
    await Certificate.create({ certificateId: `CERT-${marker}`, learner: learner._id, skill: skill._id, mentor: teacher._id, achievement: "Foundations milestone", verificationCode: `verify-${marker}` });
  });

  afterAll(async () => {
    const users = await User.find({ email: new RegExp(`^test-learning-.*-${marker}@test\\.com$`) }).select("_id");
    const userIds = users.map((user) => user._id);
    await Promise.all([
      Booking.deleteMany({ $or: [{ teacher: { $in: userIds } }, { student: { $in: userIds } }] }),
      Certificate.deleteMany({ learner: { $in: userIds } }),
      Roadmap.deleteMany({ user: { $in: userIds } }),
      Session.deleteMany({ $or: [{ teacherId: { $in: userIds } }, { studentId: { $in: userIds } }] }),
      UserSkill.deleteMany({ user: { $in: userIds } }),
      Skill.deleteOne({ _id: skill?._id }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
    await mongoose.disconnect();
  });

  test("streak calculation uses unique consecutive UTC activity days", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    expect(calculateLearningStreak(["2026-08-23", "2026-08-23", "2026-08-22", "2026-08-20"], now)).toMatchObject({ current: 2, longest: 2, lastActivityDate: "2026-08-23" });
    expect(calculateLearningStreak(["2026-08-20"], now).current).toBe(0);
  });

  test("endpoint returns only owner records and derives every summary", async () => {
    const response = await request(app).get("/api/learning/me").set("Cookie", learnerCookie).expect(200);
    const data = response.body.data;
    expect(data.summary).toMatchObject({ activeSkills: 1, activeRoadmaps: 1, completedSessions: 1, upcomingSessions: 1, completedMilestones: 1, certificates: 1 });
    expect(data.hoursLearned).toBe(1.5);
    expect(data.sessions.total).toBe(3);
    expect(data.streak.current).toBeGreaterThanOrEqual(2);
    expect(data.goals.some((item) => item.source === "profile" && item.goal === "Become production-ready")).toBe(true);
    expect(data.goals.some((item) => item.source === "roadmap" && item.progress === 50)).toBe(true);
    expect(data.certificates[0].certificateId).toBe(`CERT-${marker}`);

    const outsider = await request(app).get("/api/learning/me").set("Cookie", outsiderCookie).expect(200);
    expect(outsider.body.data.summary).toMatchObject({ activeSkills: 0, activeRoadmaps: 0, completedSessions: 0, certificates: 0 });
    expect(outsider.body.data.hoursLearned).toBe(0);
  });
});
