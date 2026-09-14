import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";
import Booking from "../models/Booking.js";
import CreditTransaction from "../models/CreditTransaction.js";
import GroupSession from "../models/GroupSession.js";
import GroupSessionEnrollment from "../models/GroupSessionEnrollment.js";
import Listing from "../models/Listing.js";
import Review from "../models/Review.js";
import Session from "../models/Session.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Event-backed mentor analytics", () => {
  const marker = `${Date.now()}`;
  let mentor; let learner; let mentorCookie; let learnerCookie; let skill; let listing; let group;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Analytics`, email: `test-mentor-analytics-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [mentorResponse, learnerResponse] = await Promise.all([register("Mentor"), register("Learner")]);
    mentorCookie = mentorResponse.headers["set-cookie"]; learnerCookie = learnerResponse.headers["set-cookie"];
    mentor = await User.findByIdAndUpdate(mentorResponse.body.user._id, { username: `analytics_${marker.slice(-10)}`, visibility: "public", profileVisibility: "public" }, { new: true });
    learner = await User.findById(learnerResponse.body.user._id);
    skill = await Skill.create({ name: `Analytics Skill ${marker}`, slug: `analytics-skill-${marker}`, category: "Technology" });
    await UserSkill.create({ user: mentor._id, skill: skill._id, type: "teach", proficiency: "Expert", verificationStatus: "verified" });
    listing = await Listing.create({ owner: mentor._id, skill: skill._id, slug: `analytics-listing-${marker}`, title: "Observable teaching systems", description: "A published listing used to verify real mentor discovery analytics.", learningOutcomes: ["Measure real outcomes"], deliveryMode: ["video"], sessionDurations: [60], status: "published", publishedAt: new Date() });
  });

  afterAll(async () => {
    const users = [mentor?._id, learner?._id].filter(Boolean);
    await Promise.all([AnalyticsEvent.deleteMany({ subject: mentor?._id }), Booking.deleteMany({ teacher: { $in: users } }), CreditTransaction.collection.deleteMany({ user: { $in: users } }), GroupSessionEnrollment.deleteMany({ groupSession: group?._id }), GroupSession.deleteMany({ mentor: { $in: users } }), Listing.deleteMany({ owner: { $in: users } }), Review.deleteMany({ $or: [{ reviewer: { $in: users } }, { reviewee: { $in: users } }] }), Session.deleteMany({ $or: [{ teacherId: { $in: users } }, { studentId: { $in: users } }] }), SwapProposal.deleteMany({ $or: [{ requester: { $in: users } }, { recipient: { $in: users } }] }), UserSkill.deleteMany({ user: { $in: users } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]);
    await mongoose.disconnect();
  });

  test("profile and listing views deduplicate by viewer, entity, and UTC day", async () => {
    await request(app).get(`/api/users/by-username/${mentor.username}`).set("Cookie", learnerCookie).expect(200);
    await request(app).get(`/api/users/by-username/${mentor.username}`).set("Cookie", learnerCookie).expect(200);
    await request(app).get(`/api/listings/${listing._id}`).set("Cookie", learnerCookie).expect(200);
    await request(app).get(`/api/listings/${listing._id}`).set("Cookie", learnerCookie).expect(200);
    await request(app).get(`/api/users/by-username/${mentor.username}`).set("Cookie", mentorCookie).expect(200);
    expect(await AnalyticsEvent.countDocuments({ subject: mentor._id, type: "profile_view" })).toBe(1);
    expect(await AnalyticsEvent.countDocuments({ subject: mentor._id, type: "listing_view" })).toBe(1);
  });

  test("all mentor metrics use persisted marketplace evidence and explicit denominators", async () => {
    const now = new Date();
    const bookingValues = ["completed", "completed", "cancelled"].map((status, index) => ({ bookingCode: `AN-${marker}-${index}`, proposal: new mongoose.Types.ObjectId(), listing: listing._id, leg: "requested", sequence: 1, teacher: mentor._id, student: learner._id, skill: skill._id, startAt: new Date(now.getTime() - (index + 3) * 3600000), endAt: new Date(now.getTime() - (index + 2) * 3600000), duration: 60, timezone: "UTC", teacherTimezone: "UTC", studentTimezone: "UTC", mode: "video", status, paymentModel: "paid", paymentAmount: status === "completed" ? 50 : 0, currency: "USD", ...(status === "completed" && { completedAt: now }) }));
    const bookings = await Booking.create(bookingValues);
    const groupStart = new Date(now.getTime() - 7200000);
    group = await GroupSession.create({ title: "Analytics group class", mentor: mentor._id, skill: skill._id, description: "A completed group class with one attended learner.", startAt: groupStart, endAt: new Date(groupStart.getTime() + 3600000), duration: 60, timezone: "UTC", capacity: 10, mode: "video", meetingUrl: "https://example.com/room", status: "completed" });
    await GroupSessionEnrollment.create({ groupSession: group._id, participant: learner._id, status: "attended" });
    await Session.create({ requestId: new mongoose.Types.ObjectId(), teacherId: mentor._id, studentId: learner._id, status: "COMPLETED" });
    await Review.create({ reviewer: learner._id, reviewee: mentor._id, session: bookings[0]._id, author: learner._id, recipient: mentor._id, swapRequest: new mongoose.Types.ObjectId(), ratings: { communication: 5, knowledge: 5, teaching: 5, punctuality: 4, professionalism: 5, overall: 4.5 }, rating: 4.5, wouldLearnAgain: true });
    await SwapProposal.create([{ requester: learner._id, recipient: mentor._id, offeredSkill: skill._id, requestedSkill: skill._id, duration: 60, deliveryMode: "video", status: "accepted", respondedAt: new Date(now.getTime() - 60000), acceptedAt: now }, { requester: learner._id, recipient: mentor._id, offeredSkill: skill._id, requestedSkill: skill._id, duration: 60, deliveryMode: "video", status: "pending", actionRequiredBy: mentor._id }]);
    await CreditTransaction.create({ transactionId: `SCT-AN-${marker}`, idempotencyKey: `analytics:${marker}:credit`, user: mentor._id, amount: 20, type: "teaching_reward", relatedEntity: { kind: "booking", id: bookings[0]._id }, description: "Verified analytics teaching reward", balanceAfter: 20 });
    const response = await request(app).get("/api/analytics/mentor?rangeDays=30").set("Cookie", mentorCookie).expect(200);
    const data = response.body.data;
    expect(data).toMatchObject({ profileViews: 1, listingViews: 1, bookingRequests: 3, conversionRate: 66.7, sessionsTaught: 4, averageRating: 4.5, ratingCount: 1, repeatLearners: 1, uniqueLearners: 1, skillCreditsEarned: 20, responseRate: 50, cancellationRate: 33.3 });
    expect(data.topSkills[0]).toMatchObject({ name: skill.name, sessions: 3 });
    expect(data.revenue).toMatchObject({ settledTotal: 0, settlementAvailable: false, basis: "completed_booking_terms_until_payment_ledger" });
    expect(data.revenue.currencies).toContainEqual({ currency: "USD", bookedAmount: 100 });
    expect(data.definitions.views).toMatch(/self-views excluded/i);
    await request(app).get("/api/analytics/mentor?rangeDays=13").set("Cookie", mentorCookie).expect(400);
  });
});
