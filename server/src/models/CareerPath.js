import mongoose from "mongoose";

const requiredSkillSchema = new mongoose.Schema(
  {
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    minimumProficiency: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Beginner",
    },
    importance: { type: String, enum: ["core", "supporting"], default: "core" },
    rationale: { type: String, trim: true, maxlength: 500, default: "" },
    order: { type: Number, min: 0, max: 1000, default: 0 },
  },
  { _id: false }
);

const careerPathSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    requiredSkills: { type: [requiredSkillSchema], validate: [(value) => value.length > 0, "At least one required skill is required"] },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    version: { type: Number, min: 1, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

careerPathSchema.index({ status: 1, title: 1 });
careerPathSchema.pre("validate", function (next) {
  const skillIds = this.requiredSkills.map((item) => item.skill?.toString()).filter(Boolean);
  if (new Set(skillIds).size !== skillIds.length) this.invalidate("requiredSkills", "A skill may appear only once in a career path");
  next();
});

export default mongoose.model("CareerPath", careerPathSchema);
