import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import GroupSession from "../models/GroupSession.js";
import GroupSessionEnrollment from "../models/GroupSessionEnrollment.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";
describe("Capacity-safe group sessions", () => {
  const marker = `${Date.now()}`; let hostCookie; let firstCookie; let secondCookie; let thirdCookie; let host; let users; let skill; let session;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Group`, email: `test-group-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);
  beforeAll(async () => { await mongoose.connect(TEST_URI); const auth = await Promise.all([register("Host"), register("First"), register("Second"), register("Third")]); [hostCookie, firstCookie, secondCookie, thirdCookie] = auth.map((item) => item.headers["set-cookie"]); users = await User.find({ _id: { $in: auth.map((item) => item.body.user._id) } }); host = await User.findByIdAndUpdate(auth[0].body.user._id, { role: "mentor" }, { new: true }); skill = await Skill.create({ name: `Group Skill ${marker}`, slug: `group-skill-${marker}`, category: "Technology" }); await UserSkill.create({ user: host._id, skill: skill._id, type: "teach", proficiency: "Expert" }); });
  afterAll(async () => { const ids = users.map((item) => item._id); const sessions = await GroupSession.find({ mentor: host?._id }).select("_id"); await Promise.all([GroupSessionEnrollment.deleteMany({ groupSession: { $in: sessions.map((item) => item._id) } }), GroupSession.deleteMany({ mentor: host?._id }), UserSkill.deleteMany({ user: { $in: ids } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: ids } })]); await mongoose.disconnect(); });
  test("mentor creates and publishes a validated session", async () => { const startAt = new Date(Date.now() + 7 * 86400000); const created = await request(app).post("/api/group-sessions").set("Cookie", hostCookie).send({ title: "Reliable systems workshop", skillId: skill._id.toString(), description: "Practice reliability patterns in a guided small group.", startAt, duration: 90, timezone: "UTC", capacity: 2, mode: "video", meetingUrl: "https://example.com/meeting" }).expect(201); session = created.body.data; expect(new Date(session.endAt).getTime() - new Date(session.startAt).getTime()).toBe(90 * 60000); await request(app).post(`/api/group-sessions/${session._id}/publish`).set("Cookie", firstCookie).expect(404); const published = await request(app).post(`/api/group-sessions/${session._id}/publish`).set("Cookie", hostCookie).expect(200); expect(published.body.data.status).toBe("published"); });
  test("atomic capacity and unique enrollment prevent overbooking", async () => { const [first, second] = await Promise.all([request(app).post(`/api/group-sessions/${session._id}/enroll`).set("Cookie", firstCookie), request(app).post(`/api/group-sessions/${session._id}/enroll`).set("Cookie", secondCookie)]); expect([first.status, second.status]).toEqual([200, 200]); await request(app).post(`/api/group-sessions/${session._id}/enroll`).set("Cookie", thirdCookie).expect(409); let stored = await GroupSession.findById(session._id); expect(stored.participantCount).toBe(2); expect(stored.status).toBe("full"); expect(await GroupSessionEnrollment.countDocuments({ groupSession: session._id, status: "enrolled" })).toBe(2); const replay = await request(app).post(`/api/group-sessions/${session._id}/enroll`).set("Cookie", firstCookie).expect(200); expect(replay.body.data.replayed).toBe(true); });
  test("withdrawal reopens one seat without deleting enrollment history", async () => { await request(app).post(`/api/group-sessions/${session._id}/withdraw`).set("Cookie", firstCookie).expect(200); await request(app).post(`/api/group-sessions/${session._id}/enroll`).set("Cookie", thirdCookie).expect(200); const stored = await GroupSession.findById(session._id); expect(stored.participantCount).toBe(2); expect(await GroupSessionEnrollment.countDocuments({ groupSession: session._id, status: "cancelled" })).toBe(1); });
  test("host cancellation closes active enrollments and lifecycle timing is enforced", async () => {
    const cancelled = await request(app).post(`/api/group-sessions/${session._id}/cancel`).set("Cookie", hostCookie).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: "cancelled", participantCount: 0 });
    expect(await GroupSessionEnrollment.countDocuments({ groupSession: session._id, status: "enrolled" })).toBe(0);

    const startAt = new Date(Date.now() - 90 * 60000);
    const lifecycle = await GroupSession.create({ title: "Lifecycle workshop", mentor: host._id, skill: skill._id, description: "A completed lifecycle fixture for host transition testing.", startAt, endAt: new Date(startAt.getTime() + 60 * 60000), duration: 60, timezone: "UTC", capacity: 5, mode: "video", meetingUrl: "https://example.com/lifecycle", status: "published" });
    const started = await request(app).post(`/api/group-sessions/${lifecycle._id}/start`).set("Cookie", hostCookie).expect(200);
    expect(started.body.data.status).toBe("in_progress");
    const completed = await request(app).post(`/api/group-sessions/${lifecycle._id}/complete`).set("Cookie", hostCookie).expect(200);
    expect(completed.body.data.status).toBe("completed");
  });
});
