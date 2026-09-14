import { AIServiceError } from "./errors.js";

const retryableStatus = (status) => status === 408 || status === 409 || status === 429 || status >= 500;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestJson({ provider, url, headers, body, timeoutMs, maxRetries = 1, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") throw new AIServiceError("AI_FETCH_UNAVAILABLE", "The server runtime does not provide fetch", { provider });
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryable = retryableStatus(response.status);
        const error = new AIServiceError("AI_PROVIDER_ERROR", payload?.error?.message || `${provider} request failed`, { provider, status: response.status, retryable });
        if (!retryable || attempt === maxRetries) throw error;
        lastError = error;
      } else {
        return payload;
      }
    } catch (error) {
      const normalized = error instanceof AIServiceError ? error : new AIServiceError(
        error?.name === "AbortError" ? "AI_TIMEOUT" : "AI_NETWORK_ERROR",
        error?.name === "AbortError" ? `${provider} request timed out` : `${provider} request failed`,
        { provider, status: error?.name === "AbortError" ? 504 : 503, retryable: true, cause: error }
      );
      if (!normalized.retryable || attempt === maxRetries) throw normalized;
      lastError = normalized;
    } finally {
      clearTimeout(timer);
    }
    await delay(Math.min(250, 50 * (2 ** attempt)));
  }
  throw lastError;
}
