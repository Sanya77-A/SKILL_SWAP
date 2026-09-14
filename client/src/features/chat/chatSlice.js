import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const fetchConversations = createAsyncThunk(
  "chat/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/chats");
      return data.data || [];
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async ({ conversationId, page = 1 }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/chats/${conversationId}/messages`, { params: { page, limit: 20 } });
      return { conversationId, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ conversationId, content, files = [], card, clientMessageId }, { rejectWithValue }) => {
    try {
      let data;
      if (files && files.length > 0) {
        const formData = new FormData();
        if (content) formData.append("content", content);
        formData.append("clientMessageId", clientMessageId);
        if (card?.type && card?.id) formData.append(`${card.type}Id`, card.id);
        for (let i = 0; i < files.length; i++) {
          formData.append("attachments", files[i]);
        }
        const res = await api.post(`/chats/${conversationId}/messages`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        data = res.data;
      } else {
        const payload = { content, clientMessageId };
        if (card?.type && card?.id) payload[`${card.type}Id`] = card.id;
        const res = await api.post(`/chats/${conversationId}/messages`, payload);
        data = res.data;
      }
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const markConversationRead = createAsyncThunk(
  "chat/markConversationRead",
  async (conversationId, { rejectWithValue }) => {
    try {
      await api.patch(`/chats/${conversationId}/read`);
      return conversationId;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const getOrCreateConversation = createAsyncThunk(
  "chat/getOrCreateConversation",
  async (otherUserId, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/chats/conversation", { otherUserId });
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Cannot start chat");
    }
  }
);

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    conversations: [],
    messages: {},
    activeConversationId: null,
    onlineUsers: [],
    loading: false,
    error: null,
  },
  reducers: {
    setActiveConversation: (state, { payload }) => {
      state.activeConversationId = payload;
    },
    addMessage: (state, { payload }) => {
      const convId = payload.conversation?._id || payload.conversation;
      if (!convId) return;
      if (!state.messages[convId]) state.messages[convId] = [];
      if (!state.messages[convId].find((m) => m._id === payload._id)) {
        state.messages[convId].push(payload);
      }
    },
    applyReadReceipt: (state, { payload }) => {
      const conversationMessages = state.messages[payload.conversationId] || [];
      conversationMessages.forEach((message) => {
        if (String(message.sender?._id || message.sender) !== String(payload.userId)) {
          message.read = true;
          message.readAt = payload.readAt;
          message.seenBy = [...new Set([...(message.seenBy || []).map(String), String(payload.userId)])];
        }
      });
    },
    setOnlineUsers: (state, { payload }) => {
      state.onlineUsers = payload || [];
    },
    clearChat: (state) => {
      state.messages = {};
      state.activeConversationId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, { payload }) => {
        state.conversations = payload;
      })
      .addCase(fetchMessages.fulfilled, (state, { payload }) => {
        state.messages[payload.conversationId] = payload.data || [];
      })
      .addCase(sendMessage.fulfilled, (state, { payload }) => {
        const convId = payload.conversation?._id || payload.conversation;
        if (!convId) return;
        if (!state.messages[convId]) state.messages[convId] = [];
        if (!state.messages[convId].find((message) => message._id === payload._id)) {
          state.messages[convId].push(payload);
        }
      })
      .addCase(markConversationRead.fulfilled, (state, { payload }) => {
        const conversation = state.conversations.find((item) => item._id === payload);
        if (conversation) conversation.unreadCount = 0;
      })
      .addCase(getOrCreateConversation.fulfilled, (state, { payload }) => {
        if (!state.conversations.find((c) => c._id === payload._id)) {
          state.conversations = [payload, ...state.conversations];
        }
        state.activeConversationId = payload._id;
      });
  },
});

export const { setActiveConversation, addMessage, applyReadReceipt, setOnlineUsers, clearChat } = chatSlice.actions;
export default chatSlice.reducer;
