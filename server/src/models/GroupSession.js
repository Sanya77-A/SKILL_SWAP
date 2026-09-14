import mongoose from "mongoose";

const groupSessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
  community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", default: null },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  duration: { type: Number, required: true, min: 15, max: 480 },
  timezone: { type: String, required: true, trim: true, maxlength: 100 },
  capacity: { type: Number, required: true, min: 2, max: 500 },
  participantCount: { type: Number, min: 0, default: 0 },
  creditCost: { type: Number, min: 0, default: 0 },
  price: { type: Number, min: 0, default: 0 },
  currency: { type: String, uppercase: true, trim: true, minlength: 3, maxlength: 3, default: "USD" },
  mode: { type: String, enum: ["video", "in_person", "hybrid"], required: true },
  meetingUrl: { type: String, trim: true, maxlength: 500, default: "" },
  locationDetails: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["draft", "published", "full", "in_progress", "completed", "cancelled"], default: "draft" },
}, { timestamps: true, optimisticConcurrency: true });

groupSessionSchema.index({ status: 1, startAt: 1 });
groupSessionSchema.index({ mentor: 1, status: 1, startAt: -1 });
groupSessionSchema.index({ skill: 1, status: 1, startAt: 1 });
groupSessionSchema.pre("validate", function (next) {
  const expectedEnd = new Date(this.startAt).getTime() + this.duration * 60000;
  if (Math.abs(new Date(this.endAt).getTime() - expectedEnd) > 1000) this.invalidate("endAt", "End time must match start time plus duration");
  if (this.mode === "video" && !this.meetingUrl) this.invalidate("meetingUrl", "Video sessions require a meeting URL");
  if (this.mode === "in_person" && !this.locationDetails) this.invalidate("locationDetails", "In-person sessions require location details");
  next();
});
export default mongoose.model("GroupSession", groupSessionSchema);
