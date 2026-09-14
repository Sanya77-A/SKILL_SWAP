const clean = (value) => value?.trim();

function absoluteOrigin(value, variableName) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTP(S) URL`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${variableName} must be a credential-free HTTP(S) URL`);
  }
  return url;
}

function resolveApiEndpoint(value) {
  if (!value) return { baseUrl: "/api", origin: globalThis.location?.origin || "" };
  if (value === "/api") return { baseUrl: "/api", origin: globalThis.location?.origin || "" };

  const url = absoluteOrigin(value, "VITE_API_URL");
  const pathname = url.pathname.replace(/\/+$/, "");
  if ((pathname && pathname !== "/api") || url.search || url.hash) {
    throw new Error("VITE_API_URL must be a backend origin (preferred) or end with /api");
  }
  return { baseUrl: `${url.origin}/api`, origin: url.origin };
}

function resolveSocketOrigin(value, fallbackOrigin) {
  if (!value) return fallbackOrigin;
  const url = absoluteOrigin(value, "VITE_SOCKET_URL");
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VITE_SOCKET_URL must be an origin without a path, query, or fragment");
  }
  return url.origin;
}

const configuredApiUrl = clean(import.meta.env.VITE_API_URL);
const configuredSocketUrl = clean(import.meta.env.VITE_SOCKET_URL);
const apiEndpoint = resolveApiEndpoint(configuredApiUrl || "/api");

export const API_BASE_URL = apiEndpoint.baseUrl;
export const SOCKET_ORIGIN = resolveSocketOrigin(configuredSocketUrl, apiEndpoint.origin);
export const SOCKET_ENABLED = !import.meta.env.PROD || Boolean(configuredSocketUrl);
