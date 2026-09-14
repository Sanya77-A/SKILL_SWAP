import mongoose from "mongoose";

const actualSkillSchema = new mongoose.Schema(
  {
    userSkill: { type: mongoose.Schema.Types.ObjectId, ref: "UserSkill", required: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["teach", "learn", "both"], required: true },
    proficiency: { type: String, enum: ["Beginner", "Intermediate", "Advanced", "Expert"], required: true },
    proficiencyRank: { type: Number, min: 1, max: 4, required: true },
    verificationStatus: { type: String, enum: ["unverified", "pending", "verified", "rejected"], required: true },
  },
  { _id: false }
);

const requiredSkillSnapshotSchema = new mongoose.Schema(
  {
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    name: { type: String, required: true },
    minimumProficiency: { type: String, enum: ["Beginner", "Intermediate", "Advanced", "Expert"], required: true },
    minimumRank: { type: Number, min: 1, max: 4, required: true },
    importance: { type: String, enum: ["core", "supporting"], required: true },
    rationale: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const gapSkillSchema = new mongoose.Schema(
  {
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    name: { type: String, required: true },
    currentProficiency: { type: String, enum: ["None", "Beginner", "Intermediate", "Advanced", "Expert"], required: true },
    requiredProficiency: { type: String, enum: ["Beginner", "Intermediate", "Advanced", "Expert"], required: true },
    importance: { type: String, enum: ["core", "supporting"], required: true },
    rationale: { type: String, default: "" },
    priority: { type: Number, min: 1, required: true },
  },
  { _id: false }
);

const mentorRecommendationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    skillName: { type: String, required: true },
    suitabilityScore: { type: Number, min: 0, max: 100, required: true },
    reasons: [{ type: String, maxlength: 180 }],
  },
  { _id: false }
);

const skillGapAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    careerPath: { type: mongoose.Schema.Types.ObjectId, ref: "CareerPath", required: true, index: true },
    careerPathTitle: { type: String, required: true },
    careerPathVersion: { type: Number, required: true, min: 1 },
    actualSkillSnapshot: [actualSkillSchema],
    requiredSkillSnapshot: [requiredSkillSnapshotSchema],
    currentSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
    missingSkills: [gapSkillSchema],
    weakSkills: [gapSkillSchema],
    recommendedNextSkills: [gapSkillSchema],
    mentorRecommendations: [mentorRecommendationSchema],
    generatedNarrative: { type: String, maxlength: 6000, default: "" },
    narrativeProvider: { type: String, maxlength: 80, default: "grounded_fallback" },
  },
  { timestamps: true }
);

skillGapAnalysisSchema.index({ user: 1, careerPath: 1, createdAt: -1 });

export default mongoose.model("SkillGapAnalysis", skillGapAnalysisSchema);
