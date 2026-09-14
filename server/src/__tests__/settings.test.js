import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import RefreshToken from "../models/RefreshToken.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { canUsersContact } from "../services/chatService.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Phase 28 settings and privacy", () => {
  const marker = `${Date.now()}`; let owner; let match; let stranger; let ownerCookie; let matchCookie; let strangerCookie; let proposal; let conversation;
  const register = (label) => request(app).post("/api/auth/register").send({ name: `${label} Settings`, email: `test-settings-${label.toLowerCase()}-${marker}@test.com`, password: "password123" }).expect(201);
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [ownerAuth, matchAuth, strangerAuth] = await Promise.all([register("Owner"), register("Match"), register("Stranger")]);
    ownerCookie = ownerAuth.headers["set-cookie"]; matchCookie = matchAuth.headers["set-cookie"]; strangerCookie = strangerAuth.headers["set-cookie"];
    [owner, match, stranger] = await Promise.all([User.findById(ownerAuth.body.user._id), User.findById(matchAuth.body.user._id), User.findById(strangerAuth.body.user._id)]);
    await User.updateOne({ _id: owner._id }, { profileVisibility: "public", visibility: "public", location: "Private City", lastActive: new Date(), lastActiveAt: new Date() });
    proposal = await SwapProposal.create({ requester: match._id, recipient: owner._id, offeredSkill: new mongoose.Types.ObjectId(), requestedSkill: new mongoose.Types.ObjectId(), duration: 60, deliveryMode: "video", status: "accepted", acceptedAt: new Date() });
  });
  afterAll(async () => {
    const ids = [owner?._id, match?._id, stranger?._id].filter(Boolean); const conversations = await Conversation.find({ participants: { $in: ids } }).select("_id").lean();
    await Promise.all([Message.deleteMany({ conversation: { $in: conversations.map((item) => item._id) } }), Conversation.deleteMany({ _id: { $in: conversations.map((item) => item._id) } }), Notification.deleteMany({ user: { $in: ids } }), NotificationPreference.deleteMany({ user: { $in: ids } }), RefreshToken.deleteMany({ user: { $in: ids } }), SwapProposal.deleteOne({ _id: proposal?._id }), Wallet.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })]);
    await mongoose.disconnect();
  });

  test("settings aggregate every section without exposing session credentials", async () => {
    const response = await request(app).get("/api/settings").set("Cookie", ownerCookie).expect(200);
    expect(response.body.data).toEqual(expect.objectContaining({ account: expect.any(Object), profile: expect.any(Object), notifications: expect.any(Object), privacy: expect.any(Object), security: expect.any(Object), learning: expect.any(Object), availability: expect.any(Array), connectedAccounts: expect.any(Array), billing: expect.any(Object) }));
    expect(response.body.data.security.sessions.length).toBeGreaterThan(0);
    expect(response.body.data.security.sessions[0]).not.toHaveProperty("token");
    expect(response.body.data.billing.paymentProvider).toBe("not_configured");
  });

  test("profile fields, presence metadata, and messaging obey privacy controls", async () => {
    await request(app).patch("/api/settings/privacy").set("Cookie", ownerCookie).send({ profileVisibility: "public", locationVisibility: "private", showOnlineStatus: false, showLastActive: false, messagePermissions: "matches" }).expect(200);
    const profile = await request(app).get(`/api/users/by-username/${owner.username}`).expect(200);
    expect(profile.body.data.user).not.toHaveProperty("location");
    expect(profile.body.data.user).not.toHaveProperty("lastActive");
    const directory = await request(app).get("/api/users").set("Cookie", matchCookie).expect(200);
    const listed = directory.body.data.find((item) => item._id === owner._id.toString());
    expect(listed).not.toHaveProperty("location"); expect(listed).not.toHaveProperty("lastActive");

    const created = await request(app).post("/api/chats/conversation").set("Cookie", matchCookie).send({ otherUserId: owner._id }).expect(200); conversation = created.body.conversation;
    await request(app).patch("/api/settings/privacy").set("Cookie", ownerCookie).send({ profileVisibility: "public", locationVisibility: "private", showOnlineStatus: false, showLastActive: false, messagePermissions: "no_one" }).expect(200);
    await request(app).post(`/api/chats/${conversation._id}/messages`).set("Cookie", matchCookie).send({ content: "Privacy must block this message" }).expect(403);
    await request(app).patch("/api/settings/privacy").set("Cookie", ownerCookie).send({ profileVisibility: "public", locationVisibility: "members", showOnlineStatus: true, showLastActive: true, messagePermissions: "everyone" }).expect(200);
    expect(await canUsersContact(stranger._id, owner._id)).toBe(true);
    const openConversation = await request(app).post("/api/chats/conversation").set("Cookie", strangerCookie).send({ otherUserId: owner._id }).expect(200);
    await request(app).post(`/api/chats/${openConversation.body.conversation._id}/messages`).set("Cookie", strangerCookie).send({ content: "Allowed by explicit everyone setting" }).expect(201);
  });

  test("learning, notifications, email, sessions, and destructive confirmation are enforced", async () => {
    const learning = { preferredLearningMode: "hybrid", preferredTeachingMode: "online", experienceLevel: "advanced", preferredExchangeModels: ["exchange", "credits"], maxCreditCost: 80, maxSessionPrice: null, preferredCurrency: "INR", learningGoals: ["Practice secure architecture"] };
    await request(app).patch("/api/settings/learning").set("Cookie", ownerCookie).send(learning).expect(200);
    await request(app).put("/api/notifications/preferences").set("Cookie", ownerCookie).send({ inApp: { message: false }, emailDigest: "weekly", pushEnabled: true }).expect(200);
    await request(app).patch("/api/settings/account").set("Cookie", ownerCookie).send({ email: `updated-settings-${marker}@test.com`, currentPassword: "wrong-pass" }).expect(400);
    await request(app).patch("/api/settings/account").set("Cookie", ownerCookie).send({ email: `updated-settings-${marker}@test.com`, currentPassword: "password123" }).expect(200);
    const secondLogin = await request(app).post("/api/auth/login").send({ email: `updated-settings-${marker}@test.com`, password: "password123" }).expect(200);
    expect(await RefreshToken.countDocuments({ user: owner._id })).toBeGreaterThan(1);
    await request(app).delete("/api/settings/security/sessions/others").set("Cookie", secondLogin.headers["set-cookie"]).expect(200);
    expect(await RefreshToken.countDocuments({ user: owner._id })).toBe(1);
    await request(app).delete("/api/settings/account").set("Cookie", strangerCookie).send({ currentPassword: "password123", confirmation: "NO" }).expect(400);
    await request(app).delete("/api/settings/account").set("Cookie", strangerCookie).send({ currentPassword: "password123", confirmation: "DELETE" }).expect(200);
    await request(app).get("/api/settings").set("Cookie", strangerCookie).expect(403);
    const updated = await User.findById(owner._id); expect(updated).toMatchObject({ preferredCurrency: "INR", emailVerified: false });
  });
});
