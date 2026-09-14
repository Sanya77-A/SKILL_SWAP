import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import AdminAudit from "../models/AdminAudit.js";
import Community from "../models/Community.js";
import Listing from "../models/Listing.js";
import Review from "../models/Review.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Phase 27 admin dashboard and RBAC", () => {
  const marker = `${Date.now()}`;
  let member; let moderator; let admin; let superAdmin; let memberCookie; let moderatorCookie; let adminCookie; let superCookie; let skill; let userSkill; let listing; let review; let community;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Admin Test`, email: `test-admin-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [memberAuth, moderatorAuth, adminAuth, superAuth] = await Promise.all([register("Member"), register("Moderator"), register("Admin"), register("Super")]);
    memberCookie = memberAuth.headers["set-cookie"]; moderatorCookie = moderatorAuth.headers["set-cookie"]; adminCookie = adminAuth.headers["set-cookie"]; superCookie = superAuth.headers["set-cookie"];
    [member, moderator, admin, superAdmin] = await Promise.all([
      User.findById(memberAuth.body.user._id), User.findByIdAndUpdate(moderatorAuth.body.user._id, { role: "moderator" }, { new: true }), User.findByIdAndUpdate(adminAuth.body.user._id, { role: "admin" }, { new: true }), User.findByIdAndUpdate(superAuth.body.user._id, { role: "super_admin" }, { new: true }),
    ]);
    skill = await Skill.create({ name: `Admin Skill ${marker}`, slug: `admin-skill-${marker}`, category: "Technology" });
    userSkill = await UserSkill.create({ user: member._id, skill: skill._id, type: "teach", proficiency: "Expert", evidence: [{ type: "portfolio", label: "Work", url: "https://example.com/work" }] });
    listing = await Listing.create({ owner: member._id, skill: skill._id, slug: `admin-listing-${marker}`, title: "Admin moderation listing", description: "A published listing for admin moderation coverage.", learningOutcomes: ["Verify moderation"], deliveryMode: ["video"], sessionDurations: [60], status: "published" });
    review = await Review.create({ reviewer: moderator._id, reviewee: member._id, author: moderator._id, recipient: member._id, swapRequest: new mongoose.Types.ObjectId(), ratings: { communication: 4, knowledge: 4, teaching: 4, punctuality: 4, professionalism: 4, overall: 4 }, rating: 4, wouldLearnAgain: true, comment: "Review moderation fixture" });
    community = await Community.create({ name: `Admin Community ${marker}`, slug: `admin-community-${marker}`, description: "Community moderation fixture", owner: member._id, admins: [member._id], category: "Technology" });
  });

  afterAll(async () => {
    const users = [member?._id, moderator?._id, admin?._id, superAdmin?._id].filter(Boolean);
    await AdminAudit.collection.deleteMany({ actor: { $in: users } });
    await Promise.all([Community.deleteOne({ _id: community?._id }), Listing.deleteOne({ _id: listing?._id }), Review.deleteOne({ _id: review?._id }), UserSkill.deleteOne({ _id: userSkill?._id }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]);
    await mongoose.disconnect();
  });

  test("role permissions expose only authorized admin areas", async () => {
    await request(app).get("/api/admin/users").set("Cookie", memberCookie).expect(403);
    const access = await request(app).get("/api/admin/access").set("Cookie", moderatorCookie).expect(200);
    expect(access.body.data.permissions).toEqual(expect.arrayContaining(["users:read", "content:moderate", "verification:write"]));
    await request(app).get("/api/admin/users").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/admin/listings").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/admin/reports").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/safety/moderation/reports").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/safety/moderation/reports").set("Cookie", memberCookie).expect(403);
    await request(app).get("/api/admin/disputes").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/admin/reviews").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/admin/communities").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/admin/sessions?kind=booking").set("Cookie", moderatorCookie).expect(200);
    await request(app).get("/api/admin/skills").set("Cookie", moderatorCookie).expect(403);
    await request(app).get("/api/admin/transactions").set("Cookie", moderatorCookie).expect(403);
    await request(app).get("/api/admin/analytics").set("Cookie", moderatorCookie).expect(403);
  });

  test("account and role hierarchy is enforced server-side", async () => {
    await request(app).patch(`/api/admin/users/${member._id}`).set("Cookie", moderatorCookie).send({ status: "suspended", note: "Moderator may not suspend accounts" }).expect(403);
    await request(app).patch(`/api/admin/users/${superAdmin._id}/block`).set("Cookie", adminCookie).send({}).expect(403);
    await request(app).patch(`/api/admin/users/${member._id}`).set("Cookie", adminCookie).send({ role: "admin", note: "Privilege escalation attempt" }).expect(403);
    await request(app).patch(`/api/admin/users/${member._id}/block`).set("Cookie", adminCookie).send({}).expect(200);
    expect((await User.findById(member._id)).isBlocked).toBe(true);
    await request(app).patch(`/api/admin/users/${member._id}/unblock`).set("Cookie", adminCookie).send({}).expect(200);
    await request(app).patch(`/api/admin/users/${member._id}/role`).set("Cookie", superCookie).send({ role: "mentor", note: "Approved mentor role" }).expect(200);
    expect((await User.findById(member._id)).role).toBe("mentor");
  });

  test("content moderation is audited and hidden reviews leave public reputation", async () => {
    await request(app).patch(`/api/admin/listings/${listing._id}`).set("Cookie", moderatorCookie).send({ status: "paused", note: "Listing needs owner corrections" }).expect(200);
    await request(app).patch(`/api/admin/communities/${community._id}`).set("Cookie", moderatorCookie).send({ status: "archived", note: "Community archived after review" }).expect(200);
    await request(app).patch(`/api/admin/reviews/${review._id}`).set("Cookie", moderatorCookie).send({ status: "hidden", note: "Review violates content rules" }).expect(200);
    const publicReviews = await request(app).get(`/api/users/${member._id}/reviews`).set("Cookie", moderatorCookie).expect(200);
    expect(publicReviews.body.data.find((item) => item._id === review._id.toString())).toBeUndefined();
    expect((await User.findById(member._id)).ratingCount).toBe(0);
    expect(await AdminAudit.countDocuments({ actor: moderator._id })).toBe(3);
    await request(app).patch(`/api/admin/reviews/${review._id}`).set("Cookie", moderatorCookie).send({ status: "visible", note: "Review restored after appeal" }).expect(200);
  });

  test("verification requests and read-only operational areas work end to end", async () => {
    await request(app).post(`/api/user-skills/me/${userSkill._id}/request-verification`).set("Cookie", memberCookie).expect(200);
    const queue = await request(app).get("/api/admin/verification-requests?status=pending").set("Cookie", moderatorCookie).expect(200);
    expect(queue.body.data.some((item) => item._id === userSkill._id.toString())).toBe(true);
    await request(app).patch(`/api/admin/verification-requests/${userSkill._id}`).set("Cookie", moderatorCookie).send({ status: "verified", note: "Evidence confirms expert teaching skill" }).expect(200);
    expect((await UserSkill.findById(userSkill._id)).verificationStatus).toBe("verified");
    await request(app).get("/api/admin/skills").set("Cookie", adminCookie).expect(200);
    await request(app).get("/api/admin/transactions").set("Cookie", adminCookie).expect(200);
    const stats = await request(app).get("/api/admin/stats").set("Cookie", adminCookie).expect(200);
    expect(stats.body.data).toEqual(expect.objectContaining({ userCount: expect.any(Number), listingCount: expect.any(Number), openReports: expect.any(Number) }));
  });
});
