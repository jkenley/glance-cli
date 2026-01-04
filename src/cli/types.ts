/**
 * Type definitions for CLI modules
 */

// Service detection types
export interface ServiceStatus {
  ollama: {
    available: boolean;
    models?: string[];
    error?: string;
  };
  openai: {
    available: boolean;
    error?: string;
  };
  gemini: {
    available: boolean;
    error?: string;
  };
  elevenlabs: {
    available: boolean;
    voices?: string[];
    error?: string;
  };
  defaultModel?: string;
  priority?: string;
  recommendations?: string[];
}

// Voice synthesis types
export interface VoiceOptions {
  voice?: string;
  language?: string;
  speed?: number;
  pitch?: number;
}

// Cache options types
export interface CacheOptions {
  noCache?: boolean;
  ttl?: number;
  compress?: boolean;
}

// Model provider types
export type ModelProvider = "openai" | "google" | "ollama" | "auto";

// Summary types
export interface SummaryOptions {
  tldr?: boolean;
  keyPoints?: boolean;
  eli5?: boolean;
  full?: boolean;
  customQuestion?: string;
  language?: string;
  stream?: boolean;
  maxTokens?: number;
}

// Fetch options types
export interface FetchOptions {
  fullRender?: boolean;
  timeout?: number;
  userAgent?: string;
}

// Format options types
export interface FormatOptions {
  url?: string;
  language?: string;
  customQuestion?: string;
  customTitle?: string;
  isFullContent?: boolean;
}

// CLI parsed values types
export interface CliValues {
  help?: boolean;
  version?: boolean;
  tldr?: boolean;
  "key-points"?: boolean;
  eli5?: boolean;
  full?: boolean;
  ask?: string;
  language?: string;
  read?: boolean;
  voice?: string;
  "list-voices"?: boolean;
  "audio-output"?: string;
  model?: string;
  "list-models"?: boolean;
  stream?: boolean;
  "max-tokens"?: string;
  "check-services"?: boolean;
  "free-only"?: boolean;
  "prefer-quality"?: boolean;
  "no-cache"?: boolean;
  "clear-cache"?: boolean;
  "full-render"?: boolean;
  screenshot?: string;
  metadata?: boolean;
  links?: boolean;
  debug?: boolean;
}

// Error types with proper structure
export interface GlanceErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  recoverable?: boolean;
  hint?: string;
  cause?: Error;
}