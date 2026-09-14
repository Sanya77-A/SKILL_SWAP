import crypto from "crypto";
import CreditOperation from "../models/CreditOperation.js";
import CreditTransaction from "../models/CreditTransaction.js";
import Wallet from "../models/Wallet.js";
import { ApiError } from "../utils/ApiError.js";
import { createNotification } from "./notificationService.js";
import { logger } from "../utils/logger.js";

const positiveTypes = new Set(["teaching_reward", "booking_refund", "bonus", "referral", "achievement"]);

const assertOperation = ({ amount, type, idempotencyKey, relatedEntity, description }) => {
  if (!Number.isInteger(amount) || amount === 0) throw new ApiError(400, "INVALID_CREDIT_AMOUNT", "Credit amount must be a non-zero integer");
  if (positiveTypes.has(type) && amount < 0) throw new ApiError(400, "INVALID_CREDIT_DIRECTION", `${type} must add credits`);
  if (type === "booking_spend" && amount > 0) throw new ApiError(400, "INVALID_CREDIT_DIRECTION", "Booking spend must deduct credits");
  if (!idempotencyKey || idempotencyKey.length > 200) throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "A bounded idempotency key is required");
  if (!relatedEntity?.kind || !relatedEntity?.id || !description) throw new ApiError(400, "INVALID_CREDIT_CONTEXT", "Credit operations require a related entity and description");
};

const sameOperation = (transaction, input) => transaction.user.toString() === input.userId.toString()
  && transaction.amount === input.amount && transaction.type === input.type;

export async function applyCredit(input) {
  assertOperation(input);
  const existing = await CreditTransaction.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (!sameOperation(existing, input)) throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for different credit terms");
    return { transaction: existing, replayed: true };
  }

  let operation;
  try {
    operation = await CreditOperation.create({ idempotencyKey: input.idempotencyKey, user: input.userId, amount: input.amount, type: input.type });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const replay = await CreditTransaction.findOne({ idempotencyKey: input.idempotencyKey });
    if (replay) {
      if (!sameOperation(replay, input)) throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for different credit terms");
      return { transaction: replay, replayed: true };
    }
    throw new ApiError(409, "CREDIT_OPERATION_IN_PROGRESS", "This credit operation is already being processed");
  }

  let wallet;
  try {
    if (input.amount > 0) {
      wallet = await Wallet.findOneAndUpdate(
        { user: input.userId },
        { $inc: { balance: input.amount, lifetimeEarned: input.amount, revision: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      const spend = Math.abs(input.amount);
      wallet = await Wallet.findOneAndUpdate(
        { user: input.userId, balance: { $gte: spend } },
        { $inc: { balance: input.amount, lifetimeSpent: spend, revision: 1 } },
        { new: true }
      );
      if (!wallet) throw new ApiError(409, "INSUFFICIENT_CREDITS", "Insufficient SkillCredits");
    }
    const transaction = await CreditTransaction.create({
      transactionId: `SCT-${crypto.randomUUID()}`,
      idempotencyKey: input.idempotencyKey,
      user: input.userId,
      amount: input.amount,
      type: input.type,
      relatedEntity: input.relatedEntity,
      description: input.description,
      balanceAfter: wallet.balance,
    });
    await CreditOperation.updateOne({ _id: operation._id }, { status: "completed", transaction: transaction._id });
    await createNotification(input.userId, { type: "credits", title: input.amount > 0 ? "SkillCredits received" : "SkillCredits spent", body: `${input.amount > 0 ? "+" : ""}${input.amount} SkillCredits · ${input.description}`, link: "/credits", metadata: { transactionId: transaction.transactionId, type: input.type }, dedupeKey: `credit:${transaction.transactionId}` }).catch(() => {});
    return { transaction, replayed: false };
  } catch (error) {
    if (wallet) {
      const reverse = { balance: -input.amount, revision: 1 };
      if (input.amount > 0) reverse.lifetimeEarned = -input.amount;
      else reverse.lifetimeSpent = input.amount;
      await Wallet.updateOne({ _id: wallet._id }, { $inc: reverse }).catch(() => {});
    }
    await CreditOperation.updateOne({ _id: operation._id }, { status: "failed", errorCode: error.errorCode || error.code || "CREDIT_OPERATION_FAILED" }).catch(() => {});
    logger.error("credit_operation_failed", {
      userId: input.userId.toString(),
      operationType: input.type,
      relatedKind: input.relatedEntity.kind,
      errorCode: error.errorCode || error.code || "CREDIT_OPERATION_FAILED",
    });
    throw error;
  }
}

export async function getWalletSnapshot(userId) {
  const wallet = await Wallet.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  const [ledger] = await CreditTransaction.aggregate([
    { $match: { user: wallet.user } },
    { $group: { _id: null, balance: { $sum: "$amount" }, earned: { $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] } }, spent: { $sum: { $cond: [{ $lt: ["$amount", 0] }, { $abs: "$amount" }, 0] } } } },
  ]);
  const ledgerBalance = ledger?.balance || 0;
  return { ...wallet, ledgerBalance, integrityValid: wallet.balance === ledgerBalance, ledgerEarned: ledger?.earned || 0, ledgerSpent: ledger?.spent || 0 };
}

export const spendBookingCredits = (booking) => booking.creditAmount > 0
  ? applyCredit({ userId: booking.student, amount: -booking.creditAmount, type: "booking_spend", idempotencyKey: `booking:${booking._id}:spend`, relatedEntity: { kind: "booking", id: booking._id }, description: `Credits reserved for booking ${booking.bookingCode}` })
  : null;

export async function refundBookingCredits(booking) {
  if (!(booking.creditAmount > 0)) return null;
  const spend = await CreditTransaction.exists({ idempotencyKey: `booking:${booking._id}:spend` });
  if (!spend) return null;
  return applyCredit({ userId: booking.student, amount: booking.creditAmount, type: "booking_refund", idempotencyKey: `booking:${booking._id}:refund`, relatedEntity: { kind: "booking", id: booking._id }, description: `Refund for cancelled booking ${booking.bookingCode}` });
}

export async function rewardTeachingCredits(booking) {
  if (!(booking.creditAmount > 0)) return null;
  const spend = await CreditTransaction.exists({ idempotencyKey: `booking:${booking._id}:spend` });
  if (!spend) return null;
  return applyCredit({ userId: booking.teacher, amount: booking.creditAmount, type: "teaching_reward", idempotencyKey: `booking:${booking._id}:reward`, relatedEntity: { kind: "booking", id: booking._id }, description: `Teaching reward for booking ${booking.bookingCode}` });
}
