import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["link", "certificate", "portfolio", "other"], default: "link" },
    label: { type: String, trim: true, maxlength: 120, default: "" },
    url: { type: String, trim: true, maxlength: 500, required: true },
  },
  { _id: false }
);

const userSkillSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    type: { type: String, enum: ["teach", "learn", "both"], required: true },
    proficiency: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Beginner",
    },
    yearsExperience: { type: Number, default: 0, min: 0, max: 80 },
    teachingEnabled: { type: Boolean, default: false },
    learningEnabled: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    verificationRequestedAt: { type: Date, default: null },
    verificationReviewedAt: { type: Date, default: null },
    verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verificationNote: { type: String, trim: true, maxlength: 1000, default: "" },
    description: { type: String, default: "", maxlength: 2000 },
    evidence: [evidenceSchema],
  },
  { timestamps: true }
);

userSkillSchema.index({ user: 1, skill: 1 }, { unique: true });
userSkillSchema.index({ skill: 1, type: 1, proficiency: 1 });
userSkillSchema.index({ user: 1, teachingEnabled: 1 });
userSkillSchema.index({ user: 1, learningEnabled: 1 });

userSkillSchema.pre("validate", function (next) {
  if (this.type === "teach") {
    this.teachingEnabled = true;
    this.learningEnabled = false;
  } else if (this.type === "learn") {
    this.teachingEnabled = false;
    this.learningEnabled = true;
  } else if (this.type === "both") {
    this.teachingEnabled = true;
    this.learningEnabled = true;
  }
  next();
});

export default mongoose.model("UserSkill", userSkillSchema);
