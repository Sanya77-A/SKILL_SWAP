import Activity from "../models/Activity.js";
import ActivityComment from "../models/ActivityComment.js";
import ActivityLike from "../models/ActivityLike.js";
import ActivitySave from "../models/ActivitySave.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { blockedUserIds } from "./safetyService.js";

const safePrefixes = ["/certificates", "/verify/certificate", "/challenges", "/listing", "/roadmaps", "/communities", "/group-sessions", "/user"];
const isSafeLink = (link) => link?.startsWith("/") && !link.startsWith("//") && safePrefixes.some((prefix) => link === prefix || link.startsWith(`${prefix}/`) || link.startsWith(`${prefix}?`));
const populateActivity = (query) => query.populate("actor", "name fullName username profilePhoto profileImage headline role").populate("skill", "name slug category icon");

export async function createActivity(input) {
  if (!isSafeLink(input.link)) throw new Error("Activity link must use an approved internal path");
  const existing = await Activity.findOne({ dedupeKey: input.dedupeKey });
  if (existing) {
    if (existing.status === "hidden") { existing.status = "active"; existing.occurredAt = new Date(); await existing.save(); }
    return existing;
  }
  try { return await Activity.create(input); }
  catch (error) { if (error?.code === 11000) return Activity.findOne({ dedupeKey: input.dedupeKey }); throw error; }
}
export const hideActivity = (dedupeKey) => Activity.updateOne({ dedupeKey }, { status: "hidden" });

async function readableActorIds(userId) {
  const excluded = await blockedUserIds(userId);
  return User.distinct("_id", { _id: { $nin: excluded }, isDeleted: false, isBlocked: false, status: "active", $or: [{ profileVisibility: { $ne: "private" } }, { _id: userId }] });
}
export async function requireReadableActivity(activityId, userId) {
  const actors = await readableActorIds(userId);
  const activity = await Activity.findOne({ _id: activityId, actor: { $in: actors }, status: "active" });
  if (!activity) throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found");
  return activity;
}
export async function listFeed(userId, { page, limit, type, saved }) {
  const actors = await readableActorIds(userId);
  let savedIds = null;
  if (saved) savedIds = await ActivitySave.distinct("activity", { user: userId });
  const filter = { actor: { $in: actors }, status: "active", ...(type && { type }), ...(savedIds && { _id: { $in: savedIds } }) };
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([populateActivity(Activity.find(filter).sort({ occurredAt: -1, _id: -1 }).skip(skip).limit(limit)).lean(), Activity.countDocuments(filter)]);
  const ids = data.map((item) => item._id);
  const [likes, saves] = await Promise.all([ActivityLike.distinct("activity", { activity: { $in: ids }, user: userId }), ActivitySave.distinct("activity", { activity: { $in: ids }, user: userId })]);
  const liked = new Set(likes.map(String)); const savedSet = new Set(saves.map(String));
  return { data: data.map((item) => ({ ...item, liked: liked.has(item._id.toString()), saved: savedSet.has(item._id.toString()) })), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
}

async function setEngagement(Model, field, activityId, userId, enabled) {
  await requireReadableActivity(activityId, userId);
  if (enabled) {
    try { await Model.create({ activity: activityId, user: userId }); await Activity.updateOne({ _id: activityId }, { $inc: { [field]: 1 } }); }
    catch (error) { if (error?.code !== 11000) throw error; }
  } else {
    const result = await Model.deleteOne({ activity: activityId, user: userId });
    if (result.deletedCount) await Activity.updateOne({ _id: activityId, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
  }
  return populateActivity(Activity.findById(activityId)).lean();
}
export const setLike = (activityId, userId, enabled) => setEngagement(ActivityLike, "likeCount", activityId, userId, enabled);
export const setSave = (activityId, userId, enabled) => setEngagement(ActivitySave, "saveCount", activityId, userId, enabled);

export async function listComments(activityId, userId, { page, limit }) {
  await requireReadableActivity(activityId, userId);
  const excluded = await blockedUserIds(userId);
  const skip = (page - 1) * limit; const filter = { activity: activityId, status: "active", author: { $nin: excluded } };
  const [data, total] = await Promise.all([ActivityComment.find(filter).populate("author", "name fullName username profilePhoto profileImage headline role").sort({ createdAt: 1 }).skip(skip).limit(limit).lean(), ActivityComment.countDocuments(filter)]);
  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
}
export async function addComment(activityId, userId, body) {
  await requireReadableActivity(activityId, userId);
  const comment = await ActivityComment.create({ activity: activityId, author: userId, body });
  await Activity.updateOne({ _id: activityId }, { $inc: { commentCount: 1 } });
  return comment.populate("author", "name fullName username profilePhoto profileImage headline role");
}
export async function removeComment(commentId, user) {
  const filter = { _id: commentId, status: "active", ...(!["moderator", "admin", "super_admin"].includes(user.role) && { author: user._id }) };
  const comment = await ActivityComment.findOneAndUpdate(filter, { status: "removed", removedAt: new Date() }, { new: true });
  if (!comment) throw new ApiError(404, "ACTIVITY_COMMENT_NOT_FOUND", "Comment not found");
  await Activity.updateOne({ _id: comment.activity, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  return comment;
}
