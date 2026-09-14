import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import Conversation from "../models/Conversation.js";
import Dispute from "../models/Dispute.js";
import Listing from "../models/Listing.js";
import Message from "../models/Message.js";
import ModerationAction from "../models/ModerationAction.js";
import Report from "../models/Report.js";
import Review from "../models/Review.js";
import SwapProposal from "../models/SwapProposal.js";
import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import UserBlock from "../models/UserBlock.js";
import { ApiError } from "../utils/ApiError.js";
import { refundBookingCredits } from "./creditService.js";
import { createNotification } from "./notificationService.js";

export async function isBlockedBetween(first, second) {
  return Boolean(await UserBlock.exists({ $or: [{ blocker: first, blocked: second }, { blocker: second, blocked: first }] }));
}
export async function blockedUserIds(userId) {
  if (!userId) return [];
  const records = await UserBlock.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).select("blocker blocked").lean();
  return records.map((record) => (
    record.blocker.toString() === userId.toString() ? record.blocked : record.blocker
  ));
}
export async function assertCanContact(first, second) {
  if (await isBlockedBetween(first, second)) throw new ApiError(403, "USER_CONTACT_BLOCKED", "Contact is unavailable between these members");
}
export async function blockMember(blocker, blocked, reason = "") {
  if (blocker.toString() === blocked.toString()) throw new ApiError(400, "SELF_BLOCK", "You cannot block yourself");
  if (!await User.exists({ _id: blocked, isDeleted: false })) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  let record;
  try { record = await UserBlock.create({ blocker, blocked, reason }); }
  catch (error) { if (error?.code !== 11000) throw error; record = await UserBlock.findOne({ blocker, blocked }); }
  await Promise.all([
    SwapProposal.updateMany({ status: { $in: ["draft", "pending", "countered"] }, $or: [{ requester: blocker, recipient: blocked }, { requester: blocked, recipient: blocker }] }, { status: "cancelled", actionRequiredBy: null }),
    SwapRequest.updateMany({ status: "PENDING", $or: [{ sender: blocker, receiver: blocked }, { sender: blocked, receiver: blocker }] }, { status: "CANCELED" }),
  ]);
  return record.populate("blocked", "name fullName username profilePhoto profileImage headline");
}
export async function unblockMember(blocker, blocked) {
  const result = await UserBlock.deleteOne({ blocker, blocked });
  if (!result.deletedCount) throw new ApiError(404, "BLOCK_NOT_FOUND", "Blocked member not found");
}
export const listBlocks = async (userId, { skip = 0, limit = 20 } = {}) => {
  const filter = { blocker: userId };
  const [data, total] = await Promise.all([
    UserBlock.find(filter).populate("blocked", "name fullName username profilePhoto profileImage headline").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserBlock.countDocuments(filter),
  ]);
  return { data, total };
};

async function reportTarget(reporter, type, id) {
  if (type === "user") {
    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) throw new ApiError(404, "REPORT_TARGET_NOT_FOUND", "Report target not found");
    return user._id;
  }
  if (type === "listing") {
    const listing = await Listing.findById(id).select("owner");
    if (!listing) throw new ApiError(404, "REPORT_TARGET_NOT_FOUND", "Report target not found");
    return listing.owner;
  }
  if (type === "message") {
    const message = await Message.findById(id).select("sender conversation");
    if (!message) throw new ApiError(404, "REPORT_TARGET_NOT_FOUND", "Report target not found");
    if (!await Conversation.exists({ _id: message.conversation, participants: reporter })) throw new ApiError(404, "REPORT_TARGET_NOT_FOUND", "Report target not found");
    return message.sender;
  }
  const review = await Review.findById(id).select("reviewer author");
  if (!review) throw new ApiError(404, "REPORT_TARGET_NOT_FOUND", "Report target not found");
  return review.reviewer || review.author;
}
export async function createSafetyReport(reporter, input) {
  const reportedUserId = await reportTarget(reporter, input.targetType, input.targetId);
  if (reportedUserId.toString() === reporter.toString()) throw new ApiError(400, "SELF_REPORT", "You cannot report your own content or account");
  const priority = ["safety", "harassment"].includes(input.category) ? "high" : "normal";
  try {
    const report = await Report.create({ reporter, reportedBy: reporter, reportedUserId, targetType: input.targetType, targetId: input.targetId, category: input.category, reason: input.reason, evidenceUrls: input.evidenceUrls, priority, history: [{ status: "submitted", actor: reporter, note: "Report submitted" }] });
    return { report, replayed: false };
  } catch (error) {
    if (error?.code === 11000) return { report: await Report.findOne({ reporter, targetType: input.targetType, targetId: input.targetId }), replayed: true };
    throw error;
  }
}
export const listMyReports = async (userId, { skip = 0, limit = 20 } = {}) => {
  const filter = { reporter: userId };
  const [data, total] = await Promise.all([
    Report.find(filter).populate("reportedUserId", "name fullName username profilePhoto").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Report.countDocuments(filter),
  ]);
  return { data, total };
};

const reportTransitions = { submitted: ["triaged", "dismissed"], triaged: ["in_review", "resolved", "dismissed"], in_review: ["resolved", "dismissed"] };
export async function moderateReport(admin, id, nextStatus, note) {
  const report = await Report.findById(id);
  if (!report) throw new ApiError(404, "REPORT_NOT_FOUND", "Report not found");
  if (!(reportTransitions[report.status] || []).includes(nextStatus)) throw new ApiError(409, "INVALID_MODERATION_TRANSITION", `Cannot move report from ${report.status} to ${nextStatus}`);
  const previous = report.status; report.status = nextStatus; report.assignedTo = admin;
  if (["resolved", "dismissed"].includes(nextStatus)) { report.resolution = note; report.resolvedAt = new Date(); }
  report.history.push({ status: nextStatus, actor: admin, note }); await report.save();
  await ModerationAction.create({ actor: admin, targetType: "report", targetId: report._id, action: "status_change", previousStatus: previous, nextStatus, note });
  await createNotification(report.reporter, { type: "system", title: "Report status updated", body: `Your report is now ${nextStatus.replace("_", " ")}.`, link: "/safety", metadata: { reportId: report._id }, dedupeKey: `report:${report._id}:${nextStatus}` }).catch(() => {});
  return report;
}

export async function openDispute(userId, bookingId, input) {
  const booking = await Booking.findOne({ _id: bookingId, status: { $in: ["confirmed", "upcoming", "in_progress"] }, $or: [{ teacher: userId }, { student: userId }] });
  if (!booking) throw new ApiError(409, "DISPUTE_NOT_ELIGIBLE", "Only an active confirmed session can be disputed");
  const against = booking.teacher.toString() === userId.toString() ? booking.student : booking.teacher;
  let dispute;
  try { dispute = await Dispute.create({ booking: booking._id, openedBy: userId, against, category: input.category, description: input.description, evidenceUrls: input.evidenceUrls, previousBookingStatus: booking.status, history: [{ status: "open", actor: userId, note: "Dispute opened" }] }); }
  catch (error) { if (error?.code === 11000) throw new ApiError(409, "DISPUTE_EXISTS", "This booking already has a dispute"); throw error; }
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { $set: { status: "disputed", confirmationRequiredBy: null } },
    { new: true }
  );
  if (!claimed) {
    await Dispute.deleteOne({ _id: dispute._id });
    throw new ApiError(409, "DISPUTE_STATE_CHANGED", "The booking changed before the dispute could be opened");
  }
  await createNotification(against, { type: "system", title: "Session disputed", body: "A participant opened a dispute for this session.", link: "/safety", priority: "high", metadata: { disputeId: dispute._id, bookingId: booking._id }, dedupeKey: `dispute:${dispute._id}:opened` }).catch(() => {});
  return dispute.populate([{ path: "booking", populate: [{ path: "skill", select: "name slug category" }, { path: "teacher student", select: "name fullName username profilePhoto" }] }, { path: "openedBy against", select: "name fullName username profilePhoto" }]);
}
export const listMyDisputes = async (userId, { skip = 0, limit = 20 } = {}) => {
  const filter = { $or: [{ openedBy: userId }, { against: userId }] };
  const [data, total] = await Promise.all([
    Dispute.find(filter).populate([{ path: "booking", populate: { path: "skill", select: "name slug category" } }, { path: "openedBy against", select: "name fullName username profilePhoto" }]).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Dispute.countDocuments(filter),
  ]);
  return { data, total };
};
export const listModerationReports = async (filter = {}, { skip = 0, limit = 20 } = {}) => {
  const [data, total] = await Promise.all([
    Report.find(filter).populate("reporter reportedUserId assignedTo", "name fullName username email role").sort({ priority: -1, createdAt: 1 }).skip(skip).limit(limit).lean(),
    Report.countDocuments(filter),
  ]);
  return { data, total };
};
export const listModerationDisputes = async (filter = {}, { skip = 0, limit = 20 } = {}) => {
  const [data, total] = await Promise.all([
    Dispute.find(filter).populate([{ path: "booking", populate: { path: "skill", select: "name slug category" } }, { path: "openedBy against assignedTo", select: "name fullName username email role" }]).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    Dispute.countDocuments(filter),
  ]);
  return { data, total };
};

const disputeTransitions = { open: ["under_review", "resolved_refund", "resolved_no_action", "dismissed"], under_review: ["resolved_refund", "resolved_no_action", "dismissed"] };
export async function moderateDispute(admin, id, nextStatus, note) {
  const dispute = await Dispute.findById(id);
  if (!dispute) throw new ApiError(404, "DISPUTE_NOT_FOUND", "Dispute not found");
  if (!(disputeTransitions[dispute.status] || []).includes(nextStatus)) throw new ApiError(409, "INVALID_MODERATION_TRANSITION", `Cannot move dispute from ${dispute.status} to ${nextStatus}`);
  const previous = dispute.status; dispute.status = nextStatus; dispute.assignedTo = admin; dispute.history.push({ status: nextStatus, actor: admin, note });
  const booking = await Booking.findById(dispute.booking);
  if (nextStatus === "resolved_refund") {
    if (booking) {
      const disputedStatus = booking.status;
      booking.status = "cancelled"; booking.cancelReason = note; booking.cancelledBy = admin;
      await booking.save();
      try {
        await refundBookingCredits(booking);
        await BookingSlot.deleteMany({ booking: booking._id });
      } catch (error) {
        booking.status = disputedStatus;
        booking.cancelReason = "";
        booking.cancelledBy = null;
        await booking.save().catch(() => {});
        throw error;
      }
    }
    dispute.resolution = note; dispute.resolvedAt = new Date();
  }
  else if (["resolved_no_action", "dismissed"].includes(nextStatus)) { if (booking?.status === "disputed") { booking.status = dispute.previousBookingStatus; await booking.save(); } dispute.resolution = note; dispute.resolvedAt = new Date(); }
  await dispute.save();
  await ModerationAction.create({ actor: admin, targetType: "dispute", targetId: dispute._id, action: "status_change", previousStatus: previous, nextStatus, note });
  await Promise.all([dispute.openedBy, dispute.against].map((user) => createNotification(user, { type: "system", title: "Dispute status updated", body: `The dispute is now ${nextStatus.replaceAll("_", " ")}.`, link: "/safety", metadata: { disputeId: dispute._id }, dedupeKey: `dispute:${dispute._id}:${nextStatus}:user:${user}` }).catch(() => {})));
  return dispute;
}
