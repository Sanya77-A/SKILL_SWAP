import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const calculateProfileCompleteness = (profile) => {
  const completenessFields = [
    profile.fullName || profile.name,
    profile.username,
    profile.profilePhoto || profile.profileImage,
    profile.headline,
    profile.bio,
    profile.location,
    profile.timezone,
    profile.languages?.length,
    profile.skillsOffered?.length || profile.skillsWanted?.length,
    profile.availability?.length,
  ];
  return Math.round((completenessFields.filter(Boolean).length / completenessFields.length) * 100);
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fullName: { type: String, trim: true, default: "" },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    bio: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    profileImagePublicId: { type: String, default: "", select: false },
    headline: { type: String, default: "", maxlength: 160 },
    occupation: { type: String, default: "", maxlength: 120 },
    company: { type: String, default: "", maxlength: 120 },
    university: { type: String, default: "", maxlength: 160 },
    location: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    languages: [{ type: String, trim: true }],
    website: { type: String, default: "" },
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    portfolioLinks: [
      {
        label: { type: String, trim: true, maxlength: 80 },
        url: { type: String, trim: true, maxlength: 500 },
        _id: false,
      },
    ],
    availability: [{ type: String }],
    visibility: { type: String, enum: ["public", "members", "private"], default: "members" },
    profileVisibility: { type: String, enum: ["public", "members", "private"], default: "members" },
    locationVisibility: { type: String, enum: ["public", "members", "private"], default: "public" },
    showOnlineStatus: { type: Boolean, default: true },
    showLastActive: { type: Boolean, default: true },
    messagePermissions: { type: String, enum: ["everyone", "matches", "no_one"], default: "matches" },
    preferredLearningMode: { type: String, enum: ["online", "in_person", "hybrid"], default: "online" },
    preferredTeachingMode: { type: String, enum: ["online", "in_person", "hybrid"], default: "online" },
    preferredLearningModes: [{ type: String, enum: ["online", "in_person", "hybrid"] }],
    preferredTeachingModes: [{ type: String, enum: ["online", "in_person", "hybrid"] }],
    preferredExchangeModels: {
      type: [{ type: String, enum: ["exchange", "credits", "paid"] }],
      default: ["exchange"],
    },
    maxCreditCost: { type: Number, default: null, min: 0 },
    maxSessionPrice: { type: Number, default: null, min: 0 },
    preferredCurrency: { type: String, uppercase: true, trim: true, default: "USD", minlength: 3, maxlength: 3 },
    accessibilityPreferences: {
      reducedMotion: { type: Boolean, default: false },
      highContrast: { type: Boolean, default: false },
    },
    learningGoals: [{ type: String, trim: true, maxlength: 300 }],
    onboardingCompleted: { type: Boolean, default: false },
    profileCompleteness: { type: Number, default: 0, min: 0, max: 100 },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate",
    },
    skillsOffered: [{ type: String, trim: true }],
    skillsWanted: [{ type: String, trim: true }],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    reputation: {
      communication: { type: Number, default: 0, min: 0, max: 5 },
      knowledge: { type: Number, default: 0, min: 0, max: 5 },
      teaching: { type: Number, default: 0, min: 0, max: 5 },
      punctuality: { type: Number, default: 0, min: 0, max: 5 },
      professionalism: { type: Number, default: 0, min: 0, max: 5 },
      overall: { type: Number, default: 0, min: 0, max: 5 },
      wouldLearnAgainRate: { type: Number, default: 0, min: 0, max: 100 },
      updatedAt: { type: Date, default: null },
    },
    sessionsCompleted: { type: Number, default: 0, min: 0 },
    responseTimeMinutes: { type: Number, default: null, min: 0 },
    skillScore: { type: Number, default: 0, min: 0, max: 100 },
    verificationBadges: [
      {
        key: { type: String, required: true, trim: true, maxlength: 80 },
        label: { type: String, required: true, trim: true, maxlength: 120 },
        verifiedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    achievements: [
      {
        key: { type: String, required: true, trim: true, maxlength: 80 },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, default: "", maxlength: 500 },
        icon: { type: String, default: "", maxlength: 100 },
        earnedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    role: {
      type: String,
      enum: ["user", "mentor", "moderator", "admin", "super_admin"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "suspended", "deactivated"],
      default: "active",
    },
    isBlocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastActiveAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ skillsOffered: 1 });
userSchema.index({ skillsWanted: 1 });
userSchema.index({ ratingAvg: -1 });
userSchema.index({ location: 1 });
userSchema.index({ isDeleted: 1, isBlocked: 1 });
userSchema.index({ status: 1, role: 1 });
userSchema.index({ name: "text", skillsOffered: "text", skillsWanted: "text" });

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.profileImagePublicId;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  return obj;
};

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.pre("validate", function (next) {
  if (!this.fullName) this.fullName = this.name;
  if (!this.name) this.name = this.fullName;
  if (!this.profilePhoto && this.profileImage) this.profilePhoto = this.profileImage;
  if (!this.profileImage && this.profilePhoto) this.profileImage = this.profilePhoto;
  if (this.isModified("visibility") && !this.isModified("profileVisibility")) this.profileVisibility = this.visibility;
  if (this.isModified("profileVisibility") && !this.isModified("visibility")) this.visibility = this.profileVisibility;
  if (!this.preferredLearningModes?.length && this.preferredLearningMode) this.preferredLearningModes = [this.preferredLearningMode];
  if (!this.preferredTeachingModes?.length && this.preferredTeachingMode) this.preferredTeachingModes = [this.preferredTeachingMode];

  if (!this.lastActive) this.lastActive = this.lastActiveAt || new Date();
  this.profileCompleteness = calculateProfileCompleteness(this);
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

export default mongoose.model("User", userSchema);
