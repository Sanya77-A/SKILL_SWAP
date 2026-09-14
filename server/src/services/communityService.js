import Community from "../models/Community.js";
import CommunityComment from "../models/CommunityComment.js";
import CommunityMembership from "../models/CommunityMembership.js";
import CommunityPost from "../models/CommunityPost.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { createActivity } from "./activityService.js";

const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function activeMembership(communityId, userId) {
  return CommunityMembership.findOne({ community: communityId, user: userId, status: "active" });
}
async function requireMembership(communityId, userId) {
  const membership = await activeMembership(communityId, userId);
  if (!membership) throw new ApiError(403, "COMMUNITY_MEMBERSHIP_REQUIRED", "Join this community to interact");
  return membership;
}
async function requireAdmin(communityId, userId) {
  const membership = await requireMembership(communityId, userId);
  if (membership.role !== "admin") throw new ApiError(403, "COMMUNITY_ADMIN_REQUIRED", "Community admin access required");
  return membership;
}

export async function createCommunity(userId, payload) {
  if (payload.skillId && !await Skill.exists({ _id: payload.skillId, status: "active" })) throw new ApiError(400, "INVALID_COMMUNITY_SKILL", "Community skill must be active and canonical");
  let community;
  try {
    community = await Community.create({ ...payload, slug: payload.slug || toSlug(payload.name), skill: payload.skillId || null, owner: userId, admins: [userId] });
    await CommunityMembership.create({ community: community._id, user: userId, role: "admin" });
  } catch (error) {
    if (community) await Community.deleteOne({ _id: community._id });
    if (error?.code === 11000) throw new ApiError(409, "COMMUNITY_EXISTS", "A community with this slug already exists");
    throw error;
  }
  return community.populate(["skill", { path: "owner", select: "name fullName username profilePhoto headline" }]);
}

export async function joinCommunity(communityId, userId) {
  const community = await Community.findOne({ _id: communityId, status: "active" });
  if (!community) throw new ApiError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  const existing = await CommunityMembership.findOne({ community: communityId, user: userId });
  if (existing?.status === "active") return { community, membership: existing, joined: false };
  if (existing?.status === "banned") throw new ApiError(403, "COMMUNITY_BANNED", "You cannot join this community");
  if (community.visibility === "private" && !existing) throw new ApiError(403, "COMMUNITY_INVITE_REQUIRED", "This private community requires an admin invitation");
  const membership = await CommunityMembership.findOneAndUpdate({ community: communityId, user: userId }, { $set: { status: "active", role: existing?.role || "member", joinedAt: new Date() } }, { new: true, upsert: true, runValidators: true });
  await Community.updateOne({ _id: communityId }, { $inc: { memberCount: 1 } });
  return { community, membership, joined: true };
}

export async function leaveCommunity(communityId, userId) {
  const membership = await requireMembership(communityId, userId);
  if (membership.role === "admin") throw new ApiError(409, "ADMIN_CANNOT_LEAVE", "Transfer or remove admin access before leaving");
  membership.status = "left";
  await membership.save();
  await Community.updateOne({ _id: communityId, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 }, $pull: { moderators: userId } });
}

export async function setMemberRole(communityId, actingUserId, userId, role) {
  await requireAdmin(communityId, actingUserId);
  if (!await User.exists({ _id: userId, status: "active", isDeleted: false, isBlocked: false })) throw new ApiError(404, "USER_NOT_FOUND", "Eligible user not found");
  const existing = await CommunityMembership.findOne({ community: communityId, user: userId });
  const wasActive = existing?.status === "active";
  const membership = await CommunityMembership.findOneAndUpdate({ community: communityId, user: userId }, { $set: { role, status: "active", joinedAt: existing?.joinedAt || new Date() } }, { new: true, upsert: true, runValidators: true });
  await Community.updateOne({ _id: communityId }, {
    ...(!wasActive && { $inc: { memberCount: 1 } }),
    ...(role === "admin" ? { $addToSet: { admins: userId }, $pull: { moderators: userId } } : role === "moderator" ? { $addToSet: { moderators: userId }, $pull: { admins: userId } } : { $pull: { admins: userId, moderators: userId } }),
  });
  return membership;
}

export async function createPost(communityId, userId, payload) {
  await requireMembership(communityId, userId);
  const community = await Community.findOne({ _id: communityId, status: "active" });
  if (!community) throw new ApiError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  const post = await CommunityPost.create({ community: communityId, author: userId, ...payload });
  await Community.updateOne({ _id: communityId }, { $inc: { postCount: 1 } });
  if (community.visibility === "public") await createActivity({ actor: userId, type: "community_post", title: post.title || `Posted in ${community.name}`, body: post.content.slice(0, 300), link: "/communities", skill: community.skill, entityType: "community_post", entityId: post._id, visibility: "members", metadata: { communityId: community._id, communityName: community.name, postType: post.type }, dedupeKey: `community-post:${post._id}:published` }).catch(() => {});
  return post.populate("author", "name fullName username profilePhoto headline role");
}

export async function createComment(communityId, postId, userId, content) {
  await requireMembership(communityId, userId);
  const post = await CommunityPost.findOne({ _id: postId, community: communityId, status: "published" });
  if (!post) throw new ApiError(404, "COMMUNITY_POST_NOT_FOUND", "Community post not found");
  const comment = await CommunityComment.create({ community: communityId, post: postId, author: userId, content });
  await CommunityPost.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
  return comment.populate("author", "name fullName username profilePhoto headline role");
}

export async function ensureCommunityReadable(community, userId) {
  if (!community || community.status !== "active") throw new ApiError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  const membership = await activeMembership(community._id, userId);
  if (community.visibility === "private" && !membership) throw new ApiError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  return membership;
}
