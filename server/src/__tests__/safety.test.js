import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Dispute from "../models/Dispute.js";
import Listing from "../models/Listing.js";
import Message from "../models/Message.js";
import ModerationAction from "../models/ModerationAction.js";
import Notification from "../models/Notification.js";
import Report from "../models/Report.js";
import Review from "../models/Review.js";
import Skill from "../models/Skill.js";
import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import UserBlock from "../models/UserBlock.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";
describe("Safety, typed reports, and disputes", () => {
  const marker = `${Date.now()}`; let first; let second; let admin; let firstCookie; let secondCookie; let adminCookie; let skill; let listing; let conversation; let message; let review; let booking; let report; let dispute;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Safety`, email: `test-safety-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);
  beforeAll(async () => {
    await mongoose.connect(TEST_URI); const [a, b, c] = await Promise.all([register("First"), register("Second"), register("Admin")]);
    firstCookie = a.headers["set-cookie"]; secondCookie = b.headers["set-cookie"]; adminCookie = c.headers["set-cookie"];
    first = await User.findById(a.body.user._id); second = await User.findById(b.body.user._id); admin = await User.findByIdAndUpdate(c.body.user._id, { role: "admin" }, { new: true });
    skill = await Skill.create({ name: `Safety Skill ${marker}`, slug: `safety-skill-${marker}`, category: "Technology" });
    listing = await Listing.create({ owner: second._id, skill: skill._id, slug: `safety-listing-${marker}`, title: "Safety report target listing", description: "A listing used to verify target-aware safety reporting.", learningOutcomes: ["Use reporting safely"], deliveryMode: ["video"], sessionDurations: [60], status: "published" });
    conversation = await Conversation.create({ participants: [first._id, second._id], participantKey: [first._id.toString(), second._id.toString()].sort().join(":") });
    message = await Message.create({ conversation: conversation._id, sender: second._id, content: "Message requiring moderation review" });
    review = await Review.create({ reviewer: second._id, reviewee: first._id, author: second._id, recipient: first._id, swapRequest: new mongoose.Types.ObjectId(), ratings: { communication: 3, knowledge: 3, teaching: 3, punctuality: 3, professionalism: 3, overall: 3 }, rating: 3, wouldLearnAgain: false, comment: "Review requiring moderation" });
  });
  afterAll(async () => { const users = [first?._id, second?._id, admin?._id].filter(Boolean); await Promise.all([Booking.deleteMany({ $or: [{ teacher: { $in: users } }, { student: { $in: users } }] }), Conversation.deleteMany({ participants: { $in: users } }), Dispute.deleteMany({ $or: [{ openedBy: { $in: users } }, { against: { $in: users } }] }), Listing.deleteMany({ owner: { $in: users } }), Message.deleteMany({ sender: { $in: users } }), ModerationAction.deleteMany({ actor: { $in: users } }), Notification.deleteMany({ user: { $in: users } }), Report.deleteMany({ reporter: { $in: users } }), Review.deleteMany({ $or: [{ reviewer: { $in: users } }, { reviewee: { $in: users } }] }), SwapRequest.deleteMany({ $or: [{ sender: { $in: users } }, { receiver: { $in: users } }] }), UserBlock.deleteMany({ $or: [{ blocker: { $in: users } }, { blocked: { $in: users } }] }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]); await mongoose.disconnect(); });

  test("member blocks are bilateral contact boundaries and cancel pending requests", async () => {
    await request(app).post(`/api/safety/blocks/${second._id}`).set("Cookie", firstCookie).send({ reason: "Stop contact" }).expect(201);
    await request(app).post(`/api/safety/blocks/${second._id}`).set("Cookie", firstCookie).send({ reason: "Replay" }).expect(201);
    expect(await UserBlock.countDocuments({ blocker: first._id, blocked: second._id })).toBe(1);
    await request(app).get(`/api/users/${second._id}`).set("Cookie", firstCookie).expect(404);
    const search = await request(app).get(`/api/users?q=${encodeURIComponent(second.name)}`).set("Cookie", firstCookie).expect(200);
    expect(search.body.data.some((user) => user._id === second._id.toString())).toBe(false);
    const explore = await request(app).get("/api/explore/search?q=Safety").set("Cookie", firstCookie).expect(200);
    expect(explore.body.data.listings.some((item) => item.owner?._id === second._id.toString())).toBe(false);
    expect(explore.body.data.mentors.some((user) => user._id === second._id.toString())).toBe(false);
    const matches = await request(app).get("/api/matches").set("Cookie", firstCookie).expect(200);
    expect(matches.body.data.some((item) => item.user?._id === second._id.toString())).toBe(false);
    await request(app).post("/api/requests").set("Cookie", secondCookie).send({ receiverId: first._id, skillToLearn: "Safety", skillToTeach: "Testing", message: "blocked" }).expect(403);
    await request(app).post("/api/chats/conversation").set("Cookie", secondCookie).send({ otherUserId: first._id }).expect(403);
    await request(app).post(`/api/chats/${conversation._id}/messages`).set("Cookie", secondCookie).send({ content: "blocked message" }).expect(403);
    await request(app).delete(`/api/safety/blocks/${second._id}`).set("Cookie", firstCookie).expect(200);
    await request(app).post("/api/requests").set("Cookie", secondCookie).send({ receiverId: first._id, skillToLearn: "Safety", skillToTeach: "Testing", message: "allowed now" }).expect(201);
    await request(app).post(`/api/safety/blocks/${second._id}`).set("Cookie", firstCookie).send({}).expect(201);
    expect(await SwapRequest.countDocuments({ sender: second._id, receiver: first._id, status: "CANCELED" })).toBe(1);
    await request(app).delete(`/api/safety/blocks/${second._id}`).set("Cookie", firstCookie).expect(200);
  });

  test("reports resolve target ownership and follow an audited admin state machine", async () => {
    const targets = [{ targetType: "user", targetId: second._id }, { targetType: "listing", targetId: listing._id }, { targetType: "message", targetId: message._id }, { targetType: "review", targetId: review._id }];
    for (const target of targets) await request(app).post("/api/safety/reports").set("Cookie", firstCookie).send({ ...target, category: "harassment", reason: "Repeated unsafe behavior requiring moderator review", evidenceUrls: ["https://example.com/evidence"] }).expect(201);
    const replay = await request(app).post("/api/safety/reports").set("Cookie", firstCookie).send({ targetType: "user", targetId: second._id, category: "harassment", reason: "Duplicate report should replay" }).expect(201);
    expect(replay.body.data.replayed).toBe(true);
    await request(app).post("/api/safety/reports").set("Cookie", firstCookie).send({ targetType: "user", targetId: first._id, category: "other", reason: "Self report must fail" }).expect(400);
    const queue = await request(app).get("/api/safety/moderation/reports").set("Cookie", adminCookie).expect(200); report = queue.body.data.find((item) => item.targetType === "user");
    await request(app).patch(`/api/safety/moderation/reports/${report._id}`).set("Cookie", adminCookie).send({ status: "resolved", note: "Invalid direct transition" }).expect(409);
    for (const status of ["triaged", "in_review", "resolved"]) await request(app).patch(`/api/safety/moderation/reports/${report._id}`).set("Cookie", adminCookie).send({ status, note: `Moderator moved report to ${status}` }).expect(200);
    expect(await ModerationAction.countDocuments({ targetType: "report", targetId: report._id })).toBe(3);
  });

  test("only booking participants dispute active sessions and admins resolve them", async () => {
    const startAt = new Date(Date.now() + 3600000);
    booking = await Booking.create({ bookingCode: `SAFE-${marker}`, proposal: new mongoose.Types.ObjectId(), listing: listing._id, leg: "requested", sequence: 1, teacher: second._id, student: first._id, skill: skill._id, startAt, endAt: new Date(startAt.getTime() + 3600000), duration: 60, timezone: "UTC", teacherTimezone: "UTC", studentTimezone: "UTC", mode: "video", status: "confirmed", paymentModel: "exchange" });
    const opened = await request(app).post(`/api/safety/disputes/bookings/${booking._id}`).set("Cookie", firstCookie).send({ category: "misrepresentation", description: "The agreed session terms materially differ from the published offer.", evidenceUrls: ["https://example.com/session-evidence"] }).expect(201); dispute = opened.body.data;
    expect((await Booking.findById(booking._id)).status).toBe("disputed");
    await request(app).post(`/api/safety/disputes/bookings/${booking._id}`).set("Cookie", secondCookie).send({ category: "other", description: "A duplicate dispute must not be created." }).expect(409);
    await request(app).get("/api/safety/moderation/disputes").set("Cookie", firstCookie).expect(403);
    await request(app).patch(`/api/safety/moderation/disputes/${dispute._id}`).set("Cookie", adminCookie).send({ status: "under_review", note: "Evidence review started" }).expect(200);
    await request(app).patch(`/api/safety/moderation/disputes/${dispute._id}`).set("Cookie", adminCookie).send({ status: "resolved_refund", note: "Session cancelled and eligible credits refunded" }).expect(200);
    expect((await Booking.findById(booking._id)).status).toBe("cancelled");
    expect((await Dispute.findById(dispute._id))).toMatchObject({ status: "resolved_refund", resolution: "Session cancelled and eligible credits refunded" });
    expect(await ModerationAction.countDocuments({ targetType: "dispute", targetId: dispute._id })).toBe(2);
  });
});
