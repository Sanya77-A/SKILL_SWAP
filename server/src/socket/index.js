import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import { setIO } from "../services/socketService.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { canUsersContact } from "../services/chatService.js";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import UserBlock from "../models/UserBlock.js";

/**
 * Socket.io: authenticate via access token, join user room, handle chat + typing
 */
function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== "string") return null;
  const match = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith("accessToken="));
  return match ? decodeURIComponent(match.split("=")[1] || "").trim() : null;
}

export const authenticateSocket = async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
      getTokenFromCookie(socket.handshake.headers?.cookie);
    if (!token) {
      logger.warn("socket_authentication_failed", { reason: "missing_access_token" });
      return next(new Error("Authentication required"));
    }
    try {
      const { userId } = verifyAccessToken(token);
      const user = await User.findOne({ _id: userId, isDeleted: false, isBlocked: false, status: "active" }).select("_id").lean();
      if (!user) {
        logger.warn("socket_authentication_failed", { reason: "account_unavailable", userId });
        return next(new Error("Account unavailable"));
      }
      socket.userId = userId;
      next();
    } catch (err) {
      logger.warn("socket_authentication_failed", { reason: "invalid_or_expired_token", errorCode: err.code || err.name });
      next(new Error("Invalid token"));
    }
};

export const setupSocket = (io) => {
  setIO(io);

  io.use(authenticateSocket);

  io.on("connection", async (socket) => {
    const eventWindow = { startedAt: Date.now(), count: 0 };
    const guardEvent = (handler) => async (payload = {}) => {
      if (payload === null || payload === undefined) return;
      const now = Date.now();
      if (now - eventWindow.startedAt >= 10_000) {
        eventWindow.startedAt = now;
        eventWindow.count = 0;
      }
      eventWindow.count += 1;
      if (eventWindow.count > 80) {
        logger.warn("socket_event_rate_limited", { userId: socket.userId, eventCount: eventWindow.count });
        socket.emit("socket_error", { code: "SOCKET_RATE_LIMITED", message: "Too many realtime events" });
        return;
      }
      try {
        await handler(payload);
      } catch (error) {
        logger.warn("socket_event_failed", { userId: socket.userId, errorCode: error.code || error.name });
      }
    };
    const validId = (value) => typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
    const authorizedConversation = async (conversationId) => {
      if (!validId(conversationId)) return false;
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.userId }).select("participants").lean().catch(() => null);
      const other = conversation?.participants.find((id) => id.toString() !== socket.userId.toString());
      return Boolean(other && await canUsersContact(socket.userId, other).catch(() => false));
    };
    socket.join(`user:${socket.userId}`);
    await User.updateOne({ _id: socket.userId }, { lastActiveAt: new Date(), lastActive: new Date() }).catch(() => {});
    await emitOnlineUsers(io);

    socket.on("join_conversation", guardEvent(async (conversationId) => {
      if (await authorizedConversation(conversationId)) socket.join(`conv:${conversationId}`);
    }));

    socket.on("leave_conversation", guardEvent(async (conversationId) => {
      if (!validId(conversationId)) return;
      socket.leave(`conv:${conversationId}`);
    }));

    socket.on("typing", guardEvent(async ({ conversationId }) => {
      if (!validId(conversationId)) return;
      if (socket.rooms.has(`conv:${conversationId}`) && await authorizedConversation(conversationId)) {
        socket.to(`conv:${conversationId}`).emit("user_typing", { userId: socket.userId });
      }
    }));

    socket.on("typing_stop", guardEvent(async ({ conversationId }) => {
      if (!validId(conversationId)) return;
      if (socket.rooms.has(`conv:${conversationId}`) && await authorizedConversation(conversationId)) {
        socket.to(`conv:${conversationId}`).emit("user_typing_stop", { userId: socket.userId });
      }
    }));

    const canContact = async (otherUserId) => canUsersContact(socket.userId, otherUserId).catch(() => false);

    // WebRTC Signaling Events
    socket.on("call_user", guardEvent(async ({ to, offer, isVideo, callerName }) => {
      if (!validId(to) || !offer || typeof offer !== "object") return;
      if (await canContact(to)) {
        io.to(`user:${to}`).emit("incoming_call", { from: socket.userId, offer, isVideo: Boolean(isVideo), callerName: typeof callerName === "string" ? callerName.slice(0, 100) : "SkillSwap member" });
      }
    }));

    socket.on("answer_call", guardEvent(async ({ to, answer }) => {
      if (validId(to) && answer && typeof answer === "object" && await canContact(to)) io.to(`user:${to}`).emit("call_answered", { answer });
    }));

    socket.on("ice_candidate", guardEvent(async ({ to, candidate }) => {
      if (validId(to) && candidate && typeof candidate === "object" && await canContact(to)) io.to(`user:${to}`).emit("ice_candidate", { candidate });
    }));

    socket.on("end_call", guardEvent(async ({ to }) => {
      if (validId(to) && await canContact(to)) io.to(`user:${to}`).emit("call_ended");
    }));

    socket.on("disconnect", () => {
      User.updateOne({ _id: socket.userId }, { lastActiveAt: new Date(), lastActive: new Date() }).catch(() => {});
      emitOnlineUsers(io);
    });
  });
};

async function getOnlineUserIds(io) {
  const sockets = await io.fetchSockets();
  const connected = [...new Set(sockets.map((s) => s.userId?.toString()).filter(Boolean))];
  if (!connected.length) return [];
  const visible = await User.find({ _id: { $in: connected }, showOnlineStatus: { $ne: false }, isDeleted: false, isBlocked: false, status: "active" }).select("_id").lean();
  return visible.map((user) => user._id.toString());
}

async function emitOnlineUsers(io) {
  const online = await getOnlineUserIds(io);
  if (!online.length) return;
  const blocks = await UserBlock.find({
    $or: [{ blocker: { $in: online } }, { blocked: { $in: online } }],
  }).select("blocker blocked").lean();
  const hiddenByViewer = new Map();
  for (const block of blocks) {
    const first = block.blocker.toString();
    const second = block.blocked.toString();
    if (!hiddenByViewer.has(first)) hiddenByViewer.set(first, new Set());
    if (!hiddenByViewer.has(second)) hiddenByViewer.set(second, new Set());
    hiddenByViewer.get(first).add(second);
    hiddenByViewer.get(second).add(first);
  }
  for (const viewerId of online) {
    const hidden = hiddenByViewer.get(viewerId) || new Set();
    io.to(`user:${viewerId}`).emit("online_users", online.filter((id) => !hidden.has(id)));
  }
}
