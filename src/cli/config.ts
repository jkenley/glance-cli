/**
 * Configuration module for Glance CLI
 * Centralizes all configuration constants and settings
 */

export const VERSION = "0.10.2";

export const CONFIG = {
  VERSION,
  MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB
  FETCH_TIMEOUT: 30000, // 30s
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  OLLAMA_ENDPOINT: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
} as const;

export const LANGUAGE_MAP: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  ht: "Haitian Creole",
} as const;

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_MAP);