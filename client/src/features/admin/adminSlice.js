import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const fetchAdminUsers = createAsyncThunk(
  "admin/fetchAdminUsers",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/admin/users", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const blockUser = createAsyncThunk(
  "admin/blockUser",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/admin/users/${id}/block`);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const unblockUser = createAsyncThunk(
  "admin/unblockUser",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/admin/users/${id}/unblock`);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const deleteUser = createAsyncThunk(
  "admin/deleteUser",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/admin/users/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const fetchAdminStats = createAsyncThunk(
  "admin/fetchAdminStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/admin/stats");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const fetchAdminReports = createAsyncThunk(
  "admin/fetchAdminReports",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/admin/reports", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    users: [],
    pagination: null,
    stats: null,
    swapsByMonth: [],
    skillsOffered: [],
    skillsWanted: [],
    reports: [],
    reportsPagination: null,
    loading: false,
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminUsers.fulfilled, (state, { payload }) => {
        state.users = payload.data || [];
        state.pagination = payload.pagination;
      })
      .addCase(blockUser.fulfilled, (state, { payload }) => {
        const u = state.users.find((x) => x._id === payload._id);
        if (u) u.isBlocked = true;
      })
      .addCase(unblockUser.fulfilled, (state, { payload }) => {
        const u = state.users.find((x) => x._id === payload._id);
        if (u) u.isBlocked = false;
      })
      .addCase(deleteUser.fulfilled, (state, { payload }) => {
        state.users = state.users.filter((x) => x._id !== payload);
      })
      .addCase(fetchAdminStats.fulfilled, (state, { payload }) => {
        state.stats = payload.stats;
        state.swapsByMonth = payload.swapsByMonth || [];
        state.skillsOffered = payload.skillsOffered || [];
        state.skillsWanted = payload.skillsWanted || [];
      })
      .addCase(fetchAdminReports.fulfilled, (state, { payload }) => {
        state.reports = payload.data || [];
        state.reportsPagination = payload.pagination;
      });
  },
});

export default adminSlice.reducer;
