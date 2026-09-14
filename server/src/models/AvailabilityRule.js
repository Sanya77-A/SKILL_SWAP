import mongoose from "mongoose";

const availabilityRuleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timezone: { type: String, required: true, trim: true, maxlength: 100 },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    modes: [{ type: String, enum: ["video", "audio", "in_person"] }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

availabilityRuleSchema.index({ user: 1, dayOfWeek: 1, startTime: 1, endTime: 1 }, { unique: true });
availabilityRuleSchema.index({ user: 1, isActive: 1, dayOfWeek: 1 });

export default mongoose.model("AvailabilityRule", availabilityRuleSchema);
