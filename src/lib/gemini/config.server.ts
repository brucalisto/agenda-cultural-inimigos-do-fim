/**
 * Gemini Configuration
 * Loaded only on the server to prevent exposure of keys.
 */

export const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  PROMPT_VERSION: "1.4.1",
  MAX_OUTPUT_TOKENS: 8192,
  TEMPERATURE: 0.1, // Low temperature for consistent structured output
};

export const GROQ_CONFIG = {
  MODEL_NAME: "qwen/qwen3.6-27b",
  AUDIO_MODEL_NAME: "whisper-large-v3-turbo",
  API_URL: "https://api.groq.com/openai/v1",
  MAX_OUTPUT_TOKENS: 4096,
};
