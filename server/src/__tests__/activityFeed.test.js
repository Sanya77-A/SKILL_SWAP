import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Activity from "../models/Activity.js";
import ActivityComment from "../models/ActivityComment.js";
import ActivityLike from "../models/ActivityLike.js";
import ActivitySave from "../models/ActivitySave.js";
import Listing from "../models/Listing.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { createActivity } from "../services/activityService.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Evidence-driven secondary activity feed", () => {
  const marker = `${Date.now()}`;
  let actor; let viewer; let privateActor; let actorCookie; let viewerCookie; let skill; let activity;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Feed`, email: `test-feed-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [actorResponse, viewerResponse, privateResponse] = await Promise.all([register("Actor"), register("Viewer"), register("Private")]);
    actorCookie = actorResponse.headers["set-cookie"]; viewerCookie = viewerResponse.headers["set-cookie"];
    actor = await User.findByIdAndUpdate(actorResponse.body.user._id, { username: `feed_actor_${marker.slice(-8)}`, profileVisibility: "members", visibility: "members" }, { new: true });
    viewer = await User.findById(viewerResponse.body.user._id);
    privateActor = await User.findByIdAndUpdate(privateResponse.body.user._id, { profileVisibility: "private", visibility: "private" }, { new: true });
    skill = await Skill.create({ name: `Feed Skill ${marker}`, slug: `feed-skill-${marker}`, category: "Technology" });
    await UserSkill.create({ user: actor._id, skill: skill._id, type: "teach", proficiency: "Advanced" });
  });
  afterAll(async () => {
    const users = [actor?._id, viewer?._id, privateActor?._id].filter(Boolean); const activities = await Activity.find({ actor: { $in: users } }).select("_id"); const ids = activities.map((item) => item._id);
    await Promise.all([ActivityComment.deleteMany({ activity: { $in: ids } }), ActivityLike.deleteMany({ activity: { $in: ids } }), ActivitySave.deleteMany({ activity: { $in: ids } }), Activity.deleteMany({ _id: { $in: ids } }), Listing.deleteMany({ owner: { $in: users } }), UserSkill.deleteMany({ user: { $in: users } }), Skill.deleteOne({ _id: skill?._id }), User.deleteMany({ _id: { $in: users } })]); await mongoose.disconnect();
  });

  test("only internal, safe, deduplicated domain events enter the feed", async () => {
    await expect(createActivity({ actor: actor._id, type: "mentor_achievement", title: "Unsafe", link: "https://attacker.example", entityType: "achievement", entityId: new mongoose.Types.ObjectId(), dedupeKey: `unsafe:${marker}` })).rejects.toThrow("approved internal path");
    activity = await createActivity({ actor: actor._id, type: "mentor_achievement", title: "Helped ten learners", body: "A verified mentoring achievement.", link: `/user/${actor._id}`, skill: skill._id, entityType: "achievement", entityId: new mongoose.Types.ObjectId(), dedupeKey: `achievement:${marker}` });
    const replay = await createActivity({ actor: actor._id, type: "mentor_achievement", title: "Duplicate", link: `/user/${actor._id}`, entityType: "achievement", entityId: activity.entityId, dedupeKey: `achievement:${marker}` });
    expect(replay._id.toString()).toBe(activity._id.toString());
    await createActivity({ actor: privateActor._id, type: "mentor_achievement", title: "Private activity", link: `/user/${privateActor._id}`, entityType: "achievement", entityId: new mongoose.Types.ObjectId(), dedupeKey: `private:${marker}` });
    const feed = await request(app).get("/api/feed").set("Cookie", viewerCookie).expect(200);
    expect(feed.body.data.map((item) => item.title)).toContain("Helped ten learners");
    expect(feed.body.data.map((item) => item.title)).not.toContain("Private activity");
  });

  test("listing publication emits a replay-safe marketplace event", async () => {
    const listing = await Listing.create({ owner: actor._id, skill: skill._id, slug: `feed-listing-${marker}`, title: "Feed-backed teaching listing", description: "A real published listing that creates one secondary feed event.", learningOutcomes: ["Understand event-driven feeds"], deliveryMode: ["video"], sessionDurations: [60], status: "draft" });
    await request(app).post(`/api/listings/${listing._id}/publish`).set("Cookie", actorCookie).expect(200);
    expect(await Activity.countDocuments({ dedupeKey: `listing:${listing._id}:published`, type: "listing_published" })).toBe(1);
  });

  test("likes, saves, and comments are idempotent and ownership-safe", async () => {
    await request(app).post(`/api/feed/${activity._id}/like`).set("Cookie", viewerCookie).expect(200);
    await request(app).post(`/api/feed/${activity._id}/like`).set("Cookie", viewerCookie).expect(200);
    expect((await Activity.findById(activity._id)).likeCount).toBe(1);
    await request(app).post(`/api/feed/${activity._id}/save`).set("Cookie", viewerCookie).expect(200);
    const saved = await request(app).get("/api/feed?saved=true").set("Cookie", viewerCookie).expect(200);
    expect(saved.body.data.map((item) => item._id)).toContain(activity._id.toString());
    const comment = await request(app).post(`/api/feed/${activity._id}/comments`).set("Cookie", viewerCookie).send({ body: "The evidence and outcome make this useful." }).expect(201);
    await request(app).delete(`/api/feed/comments/${comment.body.data._id}`).set("Cookie", actorCookie).expect(404);
    await request(app).delete(`/api/feed/comments/${comment.body.data._id}`).set("Cookie", viewerCookie).expect(200);
    await request(app).delete(`/api/feed/${activity._id}/like`).set("Cookie", viewerCookie).expect(200);
    await request(app).delete(`/api/feed/${activity._id}/like`).set("Cookie", viewerCookie).expect(200);
    const final = await Activity.findById(activity._id);
    expect(final).toMatchObject({ likeCount: 0, commentCount: 0, saveCount: 1 });
  });
});
