/**
 * AI provider configuration
 * Loaded only on the server to prevent exposure of keys.
 */

export const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  PROMPT_VERSION: "1.4.2",
  MAX_OUTPUT_TOKENS: 1800,
  TEMPERATURE: 0.1,
};

export const GROQ_CONFIG = {
  // GPT-OSS 20B is a current Groq production model and is better suited to
  // structured extraction than the preview Qwen model we were using.
  MODEL_NAME: "openai/gpt-oss-20b",
  AUDIO_MODEL_NAME: "whisper-large-v3-turbo",
  API_URL: "https://api.groq.com/openai/v1",
  // Keep completion compact to stay comfortably inside free-tier limits.
  MAX_OUTPUT_TOKENS: 800,
};

export const OPENROUTER_CONFIG = {
  // Let OpenRouter choose among currently available free models instead of
  // pinning the app to one upstream model that can become rate-limited.
  MODEL_NAME: "openrouter/free",
  API_URL: "https://openrouter.ai/api/v1",
  MAX_OUTPUT_TOKENS: 1600,
};
