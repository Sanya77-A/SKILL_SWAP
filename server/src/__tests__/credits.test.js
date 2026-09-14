import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import CreditOperation from "../models/CreditOperation.js";
import CreditTransaction from "../models/CreditTransaction.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { applyCredit, getWalletSnapshot, refundBookingCredits, rewardTeachingCredits, spendBookingCredits } from "../services/creditService.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("SkillCredits wallet and immutable ledger", () => {
  const marker = `${Date.now()}`;
  let admin;
  let learner;
  let teacher;
  let adminCookie;
  let learnerCookie;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Credits`, email: `test-credits-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [adminAuth, learnerAuth, teacherAuth] = await Promise.all([register("Admin"), register("Learner"), register("Teacher")]);
    adminCookie = adminAuth.headers["set-cookie"];
    learnerCookie = learnerAuth.headers["set-cookie"];
    [admin, learner, teacher] = await Promise.all([
      User.findByIdAndUpdate(adminAuth.body.user._id, { role: "admin" }, { new: true }),
      User.findById(learnerAuth.body.user._id), User.findById(teacherAuth.body.user._id),
    ]);
  });

  afterAll(async () => {
    const ids = [admin?._id, learner?._id, teacher?._id].filter(Boolean);
    await CreditTransaction.collection.deleteMany({ user: { $in: ids } });
    await Promise.all([
      CreditOperation.deleteMany({ user: { $in: ids } }),
      Wallet.deleteMany({ user: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
    await mongoose.disconnect();
  });

  test("admin adjustments are authorized and idempotent", async () => {
    const payload = { userId: learner._id.toString(), amount: 100, idempotencyKey: `seed_${marker}`, description: "Test opening credits" };
    await request(app).post("/api/credits/admin-adjustments").set("Cookie", learnerCookie).send(payload).expect(403);
    const created = await request(app).post("/api/credits/admin-adjustments").set("Cookie", adminCookie).send(payload).expect(201);
    const replay = await request(app).post("/api/credits/admin-adjustments").set("Cookie", adminCookie).send(payload).expect(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.data.transactionId).toBe(created.body.data.transactionId);
    await request(app).post("/api/credits/admin-adjustments").set("Cookie", adminCookie).send({ ...payload, amount: 101 }).expect(409);

    const wallet = await request(app).get("/api/credits/wallet").set("Cookie", learnerCookie).expect(200);
    expect(wallet.body.data.balance).toBe(100);
    expect(wallet.body.data.ledgerBalance).toBe(100);
    expect(wallet.body.data.integrityValid).toBe(true);
    const ledger = await request(app).get("/api/credits/transactions").set("Cookie", learnerCookie).expect(200);
    expect(ledger.body.data[0]).toMatchObject({ amount: 100, type: "admin_adjustment", balanceAfter: 100 });
    await expect(CreditTransaction.updateOne({ transactionId: created.body.data.transactionId }, { amount: 999 })).rejects.toThrow("immutable");
  });

  test("conditional debits prevent concurrent double spending", async () => {
    const entityId = new mongoose.Types.ObjectId();
    const results = await Promise.allSettled(["a", "b"].map((suffix) => applyCredit({
      userId: learner._id, amount: -80, type: "booking_spend", idempotencyKey: `concurrent:${marker}:${suffix}`,
      relatedEntity: { kind: "booking", id: entityId }, description: "Concurrent booking debit",
    })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected").reason.code).toBe("INSUFFICIENT_CREDITS");
    expect((await getWalletSnapshot(learner._id)).balance).toBe(20);
  });

  test("booking spend, refund, and teaching reward cannot be duplicated", async () => {
    await applyCredit({ userId: learner._id, amount: 80, type: "bonus", idempotencyKey: `bonus:${marker}`, relatedEntity: { kind: "system", id: learner._id }, description: "Test bonus" });
    const booking = { _id: new mongoose.Types.ObjectId(), bookingCode: `CR-${marker}`, student: learner._id, teacher: teacher._id, creditAmount: 50 };
    const firstSpend = await spendBookingCredits(booking);
    const replayedSpend = await spendBookingCredits(booking);
    expect(replayedSpend.replayed).toBe(true);
    expect(replayedSpend.transaction.transactionId).toBe(firstSpend.transaction.transactionId);
    await refundBookingCredits(booking);
    expect((await refundBookingCredits(booking)).replayed).toBe(true);
    await rewardTeachingCredits(booking);
    expect((await rewardTeachingCredits(booking)).replayed).toBe(true);

    const [learnerWallet, teacherWallet] = await Promise.all([getWalletSnapshot(learner._id), getWalletSnapshot(teacher._id)]);
    expect(learnerWallet.balance).toBe(100);
    expect(teacherWallet.balance).toBe(50);
    expect(await CreditTransaction.countDocuments({ "relatedEntity.id": booking._id })).toBe(3);
  });
});
