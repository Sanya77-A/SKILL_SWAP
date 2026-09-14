import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const fetchUserAnalytics = createAsyncThunk(
  "analytics/fetchUserAnalytics",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/analytics/user");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const fetchPlatformAnalytics = createAsyncThunk(
  "analytics/fetchPlatformAnalytics",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/analytics/platform");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

const analyticsSlice = createSlice({
  name: "analytics",
  initialState: {
    user: null,
    platform: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserAnalytics.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.error = null;
      })
      .addCase(fetchUserAnalytics.rejected, (state, { payload }) => { state.error = payload; })
      .addCase(fetchPlatformAnalytics.fulfilled, (state, { payload }) => {
        state.platform = payload;
        state.error = null;
      })
      .addCase(fetchPlatformAnalytics.rejected, (state, { payload }) => { state.error = payload; });
  },
});

export default analyticsSlice.reducer;
