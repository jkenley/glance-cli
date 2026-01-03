/**
 * Input validation utilities for Glance CLI
 */

import { LANGUAGE_MAP } from "./config";

export function validateURL(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    
    if (!["http:", "https:"].includes(url.protocol)) {
      return { 
        valid: false, 
        error: "Only HTTP and HTTPS URLs are supported" 
      };
    }
    
    if (!url.hostname || url.hostname.length < 3) {
      return { 
        valid: false, 
        error: "Invalid hostname" 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: "Invalid URL format. Please provide a valid URL starting with http:// or https://" 
    };
  }
}

export function validateLanguage(lang: string): { valid: boolean; error?: string } {
  const supportedLanguages = Object.keys(LANGUAGE_MAP);
  
  if (!supportedLanguages.includes(lang)) {
    return {
      valid: false,
      error: `Language '${lang}' is not supported. Supported languages: ${supportedLanguages.join(", ")}`
    };
  }
  
  return { valid: true };
}

export function validateMaxTokens(value: string | undefined): { valid: boolean; parsed?: number; error?: string } {
  if (!value) {
    return { valid: true };
  }
  
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    return {
      valid: false,
      error: "max-tokens must be a valid number"
    };
  }
  
  if (parsed < 1 || parsed > 100000) {
    return {
      valid: false,
      error: "max-tokens must be between 1 and 100000"
    };
  }
  
  return { valid: true, parsed };
}

export async function validateAPIKeys(provider: "openai" | "google" | "ollama"): Promise<{ valid: boolean; error?: string; hint?: string }> {
  switch (provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          valid: false,
          error: "OpenAI API key not found",
          hint: "Set your API key with: export OPENAI_API_KEY=sk-..."
        };
      }
      
      if (!apiKey.startsWith("sk-")) {
        return {
          valid: false,
          error: "Invalid OpenAI API key format",
          hint: "OpenAI API keys should start with 'sk-'"
        };
      }
      
      // Basic length check
      if (apiKey.length < 40) {
        return {
          valid: false,
          error: "OpenAI API key appears to be incomplete",
          hint: "Make sure you've copied the entire API key"
        };
      }
      
      return { valid: true };
    }
    
    case "google": {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return {
          valid: false,
          error: "Gemini API key not found",
          hint: "Set your API key with: export GEMINI_API_KEY=..."
        };
      }
      
      // Basic length check for Google API keys
      if (apiKey.length < 30) {
        return {
          valid: false,
          error: "Gemini API key appears to be incomplete",
          hint: "Make sure you've copied the entire API key"
        };
      }
      
      return { valid: true };
    }
    
    case "ollama": {
      // Ollama doesn't require API keys, just check if it's running
      const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${endpoint}/api/version`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          return {
            valid: false,
            error: `Ollama is not responding at ${endpoint}`,
            hint: "Make sure Ollama is running. Start it with: ollama serve"
          };
        }
        
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: `Cannot connect to Ollama at ${endpoint}`,
          hint: "Install and start Ollama: https://ollama.ai/download"
        };
      }
    }
    
    default:
      return {
        valid: false,
        error: `Unknown provider: ${provider}`
      };
  }
}