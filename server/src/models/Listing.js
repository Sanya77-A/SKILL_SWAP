import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    learningOutcomes: [{ type: String, required: true, trim: true, maxlength: 300 }],
    prerequisites: [{ type: String, trim: true, maxlength: 300 }],
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert", "all_levels"],
      default: "all_levels",
    },
    deliveryMode: [{ type: String, enum: ["video", "audio", "in_person"] }],
    sessionDurations: [{ type: Number, min: 15, max: 240 }],
    exchangeEnabled: { type: Boolean, default: true },
    creditsEnabled: { type: Boolean, default: false },
    paidEnabled: { type: Boolean, default: false },
    creditCost: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, uppercase: true, trim: true, default: "USD", minlength: 3, maxlength: 3 },
    capacity: { type: Number, default: 1, min: 1, max: 100 },
    status: {
      type: String,
      enum: ["draft", "published", "paused", "archived"],
      default: "draft",
    },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    bookingCount: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

listingSchema.index({ owner: 1, status: 1, updatedAt: -1 });
listingSchema.index({ status: 1, skill: 1, ratingAvg: -1 });
listingSchema.index({ status: 1, deliveryMode: 1, price: 1, creditCost: 1 });
listingSchema.index({ title: "text", description: "text", learningOutcomes: "text" });

export default mongoose.model("Listing", listingSchema);
