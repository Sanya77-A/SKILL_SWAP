import { AIServiceError } from "../errors.js";
import { requestJson } from "../httpClient.js";

export function createGeminiProvider(config) {
  return {
    name: "gemini",
    async generate({ instructions, input, maxOutputTokens }) {
      if (!config.apiKey || !config.model) throw new AIServiceError("AI_NOT_CONFIGURED", "Gemini requires GEMINI_API_KEY and AI_MODEL", { provider: "gemini", status: 503 });
      const payload = await requestJson({
        provider: "gemini",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        body: { systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: "user", parts: [{ text: input }] }], generationConfig: { maxOutputTokens } },
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        fetchImpl: config.fetchImpl,
      });
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!text) throw new AIServiceError("AI_EMPTY_RESPONSE", "Gemini returned no text output", { provider: "gemini", status: 502 });
      return { provider: "gemini", model: config.model, responseId: payload.responseId || null, text, usage: payload.usageMetadata || null };
    },
  };
}
