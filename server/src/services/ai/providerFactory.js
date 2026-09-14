import { env } from "../../config/env.js";
import { AIServiceError } from "./errors.js";
import { createGeminiProvider } from "./providers/geminiProvider.js";
import { createGroqProvider } from "./providers/groqProvider.js";
import { createOpenAIProvider } from "./providers/openaiProvider.js";

export function createProvider(overrides = {}) {
  const provider = (overrides.provider || env.AI_PROVIDER).toLowerCase();
  const shared = {
    model: overrides.model ?? env.AI_MODEL,
    timeoutMs: overrides.timeoutMs ?? env.AI_TIMEOUT_MS,
    maxRetries: overrides.maxRetries ?? env.AI_MAX_RETRIES,
    fetchImpl: overrides.fetchImpl,
  };
  if (provider === "openai") return createOpenAIProvider({ ...shared, apiKey: overrides.apiKey ?? env.OPENAI_API_KEY });
  if (provider === "gemini") return createGeminiProvider({ ...shared, apiKey: overrides.apiKey ?? env.GEMINI_API_KEY });
  if (provider === "groq") return createGroqProvider({ ...shared, apiKey: overrides.apiKey ?? env.GROQ_API_KEY });
  if (provider === "disabled") {
    return { name: "disabled", generate: async () => { throw new AIServiceError("AI_NOT_CONFIGURED", "AI features are disabled", { provider: "disabled", status: 503 }); } };
  }
  throw new AIServiceError("AI_PROVIDER_UNSUPPORTED", `Unsupported AI provider: ${provider}`, { provider, status: 500 });
}
