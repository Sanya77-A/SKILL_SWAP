import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function validateProductionUrl(value, variableName, { allowApiPath = false } = {}) {
  if (!value) return;
  if (allowApiPath && value === "/api") return;
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${variableName} must be a credential-free HTTP(S) URL`);
  }
  if (url.search || url.hash || (pathname && !(allowApiPath && pathname === "/api"))) {
    throw new Error(`${variableName} must not contain an unexpected path`);
  }
}

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, process.cwd(), "");
  const apiUrl = process.env.VITE_API_URL || loaded.VITE_API_URL;
  const socketUrl = process.env.VITE_SOCKET_URL || loaded.VITE_SOCKET_URL;
  if (mode === "production") {
    validateProductionUrl(apiUrl?.trim(), "VITE_API_URL", { allowApiPath: true });
    if (socketUrl?.trim()) validateProductionUrl(socketUrl.trim(), "VITE_SOCKET_URL");
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": { target: "http://localhost:5006", changeOrigin: true },
        "/uploads": { target: "http://localhost:5006", changeOrigin: true },
        "/socket.io": { target: "http://localhost:5006", ws: true },
      },
    },
  };
});
