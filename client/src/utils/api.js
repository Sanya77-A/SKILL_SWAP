import axios from "axios";
import { API_BASE_URL } from "../config/runtime";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let refreshSubscribers = [];
function onRefreshed() {
  refreshSubscribers.forEach(({ resolve, original }) => resolve(api(original)));
  refreshSubscribers = [];
}
let refreshing = false;

/**
 * Setup 401 interceptor with refresh + retry. Pass refreshToken thunk and clearAuth action
 * to avoid circular dependency (api <- authSlice <- api).
 */
export function setupApiInterceptors(store, { refreshToken, clearAuth }) {
  api.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config;
      if (!original || err.response?.status !== 401) return Promise.reject(err);
      const isAuthRoute = /\/(?:auth\/(?:login|register|refresh)|demo\/(?:login|me))/.test(original.url || "");
      if (isAuthRoute || original._retry) {
        store.dispatch(clearAuth());
        return Promise.reject(err);
      }
      if (refreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push({ resolve, original });
        });
      }
      original._retry = true;
      refreshing = true;
      try {
        await store.dispatch(refreshToken()).unwrap();
        onRefreshed();
        return api(original);
      } catch (e) {
        store.dispatch(clearAuth());
        refreshSubscribers.forEach(({ resolve }) => resolve(Promise.reject(err)));
        refreshSubscribers = [];
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }
  );
}
