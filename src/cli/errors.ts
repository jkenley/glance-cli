/**
 * Custom error types for Glance CLI
 */

export class GlanceError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public recoverable: boolean = false,
    public hint?: string
  ) {
    super(message);
    this.name = "GlanceError";
  }
}

export const ErrorCodes = {
  INVALID_URL: "INVALID_URL",
  INVALID_LANGUAGE: "INVALID_LANGUAGE",
  INVALID_MAX_TOKENS: "INVALID_MAX_TOKENS",
  API_KEY_MISSING: "API_KEY_MISSING",
  API_KEY_INVALID: "API_KEY_INVALID",
  FETCH_FAILED: "FETCH_FAILED",
  CONTENT_TOO_LARGE: "CONTENT_TOO_LARGE",
  SUMMARIZE_FAILED: "SUMMARIZE_FAILED",
  CACHE_ERROR: "CACHE_ERROR",
  VOICE_SYNTHESIS_FAILED: "VOICE_SYNTHESIS_FAILED",
  SCREENSHOT_FAILED: "SCREENSHOT_FAILED",
  EXPORT_FAILED: "EXPORT_FAILED",
} as const;