import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const fetchMatches = createAsyncThunk(
  "matches/fetchMatches",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/matches", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

const matchesSlice = createSlice({
  name: "matches",
  initialState: {
    data: [],
    pagination: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMatches.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMatches.fulfilled, (state, { payload }) => {
        state.data = payload.data || [];
        state.pagination = payload.pagination;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchMatches.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      });
  },
});

export default matchesSlice.reducer;
