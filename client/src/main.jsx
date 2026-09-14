import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { store } from "./app/store";
import { setupApiInterceptors } from "./utils/api";
import { refreshToken, clearAuth } from "./features/auth/authSlice";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

setupApiInterceptors(store, { refreshToken, clearAuth });

window.addEventListener("auth:logout", () => {
  store.dispatch(clearAuth());
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
          <Toaster position="top-right" toastOptions={{ className: "!bg-surface !text-text-primary !border border-border" }} />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
