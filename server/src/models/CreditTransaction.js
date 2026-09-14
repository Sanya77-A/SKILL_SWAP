import mongoose from "mongoose";

export const creditTransactionTypes = [
  "teaching_reward", "booking_spend", "booking_refund", "bonus", "referral", "achievement", "admin_adjustment",
];

const creditTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, immutable: true },
    idempotencyKey: { type: String, required: true, unique: true, immutable: true, maxlength: 200 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    amount: { type: Number, required: true, immutable: true, validate: Number.isInteger },
    type: { type: String, enum: creditTransactionTypes, required: true, immutable: true },
    relatedEntity: {
      kind: { type: String, enum: ["booking", "group_session", "user", "achievement", "referral", "system"], required: true, immutable: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
      _id: false,
    },
    description: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
    balanceAfter: { type: Number, required: true, min: 0, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

creditTransactionSchema.index({ user: 1, createdAt: -1 });
creditTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });

const immutableLedger = (next) => next(new Error("Credit transactions are immutable"));
creditTransactionSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"], immutableLedger);

export default mongoose.model("CreditTransaction", creditTransactionSchema);
