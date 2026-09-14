/**
 * Socket.io service: store io instance so controllers can emit
 */
let io = null;

export const setIO = (instance) => {
  io = instance;
};

export const getIO = () => io;

export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitToConversation = (conversationId, event, data) => {
  if (io) io.to(`conv:${conversationId}`).emit(event, data);
};
