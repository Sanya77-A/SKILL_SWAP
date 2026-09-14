import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { duplicateKeyIsConflict, syncLegacySkillArrays } from "../services/userSkillService.js";

const populatedSkillQuery = (filter) =>
  UserSkill.find(filter)
    .populate("skill", "name slug description category tags icon status popularityScore")
    .sort({ updatedAt: -1 });

export const getMySkills = asyncHandler(async (req, res) => {
  const data = await populatedSkillQuery({ user: req.user._id }).lean();
  res.json({ success: true, data, userSkills: data });
});

export const getUserSkills = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, isDeleted: false, isBlocked: false }).select("visibility");
  if (!user || user.visibility === "private") {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }
  const data = await populatedSkillQuery({ user: user._id }).lean();
  res.json({ success: true, data, userSkills: data });
});

export const addMySkill = asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.body.skillId, status: "active" });
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Active skill not found");

  try {
    const record = await UserSkill.create({
      user: req.user._id,
      skill: skill._id,
      type: req.body.type,
      proficiency: req.body.proficiency,
      yearsExperience: req.body.yearsExperience,
      description: req.body.description,
      evidence: req.body.evidence,
    });
    await syncLegacySkillArrays(req.user._id, skill._id);
    await record.populate("skill", "name slug description category tags icon status popularityScore");
    res.status(201).json({ success: true, data: record, userSkill: record });
  } catch (error) {
    if (duplicateKeyIsConflict(error)) {
      throw new ApiError(409, "USER_SKILL_EXISTS", "This skill is already on your profile");
    }
    throw error;
  }
});

export const updateMySkill = asyncHandler(async (req, res) => {
  const record = await UserSkill.findOne({ _id: req.params.id, user: req.user._id });
  if (!record) throw new ApiError(404, "USER_SKILL_NOT_FOUND", "Profile skill not found");
  Object.assign(record, req.body);
  if (["pending", "verified", "rejected"].includes(record.verificationStatus)) {
    record.verificationStatus = "unverified";
    record.verificationRequestedAt = null;
    record.verificationReviewedAt = null;
    record.verificationReviewedBy = null;
    record.verificationNote = "";
  }
  await record.save();
  await syncLegacySkillArrays(req.user._id, record.skill);
  await record.populate("skill", "name slug description category tags icon status popularityScore");
  res.json({ success: true, data: record, userSkill: record });
});

export const deleteMySkill = asyncHandler(async (req, res) => {
  const record = await UserSkill.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!record) throw new ApiError(404, "USER_SKILL_NOT_FOUND", "Profile skill not found");
  await syncLegacySkillArrays(req.user._id, record.skill);
  res.json({ success: true, message: "Skill removed from profile" });
});

export const requestVerification = asyncHandler(async (req, res) => {
  const record = await UserSkill.findOne({ _id: req.params.id, user: req.user._id }).populate("skill", "name slug category status");
  if (!record) throw new ApiError(404, "USER_SKILL_NOT_FOUND", "Profile skill not found");
  if (!record.teachingEnabled) throw new ApiError(409, "VERIFICATION_NOT_ELIGIBLE", "Only teaching skills can be verified");
  if (!record.evidence?.length) throw new ApiError(409, "VERIFICATION_EVIDENCE_REQUIRED", "Add at least one evidence link before requesting verification");
  if (record.verificationStatus === "verified") throw new ApiError(409, "ALREADY_VERIFIED", "This skill is already verified");
  record.verificationStatus = "pending";
  record.verificationRequestedAt = new Date();
  record.verificationReviewedAt = null;
  record.verificationReviewedBy = null;
  record.verificationNote = "";
  await record.save();
  res.json({ success: true, data: record });
});
