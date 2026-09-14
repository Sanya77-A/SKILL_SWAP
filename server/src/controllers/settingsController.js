import AvailabilityRule from "../models/AvailabilityRule.js";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { deleteOwnAccount } from "../services/accountService.js";
import { getWalletSnapshot } from "../services/creditService.js";
import { getPreferences } from "../services/notificationService.js";
import { serializePrivateUser } from "../serializers/userSerializer.js";
import { ApiError } from "../utils/ApiError.js";
import { hashToken } from "../utils/tokens.js";

const sessionsFor = async (req) => {
  const currentHash = req.cookies?.refreshToken ? hashToken(req.cookies.refreshToken) : null;
  const sessions = await RefreshToken.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } }).select("createdAt expiresAt token").sort("-createdAt").lean();
  return sessions.map((session) => ({ _id: session._id, createdAt: session.createdAt, expiresAt: session.expiresAt, current: Boolean(currentHash && session.token === currentHash) }));
};

export const getSettings = asyncHandler(async (req, res) => {
  const [notifications, availability, wallet, sessions] = await Promise.all([getPreferences(req.user._id), AvailabilityRule.find({ user: req.user._id, isActive: true }).sort({ dayOfWeek: 1, startTime: 1 }).lean(), getWalletSnapshot(req.user._id), sessionsFor(req)]);
  const user = serializePrivateUser(req.user);
  res.json({ success: true, data: { account: { email: user.email, emailVerified: user.emailVerified, status: user.status, role: user.role, createdAt: user.createdAt }, profile: user, notifications, privacy: { profileVisibility: user.profileVisibility, locationVisibility: user.locationVisibility, showOnlineStatus: user.showOnlineStatus, showLastActive: user.showLastActive, messagePermissions: user.messagePermissions }, security: { sessions }, learning: { preferredLearningMode: user.preferredLearningMode, preferredTeachingMode: user.preferredTeachingMode, experienceLevel: user.experienceLevel, preferredExchangeModels: user.preferredExchangeModels, maxCreditCost: user.maxCreditCost, maxSessionPrice: user.maxSessionPrice, preferredCurrency: user.preferredCurrency, learningGoals: user.learningGoals }, availability, connectedAccounts: [], billing: { currency: user.preferredCurrency, walletBalance: wallet.balance, lifetimeEarned: wallet.lifetimeEarned, lifetimeSpent: wallet.lifetimeSpent, paymentProvider: "not_configured" }, accessibility: user.accessibilityPreferences } });
});

export const updateAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
  if (await User.exists({ email: req.body.email, _id: { $ne: user._id }, isDeleted: false })) throw new ApiError(409, "EMAIL_IN_USE", "Email is already in use");
  user.email = req.body.email; user.emailVerified = false; await user.save();
  res.json({ success: true, data: { email: user.email, emailVerified: user.emailVerified }, message: "Account email updated" });
});
export const updatePrivacy = asyncHandler(async (req, res) => { const user = await User.findByIdAndUpdate(req.user._id, { ...req.body, visibility: req.body.profileVisibility }, { new: true, runValidators: true }); res.json({ success: true, data: serializePrivateUser(user) }); });
export const updateLearning = asyncHandler(async (req, res) => { const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true }); res.json({ success: true, data: serializePrivateUser(user) }); });
export const updateAccessibility = asyncHandler(async (req, res) => { const user = await User.findByIdAndUpdate(req.user._id, { accessibilityPreferences: req.body }, { new: true, runValidators: true }); res.json({ success: true, data: user.accessibilityPreferences }); });
export const getSessions = asyncHandler(async (req, res) => res.json({ success: true, data: await sessionsFor(req) }));
export const revokeSession = asyncHandler(async (req, res) => { const result = await RefreshToken.deleteOne({ _id: req.params.id, user: req.user._id }); if (!result.deletedCount) throw new ApiError(404, "SESSION_NOT_FOUND", "Session not found"); res.json({ success: true, message: "Session revoked" }); });
export const revokeOtherSessions = asyncHandler(async (req, res) => { const currentHash = req.cookies?.refreshToken ? hashToken(req.cookies.refreshToken) : null; const filter = { user: req.user._id, ...(currentHash && { token: { $ne: currentHash } }) }; const result = await RefreshToken.deleteMany(filter); res.json({ success: true, data: { count: result.deletedCount }, message: "Other sessions revoked" }); });
export const deleteAccount = asyncHandler(async (req, res) => { await deleteOwnAccount(req.user._id, req.body.currentPassword, req.body.confirmation); res.clearCookie("accessToken", { path: "/" }); res.clearCookie("refreshToken", { path: "/" }); res.json({ success: true, message: "Account deleted" }); });
