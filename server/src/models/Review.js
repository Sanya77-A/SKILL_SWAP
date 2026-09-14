import mongoose from "mongoose";

const ratingsSchema = new mongoose.Schema(
  {
    communication: { type: Number, required: true, min: 1, max: 5 },
    knowledge: { type: Number, required: true, min: 1, max: 5 },
    teaching: { type: Number, required: true, min: 1, max: 5 },
    punctuality: { type: Number, required: true, min: 1, max: 5 },
    professionalism: { type: Number, required: true, min: 1, max: 5 },
    overall: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    ratings: { type: ratingsSchema, required: true },
    comment: { type: String, trim: true, default: "", maxlength: 2000 },
    wouldLearnAgain: { type: Boolean, required: true },
    // Compatibility fields for pre-Phase-11 review consumers and migrated records.
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    swapRequest: { type: mongoose.Schema.Types.ObjectId, ref: "SwapRequest", default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    moderationStatus: { type: String, enum: ["visible", "hidden"], default: "visible" },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderationNote: { type: String, trim: true, maxlength: 1000, default: "" },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ reviewer: 1, session: 1 }, { unique: true, partialFilterExpression: { session: { $type: "objectId" } } });
reviewSchema.index(
  { author: 1, swapRequest: 1 },
  { unique: true, partialFilterExpression: { swapRequest: { $type: "objectId" } } }
);
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ recipient: 1, createdAt: -1 });
reviewSchema.index({ moderationStatus: 1, createdAt: -1 });

reviewSchema.pre("validate", function (next) {
  if (!this.author) this.author = this.reviewer;
  if (!this.recipient) this.recipient = this.reviewee;
  if (!this.reviewer) this.reviewer = this.author;
  if (!this.reviewee) this.reviewee = this.recipient;
  if (!this.rating && this.ratings?.overall) this.rating = this.ratings.overall;
  next();
});

export default mongoose.model("Review", reviewSchema);
