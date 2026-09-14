import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Authorized realtime chat lifecycle", () => {
  const marker = `${Date.now()}`;
  let sender;
  let recipient;
  let intruder;
  let senderCookie;
  let recipientCookie;
  let intruderCookie;
  let offeredSkill;
  let requestedSkill;
  let proposal;
  let conversationId;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Chat`, email: `test-chat-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [senderAuth, recipientAuth, intruderAuth] = await Promise.all([register("Sender"), register("Recipient"), register("Intruder")]);
    senderCookie = senderAuth.headers["set-cookie"];
    recipientCookie = recipientAuth.headers["set-cookie"];
    intruderCookie = intruderAuth.headers["set-cookie"];
    [sender, recipient, intruder] = await Promise.all([
      User.findById(senderAuth.body.user._id), User.findById(recipientAuth.body.user._id), User.findById(intruderAuth.body.user._id),
    ]);
    offeredSkill = await Skill.create({ name: `Chat React ${marker}`, slug: `chat-react-${marker}`, category: "Technology" });
    requestedSkill = await Skill.create({ name: `Chat Design ${marker}`, slug: `chat-design-${marker}`, category: "Design" });
    proposal = await SwapProposal.create({
      requester: sender._id,
      recipient: recipient._id,
      offeredSkill: offeredSkill._id,
      requestedSkill: requestedSkill._id,
      duration: 60,
      deliveryMode: "video",
      status: "accepted",
      acceptedAt: new Date(),
    });
  });

  afterAll(async () => {
    const ids = [sender?._id, recipient?._id, intruder?._id].filter(Boolean);
    const conversations = await Conversation.find({ participants: { $in: ids } }).select("_id").lean();
    const conversationIds = conversations.map((item) => item._id);
    await Promise.all([
      Message.deleteMany({ conversation: { $in: conversationIds } }),
      Conversation.deleteMany({ _id: { $in: conversationIds } }),
      Notification.deleteMany({ user: { $in: ids } }),
      SwapProposal.deleteMany({ _id: proposal?._id }),
      Skill.deleteMany({ _id: { $in: [offeredSkill?._id, requestedSkill?._id].filter(Boolean) } }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
    await mongoose.disconnect();
  });

  test("an accepted proposal authorizes one stable conversation", async () => {
    const first = await request(app).post("/api/chats/conversation").set("Cookie", senderCookie)
      .send({ otherUserId: recipient._id.toString() }).expect(200);
    const second = await request(app).post("/api/chats/conversation").set("Cookie", recipientCookie)
      .send({ otherUserId: sender._id.toString() }).expect(200);
    conversationId = first.body.conversation._id;
    expect(second.body.conversation._id).toBe(conversationId);

    await request(app).post("/api/chats/conversation").set("Cookie", intruderCookie)
      .send({ otherUserId: sender._id.toString() }).expect(403);
  });

  test("participants can send text and authorized cards but outsiders cannot read", async () => {
    const textMessage = await request(app).post(`/api/chats/${conversationId}/messages`).set("Cookie", senderCookie)
      .send({ content: "Ready for our session?" }).expect(201);
    expect(textMessage.body.message.messageType).toBe("text");

    const cardMessage = await request(app).post(`/api/chats/${conversationId}/messages`).set("Cookie", senderCookie)
      .send({ proposalId: proposal._id.toString() }).expect(201);
    expect(cardMessage.body.message.messageType).toBe("proposal");
    expect(cardMessage.body.message.proposal._id).toBe(proposal._id.toString());

    await request(app).get(`/api/chats/${conversationId}/messages`).set("Cookie", intruderCookie).expect(404);
    await request(app).post(`/api/chats/${conversationId}/messages`).set("Cookie", intruderCookie)
      .send({ content: "Unauthorized" }).expect(403);
  });

  test("replaying a client message id returns the original message without duplicating it", async () => {
    const clientMessageId = "9ca11a33-047e-4c6d-9749-c50522a0474a";
    const first = await request(app).post(`/api/chats/${conversationId}/messages`).set("Cookie", senderCookie)
      .send({ content: "Send exactly once", clientMessageId }).expect(201);
    const replay = await request(app).post(`/api/chats/${conversationId}/messages`).set("Cookie", senderCookie)
      .send({ content: "Send exactly once", clientMessageId }).expect(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.message._id).toBe(first.body.message._id);
    expect(await Message.countDocuments({ sender: sender._id, clientMessageId })).toBe(1);
  });

  test("marking a conversation read persists receipt metadata", async () => {
    await request(app).patch(`/api/chats/${conversationId}/read`).set("Cookie", recipientCookie).expect(200);
    const messages = await Message.find({ conversation: conversationId, sender: sender._id }).lean();
    expect(messages).toHaveLength(3);
    expect(messages.every((message) => message.read && message.readAt)).toBe(true);
    expect(messages.every((message) => message.seenBy.some((id) => id.toString() === recipient._id.toString()))).toBe(true);

    const listed = await request(app).get("/api/chats").set("Cookie", recipientCookie).expect(200);
    expect(listed.body.data.find((item) => item._id === conversationId).unreadCount).toBe(0);
  });

  test("rejects an attachment whose bytes do not match its declared image type", async () => {
    const before = await Message.countDocuments({ conversation: conversationId });
    const response = await request(app).post(`/api/chats/${conversationId}/messages`).set("Cookie", senderCookie)
      .field("content", "disguised payload")
      .attach("attachments", Buffer.from("this is not a jpeg"), { filename: "payload.jpg", contentType: "image/jpeg" })
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_FILE_CONTENT");
    expect(await Message.countDocuments({ conversation: conversationId })).toBe(before);
  });
});
