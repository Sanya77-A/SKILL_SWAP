import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import userReducer from "../features/user/userSlice";
import matchesReducer from "../features/matches/matchesSlice";
import requestsReducer from "../features/requests/requestsSlice";
import chatReducer from "../features/chat/chatSlice";
import notificationsReducer from "../features/notifications/notificationsSlice";
import dashboardReducer from "../features/dashboard/dashboardSlice";
import adminReducer from "../features/admin/adminSlice";
import sessionReducer from "../features/sessions/sessionSlice";
import reportReducer from "../features/reports/reportSlice";
import analyticsReducer from "../features/analytics/analyticsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    matches: matchesReducer,
    requests: requestsReducer,
    chat: chatReducer,
    notifications: notificationsReducer,
    dashboard: dashboardReducer,
    admin: adminReducer,
    sessions: sessionReducer,
    reports: reportReducer,
    analytics: analyticsReducer,
  },
});
