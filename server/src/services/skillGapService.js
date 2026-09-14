import CareerPath from "../models/CareerPath.js";
import SkillGapAnalysis from "../models/SkillGapAnalysis.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { serializePublicUser } from "../serializers/userSerializer.js";
import { ApiError } from "../utils/ApiError.js";
import { aiService } from "./ai/aiService.js";
import { blockedUserIds } from "./safetyService.js";

export const PROFICIENCY_RANK = Object.freeze({ Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 });

const requiredSort = (left, right) => {
  if (left.importance !== right.importance) return left.importance === "core" ? -1 : 1;
  return left.order - right.order;
};

const gapRecord = (requirement, current, priority) => ({
  skill: requirement.skill._id,
  name: requirement.skill.name,
  currentProficiency: current?.proficiency || "None",
  requiredProficiency: requirement.minimumProficiency,
  importance: requirement.importance,
  rationale: requirement.rationale || "",
  priority,
});

const mentorScore = (record, requirement) => {
  const proficiency = PROFICIENCY_RANK[record.proficiency] || 1;
  const minimum = PROFICIENCY_RANK[requirement.minimumProficiency] || 1;
  const experience = Math.min(15, Math.round((Number(record.yearsExperience) || 0) * 2));
  const proficiencyFit = Math.min(50, 30 + Math.max(0, proficiency - minimum) * 10);
  const reputation = Math.min(25, Math.round(((Number(record.user.ratingAvg) || 0) / 5) * 25));
  const verified = record.verificationStatus === "verified" ? 10 : 0;
  return Math.min(100, proficiencyFit + experience + reputation + verified);
};

const mentorReasons = (record) => [
  `${record.proficiency} proficiency in ${record.skill.name}`,
  ...(record.yearsExperience ? [`${record.yearsExperience} year${record.yearsExperience === 1 ? "" : "s"} experience`] : []),
  ...(record.verificationStatus === "verified" ? ["Verified skill evidence"] : []),
  ...(record.user.ratingCount ? [`${Number(record.user.ratingAvg).toFixed(1)} rating from ${record.user.ratingCount} review${record.user.ratingCount === 1 ? "" : "s"}`] : []),
].slice(0, 4);

export async function findMentorsForRequirements(userId, requirements) {
  if (!requirements.length) return [];
  const excluded = await blockedUserIds(userId);
  const requirementBySkill = new Map(requirements.map((item) => [item.skill._id.toString(), item]));
  const records = await UserSkill.find({
    user: { $nin: [userId, ...excluded] },
    skill: { $in: requirements.map((item) => item.skill._id) },
    teachingEnabled: true,
  })
    .populate({
      path: "user",
      match: { role: { $in: ["user", "mentor"] }, isDeleted: false, isBlocked: false, status: "active", profileVisibility: { $ne: "private" } },
      select: "name fullName username profileImage profilePhoto headline location timezone languages availability experienceLevel ratingAvg ratingCount skillScore profileVisibility visibility role createdAt",
    })
    .populate("skill", "name category")
    .lean();

  const eligible = records.filter((record) => record.user && record.skill).map((record) => {
    const requirement = requirementBySkill.get(record.skill._id.toString());
    return {
      user: record.user._id,
      publicUser: serializePublicUser(record.user),
      skill: record.skill._id,
      skillName: record.skill.name,
      suitabilityScore: mentorScore(record, requirement),
      reasons: mentorReasons(record),
    };
  });
  return eligible.sort((left, right) => right.suitabilityScore - left.suitabilityScore).slice(0, 8);
}

const deterministicNarrative = (careerPath, missing, weak) => {
  if (!missing.length && !weak.length) return `Your recorded skills meet the current ${careerPath.title} framework. Keep the evidence and proficiency levels current as the framework evolves.`;
  const parts = [];
  if (missing.length) parts.push(`${missing.length} missing skill${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 4).map((item) => item.name).join(", ")}`);
  if (weak.length) parts.push(`${weak.length} skill${weak.length === 1 ? " is" : "s are"} below the target level: ${weak.slice(0, 4).map((item) => item.name).join(", ")}`);
  return `For ${careerPath.title}, ${parts.join(". ")}. Start with the highest-priority core skill and update your actual proficiency only when you have supporting evidence.`;
};

export async function analyzeSkillGap(userId, careerPathId) {
  const [user, careerPath, actualRecords] = await Promise.all([
    User.findById(userId).lean(),
    CareerPath.findOne({ _id: careerPathId, status: "active" }).populate("requiredSkills.skill", "name slug category status").lean(),
    UserSkill.find({ user: userId }).populate("skill", "name slug category status").lean(),
  ]);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  if (!careerPath || careerPath.requiredSkills.some((item) => !item.skill || item.skill.status !== "active")) {
    throw new ApiError(404, "CAREER_PATH_NOT_FOUND", "Active career path not found");
  }

  const requirements = [...careerPath.requiredSkills].sort(requiredSort);
  const actualBySkill = new Map(actualRecords.filter((item) => item.skill).map((item) => [item.skill._id.toString(), item]));
  const missing = [];
  const weak = [];
  requirements.forEach((requirement, index) => {
    const current = actualBySkill.get(requirement.skill._id.toString());
    const record = gapRecord(requirement, current, index + 1);
    if (!current) missing.push(record);
    else if ((PROFICIENCY_RANK[current.proficiency] || 0) < PROFICIENCY_RANK[requirement.minimumProficiency]) weak.push(record);
  });
  const recommended = [...missing, ...weak].sort((left, right) => left.priority - right.priority);
  const mentorResults = await findMentorsForRequirements(userId, recommended.map((gap) => requirements.find((item) => item.skill._id.toString() === gap.skill.toString())));
  let generatedNarrative = deterministicNarrative(careerPath, missing, weak);
  let narrativeProvider = "grounded_fallback";
  if (aiService.provider !== "disabled") {
    try {
      const result = await aiService.generate({
        userInput: `Explain my verified skill gap for the ${careerPath.title} career goal and suggest a practical next step.`,
        intent: "skill_gap_analysis",
        context: {
          user,
          skills: actualRecords,
          skillGap: {
            careerGoal: careerPath.title,
            missingSkills: missing,
            weakSkills: weak,
            recommendedNextSkills: recommended,
          },
        },
        maxOutputTokens: 500,
      });
      generatedNarrative = result.data;
      narrativeProvider = result.provider;
    } catch {
      // Deterministic analysis remains available when an optional AI provider fails.
    }
  }

  const analysis = await SkillGapAnalysis.create({
    user: userId,
    careerPath: careerPath._id,
    careerPathTitle: careerPath.title,
    careerPathVersion: careerPath.version,
    actualSkillSnapshot: actualRecords.filter((item) => item.skill).map((item) => ({
      userSkill: item._id,
      skill: item.skill._id,
      name: item.skill.name,
      type: item.type,
      proficiency: item.proficiency,
      proficiencyRank: PROFICIENCY_RANK[item.proficiency],
      verificationStatus: item.verificationStatus,
    })),
    requiredSkillSnapshot: requirements.map((item) => ({
      skill: item.skill._id,
      name: item.skill.name,
      minimumProficiency: item.minimumProficiency,
      minimumRank: PROFICIENCY_RANK[item.minimumProficiency],
      importance: item.importance,
      rationale: item.rationale || "",
      order: item.order,
    })),
    currentSkills: actualRecords.filter((item) => item.skill).map((item) => item.skill._id),
    missingSkills: missing,
    weakSkills: weak,
    recommendedNextSkills: recommended,
    mentorRecommendations: mentorResults.map(({ publicUser, ...record }) => record),
    generatedNarrative,
    narrativeProvider,
  });
  const value = analysis.toObject();
  value.mentorRecommendations = value.mentorRecommendations.map((item) => ({
    ...item,
    mentor: mentorResults.find((result) => result.user.toString() === item.user.toString())?.publicUser,
  }));
  return value;
}

export async function getOwnedAnalysis(userId, analysisId) {
  const analysis = await SkillGapAnalysis.findOne({ _id: analysisId, user: userId }).lean();
  if (!analysis) throw new ApiError(404, "SKILL_GAP_NOT_FOUND", "Skill-gap analysis not found");
  const excluded = await blockedUserIds(userId);
  const users = await User.find({ _id: { $in: analysis.mentorRecommendations.map((item) => item.user), $nin: excluded }, role: { $in: ["user", "mentor"] }, isDeleted: false, isBlocked: false, status: "active", profileVisibility: { $ne: "private" } }).lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), serializePublicUser(user)]));
  return { ...analysis, mentorRecommendations: analysis.mentorRecommendations.map((item) => ({ ...item, mentor: usersById.get(item.user.toString()) || null })) };
}
