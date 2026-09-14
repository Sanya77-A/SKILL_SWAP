import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Swap proposal negotiation lifecycle", () => {
  const marker = `${Date.now()}`;
  let requester;
  let recipient;
  let intruder;
  let requesterCookie;
  let recipientCookie;
  let intruderCookie;
  let offeredSkill;
  let requestedSkill;
  let proposal;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Proposal`, email: `test-proposal-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [requesterAuth, recipientAuth, intruderAuth] = await Promise.all([register("Requester"), register("Recipient"), register("Intruder")]);
    requesterCookie = requesterAuth.headers["set-cookie"];
    recipientCookie = recipientAuth.headers["set-cookie"];
    intruderCookie = intruderAuth.headers["set-cookie"];
    [requester, recipient, intruder] = await Promise.all([
      User.findById(requesterAuth.body.user._id), User.findById(recipientAuth.body.user._id), User.findById(intruderAuth.body.user._id),
    ]);
    offeredSkill = await Skill.create({ name: `React Proposal ${marker}`, slug: `react-proposal-${marker}`, category: "Technology" });
    requestedSkill = await Skill.create({ name: `Python Proposal ${marker}`, slug: `python-proposal-${marker}`, category: "Technology" });
    await UserSkill.create({ user: requester._id, skill: offeredSkill._id, type: "teach", proficiency: "Advanced" });
    await UserSkill.create({ user: recipient._id, skill: requestedSkill._id, type: "teach", proficiency: "Expert" });
  });

  afterAll(async () => {
    const ids = [requester?._id, recipient?._id, intruder?._id].filter(Boolean);
    await SwapProposal.deleteMany({ $or: [{ requester: { $in: ids } }, { recipient: { $in: ids } }] });
    await UserSkill.deleteMany({ user: { $in: ids } });
    await Skill.deleteMany({ _id: { $in: [offeredSkill?._id, requestedSkill?._id].filter(Boolean) } });
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  });

  test("draft ownership and bidirectional counter turns are enforced", async () => {
    const created = await request(app).post("/api/proposals").set("Cookie", requesterCookie).send({
      recipientId: recipient._id.toString(), offeredSkillId: offeredSkill._id.toString(), requestedSkillId: requestedSkill._id.toString(),
      offeredSessions: 2, requestedSessions: 1, duration: 60, deliveryMode: "video", message: "Let's exchange skills.",
      optionalCredits: 20,
    }).expect(201);
    proposal = created.body.data;
    expect(proposal.status).toBe("draft");

    await request(app).patch(`/api/proposals/${proposal._id}`).set("Cookie", intruderCookie).send({ message: "Tampered" }).expect(404);
    await request(app).post(`/api/proposals/${proposal._id}/accept`).set("Cookie", recipientCookie).expect(403);
    await request(app).post(`/api/proposals/${proposal._id}/submit`).set("Cookie", requesterCookie).expect(200);
    await request(app).post(`/api/proposals/${proposal._id}/accept`).set("Cookie", requesterCookie).expect(403);

    const countered = await request(app).post(`/api/proposals/${proposal._id}/counter`).set("Cookie", recipientCookie).send({
      offeredSessions: 1, requestedSessions: 2, duration: 90, message: "How about two sessions?",
    }).expect(200);
    expect(countered.body.data.status).toBe("countered");
    expect(countered.body.data.revisions).toHaveLength(1);
    expect(countered.body.data.actionRequiredBy).toBe(requester._id.toString());

    await request(app).post(`/api/proposals/${proposal._id}/accept`).set("Cookie", recipientCookie).expect(403);
    const accepted = await request(app).post(`/api/proposals/${proposal._id}/accept`).set("Cookie", requesterCookie).expect(200);
    expect(accepted.body.data.status).toBe("accepted");
    await request(app).post(`/api/proposals/${proposal._id}/cancel`).set("Cookie", requesterCookie).expect(409);
  });

  test("only requester can cancel and stale proposals expire during reads", async () => {
    const created = await request(app).post("/api/proposals").set("Cookie", requesterCookie).send({
      recipientId: recipient._id.toString(), offeredSkillId: offeredSkill._id.toString(), requestedSkillId: requestedSkill._id.toString(),
      duration: 30, deliveryMode: "audio",
    }).expect(201);
    const id = created.body.data._id;
    await request(app).post(`/api/proposals/${id}/submit`).set("Cookie", requesterCookie).expect(200);
    await request(app).post(`/api/proposals/${id}/cancel`).set("Cookie", recipientCookie).expect(403);
    await SwapProposal.findByIdAndUpdate(id, { expiresAt: new Date(Date.now() - 1000) });
    const listed = await request(app).get("/api/proposals").set("Cookie", requesterCookie).expect(200);
    expect(listed.body.data.find((item) => item._id === id).status).toBe("expired");
  });
});
