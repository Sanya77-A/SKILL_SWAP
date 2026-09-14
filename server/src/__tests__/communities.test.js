import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Community from "../models/Community.js";
import CommunityComment from "../models/CommunityComment.js";
import CommunityMembership from "../models/CommunityMembership.js";
import CommunityPost from "../models/CommunityPost.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Skill communities", () => {
  const marker = `${Date.now()}`;
  let ownerCookie; let memberCookie; let outsiderCookie; let owner; let member; let outsider; let skill; let community;
  const register = async (label) => request(app).post("/api/auth/register").send({ name: `${label} Community`, email: `test-community-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [a, b, c] = await Promise.all([register("Owner"), register("Member"), register("Outsider")]);
    ownerCookie = a.headers["set-cookie"]; memberCookie = b.headers["set-cookie"]; outsiderCookie = c.headers["set-cookie"];
    [owner, member, outsider] = await Promise.all([User.findById(a.body.user._id), User.findById(b.body.user._id), User.findById(c.body.user._id)]);
    skill = await Skill.create({ name: `Community Skill ${marker}`, slug: `community-skill-${marker}`, category: "Technology" });
  });
  afterAll(async () => {
    const users = [owner?._id, member?._id, outsider?._id].filter(Boolean);
    const communities = await Community.find({ owner: owner?._id }).select("_id"); const ids = communities.map((item) => item._id);
    await Promise.all([CommunityComment.deleteMany({ community: { $in: ids } }), CommunityPost.deleteMany({ community: { $in: ids } }), CommunityMembership.deleteMany({ community: { $in: ids } }), Community.deleteMany({ _id: { $in: ids } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]);
    await mongoose.disconnect();
  });

  test("creator becomes admin and public membership is idempotent", async () => {
    const created = await request(app).post("/api/communities").set("Cookie", ownerCookie).send({ name: `Systems Guild ${marker}`, description: "A serious community for systems practitioners", skillId: skill._id.toString(), category: "Engineering", rules: ["Be specific", "Share evidence"] }).expect(201);
    community = created.body.data;
    expect(community.admins).toContain(owner._id.toString());
    expect(await CommunityMembership.countDocuments({ community: community._id, role: "admin", status: "active" })).toBe(1);
    await request(app).post(`/api/communities/${community._id}/posts`).set("Cookie", memberCookie).send({ content: "Not joined" }).expect(403);
    expect((await request(app).post(`/api/communities/${community._id}/join`).set("Cookie", memberCookie).expect(200)).body.data.joined).toBe(true);
    expect((await request(app).post(`/api/communities/${community._id}/join`).set("Cookie", memberCookie).expect(200)).body.data.joined).toBe(false);
    expect((await Community.findById(community._id)).memberCount).toBe(2);
    await request(app).post(`/api/communities/${community._id}/leave`).set("Cookie", ownerCookie).expect(409);
  });

  test("members ask questions, share validated resources, and comment", async () => {
    const question = await request(app).post(`/api/communities/${community._id}/posts`).set("Cookie", memberCookie).send({ type: "question", title: "How should retries be bounded?", content: "I am comparing retry budgets and backoff strategies." }).expect(201);
    await request(app).post(`/api/communities/${community._id}/posts`).set("Cookie", memberCookie).send({ type: "resource", content: "Useful reference" }).expect(400);
    await request(app).post(`/api/communities/${community._id}/posts`).set("Cookie", memberCookie).send({ type: "resource", title: "Reference", content: "A useful systems resource", resourceUrl: "https://example.com/systems" }).expect(201);
    const comment = await request(app).post(`/api/communities/${community._id}/posts/${question.body.data._id}/comments`).set("Cookie", ownerCookie).send({ content: "Tie the retry budget to the end-to-end deadline." }).expect(201);
    expect(comment.body.data.author._id).toBe(owner._id.toString());
    const feed = await request(app).get(`/api/communities/${community._id}/posts`).set("Cookie", memberCookie).expect(200);
    expect(feed.body.pagination.total).toBe(2);
    expect(feed.body.data.find((item) => item._id === question.body.data._id).commentCount).toBe(1);
    const comments = await request(app).get(`/api/communities/${community._id}/posts/${question.body.data._id}/comments`).set("Cookie", memberCookie).expect(200);
    expect(comments.body.data[0].content).toContain("end-to-end");
  });

  test("private communities stay hidden until an admin adds a member", async () => {
    const created = await request(app).post("/api/communities").set("Cookie", ownerCookie).send({ name: `Private Guild ${marker}`, description: "An invitation-only mentor working group", skillId: skill._id.toString(), visibility: "private" }).expect(201);
    const privateCommunity = created.body.data;
    await request(app).get(`/api/communities/${privateCommunity.slug}`).set("Cookie", outsiderCookie).expect(404);
    await request(app).post(`/api/communities/${privateCommunity._id}/join`).set("Cookie", outsiderCookie).expect(403);
    await request(app).put(`/api/communities/${privateCommunity._id}/members/${outsider._id}/role`).set("Cookie", memberCookie).send({ role: "member" }).expect(403);
    await request(app).put(`/api/communities/${privateCommunity._id}/members/${outsider._id}/role`).set("Cookie", ownerCookie).send({ role: "member" }).expect(200);
    const detail = await request(app).get(`/api/communities/${privateCommunity.slug}`).set("Cookie", outsiderCookie).expect(200);
    expect(detail.body.data.membership.role).toBe("member");
  });
});
