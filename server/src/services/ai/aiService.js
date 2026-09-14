import { buildAIContext } from "./contextBuilder.js";
import { AIServiceError } from "./errors.js";
import { routeIntent } from "./intentRouter.js";
import { buildPrompt } from "./promptBuilder.js";
import { createProvider } from "./providerFactory.js";

const parseJson = (value, provider) => {
  try { return JSON.parse(value); }
  catch (error) { throw new AIServiceError("AI_INVALID_JSON", "AI provider returned invalid structured output", { provider, status: 502, cause: error }); }
};

export function createAIService(options = {}) {
  const provider = options.providerInstance || createProvider(options);
  return {
    provider: provider.name,
    async generate({ userInput, intent: explicitIntent, context: sourceContext, output = "text", maxOutputTokens = 800 }) {
      if (!userInput?.trim()) throw new AIServiceError("AI_INPUT_REQUIRED", "A user request is required", { provider: provider.name, status: 400 });
      const intent = routeIntent(userInput, explicitIntent);
      const context = buildAIContext(sourceContext);
      const prompt = buildPrompt({ intent, userInput: userInput.trim(), context, output });
      const result = await provider.generate({ ...prompt, maxOutputTokens: Math.min(2000, Math.max(64, maxOutputTokens)) });
      return { ...result, intent, data: output === "json" ? parseJson(result.text, result.provider) : result.text };
    },
  };
}

export const aiService = createAIService();
