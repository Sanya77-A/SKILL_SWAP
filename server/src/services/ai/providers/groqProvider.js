import { AIServiceError } from "../errors.js";
import { requestJson } from "../httpClient.js";

export function createGroqProvider(config) {
  return {
    name: "groq",
    async generate({ instructions, input, maxOutputTokens }) {
      if (!config.apiKey || !config.model) throw new AIServiceError("AI_NOT_CONFIGURED", "Groq requires GROQ_API_KEY and AI_MODEL", { provider: "groq", status: 503 });
      const payload = await requestJson({
        provider: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: { model: config.model, messages: [{ role: "system", content: instructions }, { role: "user", content: input }], max_completion_tokens: maxOutputTokens },
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        fetchImpl: config.fetchImpl,
      });
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) throw new AIServiceError("AI_EMPTY_RESPONSE", "Groq returned no text output", { provider: "groq", status: 502 });
      return { provider: "groq", model: payload.model || config.model, responseId: payload.id, text, usage: payload.usage || null };
    },
  };
}
