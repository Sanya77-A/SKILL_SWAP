import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const updateProfile = createAsyncThunk(
  "user/updateProfile",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.put("/users/me", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Update failed");
    }
  }
);

export const searchUsers = createAsyncThunk(
  "user/searchUsers",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/users", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const getUserById = createAsyncThunk(
  "user/getUserById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/users/${id}`);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    searchResults: [],
    searchPagination: null,
    selectedUser: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSelectedUser: (state) => {
      state.selectedUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateProfile.fulfilled, (state, { payload }) => {
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, { payload }) => {
        state.searchResults = payload.data || [];
        state.searchPagination = payload.pagination;
        state.error = null;
      })
      .addCase(getUserById.fulfilled, (state, { payload }) => {
        state.selectedUser = payload;
        state.error = null;
      })
      .addCase(getUserById.rejected, (state) => {
        state.selectedUser = null;
      });
  },
});

export const { clearSelectedUser } = userSlice.actions;
export default userSlice.reducer;
