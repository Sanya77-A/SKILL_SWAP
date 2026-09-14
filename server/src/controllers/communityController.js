import Community from "../models/Community.js";
import CommunityComment from "../models/CommunityComment.js";
import CommunityMembership from "../models/CommunityMembership.js";
import CommunityPost from "../models/CommunityPost.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { escapeRegex } from "../utils/search.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { createComment, createCommunity, createPost, ensureCommunityReadable, joinCommunity, leaveCommunity, setMemberRole } from "../services/communityService.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const memberIds = await CommunityMembership.distinct("community", { user: req.user._id, status: "active" });
  const filter = { status: "active", ...(req.query.joined ? { _id: { $in: memberIds } } : { $or: [{ visibility: "public" }, { _id: { $in: memberIds } }] }), ...(req.query.skillId && { skill: req.query.skillId }) };
  if (req.query.q) { const q = escapeRegex(req.query.q); filter.$and = [{ $or: [{ name: { $regex: q, $options: "i" } }, { description: { $regex: q, $options: "i" } }, { category: { $regex: q, $options: "i" } }] }]; }
  const [data, total, memberships] = await Promise.all([Community.find(filter).populate("skill", "name slug category").populate("owner", "name fullName username profilePhoto headline").sort({ memberCount: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), Community.countDocuments(filter), CommunityMembership.find({ user: req.user._id, community: { $in: memberIds }, status: "active" }).lean()]);
  const byCommunity = new Map(memberships.map((item) => [item.community.toString(), item]));
  res.json({ success: true, ...paginatedResponse(data.map((item) => ({ ...item, membership: byCommunity.get(item._id.toString()) || null })), total, page, limit) });
});
export const create = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await createCommunity(req.user._id, req.body) }));
export const detail = asyncHandler(async (req, res) => {
  const filter = /^[0-9a-fA-F]{24}$/.test(req.params.key) ? { _id: req.params.key } : { slug: req.params.key.toLowerCase() };
  const community = await Community.findOne(filter).populate("skill", "name slug category").populate("owner admins moderators", "name fullName username profilePhoto headline role").lean();
  const membership = await ensureCommunityReadable(community, req.user._id);
  res.json({ success: true, data: { ...community, membership } });
});
export const join = asyncHandler(async (req, res) => res.json({ success: true, data: await joinCommunity(req.params.id, req.user._id) }));
export const leave = asyncHandler(async (req, res) => { await leaveCommunity(req.params.id, req.user._id); res.json({ success: true, message: "Community left" }); });
export const role = asyncHandler(async (req, res) => res.json({ success: true, data: await setMemberRole(req.params.id, req.user._id, req.params.userId, req.body.role) }));
export const posts = asyncHandler(async (req, res) => {
  const community = await Community.findById(req.params.id).lean(); await ensureCommunityReadable(community, req.user._id);
  const { page, limit, skip } = getPagination(req.query); const filter = { community: req.params.id, status: "published", ...(req.query.type && { type: req.query.type }) };
  const [data, total] = await Promise.all([CommunityPost.find(filter).populate("author", "name fullName username profilePhoto headline role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), CommunityPost.countDocuments(filter)]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});
export const publish = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await createPost(req.params.id, req.user._id, req.body) }));
export const comments = asyncHandler(async (req, res) => {
  const community = await Community.findById(req.params.id).lean(); await ensureCommunityReadable(community, req.user._id);
  const { page, limit, skip } = getPagination(req.query); const filter = { community: req.params.id, post: req.params.postId, status: "published" };
  const [data, total] = await Promise.all([CommunityComment.find(filter).populate("author", "name fullName username profilePhoto headline role").sort({ createdAt: 1 }).skip(skip).limit(limit).lean(), CommunityComment.countDocuments(filter)]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});
export const comment = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await createComment(req.params.id, req.params.postId, req.user._id, req.body.content) }));
