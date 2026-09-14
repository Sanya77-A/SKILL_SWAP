import Notification, { notificationTypes } from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import { emitToUser } from "./socketService.js";

const legacyTypeMap = {
  NEW_REQUEST: "proposal", REQUEST_ACCEPTED: "proposal", REQUEST_REJECTED: "proposal", REQUEST_COMPLETED: "session",
  NEW_MESSAGE: "message", SESSION_CONFIRMED: "session", SESSION_PROPOSED: "session",
};
const safeLinkPrefixes = ["/proposals", "/bookings", "/chat", "/notifications", "/credits", "/requests", "/sessions", "/profile", "/communities", "/certificates", "/challenges", "/safety"];

const canonicalType = (type) => legacyTypeMap[type] || type;
const safeDeepLink = (link) => !link || (link.startsWith("/") && !link.startsWith("//") && safeLinkPrefixes.some((prefix) => link === prefix || link.startsWith(`${prefix}/`) || link.startsWith(`${prefix}?`)));

export const getPreferences = async (userId) => NotificationPreference.findOneAndUpdate(
  { user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, new: true, setDefaultsOnInsert: true }
);

export const updatePreferences = async (userId, payload) => {
  const updates = {};
  for (const [type, enabled] of Object.entries(payload.inApp || {})) updates[`inApp.${type}`] = enabled;
  if (payload.emailDigest !== undefined) updates.emailDigest = payload.emailDigest;
  if (payload.pushEnabled !== undefined) updates.pushEnabled = payload.pushEnabled;
  return NotificationPreference.findOneAndUpdate({ user: userId }, { $set: updates, $setOnInsert: { user: userId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
};

export const createNotification = async (userId, input) => {
  const type = canonicalType(input.type);
  if (!notificationTypes.includes(type)) throw new Error(`Unsupported notification type: ${input.type}`);
  const link = input.link || "";
  if (!safeDeepLink(link)) throw new Error("Notification deep link must be an approved internal path");
  const preferences = await getPreferences(userId);
  if (type !== "system" && preferences.inApp?.[type] === false) return null;
  let notification;
  try {
    notification = await Notification.create({
      user: userId,
      type,
      title: input.title,
      body: input.body || input.message || "",
      link,
      metadata: input.metadata || {},
      priority: input.priority || "normal",
      dedupeKey: input.dedupeKey || null,
    });
  } catch (error) {
    if (error?.code === 11000 && input.dedupeKey) return Notification.findOne({ user: userId, dedupeKey: input.dedupeKey });
    throw error;
  }
  emitToUser(userId.toString(), "notification", notification.toObject());
  return notification;
};

export const getNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false, type }) => {
  const skip = (page - 1) * limit;
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  if (type) filter.type = type;
  const [data, total] = await Promise.all([
    Notification.find(filter).sort("-createdAt").skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
};

export const getUnreadCount = (userId) => Notification.countDocuments({ user: userId, read: false });

export const markAsRead = (notificationId, userId) => Notification.findOneAndUpdate(
  { _id: notificationId, user: userId }, { $set: { read: true, readAt: new Date() } }, { new: true }
);

export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany({ user: userId, read: false }, { $set: { read: true, readAt: new Date() } });
  return result.modifiedCount;
};
