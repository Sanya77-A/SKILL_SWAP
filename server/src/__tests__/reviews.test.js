import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";
const ratings = { communication: 5, knowledge: 4, teaching: 5, punctuality: 4, professionalism: 5, overall: 5 };

describe("Structured reviews and reputation", () => {
  const marker = `${Date.now()}`;
  let teacher;
  let student;
  let intruder;
  let teacherCookie;
  let studentCookie;
  let intruderCookie;
  let skill;
  let proposal;
  let booking;
  let secondBooking;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Review`, email: `test-review-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [teacherAuth, studentAuth, intruderAuth] = await Promise.all([register("Teacher"), register("Student"), register("Intruder")]);
    teacherCookie = teacherAuth.headers["set-cookie"];
    studentCookie = studentAuth.headers["set-cookie"];
    intruderCookie = intruderAuth.headers["set-cookie"];
    [teacher, student, intruder] = await Promise.all([
      User.findById(teacherAuth.body.user._id), User.findById(studentAuth.body.user._id), User.findById(intruderAuth.body.user._id),
    ]);
    skill = await Skill.create({ name: `Review Skill ${marker}`, slug: `review-skill-${marker}`, category: "Technology" });
    proposal = await SwapProposal.create({ requester: student._id, recipient: teacher._id, offeredSkill: skill._id, requestedSkill: skill._id, duration: 60, deliveryMode: "video", status: "accepted" });
    booking = await Booking.create({
      bookingCode: `RV${marker.slice(-10)}`,
      proposal: proposal._id,
      leg: "requested",
      sequence: 1,
      teacher: teacher._id,
      student: student._id,
      skill: skill._id,
      startAt: new Date(Date.now() - 2 * 60 * 60_000),
      endAt: new Date(Date.now() - 60 * 60_000),
      duration: 60,
      timezone: "UTC",
      teacherTimezone: "UTC",
      studentTimezone: "UTC",
      mode: "video",
      status: "confirmed",
    });
  });

  afterAll(async () => {
    const ids = [teacher?._id, student?._id, intruder?._id].filter(Boolean);
    await Promise.all([
      Review.deleteMany({ $or: [{ reviewer: { $in: ids } }, { reviewee: { $in: ids } }] }),
      Booking.deleteMany({ _id: { $in: [booking?._id, secondBooking?._id].filter(Boolean) } }),
      SwapProposal.deleteMany({ _id: proposal?._id }),
      Skill.deleteMany({ _id: skill?._id }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
    await mongoose.disconnect();
  });

  test("only participants of completed sessions can submit structured ratings", async () => {
    const payload = { sessionId: booking._id.toString(), ratings, comment: "Clear and practical.", wouldLearnAgain: true };
    await request(app).post("/api/reviews").set("Cookie", studentCookie).send(payload).expect(409);
    await Booking.findByIdAndUpdate(booking._id, { status: "completed", completedAt: new Date() });
    await request(app).post("/api/reviews").set("Cookie", intruderCookie).send(payload).expect(403);
    await request(app).post("/api/reviews").set("Cookie", studentCookie)
      .send({ ...payload, revieweeId: student._id.toString() }).expect(400);

    const created = await request(app).post("/api/reviews").set("Cookie", studentCookie).send(payload).expect(201);
    expect(created.body.data.reviewer._id).toBe(student._id.toString());
    expect(created.body.data.reviewee).toBe(teacher._id.toString());
    expect(created.body.data.ratings).toMatchObject(ratings);
    expect(created.body.reputation.ratingCount).toBe(1);
    expect(created.body.reputation.overall).toBe(5);
    expect(created.body.reputation.wouldLearnAgainRate).toBe(100);
  });

  test("each participant gets at most one review per eligible session", async () => {
    const payload = { sessionId: booking._id.toString(), ratings, wouldLearnAgain: true };
    await request(app).post("/api/reviews").set("Cookie", studentCookie).send(payload).expect(409);
    await request(app).post("/api/reviews").set("Cookie", teacherCookie)
      .send({ ...payload, ratings: { ...ratings, overall: 4 }, wouldLearnAgain: false }).expect(201);

    const listed = await request(app).get(`/api/users/${teacher._id}/reviews`).set("Cookie", studentCookie).expect(200);
    expect(listed.body.pagination.total).toBe(1);
    expect(listed.body.data[0].session._id).toBe(booking._id.toString());
  });

  test("one reviewer can review separate completed bookings", async () => {
    secondBooking = await Booking.create({
      bookingCode: `RV2${marker.slice(-9)}`,
      proposal: proposal._id,
      leg: "requested",
      sequence: 2,
      teacher: teacher._id,
      student: student._id,
      skill: skill._id,
      startAt: new Date(Date.now() - 4 * 60 * 60_000),
      endAt: new Date(Date.now() - 3 * 60 * 60_000),
      duration: 60,
      timezone: "UTC",
      teacherTimezone: "UTC",
      studentTimezone: "UTC",
      mode: "video",
      status: "completed",
      completedAt: new Date(Date.now() - 3 * 60 * 60_000),
    });
    await request(app).post("/api/reviews").set("Cookie", studentCookie).send({
      sessionId: secondBooking._id.toString(), ratings, comment: "A second eligible session.", wouldLearnAgain: true,
    }).expect(201);
    expect(await Review.countDocuments({ reviewer: student._id })).toBe(2);
  });
});
