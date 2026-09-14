import Listing from "../models/Listing.js";
import MatchCache from "../models/MatchCache.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { serializePublicUser } from "../serializers/userSerializer.js";
import { blockedUserIds } from "./safetyService.js";

const WEIGHTS = Object.freeze({
  skill: 30,
  mutualSkill: 12,
  availability: 12,
  timezone: 6,
  location: 5,
  language: 8,
  goals: 7,
  experience: 8,
  preferences: 5,
  reputation: 5,
  price: 2,
});

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const normalized = (value) => String(value || "").trim().toLowerCase();
const normalizedSet = (values = []) => new Set(values.map(normalized).filter(Boolean));
const intersection = (left, right) => [...left].filter((value) => right.has(value));
const jaccardScore = (left, right, missingScore = 50) => {
  if (!left.size || !right.size) return missingScore;
  const overlap = intersection(left, right).length;
  return clamp((overlap / new Set([...left, ...right]).size) * 100);
};

const recordName = (record) => normalized(record.skill?.name || record.skillName || record.name);
const teaches = (user, records = []) => normalizedSet([
  ...(user.skillsOffered || []),
  ...records.filter((record) => record.teachingEnabled || ["teach", "both"].includes(record.type)).map(recordName),
]);
const learns = (user, records = []) => normalizedSet([
  ...(user.skillsWanted || []),
  ...records.filter((record) => record.learningEnabled || ["learn", "both"].includes(record.type)).map(recordName),
]);

export function calculateSkillMatch(currentUser, targetUser, context = {}) {
  const wanted = learns(currentUser, context.currentSkills);
  const offered = teaches(targetUser, context.targetSkills);
  if (!wanted.size) return 50;
  return clamp((intersection(wanted, offered).length / wanted.size) * 100);
}

export function calculateMutualSkillMatch(currentUser, targetUser, context = {}) {
  const myTeaching = teaches(currentUser, context.currentSkills);
  const theirLearning = learns(targetUser, context.targetSkills);
  if (!myTeaching.size || !theirLearning.size) return 0;
  return clamp((intersection(myTeaching, theirLearning).length / Math.min(myTeaching.size, theirLearning.size)) * 100);
}

export function calculateAvailabilityMatch(currentUser, targetUser) {
  return jaccardScore(normalizedSet(currentUser.availability), normalizedSet(targetUser.availability));
}

const timezoneOffset = (timezone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
      hour: "2-digit",
    }).formatToParts(new Date());
    const label = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;
    return (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
  } catch {
    return null;
  }
};

export function calculateTimezoneMatch(currentUser, targetUser) {
  if (!currentUser.timezone || !targetUser.timezone) return 50;
  if (currentUser.timezone === targetUser.timezone) return 100;
  const currentOffset = timezoneOffset(currentUser.timezone);
  const targetOffset = timezoneOffset(targetUser.timezone);
  if (currentOffset == null || targetOffset == null) return 50;
  const differenceHours = Math.abs(currentOffset - targetOffset) / 60;
  return clamp(100 - differenceHours * 10);
}

export function calculateLanguageMatch(currentUser, targetUser) {
  return jaccardScore(normalizedSet(currentUser.languages), normalizedSet(targetUser.languages));
}

export function calculateGoalMatch(currentUser, targetUser, context = {}) {
  const goalTokens = normalizedSet((currentUser.learningGoals || []).flatMap((goal) => normalized(goal).split(/\W+/)));
  if (!goalTokens.size) return 50;
  const targetText = [
    targetUser.headline,
    targetUser.bio,
    ...teaches(targetUser, context.targetSkills),
    ...(context.targetSkills || []).map((record) => record.description),
  ].filter(Boolean).join(" ");
  const targetTokens = normalizedSet(normalized(targetText).split(/\W+/));
  return clamp((intersection(goalTokens, targetTokens).length / goalTokens.size) * 100);
}

export function calculateLocationMatch(currentUser, targetUser) {
  if (!currentUser.location || !targetUser.location) return 50;
  return normalized(currentUser.location) === normalized(targetUser.location) ? 100 : 20;
}

export function calculateExperienceMatch(currentUser, targetUser, context = {}) {
  const levels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const targetRecords = (context.targetSkills || []).filter((record) => record.teachingEnabled || ["teach", "both"].includes(record.type));
  const recordLevel = Math.max(0, ...targetRecords.map((record) => levels[normalized(record.proficiency)] || 0));
  const targetLevel = recordLevel || levels[normalized(targetUser.experienceLevel)] || 2;
  const learnerLevel = levels[normalized(currentUser.experienceLevel)] || 1;
  return targetLevel >= learnerLevel ? 100 : clamp((targetLevel / learnerLevel) * 100);
}

export function calculatePreferenceMatch(currentUser, targetUser) {
  const learningModes = normalizedSet(currentUser.preferredLearningModes?.length ? currentUser.preferredLearningModes : [currentUser.preferredLearningMode]);
  const teachingModes = normalizedSet(targetUser.preferredTeachingModes?.length ? targetUser.preferredTeachingModes : [targetUser.preferredTeachingMode]);
  return jaccardScore(learningModes, teachingModes);
}

export function calculateReputationMatch(_currentUser, targetUser) {
  const rating = Math.min(5, Math.max(0, Number(targetUser.ratingAvg) || 0));
  const confidence = Math.min(1, (Number(targetUser.ratingCount) || 0) / 10);
  const rawRatingScore = (rating / 5) * 100;
  const ratingScore = rating
    ? rawRatingScore * (0.5 + confidence * 0.5) + 50 * (0.5 - confidence * 0.5)
    : 40;
  const skillScore = Number(targetUser.skillScore) || 0;
  return clamp(skillScore ? ratingScore * 0.75 + skillScore * 0.25 : ratingScore);
}

export function calculatePriceMatch(currentUser, _targetUser, context = {}) {
  const listings = context.targetListings || [];
  if (!listings.length) return 50;
  const models = new Set(currentUser.preferredExchangeModels?.length ? currentUser.preferredExchangeModels : ["exchange"]);
  const compatible = listings.map((listing) => {
    if (models.has("exchange") && listing.exchangeEnabled) return 100;
    if (models.has("credits") && listing.creditsEnabled) {
      return currentUser.maxCreditCost == null || listing.creditCost <= currentUser.maxCreditCost ? 100 : 20;
    }
    if (models.has("paid") && listing.paidEnabled) {
      return currentUser.maxSessionPrice == null || listing.price <= currentUser.maxSessionPrice ? 100 : 20;
    }
    return 0;
  });
  return Math.max(...compatible);
}

export function generateMatchReasons(factors) {
  return Object.values(factors)
    .filter((factor) => factor.score >= 60)
    .sort((left, right) => (right.score * right.weight) - (left.score * left.weight))
    .slice(0, 5)
    .map((factor) => factor.detail);
}

export function calculateOverallMatch(currentUser, targetUser, context = {}) {
  const scores = {
    skill: calculateSkillMatch(currentUser, targetUser, context),
    mutualSkill: calculateMutualSkillMatch(currentUser, targetUser, context),
    availability: calculateAvailabilityMatch(currentUser, targetUser),
    timezone: calculateTimezoneMatch(currentUser, targetUser),
    location: calculateLocationMatch(currentUser, targetUser),
    language: calculateLanguageMatch(currentUser, targetUser),
    goals: calculateGoalMatch(currentUser, targetUser, context),
    experience: calculateExperienceMatch(currentUser, targetUser, context),
    preferences: calculatePreferenceMatch(currentUser, targetUser),
    reputation: calculateReputationMatch(currentUser, targetUser),
    price: calculatePriceMatch(currentUser, targetUser, context),
  };
  const labels = {
    skill: "Teaches a skill you want", mutualSkill: "Mutual skill match", availability: "Availability overlap",
    timezone: "Timezone compatible", location: "Location compatible", language: "Shared language",
    goals: "Aligned learning goals", experience: "Experience fits your level", preferences: "Learning modes align",
    reputation: "High rating and reputation", price: "Compatible booking model",
  };
  const factors = Object.fromEntries(Object.entries(scores).map(([key, score]) => [key, {
    score: clamp(score), weight: WEIGHTS[key], detail: labels[key],
  }]));
  const matchScore = clamp(Object.values(factors).reduce((sum, factor) => sum + factor.score * factor.weight, 0) / 100);
  const strengths = Object.values(factors).filter((factor) => factor.score >= 75).map((factor) => factor.detail);
  const conflicts = Object.values(factors).filter((factor) => factor.score <= 25).map((factor) => factor.detail);
  return { matchScore, factors, strengths, conflicts, reasons: generateMatchReasons(factors) };
}

/** Compatibility export for the existing API and callers. */
export function calculateMatchScore(currentUser, targetUser, context = {}) {
  return calculateOverallMatch(currentUser, targetUser, context);
}

const profileFields = "name fullName username profileImage profilePhoto headline bio location locationVisibility showLastActive timezone languages availability experienceLevel preferredLearningMode preferredTeachingMode preferredLearningModes preferredTeachingModes preferredExchangeModels maxCreditCost maxSessionPrice learningGoals skillsOffered skillsWanted ratingAvg ratingCount skillScore lastActive updatedAt visibility profileVisibility";
const MATCH_CACHE_TTL_MS = 5 * 60 * 1000;

async function readFreshMatchCache(userId) {
  const cutoff = new Date(Date.now() - MATCH_CACHE_TTL_MS);
  const newest = await MatchCache.findOne({ userId }).select("updatedAt").sort({ updatedAt: -1 }).lean();
  if (!newest || newest.updatedAt < cutoff) return null;
  const cached = await MatchCache.find({ userId, updatedAt: { $gte: cutoff } })
    .populate({
      path: "matchedUserId",
      match: { isDeleted: false, isBlocked: false, status: "active", profileVisibility: { $ne: "private" } },
      select: profileFields,
    })
    .sort({ matchScore: -1 })
    .lean();
  const excluded = new Set((await blockedUserIds(userId)).map(String));
  return cached.filter((item) => item.matchedUserId && !excluded.has(item.matchedUserId._id.toString())).map((item) => ({
    user: serializePublicUser(item.matchedUserId, { viewerAuthenticated: true }),
    matchScore: item.matchScore,
    reasons: item.reasons || [],
    factors: item.factors || {},
    strengths: item.strengths || [],
    conflicts: item.conflicts || [],
  }));
}

async function buildMatches(userId) {
  const currentUser = await User.findById(userId).select(profileFields).lean();
  if (!currentUser) return [];
  const currentSkills = await UserSkill.find({ user: userId }).populate("skill", "name description category tags").lean();
  const wantedSkillIds = currentSkills.filter((record) => record.learningEnabled).map((record) => record.skill?._id).filter(Boolean);
  const canonicalTeacherIds = wantedSkillIds.length
    ? await UserSkill.distinct("user", { skill: { $in: wantedSkillIds }, teachingEnabled: true })
    : [];
  const legacyWanted = [...learns(currentUser, currentSkills)];
  const legacyPatterns = legacyWanted.map((value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  const excluded = await blockedUserIds(userId);
  const candidateFilter = {
    _id: { $ne: userId, ...(excluded.length ? { $nin: excluded } : {}) },
    isDeleted: false,
    isBlocked: false,
    status: "active",
    role: { $in: ["user", "mentor"] },
    profileVisibility: { $ne: "private" },
    ...(canonicalTeacherIds.length || legacyPatterns.length ? {
      $or: [
        ...(canonicalTeacherIds.length ? [{ _id: { $in: canonicalTeacherIds } }] : []),
        ...(legacyPatterns.length ? [{ skillsOffered: { $in: legacyPatterns } }] : []),
      ],
    } : {}),
  };
  const candidates = await User.find(candidateFilter).select(profileFields).lean();
  const candidateIds = candidates.map((candidate) => candidate._id);
  const [skillRecords, listings] = await Promise.all([
    UserSkill.find({ user: { $in: candidateIds } }).populate("skill", "name description category tags").lean(),
    Listing.find({ owner: { $in: candidateIds }, status: "published" }).select("owner skill exchangeEnabled creditsEnabled paidEnabled creditCost price currency deliveryMode").lean(),
  ]);
  const skillsByUser = new Map();
  const listingsByUser = new Map();
  for (const record of skillRecords) {
    const key = record.user.toString();
    skillsByUser.set(key, [...(skillsByUser.get(key) || []), record]);
  }
  for (const listing of listings) {
    const key = listing.owner.toString();
    listingsByUser.set(key, [...(listingsByUser.get(key) || []), listing]);
  }
  return candidates.map((target) => {
    const key = target._id.toString();
    const privacySafeTarget = target.locationVisibility === "private" ? { ...target, location: "" } : target;
    const result = calculateOverallMatch(currentUser, privacySafeTarget, {
      currentSkills,
      targetSkills: skillsByUser.get(key) || [],
      targetListings: listingsByUser.get(key) || [],
    });
    return { user: serializePublicUser(target, { viewerAuthenticated: true }), ...result };
  }).sort((left, right) => right.matchScore - left.matchScore);
}

export async function recomputeMatchCacheForUser(userId) {
  const matches = await buildMatches(userId);
  await MatchCache.deleteMany({ userId, matchedUserId: { $nin: matches.map((match) => match.user._id) } });
  if (matches.length) {
    await MatchCache.bulkWrite(matches.map((match) => ({
      updateOne: {
        filter: { userId, matchedUserId: match.user._id },
        update: { $set: { matchScore: match.matchScore, reasons: match.reasons, factors: match.factors, strengths: match.strengths, conflicts: match.conflicts } },
        upsert: true,
      },
    })));
  }
  return matches;
}

export async function recomputeAllMatchCaches() {
  const users = await User.find({ isDeleted: false, isBlocked: false, status: "active" }).select("_id").lean();
  for (const user of users) await recomputeMatchCacheForUser(user._id);
}

export async function getMatches(userId, options = {}) {
  const { page = 1, limit = 20, experienceLevel, availability } = options;
  let matches = await readFreshMatchCache(userId);
  if (matches === null) matches = await recomputeMatchCacheForUser(userId);
  if (experienceLevel) matches = matches.filter((match) => match.user.experienceLevel === experienceLevel);
  if (availability?.length) {
    const wanted = normalizedSet(availability);
    matches = matches.filter((match) => intersection(wanted, normalizedSet(match.user.availability)).length > 0);
  }
  const total = matches.length;
  const skip = (page - 1) * limit;
  return {
    data: matches.slice(skip, skip + limit),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}
