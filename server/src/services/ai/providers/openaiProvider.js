import { AIServiceError } from "../errors.js";
import { requestJson } from "../httpClient.js";

const extractText = (payload) => payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;

export function createOpenAIProvider(config) {
  return {
    name: "openai",
    async generate({ instructions, input, maxOutputTokens }) {
      if (!config.apiKey || !config.model) throw new AIServiceError("AI_NOT_CONFIGURED", "OpenAI requires OPENAI_API_KEY and AI_MODEL", { provider: "openai", status: 503 });
      const payload = await requestJson({
        provider: "openai",
        url: "https://api.openai.com/v1/responses",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: { model: config.model, instructions, input, store: false, max_output_tokens: maxOutputTokens },
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        fetchImpl: config.fetchImpl,
      });
      const text = extractText(payload);
      if (!text) throw new AIServiceError("AI_EMPTY_RESPONSE", "OpenAI returned no text output", { provider: "openai", status: 502 });
      return { provider: "openai", model: payload.model || config.model, responseId: payload.id, text, usage: payload.usage || null };
    },
  };
}
