/**
 * Gemini Configuration
 * Loaded only on the server to prevent exposure of keys.
 */

export const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-1.5-flash",
  PROMPT_VERSION: "1.0.0",
  MAX_OUTPUT_TOKENS: 2048,
  TEMPERATURE: 0.1, // Low temperature for consistent structured output
};
