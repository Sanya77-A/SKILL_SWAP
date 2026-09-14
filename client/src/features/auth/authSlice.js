import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/api";

export const register = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Registration failed");
    }
  }
);

export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Login failed");
    }
  }
);

export const demoLogin = createAsyncThunk(
  "auth/demoLogin",
  async (role, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/demo/login", { role });
      return { ...data, databaseMode: "demo" };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Demo login failed");
    }
  }
);

export const refreshToken = createAsyncThunk(
  "auth/refresh",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/refresh");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  }
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { getState }) => {
    try {
      await api.post(getState().auth.user?.isDemo ? "/demo/logout" : "/auth/logout");
    } catch (_) {}
  }
);

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    let databaseMode = "mongo";
    try {
      const health = await api.get("/health");
      databaseMode = health.data.data?.databaseMode || "mongo";
      const { data } = await api.get(databaseMode === "demo" ? "/demo/me" : "/users/me");
      return { user: data.user, databaseMode };
    } catch (err) {
      return rejectWithValue({ ...(err.response?.data || {}), databaseMode });
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    loading: false,
    error: null,
    databaseMode: "unknown",
    isAuthenticated: false,
    isInitializing: true,  // true until first fetchMe completes
  },
  reducers: {
    setCredentials: (state, { payload }) => {
      state.user = payload?.user ?? state.user;
      state.isAuthenticated = !!state.user;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.isAuthenticated = true;
        state.databaseMode = "mongo";
        state.error = null;
      })
      .addCase(demoLogin.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.isAuthenticated = true;
        state.databaseMode = "demo";
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(fetchMe.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.databaseMode = payload.databaseMode;
        state.isAuthenticated = true;
        state.isInitializing = false;
      })
      .addCase(fetchMe.rejected, (state, { payload }) => {
        state.user = null;
        state.databaseMode = payload?.databaseMode || state.databaseMode;
        state.isAuthenticated = false;
        state.isInitializing = false;
      })
      .addCase(refreshToken.fulfilled, (state, { payload }) => {
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isInitializing = false;
      })
      .addMatcher(
        (action) => [register.pending.type, login.pending.type, demoLogin.pending.type].includes(action.type),
        (state) => { state.loading = true; state.error = null; }
      )
      .addMatcher(
        (action) => [register.rejected.type, login.rejected.type, demoLogin.rejected.type].includes(action.type),
        (state, { payload }) => { state.loading = false; state.error = payload; }
      )
      .addMatcher(
        (action) => [register.fulfilled.type, login.fulfilled.type, demoLogin.fulfilled.type].includes(action.type),
        (state) => { state.loading = false; }
      );
  },
});

export const { setCredentials, clearAuth } = authSlice.actions;
export default authSlice.reducer;
