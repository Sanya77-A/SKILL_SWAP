import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const fetchSessions = createAsyncThunk(
  "sessions/fetchSessions",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/sessions", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const createSession = createAsyncThunk(
  "sessions/createSession",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/sessions", payload);
      return data.session;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to create session");
    }
  }
);

export const acceptSession = createAsyncThunk(
  "sessions/acceptSession",
  async ({ sessionId, acceptedSlot }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/sessions/${sessionId}/accept`, { acceptedSlot });
      return data.session;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to accept");
    }
  }
);

export const completeSession = createAsyncThunk(
  "sessions/completeSession",
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/sessions/${sessionId}/complete`);
      return data.session;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to complete");
    }
  }
);

const sessionSlice = createSlice({
  name: "sessions",
  initialState: {
    data: [],
    pagination: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessions.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSessions.fulfilled, (state, { payload }) => {
        state.data = payload.data || [];
        state.pagination = payload.pagination;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchSessions.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(createSession.fulfilled, (state, { payload }) => {
        state.data = [payload, ...state.data];
      })
      .addCase(acceptSession.fulfilled, (state, { payload }) => {
        const i = state.data.findIndex((s) => s._id === payload._id);
        if (i !== -1) state.data[i] = payload;
      })
      .addCase(completeSession.fulfilled, (state, { payload }) => {
        const i = state.data.findIndex((s) => s._id === payload._id);
        if (i !== -1) state.data[i] = payload;
      });
  },
});

export default sessionSlice.reducer;
