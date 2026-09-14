import Challenge from "../models/Challenge.js";
import ChallengeDayCompletion from "../models/ChallengeDayCompletion.js";
import ChallengeEnrollment from "../models/ChallengeEnrollment.js";
import XPTransaction from "../models/XPTransaction.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { abandonChallenge, completeChallengeDay, createChallenge, enrollChallenge, publishChallenge } from "../services/challengeService.js";

const isAdmin = (user) => ["admin", "super_admin"].includes(user.role);
export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status: isAdmin(req.user) && req.query.status ? req.query.status : "published", ...(req.query.skillId && { skill: req.query.skillId }) };
  const [data, total, enrollments] = await Promise.all([Challenge.find(filter).populate("skill", "name slug category icon").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Challenge.countDocuments(filter), ChallengeEnrollment.find({ user: req.user._id }).lean()]);
  const byChallenge = new Map(enrollments.map((item) => [item.challenge.toString(), item]));
  res.json({ success: true, ...paginatedResponse(data.map((item) => ({ ...item, myEnrollment: byChallenge.get(item._id.toString()) || null })), total, page, limit) });
});
export const create = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await createChallenge(req.user._id, req.body) }));
export const publish = asyncHandler(async (req, res) => res.json({ success: true, data: await publishChallenge(req.params.id) }));
export const detail = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findOne({ _id: req.params.id, ...(isAdmin(req.user) ? {} : { status: "published" }) }).populate("skill", "name slug category icon").lean();
  if (!challenge) throw new ApiError(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
  const enrollment = await ChallengeEnrollment.findOne({ challenge: challenge._id, user: req.user._id }).lean();
  const completions = enrollment ? await ChallengeDayCompletion.find({ enrollment: enrollment._id }).sort({ day: 1 }).lean() : [];
  res.json({ success: true, data: { ...challenge, myEnrollment: enrollment, myCompletions: completions } });
});
export const enroll = asyncHandler(async (req, res) => res.json({ success: true, data: await enrollChallenge(req.user._id, req.params.id) }));
export const completeDay = asyncHandler(async (req, res) => res.json({ success: true, data: await completeChallengeDay(req.user._id, req.params.id, req.params.day, req.body) }));
export const abandon = asyncHandler(async (req, res) => res.json({ success: true, data: await abandonChallenge(req.user._id, req.params.id) }));
export const myEnrollments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [data, total] = await Promise.all([ChallengeEnrollment.find({ user: req.user._id }).populate({ path: "challenge", populate: { path: "skill", select: "name slug category icon" } }).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(), ChallengeEnrollment.countDocuments({ user: req.user._id })]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});
export const myXp = asyncHandler(async (req, res) => {
  const [summary, recent] = await Promise.all([XPTransaction.aggregate([{ $match: { user: req.user._id } }, { $group: { _id: null, total: { $sum: "$points" }, events: { $sum: 1 } } }]), XPTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).lean()]);
  res.json({ success: true, data: { totalXp: summary[0]?.total || 0, events: summary[0]?.events || 0, recent } });
});
