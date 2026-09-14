import Challenge from "../models/Challenge.js";
import ChallengeBadgeGrant from "../models/ChallengeBadgeGrant.js";
import ChallengeDayCompletion from "../models/ChallengeDayCompletion.js";
import ChallengeEnrollment from "../models/ChallengeEnrollment.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import XPTransaction from "../models/XPTransaction.js";
import { ApiError } from "../utils/ApiError.js";
import { applyCredit } from "./creditService.js";
import { calculateLearningStreak } from "./learningService.js";
import { createNotification } from "./notificationService.js";
import { createActivity } from "./activityService.js";

const DAY_MS = 86400000;
const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function createChallenge(userId, payload) {
  if (!await Skill.exists({ _id: payload.skillId, status: "active" })) throw new ApiError(404, "SKILL_NOT_FOUND", "Active challenge skill not found");
  const totalDailyXp = payload.dailyTasks.reduce((sum, task) => sum + task.xp, 0);
  if (payload.completionBonusXp > totalDailyXp || payload.rewardCredits > payload.durationDays * 10) throw new ApiError(400, "UNBOUNDED_CHALLENGE_REWARD", "Challenge rewards exceed the documented rules");
  try { return await Challenge.create({ ...payload, slug: payload.slug || toSlug(payload.title), skill: payload.skillId, createdBy: userId }); }
  catch (error) { if (error?.code === 11000) throw new ApiError(409, "CHALLENGE_EXISTS", "A challenge with this slug already exists"); throw error; }
}
export async function publishChallenge(id) {
  const challenge = await Challenge.findOneAndUpdate({ _id: id, status: "draft" }, { status: "published" }, { new: true, runValidators: true });
  if (!challenge) throw new ApiError(409, "INVALID_CHALLENGE_STATE", "Only a draft challenge can be published");
  return challenge;
}
export async function enrollChallenge(userId, id) {
  const now = new Date();
  const challenge = await Challenge.findOne({ _id: id, status: "published", $and: [{ $or: [{ enrollmentOpensAt: null }, { enrollmentOpensAt: { $lte: now } }] }, { $or: [{ enrollmentClosesAt: null }, { enrollmentClosesAt: { $gt: now } }] }] });
  if (!challenge) throw new ApiError(409, "CHALLENGE_ENROLLMENT_CLOSED", "Challenge enrollment is not open");
  const existing = await ChallengeEnrollment.findOne({ challenge: id, user: userId });
  if (existing) return { enrollment: existing, replayed: true };
  let enrollment;
  try { enrollment = await ChallengeEnrollment.create({ challenge: id, user: userId, startedAt: now, targetEndAt: new Date(now.getTime() + challenge.durationDays * DAY_MS) }); }
  catch (error) { if (error?.code === 11000) return { enrollment: await ChallengeEnrollment.findOne({ challenge: id, user: userId }), replayed: true }; throw error; }
  await Challenge.updateOne({ _id: id }, { $inc: { enrollmentCount: 1 } });
  return { enrollment, replayed: false };
}
async function ensureXp(input) {
  const existing = await XPTransaction.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return existing;
  try { return await XPTransaction.create(input); }
  catch (error) { if (error?.code === 11000) return XPTransaction.findOne({ idempotencyKey: input.idempotencyKey }); throw error; }
}
async function finalizeChallenge(enrollment, challenge) {
  const completedCount = await ChallengeDayCompletion.countDocuments({ enrollment: enrollment._id });
  if (completedCount !== challenge.durationDays) return;
  if (challenge.completionBonusXp > 0) await ensureXp({ user: enrollment.user, challenge: challenge._id, enrollment: enrollment._id, points: challenge.completionBonusXp, type: "completion_bonus", reason: `Completed ${challenge.title}`, idempotencyKey: `challenge:${challenge._id}:user:${enrollment.user}:completion-xp` });
  if (challenge.rewardCredits > 0) await applyCredit({ userId: enrollment.user, amount: challenge.rewardCredits, type: "achievement", idempotencyKey: `challenge:${challenge._id}:user:${enrollment.user}:credits`, relatedEntity: { kind: "achievement", id: challenge._id }, description: `Completed ${challenge.title}` });
  let grant = await ChallengeBadgeGrant.findOne({ user: enrollment.user, challenge: challenge._id });
  if (!grant) {
    try { grant = await ChallengeBadgeGrant.create({ user: enrollment.user, challenge: challenge._id, enrollment: enrollment._id, badgeKey: challenge.badge.key, title: challenge.badge.title, description: challenge.badge.description, icon: challenge.badge.icon }); }
    catch (error) { if (error?.code !== 11000) throw error; grant = await ChallengeBadgeGrant.findOne({ user: enrollment.user, challenge: challenge._id }); }
    if (grant) await User.updateOne({ _id: enrollment.user, "achievements.key": { $ne: challenge.badge.key } }, { $push: { achievements: { key: challenge.badge.key, title: challenge.badge.title, description: challenge.badge.description, icon: challenge.badge.icon, earnedAt: grant.grantedAt } } });
  }
  const xp = (await XPTransaction.aggregate([{ $match: { enrollment: enrollment._id } }, { $group: { _id: null, total: { $sum: "$points" } } }]))[0]?.total || 0;
  const completed = await ChallengeEnrollment.findOneAndUpdate({ _id: enrollment._id, status: "active" }, { status: "completed", completedAt: new Date(), progress: 100, progressDays: challenge.durationDays, xp, rewardGranted: true, badgeGranted: true }, { new: true });
  if (completed) {
    await Challenge.updateOne({ _id: challenge._id }, { $inc: { completionCount: 1 } });
    await createNotification(enrollment.user, {
      type: "badge",
      title: `${challenge.badge.title} earned`,
      body: `You completed ${challenge.title} with ${xp} XP${challenge.rewardCredits ? ` and ${challenge.rewardCredits} SkillCredits` : ""}.`,
      link: "/challenges",
      metadata: { challengeId: challenge._id, enrollmentId: enrollment._id, badgeKey: challenge.badge.key },
      dedupeKey: `challenge:${challenge._id}:user:${enrollment.user}:completed`,
    }).catch(() => {});
    await createActivity({ actor: enrollment.user, type: "challenge_completed", title: `Completed ${challenge.title}`, body: `Earned ${xp} XP${challenge.rewardCredits ? ` and ${challenge.rewardCredits} SkillCredits` : ""}.`, link: "/challenges", skill: challenge.skill, entityType: "challenge", entityId: challenge._id, visibility: "members", metadata: { xp, rewardCredits: challenge.rewardCredits, badgeKey: challenge.badge.key }, dedupeKey: `challenge:${challenge._id}:user:${enrollment.user}:activity` }).catch(() => {});
  }
}
export async function completeChallengeDay(userId, challengeId, day, payload, now = new Date()) {
  const [challenge, enrollment] = await Promise.all([Challenge.findOne({ _id: challengeId, status: "published" }), ChallengeEnrollment.findOne({ challenge: challengeId, user: userId })]);
  if (!challenge) throw new ApiError(404, "CHALLENGE_NOT_FOUND", "Published challenge not found");
  if (!enrollment || enrollment.status !== "active") throw new ApiError(409, "CHALLENGE_NOT_ACTIVE", "You do not have an active enrollment");
  const task = challenge.dailyTasks.find((item) => item.day === day);
  if (!task) throw new ApiError(404, "CHALLENGE_DAY_NOT_FOUND", "Challenge day not found");
  const completions = await ChallengeDayCompletion.find({ enrollment: enrollment._id }).sort({ day: 1 });
  const existing = completions.find((item) => item.day === day);
  if (existing) { await finalizeChallenge(enrollment, challenge); return { completion: existing, enrollment: await ChallengeEnrollment.findById(enrollment._id), replayed: true }; }
  if (day !== completions.length + 1) throw new ApiError(409, "CHALLENGE_DAYS_SEQUENTIAL", "Complete challenge days in sequence");
  const unlockAt = new Date(enrollment.startedAt.getTime() + (day - 1) * DAY_MS);
  if (now < unlockAt) throw new ApiError(409, "CHALLENGE_DAY_LOCKED", `Day ${day} unlocks on ${unlockAt.toISOString()}`);
  if (task.evidenceRequired && !payload.evidenceUrl) throw new ApiError(400, "CHALLENGE_EVIDENCE_REQUIRED", "This task requires an evidence URL");
  const activityDay = dayKey(now);
  if (completions.some((item) => item.activityDay === activityDay)) throw new ApiError(409, "ONE_CHALLENGE_TASK_PER_DAY", "Only one challenge day can be completed per UTC day");
  let completion;
  try { completion = await ChallengeDayCompletion.create({ enrollment: enrollment._id, challenge: challengeId, user: userId, day, taskTitle: task.title, evidenceUrl: payload.evidenceUrl, note: payload.note, activityDay, xpAwarded: task.xp, completedAt: now }); }
  catch (error) { if (error?.code === 11000) throw new ApiError(409, "CHALLENGE_COMPLETION_CONFLICT", "This challenge day or activity date is already complete"); throw error; }
  await ensureXp({ user: userId, challenge: challengeId, enrollment: enrollment._id, points: task.xp, type: "daily_completion", reason: `Day ${day}: ${task.title}`, idempotencyKey: `challenge:${challengeId}:user:${userId}:day:${day}` });
  const all = [...completions, completion];
  const streak = calculateLearningStreak(all.map((item) => `${item.activityDay}T12:00:00.000Z`), now);
  const xp = (await XPTransaction.aggregate([{ $match: { enrollment: enrollment._id } }, { $group: { _id: null, total: { $sum: "$points" } } }]))[0]?.total || 0;
  await ChallengeEnrollment.updateOne({ _id: enrollment._id }, { progressDays: all.length, progress: Math.round((all.length / challenge.durationDays) * 100), currentStreak: streak.current, longestStreak: streak.longest, xp });
  await finalizeChallenge(enrollment, challenge);
  return { completion, enrollment: await ChallengeEnrollment.findById(enrollment._id), replayed: false };
}

export async function abandonChallenge(userId, challengeId) {
  const enrollment = await ChallengeEnrollment.findOneAndUpdate({ challenge: challengeId, user: userId, status: "active" }, { status: "abandoned", currentStreak: 0 }, { new: true });
  if (!enrollment) throw new ApiError(409, "CHALLENGE_NOT_ACTIVE", "You do not have an active enrollment");
  return enrollment;
}
