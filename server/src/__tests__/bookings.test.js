import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import AvailabilityRule from "../models/AvailabilityRule.js";
import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Booking, availability, and conflict protection", () => {
  const marker = `${Date.now()}`;
  let teacher;
  let student;
  let teacherCookie;
  let studentCookie;
  let requestedSkill;
  let offeredSkill;
  let proposal;
  let secondProposal;
  let paidProposal;
  let booking;
  let startAt;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [teacherAuth, studentAuth] = await Promise.all([
      request(app).post("/api/auth/register").send({ name: "Booking Teacher", email: `test-booking-teacher-${marker}@test.com`, password: "password123" }).expect(201),
      request(app).post("/api/auth/register").send({ name: "Booking Student", email: `test-booking-student-${marker}@test.com`, password: "password123" }).expect(201),
    ]);
    teacherCookie = teacherAuth.headers["set-cookie"];
    studentCookie = studentAuth.headers["set-cookie"];
    teacher = await User.findByIdAndUpdate(teacherAuth.body.user._id, { timezone: "UTC" }, { new: true });
    student = await User.findByIdAndUpdate(studentAuth.body.user._id, { timezone: "Asia/Kolkata" }, { new: true });
    requestedSkill = await Skill.create({ name: `Booking Python ${marker}`, slug: `booking-python-${marker}`, category: "Technology" });
    offeredSkill = await Skill.create({ name: `Booking React ${marker}`, slug: `booking-react-${marker}`, category: "Technology" });
    await UserSkill.create({ user: teacher._id, skill: requestedSkill._id, type: "teach", proficiency: "Expert" });
    await UserSkill.create({ user: student._id, skill: offeredSkill._id, type: "teach", proficiency: "Advanced" });
    const terms = {
      requester: student._id, recipient: teacher._id, offeredSkill: offeredSkill._id, requestedSkill: requestedSkill._id,
      offeredSessions: 1, requestedSessions: 1, duration: 60, deliveryMode: "video", status: "accepted", acceptedAt: new Date(),
    };
    proposal = await SwapProposal.create(terms);
    secondProposal = await SwapProposal.create(terms);
    paidProposal = await SwapProposal.create({ ...terms, optionalPayment: { amount: 75, currency: "USD" } });
    startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    startAt.setUTCSeconds(0, 0);
    startAt.setUTCMinutes(Math.ceil(startAt.getUTCMinutes() / 15) * 15);
  });

  afterAll(async () => {
    const userIds = [teacher?._id, student?._id].filter(Boolean);
    const bookings = await Booking.find({ $or: [{ teacher: { $in: userIds } }, { student: { $in: userIds } }] }).select("_id");
    await BookingSlot.deleteMany({ booking: { $in: bookings.map((value) => value._id) } });
    await Booking.deleteMany({ _id: { $in: bookings.map((value) => value._id) } });
    await AvailabilityRule.deleteMany({ user: { $in: userIds } });
    if (student?._id && teacher?._id) await SwapProposal.deleteMany({ requester: student._id, recipient: teacher._id });
    await UserSkill.deleteMany({ user: { $in: userIds } });
    await Skill.deleteMany({ _id: { $in: [requestedSkill?._id, offeredSkill?._id].filter(Boolean) } });
    await User.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  });

  test("unique participant slots prevent double booking", async () => {
    const response = await request(app).post("/api/bookings").set("Cookie", studentCookie).send({
      proposalId: proposal._id.toString(), leg: "requested", sequence: 1, startAt: startAt.toISOString(), timezone: "Asia/Kolkata",
    }).expect(201);
    booking = response.body.data;
    expect(booking.status).toBe("requested");
    expect(booking.confirmationRequiredBy).toBe(teacher._id.toString());
    expect(await BookingSlot.countDocuments({ booking: booking._id })).toBe(8);

    const conflict = await request(app).post("/api/bookings").set("Cookie", studentCookie).send({
      proposalId: secondProposal._id.toString(), leg: "requested", sequence: 1, startAt: startAt.toISOString(), timezone: "Asia/Kolkata",
    }).expect(409);
    expect(conflict.body.error.code).toBe("BOOKING_CONFLICT");
  });

  test("confirmation and reschedule turns are participant-bound", async () => {
    await request(app).post(`/api/bookings/${booking._id}/confirm`).set("Cookie", studentCookie).expect(403);
    await request(app).post(`/api/bookings/${booking._id}/confirm`).set("Cookie", teacherCookie).expect(200);

    const nextStart = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
    const rescheduled = await request(app).post(`/api/bookings/${booking._id}/reschedule`).set("Cookie", teacherCookie).send({
      startAt: nextStart.toISOString(), timezone: "UTC", reason: "Move to a later slot",
    }).expect(200);
    expect(rescheduled.body.data.status).toBe("requested");
    expect(rescheduled.body.data.confirmationRequiredBy).toBe(student._id.toString());
    expect(rescheduled.body.data.rescheduleHistory).toHaveLength(1);
    await request(app).post(`/api/bookings/${booking._id}/confirm`).set("Cookie", studentCookie).expect(200);
  });

  test("availability replacement rejects overlaps and stores valid rules", async () => {
    const baseRule = { timezone: "UTC", dayOfWeek: 1, startTime: "09:00", endTime: "12:00", modes: ["video"], isActive: true };
    await request(app).put("/api/bookings/availability/me").set("Cookie", teacherCookie).send({
      rules: [baseRule, { ...baseRule, startTime: "11:00", endTime: "13:00" }],
    }).expect(400);
    const response = await request(app).put("/api/bookings/availability/me").set("Cookie", teacherCookie).send({ rules: [baseRule] }).expect(200);
    expect(response.body.data).toHaveLength(1);
  });

  test("completion requires the scheduled end and releases reservations", async () => {
    await Booking.findByIdAndUpdate(booking._id, {
      status: "confirmed", startAt: new Date(Date.now() - 2 * 60 * 60 * 1000), endAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const response = await request(app).post(`/api/bookings/${booking._id}/complete`).set("Cookie", teacherCookie).expect(200);
    expect(response.body.data.status).toBe("completed");
    expect(await BookingSlot.countDocuments({ booking: booking._id })).toBe(0);
  });

  test("a no-show is recorded only after the session ends and is replay-safe", async () => {
    await AvailabilityRule.deleteMany({ user: teacher._id });
    const nextStart = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
    const created = await request(app).post("/api/bookings").set("Cookie", studentCookie).send({
      proposalId: secondProposal._id.toString(), leg: "requested", sequence: 1, startAt: nextStart.toISOString(), timezone: "Asia/Kolkata",
    }).expect(201);
    await request(app).post(`/api/bookings/${created.body.data._id}/confirm`).set("Cookie", teacherCookie).expect(200);
    await request(app).post(`/api/bookings/${created.body.data._id}/no-show`).set("Cookie", teacherCookie).send({ reason: "Learner did not join" }).expect(409);

    await Booking.findByIdAndUpdate(created.body.data._id, {
      status: "confirmed", startAt: new Date(Date.now() - 2 * 60 * 60 * 1000), endAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const reported = await request(app).post(`/api/bookings/${created.body.data._id}/no-show`).set("Cookie", teacherCookie).send({ reason: "Learner did not join" }).expect(200);
    expect(reported.body.data.status).toBe("no_show");
    expect(reported.body.data.noShowReportedBy).toBe(teacher._id.toString());
    expect(reported.body.data.noShowUser).toBe(student._id.toString());
    expect(await BookingSlot.countDocuments({ booking: created.body.data._id })).toBe(0);
    await request(app).post(`/api/bookings/${created.body.data._id}/no-show`).set("Cookie", teacherCookie).send({ reason: "Replay" }).expect(200);
  });

  test("paid terms fail closed until an authoritative checkout provider exists", async () => {
    const response = await request(app).post("/api/bookings").set("Cookie", studentCookie).send({
      proposalId: paidProposal._id.toString(), leg: "requested", sequence: 1,
      startAt: new Date(startAt.getTime() + 48 * 60 * 60 * 1000).toISOString(), timezone: "Asia/Kolkata",
    }).expect(409);
    expect(response.body.error.code).toBe("PAYMENT_REQUIRED");
    expect(await Booking.countDocuments({ proposal: paidProposal._id })).toBe(0);
  });

  test("simultaneous attempts cannot reserve the same participant slot", async () => {
    const terms = { requester: student._id, recipient: teacher._id, offeredSkill: offeredSkill._id, requestedSkill: requestedSkill._id, offeredSessions: 1, requestedSessions: 1, duration: 60, deliveryMode: "video", status: "accepted", acceptedAt: new Date() };
    const [left, right] = await SwapProposal.create([terms, terms]);
    const collisionStart = new Date(startAt.getTime() + 72 * 60 * 60 * 1000);
    const responses = await Promise.all([left, right].map((candidate) => request(app).post("/api/bookings").set("Cookie", studentCookie).send({
      proposalId: candidate._id.toString(), leg: "requested", sequence: 1, startAt: collisionStart.toISOString(), timezone: "Asia/Kolkata",
    })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  test("competing completion and no-show transitions have exactly one winner", async () => {
    const terminalProposal = await SwapProposal.create({ requester: student._id, recipient: teacher._id, offeredSkill: offeredSkill._id, requestedSkill: requestedSkill._id, offeredSessions: 1, requestedSessions: 1, duration: 60, deliveryMode: "video", status: "accepted", acceptedAt: new Date() });
    const terminalStart = new Date(startAt.getTime() + 96 * 60 * 60 * 1000);
    const created = await request(app).post("/api/bookings").set("Cookie", studentCookie).send({ proposalId: terminalProposal._id.toString(), leg: "requested", sequence: 1, startAt: terminalStart.toISOString(), timezone: "Asia/Kolkata" }).expect(201);
    await request(app).post(`/api/bookings/${created.body.data._id}/confirm`).set("Cookie", teacherCookie).expect(200);
    await Booking.findByIdAndUpdate(created.body.data._id, { status: "confirmed", startAt: new Date(Date.now() - 7200000), endAt: new Date(Date.now() - 3600000) });
    const responses = await Promise.all([
      request(app).post(`/api/bookings/${created.body.data._id}/complete`).set("Cookie", teacherCookie),
      request(app).post(`/api/bookings/${created.body.data._id}/no-show`).set("Cookie", studentCookie).send({ reason: "Mentor did not attend" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const persisted = await Booking.findById(created.body.data._id).lean();
    expect(["completed", "no_show"]).toContain(persisted.status);
  });
});
