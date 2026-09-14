import mongoose from "mongoose";

const dailyTaskSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1, max: 365 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    evidenceRequired: { type: Boolean, default: false },
    xp: { type: Number, required: true, min: 1, max: 1000 },
  },
  { _id: false }
);

const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    durationDays: { type: Number, required: true, min: 2, max: 365 },
    dailyTasks: { type: [dailyTaskSchema], validate: [(value) => value.length >= 2 && value.length <= 365, "A challenge requires 2-365 daily tasks"] },
    completionBonusXp: { type: Number, min: 0, max: 10000, default: 0 },
    rewardCredits: { type: Number, min: 0, max: 100000, default: 0 },
    badge: {
      key: { type: String, required: true, trim: true, maxlength: 80 },
      title: { type: String, required: true, trim: true, maxlength: 120 },
      description: { type: String, trim: true, maxlength: 500, default: "" },
      icon: { type: String, trim: true, maxlength: 100, default: "" },
    },
    enrollmentOpensAt: { type: Date, default: null },
    enrollmentClosesAt: { type: Date, default: null },
    status: { type: String, enum: ["draft", "published", "ended", "archived"], default: "draft" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    enrollmentCount: { type: Number, min: 0, default: 0 },
    completionCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);
challengeSchema.index({ status: 1, enrollmentClosesAt: 1, createdAt: -1 });
challengeSchema.index({ skill: 1, status: 1 });
challengeSchema.pre("validate", function (next) {
  if (this.dailyTasks.length !== this.durationDays) this.invalidate("dailyTasks", "Daily task count must equal durationDays");
  const days = this.dailyTasks.map((task) => task.day).sort((a, b) => a - b);
  if (days.some((day, index) => day !== index + 1)) this.invalidate("dailyTasks", "Daily task days must be sequential from 1");
  if (this.enrollmentOpensAt && this.enrollmentClosesAt && this.enrollmentClosesAt <= this.enrollmentOpensAt) this.invalidate("enrollmentClosesAt", "Enrollment close must be after open");
  next();
});
export default mongoose.model("Challenge", challengeSchema);
