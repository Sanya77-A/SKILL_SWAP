import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Typed notifications, preferences, and read state", () => {
  const marker = `${Date.now()}`;
  let user;
  let outsider;
  let userCookie;
  let outsiderCookie;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Notification`, email: `test-notification-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [userAuth, outsiderAuth] = await Promise.all([register("User"), register("Outsider")]);
    userCookie = userAuth.headers["set-cookie"];
    outsiderCookie = outsiderAuth.headers["set-cookie"];
    [user, outsider] = await Promise.all([User.findById(userAuth.body.user._id), User.findById(outsiderAuth.body.user._id)]);
  });

  afterAll(async () => {
    const ids = [user?._id, outsider?._id].filter(Boolean);
    await Promise.all([
      Notification.deleteMany({ user: { $in: ids } }),
      NotificationPreference.deleteMany({ user: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
    await mongoose.disconnect();
  });

  test("creates canonical typed notifications with safe deep links and deduplication", async () => {
    const first = await createNotification(user._id, { type: "NEW_REQUEST", title: "Proposal received", body: "Review the terms", link: "/proposals", dedupeKey: `proposal:${marker}` });
    const replay = await createNotification(user._id, { type: "proposal", title: "Proposal received", body: "Review the terms", link: "/proposals", dedupeKey: `proposal:${marker}` });
    expect(first.type).toBe("proposal");
    expect(replay._id.toString()).toBe(first._id.toString());
    expect(await Notification.countDocuments({ user: user._id })).toBe(1);
    await expect(createNotification(user._id, { type: "system", title: "Unsafe", link: "https://attacker.example" })).rejects.toThrow("approved internal path");
  });

  test("preferences suppress selected in-app types while system events remain enabled", async () => {
    const loaded = await request(app).get("/api/notifications/preferences").set("Cookie", userCookie).expect(200);
    expect(loaded.body.data.inApp.message).toBe(true);
    await request(app).put("/api/notifications/preferences").set("Cookie", userCookie)
      .send({ inApp: { message: false, system: false }, emailDigest: "weekly" }).expect(200);
    expect(await createNotification(user._id, { type: "message", title: "Muted message", link: "/chat" })).toBeNull();
    expect(await createNotification(user._id, { type: "system", title: "Required system notice", link: "/notifications", dedupeKey: `system:${marker}` })).not.toBeNull();
  });

  test("badge counts and read operations are ownership-safe", async () => {
    const unread = await request(app).get("/api/notifications/unread-count").set("Cookie", userCookie).expect(200);
    expect(unread.body.count).toBe(2);
    const list = await request(app).get("/api/notifications?type=proposal").set("Cookie", userCookie).expect(200);
    const notificationId = list.body.data[0]._id;
    await request(app).patch(`/api/notifications/${notificationId}/read`).set("Cookie", outsiderCookie).expect(404);
    const marked = await request(app).patch(`/api/notifications/${notificationId}/read`).set("Cookie", userCookie).expect(200);
    expect(marked.body.data.read).toBe(true);
    const all = await request(app).patch("/api/notifications/read-all").set("Cookie", userCookie).expect(200);
    expect(all.body.count).toBe(1);
    expect((await request(app).get("/api/notifications/unread-count").set("Cookie", userCookie)).body.count).toBe(0);
  });
});
