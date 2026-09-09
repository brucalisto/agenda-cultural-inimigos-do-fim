/**
 * AI provider configuration
 * Loaded only on the server to prevent exposure of keys.
 */

export const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  PROMPT_VERSION: "1.4.2",
  MAX_OUTPUT_TOKENS: 8192,
  TEMPERATURE: 0.1, // Low temperature for consistent structured output
};

export const GROQ_CONFIG = {
  MODEL_NAME: "qwen/qwen3.6-27b",
  AUDIO_MODEL_NAME: "whisper-large-v3-turbo",
  API_URL: "https://api.groq.com/openai/v1",
  // The current Groq tier enforces 1,000 output tokens/minute for this model.
  // Keep the request below that ceiling so fallback can actually complete.
  MAX_OUTPUT_TOKENS: 800,
};

export const OPENROUTER_CONFIG = {
  // Use a concrete free multimodal model instead of the generic free router.
  // This removes one routing step and is better suited to structured extraction.
  MODEL_NAME: "google/gemma-4-26b-a4b-it:free",
  API_URL: "https://openrouter.ai/api/v1",
  MAX_OUTPUT_TOKENS: 1200,
};
