import AdminAudit from "../models/AdminAudit.js";
import Booking from "../models/Booking.js";
import Community from "../models/Community.js";
import CreditTransaction from "../models/CreditTransaction.js";
import Dispute from "../models/Dispute.js";
import GroupSession from "../models/GroupSession.js";
import Listing from "../models/Listing.js";
import Message from "../models/Message.js";
import Report from "../models/Report.js";
import Review from "../models/Review.js";
import Session from "../models/Session.js";
import Skill from "../models/Skill.js";
import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { permissionsFor } from "../middlewares/role.js";
import { recalculateReputation } from "../services/reputationService.js";
import { createNotification } from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { escapeRegex } from "../utils/search.js";

const rank = { user: 0, mentor: 1, moderator: 2, admin: 3, super_admin: 4 };
const actorSnapshot = (req) => ({ actor: req.user._id, actorRole: req.user.role });
const audit = (req, input) => AdminAudit.create({ ...actorSnapshot(req), ...input });
const textSearch = (q, fields) => q ? { $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } })) } : {};

async function respondPage(res, query, countQuery, req) {
  const { page, limit, skip } = getPagination(req.query);
  const [data, total] = await Promise.all([query.skip(skip).limit(limit).lean(), countQuery]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
}

function assertManageable(actor, target, nextRole = target.role) {
  if (actor._id.toString() === target._id.toString()) throw new ApiError(400, "SELF_ADMIN_MUTATION", "Use account settings for your own account");
  if (rank[actor.role] <= rank[target.role] || rank[nextRole] >= rank[actor.role]) throw new ApiError(403, "ROLE_HIERARCHY_DENIED", "You cannot manage an account at or above your role");
}

export const getAccess = asyncHandler(async (req, res) => res.json({ success: true, data: { role: req.user.role, permissions: permissionsFor(req.user.role) } }));

export const getUsers = asyncHandler(async (req, res) => {
  const filter = { isDeleted: false, ...textSearch(req.query.q, ["name", "fullName", "username", "email"]) };
  if (req.query.blocked) filter.isBlocked = req.query.blocked === "true";
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  await respondPage(res, User.find(filter).select("name fullName username email profilePhoto profileImage role status isBlocked emailVerified createdAt lastActiveAt").sort("-createdAt"), User.countDocuments(filter), req);
});

async function setUserState(req, changes, action) {
  const target = await User.findById(req.params.id);
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  assertManageable(req.user, target, changes.role || target.role);
  const before = { role: target.role, status: target.status, isBlocked: target.isBlocked };
  Object.assign(target, changes); await target.save();
  const after = { role: target.role, status: target.status, isBlocked: target.isBlocked };
  await audit(req, { action, targetType: "user", targetId: target._id, before, after, note: req.body?.note || "" });
  return target;
}

export const updateUser = asyncHandler(async (req, res) => {
  if (req.body.role && !permissionsFor(req.user.role).includes("roles:write")) throw new ApiError(403, "ROLE_PERMISSION_DENIED", "Only a super administrator can change platform roles");
  const target = await setUserState(req, req.body.role ? { role: req.body.role } : { status: req.body.status, isBlocked: req.body.status === "suspended" }, req.body.role ? "role_changed" : "status_changed");
  res.json({ success: true, data: target, user: target });
});
export const blockUser = asyncHandler(async (req, res) => { const user = await setUserState(req, { isBlocked: true }, "account_blocked"); res.json({ success: true, data: user, user }); });
export const unblockUser = asyncHandler(async (req, res) => { const user = await setUserState(req, { isBlocked: false }, "account_unblocked"); res.json({ success: true, data: user, user }); });
export const deleteUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id); if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User not found"); assertManageable(req.user, target);
  const before = { role: target.role, status: target.status, email: target.email };
  target.isDeleted = true; target.status = "deactivated"; target.email = `deleted_${target._id}_${Date.now()}@deleted.invalid`; await target.save();
  await audit(req, { action: "account_soft_deleted", targetType: "user", targetId: target._id, before, after: { isDeleted: true, status: target.status }, note: req.body?.note || "" });
  res.json({ success: true, message: "User deleted" });
});

export const getSkills = asyncHandler(async (req, res) => {
  const filter = { ...textSearch(req.query.q, ["name", "description", "category"]) }; if (req.query.status) filter.status = req.query.status;
  await respondPage(res, Skill.find(filter).sort({ popularityScore: -1, createdAt: -1 }), Skill.countDocuments(filter), req);
});
export const updateSkill = asyncHandler(async (req, res) => {
  const target = await Skill.findById(req.params.id); if (!target) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found"); const before = { status: target.status };
  target.status = req.body.status; await target.save(); await audit(req, { action: "skill_status_changed", targetType: "skill", targetId: target._id, before, after: { status: target.status }, note: req.body.note });
  res.json({ success: true, data: target });
});

export const getListings = asyncHandler(async (req, res) => {
  const filter = { ...textSearch(req.query.q, ["title", "description"]) }; if (req.query.status) filter.status = req.query.status;
  await respondPage(res, Listing.find(filter).populate("owner", "name fullName username email").populate("skill", "name category").sort("-createdAt"), Listing.countDocuments(filter), req);
});
export const updateListing = asyncHandler(async (req, res) => {
  const target = await Listing.findById(req.params.id); if (!target) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found"); const before = { status: target.status };
  target.status = req.body.status; await target.save(); await audit(req, { action: "listing_moderated", targetType: "listing", targetId: target._id, before, after: { status: target.status }, note: req.body.note });
  res.json({ success: true, data: target });
});

export const getReports = asyncHandler(async (req, res) => {
  const filter = {}; if (req.query.status) filter.status = req.query.status;
  await respondPage(res, Report.find(filter).populate("reportedUserId reporter reportedBy assignedTo", "name fullName username email role").sort({ priority: -1, createdAt: 1 }), Report.countDocuments(filter), req);
});
export const getDisputes = asyncHandler(async (req, res) => {
  const filter = {}; if (req.query.status) filter.status = req.query.status;
  await respondPage(res, Dispute.find(filter).populate([{ path: "booking", populate: { path: "skill", select: "name category" } }, { path: "openedBy against assignedTo", select: "name fullName username email role" }]).sort("createdAt"), Dispute.countDocuments(filter), req);
});

export const getReviews = asyncHandler(async (req, res) => {
  const filter = {}; if (req.query.status) filter.moderationStatus = req.query.status;
  await respondPage(res, Review.find(filter).populate("reviewer reviewee", "name fullName username email").sort("-createdAt"), Review.countDocuments(filter), req);
});
export const updateReview = asyncHandler(async (req, res) => {
  const target = await Review.findById(req.params.id); if (!target) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found"); const before = { moderationStatus: target.moderationStatus };
  target.moderationStatus = req.body.status; target.moderatedBy = req.user._id; target.moderationNote = req.body.note; target.moderatedAt = new Date(); await target.save();
  await recalculateReputation(target.reviewee || target.recipient); await audit(req, { action: "review_moderated", targetType: "review", targetId: target._id, before, after: { moderationStatus: target.moderationStatus }, note: req.body.note });
  res.json({ success: true, data: target });
});

export const getCommunities = asyncHandler(async (req, res) => {
  const filter = { ...textSearch(req.query.q, ["name", "description", "category"]) }; if (req.query.status) filter.status = req.query.status;
  await respondPage(res, Community.find(filter).populate("owner", "name fullName username email").populate("skill", "name category").sort("-createdAt"), Community.countDocuments(filter), req);
});
export const updateCommunity = asyncHandler(async (req, res) => {
  const target = await Community.findById(req.params.id); if (!target) throw new ApiError(404, "COMMUNITY_NOT_FOUND", "Community not found"); const before = { status: target.status };
  target.status = req.body.status; await target.save(); await audit(req, { action: "community_moderated", targetType: "community", targetId: target._id, before, after: { status: target.status }, note: req.body.note });
  res.json({ success: true, data: target });
});

export const getSessions = asyncHandler(async (req, res) => {
  const Model = req.query.kind === "group" ? GroupSession : req.query.kind === "legacy" ? Session : Booking;
  const filter = {}; if (req.query.status) filter.status = req.query.kind === "legacy" ? req.query.status.toUpperCase() : req.query.status;
  let query = Model.find(filter).sort("-createdAt");
  if (req.query.kind === "group") query = query.populate("mentor", "name fullName username email").populate("skill", "name category");
  else if (req.query.kind === "legacy") query = query.populate("teacherId studentId", "name fullName username email");
  else query = query.populate("teacher student", "name fullName username email").populate("skill", "name category");
  await respondPage(res, query, Model.countDocuments(filter), req);
});

export const getTransactions = asyncHandler(async (req, res) => {
  const filter = {}; if (req.query.status) filter.type = req.query.status;
  await respondPage(res, CreditTransaction.find(filter).populate("user", "name fullName username email").sort("-createdAt"), CreditTransaction.countDocuments(filter), req);
});

export const getVerificationRequests = asyncHandler(async (req, res) => {
  const filter = { verificationStatus: req.query.status || "pending" };
  await respondPage(res, UserSkill.find(filter).populate("user", "name fullName username email role").populate("skill", "name category status").populate("verificationReviewedBy", "name fullName username").sort({ verificationRequestedAt: 1, createdAt: 1 }), UserSkill.countDocuments(filter), req);
});
export const updateVerificationRequest = asyncHandler(async (req, res) => {
  const target = await UserSkill.findById(req.params.id); if (!target) throw new ApiError(404, "VERIFICATION_REQUEST_NOT_FOUND", "Verification request not found");
  if (target.verificationStatus !== "pending") throw new ApiError(409, "VERIFICATION_ALREADY_REVIEWED", "Only pending requests can be reviewed");
  const before = { verificationStatus: target.verificationStatus }; target.verificationStatus = req.body.status; target.verificationNote = req.body.note; target.verificationReviewedBy = req.user._id; target.verificationReviewedAt = new Date(); await target.save();
  await audit(req, { action: "skill_verification_reviewed", targetType: "user_skill", targetId: target._id, before, after: { verificationStatus: target.verificationStatus }, note: req.body.note });
  await createNotification(target.user, { type: "system", title: "Skill verification updated", body: `Your skill verification was ${req.body.status}.`, link: "/profile", metadata: { userSkillId: target._id }, dedupeKey: `skill-verification:${target._id}:${req.body.status}` }).catch(() => {});
  res.json({ success: true, data: target });
});

export const getStats = asyncHandler(async (_req, res) => {
  const [userCount, activeUsers, skillCount, listingCount, bookingCount, groupSessionCount, reviewCount, reportCount, disputeCount, transactionCount, pendingVerifications, messageCount, swapCount, pendingSwaps, acceptedSwaps, completedSwaps] = await Promise.all([
    User.countDocuments({ isDeleted: false }), User.countDocuments({ isDeleted: false, status: "active", isBlocked: false }), Skill.countDocuments(), Listing.countDocuments(), Booking.countDocuments(), GroupSession.countDocuments(), Review.countDocuments({ moderationStatus: { $ne: "hidden" } }), Report.countDocuments({ status: { $in: ["submitted", "triaged", "in_review"] } }), Dispute.countDocuments({ status: { $in: ["open", "under_review"] } }), CreditTransaction.countDocuments(), UserSkill.countDocuments({ verificationStatus: "pending" }), Message.countDocuments(), SwapRequest.countDocuments(), SwapRequest.countDocuments({ status: "PENDING" }), SwapRequest.countDocuments({ status: "ACCEPTED" }), SwapRequest.countDocuments({ status: "COMPLETED" }),
  ]);
  res.json({ success: true, data: { userCount, activeUsers, skillCount, listingCount, bookingCount, groupSessionCount, reviewCount, openReports: reportCount, openDisputes: disputeCount, transactionCount, pendingVerifications, messageCount }, stats: { userCount, swapCount, pendingSwaps, acceptedSwaps, completedSwaps, reviewCount }, swapsByMonth: [], skillsOffered: [], skillsWanted: [] });
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 30); const since = new Date(Date.now() - days * 86400000);
  const [signups, bookings, completedBookings, messages, credits] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: since }, isDeleted: false }), Booking.countDocuments({ createdAt: { $gte: since } }), Booking.countDocuments({ completedAt: { $gte: since }, status: "completed" }), Message.countDocuments({ createdAt: { $gte: since } }), CreditTransaction.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, volume: { $sum: { $abs: "$amount" } } } }]),
  ]);
  res.json({ success: true, data: { rangeDays: days, signups, bookings, completedBookings, completionRate: bookings ? Math.round((completedBookings / bookings) * 10000) / 100 : 0, messages, creditVolume: credits[0]?.volume || 0 } });
});
