import Listing from "../models/Listing.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { escapeRegex } from "../utils/search.js";
import { ApiError } from "../utils/ApiError.js";
import { createListing, transitionOwnedListing, updateOwnedListing } from "../services/listingService.js";
import { recordAnalyticsView } from "../services/analyticsService.js";
import { createActivity } from "../services/activityService.js";

const populateListing = (query) => query
  .populate("owner", "name fullName username profileImage profilePhoto headline ratingAvg ratingCount skillScore")
  .populate("skill", "name slug category icon status");

export const listListings = asyncHandler(async (req, res) => {
  const { q, skillId, deliveryMode, experienceLevel, exchangeEnabled, creditsEnabled, paidEnabled, sort = "newest" } = req.query;
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status: "published" };
  if (skillId) filter.skill = skillId;
  if (deliveryMode) filter.deliveryMode = deliveryMode;
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (exchangeEnabled !== undefined) filter.exchangeEnabled = exchangeEnabled;
  if (creditsEnabled !== undefined) filter.creditsEnabled = creditsEnabled;
  if (paidEnabled !== undefined) filter.paidEnabled = paidEnabled;
  if (q) {
    const safe = escapeRegex(q);
    filter.$or = [
      { title: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
      { learningOutcomes: { $regex: safe, $options: "i" } },
    ];
  }
  const sortMap = {
    newest: { publishedAt: -1, _id: -1 },
    rating: { ratingAvg: -1, ratingCount: -1 },
    price_low: { price: 1 },
    popular: { bookingCount: -1, ratingAvg: -1 },
  };
  const [data, total] = await Promise.all([
    populateListing(Listing.find(filter).sort(sortMap[sort]).skip(skip).limit(limit)).lean(),
    Listing.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const getListing = asyncHandler(async (req, res) => {
  const listing = await populateListing(Listing.findById(req.params.id)).lean();
  if (!listing) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  const isOwner = req.user?._id?.toString() === listing.owner?._id?.toString();
  if (listing.status !== "published" && !isOwner) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  if (listing.status === "published") await recordAnalyticsView({ subject: listing.owner._id, actor: req.user?._id, type: "listing_view", entityId: listing._id, request: req });
  res.json({ success: true, data: listing, listing });
});

export const getMyListings = asyncHandler(async (req, res) => {
  const data = await populateListing(Listing.find({ owner: req.user._id }).sort({ updatedAt: -1 })).lean();
  res.json({ success: true, data, listings: data });
});

export const createMyListing = asyncHandler(async (req, res) => {
  const listing = await createListing(req.user._id, req.body);
  await listing.populate([
    { path: "owner", select: "name fullName username profilePhoto headline ratingAvg skillScore" },
    { path: "skill", select: "name slug category icon status" },
  ]);
  res.status(201).json({ success: true, data: listing, listing });
});

export const updateMyListing = asyncHandler(async (req, res) => {
  const listing = await updateOwnedListing(req.user._id, req.params.id, { ...req.body });
  await listing.populate([
    { path: "owner", select: "name fullName username profilePhoto headline ratingAvg skillScore" },
    { path: "skill", select: "name slug category icon status" },
  ]);
  res.json({ success: true, data: listing, listing });
});

export const transitionMyListing = (action) => asyncHandler(async (req, res) => {
  const listing = await transitionOwnedListing(req.user._id, req.params.id, action);
  await listing.populate([
    { path: "owner", select: "name fullName username profilePhoto headline ratingAvg skillScore" },
    { path: "skill", select: "name slug category icon status" },
  ]);
  if (action === "publish") await createActivity({ actor: req.user._id, type: "listing_published", title: `Published ${listing.title}`, body: listing.description.slice(0, 300), link: `/listing/${listing._id}`, skill: listing.skill?._id || listing.skill, entityType: "listing", entityId: listing._id, visibility: "members", dedupeKey: `listing:${listing._id}:published` }).catch(() => {});
  res.json({ success: true, data: listing, listing, message: `Listing ${listing.status}` });
});
