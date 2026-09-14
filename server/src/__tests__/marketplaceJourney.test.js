import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Activity from "../models/Activity.js";
import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import CreditOperation from "../models/CreditOperation.js";
import CreditTransaction from "../models/CreditTransaction.js";
import Listing from "../models/Listing.js";
import MatchCache from "../models/MatchCache.js";
import Notification from "../models/Notification.js";
import RefreshToken from "../models/RefreshToken.js";
import Review from "../models/Review.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import Wallet from "../models/Wallet.js";
import { applyCredit } from "../services/creditService.js";

jest.setTimeout(20_000);
const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Critical marketplace journey", () => {
  const marker = `${Date.now()}`;
  const password = "password123";
  const mentorEmail = `test-journey-mentor-${marker}@test.com`;
  const learnerEmail = `test-journey-learner-${marker}@test.com`;
  let mentor;
  let learner;
  let mentorCookie;
  let learnerCookie;
  let requestedSkill;
  let offeredSkill;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    await request(app).post("/api/auth/register").send({ name: "Journey Mentor", email: mentorEmail, password }).expect(201);
    await request(app).post("/api/auth/register").send({ name: "Journey Learner", email: learnerEmail, password }).expect(201);
    const [mentorLogin, learnerLogin] = await Promise.all([
      request(app).post("/api/auth/login").send({ email: mentorEmail, password }).expect(200),
      request(app).post("/api/auth/login").send({ email: learnerEmail, password }).expect(200),
    ]);
    mentorCookie = mentorLogin.headers["set-cookie"];
    learnerCookie = learnerLogin.headers["set-cookie"];
    [mentor, learner] = await Promise.all([User.findOne({ email: mentorEmail }), User.findOne({ email: learnerEmail })]);
    [requestedSkill, offeredSkill] = await Promise.all([
      Skill.create({ name: `Journey Systems ${marker}`, slug: `journey-systems-${marker}`, category: "Technology" }),
      Skill.create({ name: `Journey Research ${marker}`, slug: `journey-research-${marker}`, category: "Design" }),
    ]);
  });

  afterAll(async () => {
    const userIds = [mentor?._id, learner?._id].filter(Boolean);
    const bookingIds = (await Booking.find({ $or: [{ teacher: { $in: userIds } }, { student: { $in: userIds } }] }).select("_id").lean()).map((item) => item._id);
    await Promise.all([
      BookingSlot.deleteMany({ booking: { $in: bookingIds } }),
      Review.deleteMany({ $or: [{ reviewer: { $in: userIds } }, { reviewee: { $in: userIds } }] }),
      Booking.deleteMany({ _id: { $in: bookingIds } }),
      SwapProposal.deleteMany({ $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }] }),
      Listing.deleteMany({ owner: { $in: userIds } }),
      UserSkill.deleteMany({ user: { $in: userIds } }),
      Activity.deleteMany({ actor: { $in: userIds } }),
      Notification.deleteMany({ user: { $in: userIds } }),
      CreditOperation.deleteMany({ user: { $in: userIds } }),
      Wallet.deleteMany({ user: { $in: userIds } }),
      MatchCache.deleteMany({ $or: [{ userId: { $in: userIds } }, { matchedUserId: { $in: userIds } }] }),
      RefreshToken.deleteMany({ user: { $in: userIds } }),
    ]);
    await CreditTransaction.collection.deleteMany({ user: { $in: userIds } });
    await Skill.deleteMany({ _id: { $in: [requestedSkill?._id, offeredSkill?._id].filter(Boolean) } });
    await User.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  });

  test("registers, onboards, lists, searches, proposes, books, completes, reviews, and settles credits", async () => {
    await request(app).put("/api/users/me").set("Cookie", mentorCookie).send({
      username: `journey_mentor_${marker}`.slice(0, 30), headline: "Systems mentor", bio: "I teach practical system design through real product decisions.", timezone: "UTC",
      languages: ["English"], availability: ["weekday evenings"], experienceLevel: "advanced", onboardingCompleted: true,
    }).expect(200);
    await request(app).put("/api/users/me").set("Cookie", learnerCookie).send({
      username: `journey_learner_${marker}`.slice(0, 30), headline: "Research-minded learner", bio: "I exchange research practice for stronger engineering judgement.", timezone: "UTC",
      languages: ["English"], availability: ["weekday evenings"], experienceLevel: "intermediate", onboardingCompleted: true,
    }).expect(200);

    await request(app).post("/api/user-skills/me").set("Cookie", mentorCookie).send({ skillId: requestedSkill._id.toString(), type: "teach", proficiency: "Expert", yearsExperience: 8 }).expect(201);
    await request(app).post("/api/user-skills/me").set("Cookie", learnerCookie).send({ skillId: offeredSkill._id.toString(), type: "teach", proficiency: "Advanced", yearsExperience: 3 }).expect(201);
    await applyCredit({ userId: learner._id, amount: 50, type: "bonus", idempotencyKey: `journey:${marker}:credit`, relatedEntity: { kind: "system", id: learner._id }, description: "Journey test opening balance" });

    const draft = await request(app).post("/api/listings").set("Cookie", mentorCookie).send({
      skillId: requestedSkill._id.toString(), title: `System design review ${marker}`,
      description: "A focused review of one real system boundary, including failure modes, data ownership, and operational tradeoffs.",
      learningOutcomes: ["Choose a defensible boundary", "Name the first operational risk"], prerequisites: ["Bring one architecture sketch"],
      experienceLevel: "intermediate", deliveryMode: ["video"], sessionDurations: [60], exchangeEnabled: true, creditsEnabled: true,
      paidEnabled: false, creditCost: 10, price: 0, currency: "USD", capacity: 1,
    }).expect(201);
    const listingId = draft.body.data._id;
    await request(app).post(`/api/listings/${listingId}/publish`).set("Cookie", mentorCookie).expect(200);
    const search = await request(app).get("/api/explore/search").query({ q: marker }).set("Cookie", learnerCookie).expect(200);
    expect(search.body.data.listings.some((item) => item._id === listingId)).toBe(true);

    const proposal = await request(app).post("/api/proposals").set("Cookie", learnerCookie).send({
      recipientId: mentor._id.toString(), listingId, offeredSkillId: offeredSkill._id.toString(), requestedSkillId: requestedSkill._id.toString(),
      offeredSessions: 1, requestedSessions: 1, duration: 60, deliveryMode: "video", optionalCredits: 10,
      message: "I can share a research-planning session in exchange for a system design review.",
    }).expect(201);
    await request(app).post(`/api/proposals/${proposal.body.data._id}/submit`).set("Cookie", learnerCookie).expect(200);
    await request(app).post(`/api/proposals/${proposal.body.data._id}/accept`).set("Cookie", mentorCookie).expect(200);

    const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    startAt.setUTCSeconds(0, 0); startAt.setUTCMinutes(Math.ceil(startAt.getUTCMinutes() / 15) * 15);
    const booking = await request(app).post("/api/bookings").set("Cookie", learnerCookie).send({ proposalId: proposal.body.data._id, leg: "requested", sequence: 1, startAt: startAt.toISOString(), timezone: "UTC" }).expect(201);
    await request(app).post(`/api/bookings/${booking.body.data._id}/confirm`).set("Cookie", mentorCookie).expect(200);
    await Booking.findByIdAndUpdate(booking.body.data._id, { status: "confirmed", startAt: new Date(Date.now() - 2 * 60 * 60_000), endAt: new Date(Date.now() - 60 * 60_000) });
    await request(app).post(`/api/bookings/${booking.body.data._id}/complete`).set("Cookie", mentorCookie).expect(200);

    await request(app).post("/api/reviews").set("Cookie", learnerCookie).send({
      sessionId: booking.body.data._id, ratings: { communication: 5, knowledge: 5, teaching: 5, punctuality: 4, professionalism: 5, overall: 4.8 },
      comment: "The mentor tied every architecture suggestion to an operational consequence.", wouldLearnAgain: true,
    }).expect(201);
    const [learnerWallet, mentorWallet, transactions] = await Promise.all([
      request(app).get("/api/credits/wallet").set("Cookie", learnerCookie).expect(200),
      request(app).get("/api/credits/wallet").set("Cookie", mentorCookie).expect(200),
      request(app).get("/api/credits/transactions").set("Cookie", learnerCookie).expect(200),
    ]);
    expect(learnerWallet.body.data.balance).toBe(40);
    expect(mentorWallet.body.data.balance).toBe(10);
    expect(transactions.body.data.some((item) => item.type === "booking_spend" && item.amount === -10)).toBe(true);
    expect(await Review.countDocuments({ session: booking.body.data._id })).toBe(1);
  });
});
