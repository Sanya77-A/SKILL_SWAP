import GroupSession from "../models/GroupSession.js";
import GroupSessionEnrollment from "../models/GroupSessionEnrollment.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import CreditTransaction from "../models/CreditTransaction.js";
import { ApiError } from "../utils/ApiError.js";
import { applyCredit } from "./creditService.js";

export async function createGroupSession(userId, payload) {
  const [user, skill, teaching] = await Promise.all([User.findById(userId).lean(), Skill.findOne({ _id: payload.skillId, status: "active" }).lean(), UserSkill.exists({ user: userId, skill: payload.skillId, teachingEnabled: true })]);
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Active skill not found");
  if (!user || (!["mentor", "admin", "super_admin"].includes(user.role) && !teaching)) throw new ApiError(403, "MENTOR_REQUIRED", "A verified teaching profile is required to host group sessions");
  if (new Date(payload.startAt) <= new Date()) throw new ApiError(400, "FUTURE_START_REQUIRED", "Group session must start in the future");
  const session = await GroupSession.create({ ...payload, mentor: userId, skill: payload.skillId, community: payload.communityId || null, endAt: new Date(new Date(payload.startAt).getTime() + payload.duration * 60000) });
  return session.populate(["skill", { path: "mentor", select: "name fullName username profilePhoto headline ratingAvg" }]);
}
export async function transitionGroupSession(userId, id, action) {
  const session = await GroupSession.findOne({ _id: id, mentor: userId });
  if (!session) throw new ApiError(404, "GROUP_SESSION_NOT_FOUND", "Group session not found");
  if (action === "publish") {
    if (session.status !== "draft") throw new ApiError(409, "INVALID_GROUP_SESSION_STATE", "Only draft sessions can be published");
    session.status = session.participantCount >= session.capacity ? "full" : "published";
  } else if (action === "cancel") {
    if (!["draft", "published", "full"].includes(session.status)) throw new ApiError(409, "INVALID_GROUP_SESSION_STATE", "This group session cannot be cancelled");
    const enrollments = await GroupSessionEnrollment.find({ groupSession: id, status: "enrolled" });
    for (const enrollment of enrollments) {
      if (enrollment.creditAmount > 0 && await CreditTransaction.exists({ idempotencyKey: `group-session:${id}:participant:${enrollment.participant}:spend` })) {
        await applyCredit({ userId: enrollment.participant, amount: enrollment.creditAmount, type: "booking_refund", idempotencyKey: `group-session:${id}:participant:${enrollment.participant}:refund`, relatedEntity: { kind: "group_session", id }, description: `Refund for cancelled ${session.title}` });
      }
    }
    await GroupSessionEnrollment.updateMany({ groupSession: id, status: "enrolled" }, { status: "cancelled", cancelledAt: new Date() });
    session.participantCount = 0;
    session.status = "cancelled";
  } else if (action === "start") {
    if (!["published", "full"].includes(session.status) || session.startAt > new Date()) throw new ApiError(409, "INVALID_GROUP_SESSION_STATE", "This group session cannot be started yet");
    session.status = "in_progress";
  } else if (action === "complete") {
    if (session.status !== "in_progress" || session.endAt > new Date()) throw new ApiError(409, "INVALID_GROUP_SESSION_STATE", "This group session cannot be completed yet");
    const enrollments = await GroupSessionEnrollment.find({ groupSession: id, status: "enrolled" });
    const reward = enrollments.reduce((sum, item) => sum + item.creditAmount, 0);
    if (reward > 0) await applyCredit({ userId, amount: reward, type: "teaching_reward", idempotencyKey: `group-session:${id}:reward`, relatedEntity: { kind: "group_session", id }, description: `Teaching reward for ${session.title}` });
    await GroupSessionEnrollment.updateMany({ groupSession: id, status: "enrolled" }, { status: "attended" });
    session.status = "completed";
  } else {
    throw new ApiError(400, "INVALID_GROUP_SESSION_ACTION", "Unsupported group-session action");
  }
  await session.save();
  return session;
}
export async function enrollGroupSession(userId, id) {
  const current = await GroupSession.findById(id).lean();
  if (!current) throw new ApiError(404, "GROUP_SESSION_NOT_FOUND", "Group session not found");
  if (current.mentor.toString() === userId.toString()) throw new ApiError(400, "MENTOR_CANNOT_ENROLL", "Hosts cannot enroll in their own session");
  if (current.price > 0) throw new ApiError(409, "PAYMENT_REQUIRED", "Paid group-session checkout is not available until payment setup is complete");
  const existing = await GroupSessionEnrollment.findOne({ groupSession: id, participant: userId });
  if (existing?.status === "enrolled") return { enrollment: existing, replayed: true };
  let claim;
  if (existing) claim = await GroupSessionEnrollment.findOneAndUpdate({ _id: existing._id, status: "cancelled" }, { $set: { status: "pending", cancelledAt: null } }, { new: true });
  else {
    try { claim = await GroupSessionEnrollment.create({ groupSession: id, participant: userId, status: "pending" }); }
    catch (error) {
      if (error?.code === 11000) throw new ApiError(409, "ENROLLMENT_IN_PROGRESS", "Enrollment is already being processed");
      throw error;
    }
  }
  if (!claim) throw new ApiError(409, "ENROLLMENT_IN_PROGRESS", "Enrollment is already being processed");
  const session = await GroupSession.findOneAndUpdate({ _id: id, status: "published", startAt: { $gt: new Date() }, $expr: { $lt: ["$participantCount", "$capacity"] } }, { $inc: { participantCount: 1 } }, { new: true });
  if (!session) { claim.status = "cancelled"; claim.cancelledAt = new Date(); await claim.save(); throw new ApiError(409, "GROUP_SESSION_UNAVAILABLE", "Session is closed, started, or full"); }
  let enrollment;
  try {
    enrollment = claim;
    enrollment.status = "enrolled"; enrollment.creditAmount = session.creditCost; enrollment.paymentAmount = 0; enrollment.enrolledAt = new Date(); enrollment.cancelledAt = null; await enrollment.save();
    if (session.creditCost > 0) await applyCredit({ userId, amount: -session.creditCost, type: "booking_spend", idempotencyKey: `group-session:${id}:participant:${userId}:spend`, relatedEntity: { kind: "group_session", id }, description: `Enrollment in ${session.title}` });
  } catch (error) {
    claim.status = "cancelled"; claim.cancelledAt = new Date(); await claim.save().catch(() => {});
    await GroupSession.updateOne({ _id: id, participantCount: { $gt: 0 } }, { $inc: { participantCount: -1 } });
    throw error;
  }
  if (session.participantCount >= session.capacity) await GroupSession.updateOne({ _id: id }, { status: "full" });
  return { enrollment, replayed: false };
}
export async function cancelEnrollment(userId, id) {
  const enrollment = await GroupSessionEnrollment.findOne({ groupSession: id, participant: userId, status: "enrolled" });
  if (!enrollment) throw new ApiError(404, "ENROLLMENT_NOT_FOUND", "Active enrollment not found");
  const session = await GroupSession.findById(id);
  if (!session || session.startAt <= new Date()) throw new ApiError(409, "CANCELLATION_CLOSED", "Enrollment can no longer be cancelled");
  enrollment.status = "cancelled"; enrollment.cancelledAt = new Date(); await enrollment.save();
  await GroupSession.updateOne({ _id: id, participantCount: { $gt: 0 } }, { $inc: { participantCount: -1 }, ...(session.status === "full" && { $set: { status: "published" } }) });
  if (enrollment.creditAmount > 0 && await CreditTransaction.exists({ idempotencyKey: `group-session:${id}:participant:${userId}:spend` })) await applyCredit({ userId, amount: enrollment.creditAmount, type: "booking_refund", idempotencyKey: `group-session:${id}:participant:${userId}:refund`, relatedEntity: { kind: "group_session", id }, description: `Refund for ${session.title}` });
  return enrollment;
}
