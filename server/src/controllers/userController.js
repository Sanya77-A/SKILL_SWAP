import User, { calculateProfileCompleteness } from "../models/User.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { cloudinary, initCloudinary } from "../config/cloudinary.js";
import fs from "fs";
import { escapeRegex } from "../utils/search.js";
import { serializePrivateUser, serializePublicUser } from "../serializers/userSerializer.js";
import { getProfessionalProfile } from "../services/profileService.js";
import { recordAnalyticsView } from "../services/analyticsService.js";
import { deleteOwnAccount } from "../services/accountService.js";
import { blockedUserIds } from "../services/safetyService.js";
import { requiresPersistentUploadStorage } from "../config/runtime.js";

/**
 * GET /api/users/me
 */
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: serializePrivateUser(req.user), user: serializePrivateUser(req.user) });
});

/**
 * PUT /api/users/me - update profile, optional profile image upload
 */
export const updateMe = asyncHandler(async (req, res) => {
  const profileFields = [
    "name", "fullName", "username", "profilePhoto", "coverImage", "bio", "headline", "occupation", "company", "university",
    "location", "timezone", "languages", "website", "github", "linkedin", "portfolioLinks",
    "availability", "visibility", "profileVisibility", "locationVisibility", "showOnlineStatus", "showLastActive", "messagePermissions", "preferredLearningMode", "preferredTeachingMode",
    "preferredLearningModes", "preferredTeachingModes", "learningGoals",
    "preferredExchangeModels", "maxCreditCost", "maxSessionPrice", "preferredCurrency",
    "onboardingCompleted", "experienceLevel",
  ];
  // FormData sends arrays as either `skillsOffered[]` or `skillsOffered`
  const rawOffered = req.body["skillsOffered[]"] || req.body.skillsOffered;
  const rawWanted = req.body["skillsWanted[]"] || req.body.skillsWanted;
  const toArray = (val) => {
    if (!val) return [];
    const arr = Array.isArray(val) ? val : [val];
    return arr.map((s) => s.trim()).filter(Boolean);
  };
  const updates = {};
  for (const field of profileFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.fullName !== undefined && updates.name === undefined) updates.name = updates.fullName;
  if (updates.name !== undefined && updates.fullName === undefined) updates.fullName = updates.name;
  if (updates.visibility !== undefined && updates.profileVisibility === undefined) updates.profileVisibility = updates.visibility;
  if (updates.profileVisibility !== undefined && updates.visibility === undefined) updates.visibility = updates.profileVisibility;
  if (rawOffered !== undefined) updates.skillsOffered = toArray(rawOffered);
  if (rawWanted !== undefined) updates.skillsWanted = toArray(rawWanted);

  let profileUploadPersistedLocally = false;
  if (req.file) {
    const useCloudinary = initCloudinary();
    if (!useCloudinary && requiresPersistentUploadStorage()) {
      return res.status(503).json({
        success: false,
        message: "File uploads are temporarily unavailable.",
        error: { code: "UPLOAD_STORAGE_UNAVAILABLE", message: "File uploads are temporarily unavailable." },
      });
    }
    if (useCloudinary) {
      if (req.user.profileImagePublicId) {
        await cloudinary.uploader.destroy(req.user.profileImagePublicId).catch(() => {});
      }
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "skillswap",
        transformation: [{ width: 400, height: 400, crop: "fill" }],
      });
      updates.profileImage = result.secure_url;
      updates.profilePhoto = result.secure_url;
      updates.profileImagePublicId = result.public_id;
      await fs.promises.unlink(req.file.path).catch(() => {});
    } else {
      updates.profileImage = `/uploads/${req.file.filename}`;
      updates.profilePhoto = `/uploads/${req.file.filename}`;
      profileUploadPersistedLocally = true;
    }
  }

  updates.profileCompleteness = calculateProfileCompleteness({ ...req.user.toObject(), ...updates });

  let user;
  try {
    user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Username is already in use" });
    }
    throw error;
  }
  req.profileUploadPersisted = profileUploadPersistedLocally;
  res.json({ success: true, data: serializePrivateUser(user), user: serializePrivateUser(user) });
});

/**
 * DELETE /api/users/me - soft delete
 */
export const deleteMe = asyncHandler(async (req, res) => {
  await deleteOwnAccount(req.user._id, req.body.currentPassword, req.body.confirmation);
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
  res.json({ success: true, message: "Account deleted" });
});

/**
 * GET /api/users - search/filter/pagination
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { q, experienceLevel, availability, ratingMin, ratingMax, sort = "ratingAvg", order = "desc" } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const excluded = await blockedUserIds(req.user._id);
  const filter = {
    isDeleted: false,
    isBlocked: false,
    status: "active",
    visibility: { $ne: "private" },
    _id: { $ne: req.user._id, ...(excluded.length ? { $nin: excluded } : {}) },
    role: { $in: ["user", "mentor"] },
  };
  if (q) {
    const safeQuery = escapeRegex(q);
    filter.$or = [
      { name: { $regex: safeQuery, $options: "i" } },
      { skillsOffered: { $regex: safeQuery, $options: "i" } },
      { skillsWanted: { $regex: safeQuery, $options: "i" } },
    ];
  }
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (availability) filter.availability = availability;
  if (ratingMin != null) filter.ratingAvg = { ...filter.ratingAvg, $gte: Number(ratingMin) };
  if (ratingMax != null) filter.ratingAvg = { ...filter.ratingAvg, $lte: Number(ratingMax) };

  const sortOrder = order === "asc" ? 1 : -1;
  const sortObj = { [sort]: sortOrder };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name fullName username profileImage profilePhoto headline bio occupation company university location locationVisibility timezone languages website github linkedin portfolioLinks availability visibility preferredLearningModes preferredTeachingModes learningGoals experienceLevel skillsOffered skillsWanted ratingAvg ratingCount profileCompleteness lastActive lastActiveAt showLastActive status role createdAt")
      .sort(sortObj).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, ...paginatedResponse(users.map((user) => serializePublicUser(user, { viewerAuthenticated: true })), total, page, limit) });
});

/**
 * GET /api/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  const profile = await getProfessionalProfile({ id: req.params.id, viewerId: req.user._id });
  await recordAnalyticsView({ subject: profile.user._id, actor: req.user._id, type: "profile_view", entityId: profile.user._id, request: req });
  res.json({ success: true, data: profile, profile, user: profile.user });
});

/** GET /api/users/by-username/:username */
export const getUserByUsername = asyncHandler(async (req, res) => {
  const profile = await getProfessionalProfile({ username: req.params.username, viewerId: req.user?._id });
  await recordAnalyticsView({ subject: profile.user._id, actor: req.user?._id, type: "profile_view", entityId: profile.user._id, request: req });
  res.json({ success: true, data: profile, profile, user: profile.user });
});
