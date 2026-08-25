/**
 * Gemini Configuration
 * Loaded only on the server to prevent exposure of keys.
 */

export const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  PROMPT_VERSION: "1.3.1",
  MAX_OUTPUT_TOKENS: 8192,
  TEMPERATURE: 0.1, // Low temperature for consistent structured output
};
