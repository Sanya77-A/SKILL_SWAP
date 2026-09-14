import { createAIService } from "../services/ai/aiService.js";
import { createProvider } from "../services/ai/providerFactory.js";
import { requestJson } from "../services/ai/httpClient.js";

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Provider-independent AI infrastructure", () => {
  test("disabled and unsupported providers fail with normalized errors", async () => {
    const disabled = createProvider({ provider: "disabled" });
    await expect(disabled.generate({ input: "hello" })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED", provider: "disabled" });
    expect(() => createProvider({ provider: "unknown-provider" })).toThrow("Unsupported AI provider");
  });

  test("OpenAI uses the Responses API contract and extracts output text", async () => {
    let captured;
    const provider = createProvider({ provider: "openai", apiKey: "test-key", model: "test-model", timeoutMs: 100, maxRetries: 0, fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return jsonResponse({ id: "resp_test", model: "test-model", output_text: "Grounded answer", usage: { total_tokens: 10 } });
    } });
    const result = await provider.generate({ instructions: "Use context", input: "Find mentors", maxOutputTokens: 300 });
    expect(captured.url).toBe("https://api.openai.com/v1/responses");
    expect(captured.options.headers.Authorization).toBe("Bearer test-key");
    expect(captured.body).toMatchObject({ model: "test-model", input: "Find mentors", instructions: "Use context", store: false, max_output_tokens: 300 });
    expect(result).toMatchObject({ provider: "openai", responseId: "resp_test", text: "Grounded answer" });
  });

  test("Gemini and Groq adapters normalize their different response shapes", async () => {
    const gemini = createProvider({ provider: "gemini", apiKey: "key", model: "gemini-test", timeoutMs: 100, maxRetries: 0, fetchImpl: async () => jsonResponse({ candidates: [{ content: { parts: [{ text: "Gemini answer" }] } }], usageMetadata: { totalTokenCount: 8 } }) });
    const groq = createProvider({ provider: "groq", apiKey: "key", model: "groq-test", timeoutMs: 100, maxRetries: 0, fetchImpl: async () => jsonResponse({ id: "groq-id", model: "groq-test", choices: [{ message: { content: "Groq answer" } }], usage: { total_tokens: 7 } }) });
    await expect(gemini.generate({ instructions: "i", input: "u", maxOutputTokens: 100 })).resolves.toMatchObject({ provider: "gemini", text: "Gemini answer" });
    await expect(groq.generate({ instructions: "i", input: "u", maxOutputTokens: 100 })).resolves.toMatchObject({ provider: "groq", text: "Groq answer" });
  });

  test("HTTP client retries transient failures and enforces timeouts", async () => {
    let attempts = 0;
    const payload = await requestJson({ provider: "test", url: "https://provider.test", headers: {}, body: {}, timeoutMs: 100, maxRetries: 1, fetchImpl: async () => {
      attempts += 1;
      return attempts === 1 ? jsonResponse({ error: { message: "busy" } }, 503) : jsonResponse({ ok: true });
    } });
    expect(payload.ok).toBe(true);
    expect(attempts).toBe(2);
    await expect(requestJson({ provider: "test", url: "https://provider.test", headers: {}, body: {}, timeoutMs: 5, maxRetries: 0, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))) })).rejects.toMatchObject({ code: "AI_TIMEOUT", status: 504 });
  });

  test("AI service routes intent, bounds context, and parses provider-neutral JSON", async () => {
    let call;
    const service = createAIService({ providerInstance: { name: "fake", generate: async (input) => { call = input; return { provider: "fake", model: "fixture", text: '{"actions":["Complete profile"]}' }; } } });
    const result = await service.generate({
      userInput: "How can I improve my profile?",
      context: { user: { _id: "user-1", name: "Sam", email: "private@example.com", bio: "Builder" }, skills: [{ _id: "skill-1", name: "JavaScript" }] },
      output: "json",
    });
    expect(result.intent).toBe("improve_profile");
    expect(result.data).toEqual({ actions: ["Complete profile"] });
    expect(call.input).not.toContain("private@example.com");
    expect(call.maxOutputTokens).toBe(800);
  });
});
