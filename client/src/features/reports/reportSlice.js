import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const createReport = createAsyncThunk(
  "reports/createReport",
  async ({ reportedUserId, reason }, { rejectWithValue }) => {
    try {
      await api.post("/reports", { reportedUserId, reason });
      return { reportedUserId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to submit report");
    }
  }
);

const reportSlice = createSlice({
  name: "reports",
  initialState: { loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createReport.fulfilled, (state) => { state.error = null; })
      .addCase(createReport.rejected, (state, { payload }) => { state.error = payload; });
  },
});

export default reportSlice.reducer;
