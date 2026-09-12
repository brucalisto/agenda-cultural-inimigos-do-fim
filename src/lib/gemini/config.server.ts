/**
 * AI provider configuration
 * Loaded only on the server to prevent exposure of keys.
 */

export const MISTRAL_CONFIG = {
  MODEL_NAME: "mistral-small-latest",
  API_URL: "https://api.mistral.ai/v1",
  MAX_OUTPUT_TOKENS: 1600,
};

export const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.5-flash-lite",
  PROMPT_VERSION: "1.5.0",
  MAX_OUTPUT_TOKENS: 1600,
  TEMPERATURE: 0.1,
};

export const CLOUDFLARE_CONFIG = {
  PRIMARY_MODEL_NAME: "@cf/qwen/qwen3.8-27b",
  FALLBACK_MODEL_NAME: "@cf/meta/llama-4-scout-17b-16e-instruct",
  API_URL: "https://api.cloudflare.com/client/v4/accounts",
  MAX_OUTPUT_TOKENS: 1600,
};

export const GROQ_CONFIG = {
  MODEL_NAME: "qwen/qwen3.8-27b",
  AUDIO_MODEL_NAME: "whisper-large-v3-turbo",
  API_URL: "https://api.groq.com/openai/v1",
  MAX_OUTPUT_TOKENS: 1200,
};

export const OPENROUTER_CONFIG = {
  // Última contingência: deixa o OpenRouter escolher um modelo gratuito disponível.
  MODEL_NAME: "openrouter/free",
  API_URL: "https://openrouter.ai/api/v1",
  MAX_OUTPUT_TOKENS: 1400,
};
