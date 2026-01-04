/**
 * Command handlers for Glance CLI
 * Exports individual command functions that can be used programmatically
 */

import chalk from "chalk";
import { writeFile } from "node:fs/promises";
import { fetchPage } from "../core/fetcher";
import { extractCleanText, extractLinks, extractMetadata } from "../core/extractor";
import { summarize, detectProvider } from "../core/summarizer";
import { formatOutput } from "../core/formatter";
import { takeScreenshot } from "../core/screenshot";
import { createVoiceSynthesizer, cleanTextForSpeech } from "../core/voice";
import { getDefaultModel, showCostWarning } from "../core/service-detector";
import { sanitizeAIResponse } from "../core/text-cleaner";
import { detectLanguage, shouldAutoDetectLanguage } from "../core/language-detector";
import { LANGUAGE_MAP, CONFIG } from "./config";
import { GlanceError, ErrorCodes } from "./errors";
import { logger } from "./logger";
import { createSpinner, sanitizeOutputForTerminal, withRetry, formatFileSize, getFileExtension } from "./utils";
import { showServiceStatus } from "./display";
import { validateAPIKeys } from "./validators";
import type { ServiceStatus } from "./types";

export interface GlanceOptions {
  url?: string;
  model?: string;
  language?: string;
  tldr?: boolean;
  keyPoints?: boolean;
  eli5?: boolean;
  full?: boolean;
  customQuestion?: string;
  stream?: boolean;
  maxTokens?: number;
  export?: string;
  screenshot?: string;
  fullRender?: boolean;
  metadata?: boolean;
  links?: boolean;
  read?: boolean;
  voice?: string;
  audioOutput?: string;
  listVoices?: boolean;
  checkServices?: boolean;
  freeOnly?: boolean;
  preferQuality?: boolean;
  debug?: boolean;
}

/**
 * Main glance command - fetch and summarize a webpage
 */
export async function glance(url: string, options: GlanceOptions = {}): Promise<string> {
  const startTime = Date.now();

  // Set debug logging if requested
  if (options.debug) {
    logger.setLevel("debug");
  }

  // Language will be determined after fetching content
  let language: string = options.language || "en";
  let languageName = LANGUAGE_MAP[language as keyof typeof LANGUAGE_MAP] || "English";

  // Note: Caching temporarily disabled to eliminate corruption issues

  // Fetch the webpage
  const fetchSpinner = createSpinner("Fetching webpage...");
  fetchSpinner.start();

  let html: string;
  try {
    html = await withRetry(
      () => fetchPage(url, { fullRender: options.fullRender }),
      {
        onRetry: (attempt, error) => {
          fetchSpinner.text = `Fetching webpage... (retry ${attempt})`;
        }
      }
    );
    fetchSpinner.succeed("Webpage fetched successfully");
  } catch (error: any) {
    fetchSpinner.fail("Failed to fetch webpage");
    throw new GlanceError(
      error.message,
      ErrorCodes.FETCH_FAILED,
      "Could not fetch the webpage. Please check the URL and your internet connection.",
      true,
      "Try again or use --full-render for JavaScript-heavy sites"
    );
  }

  // Extract content
  const extractSpinner = createSpinner("Extracting content...");
  extractSpinner.start();

  const cleanText = extractCleanText(html);

  // Auto-detect language if not specified by user
  if (!options.language && shouldAutoDetectLanguage()) {
    const detectionResult = detectLanguage(url, html, cleanText, options.language);
    language = detectionResult.detected;
    languageName = LANGUAGE_MAP[language as keyof typeof LANGUAGE_MAP] || "English";

    // Show detection info to user if confidence is not high
    if (detectionResult.confidence !== 'high' && detectionResult.source !== 'default') {
      logger.info(`Auto-detected language: ${languageName}`);
    }

    // Log detection result if in debug mode
    if (options.debug) {
      logger.debug(`Language detected: ${language} (${detectionResult.confidence} confidence from ${detectionResult.source})`);
      logger.debug(`Detection signals: ${detectionResult.signals.join(', ')}`);
    }
  }

  if (cleanText.length > CONFIG.MAX_CONTENT_SIZE) {
    extractSpinner.fail("Content too large");
    throw new GlanceError(
      `Content size (${formatFileSize(cleanText.length)}) exceeds maximum allowed`,
      ErrorCodes.CONTENT_TOO_LARGE,
      `The webpage content is too large to process (>${formatFileSize(CONFIG.MAX_CONTENT_SIZE)})`,
      false
    );
  }

  extractSpinner.succeed(`Content extracted (${formatFileSize(cleanText.length)})`);

  // Handle metadata extraction
  if (options.metadata) {
    const metadata = extractMetadata(html);
    console.log(chalk.bold("\n📊 Page Metadata:"));
    console.log(formatOutput(JSON.stringify(metadata, null, 2), {
      format: "json",
      url: url
    }));
  }

  // Handle links extraction
  if (options.links) {
    const links = extractLinks(html);
    console.log(chalk.bold(`\n🔗 Found ${links.length} links:`));
    links.forEach(link => {
      const display = link.text ? `${link.text} (${link.href})` : link.href;
      console.log(chalk.cyan(`  • ${display}`));
    });
  }

  // Handle screenshot
  if (options.screenshot) {
    await handleScreenshot(url, options.screenshot);
  }

  // Handle full content mode (no summarization)
  if (options.full) {
    const fullContent = await handleFullContent(cleanText, { language, ...options });

    // Note: Caching disabled

    return fullContent;
  }

  // Summarize content with detected or specified language
  const { rawSummary, formattedSummary } = await summarizeContentWithRaw(cleanText, url, { ...options, language });

  // Note: Caching disabled

  // Display summary immediately if voice synthesis is requested
  if (options.read || options.audioOutput) {
    // Show the full formatted summary first
    console.log(formattedSummary);
    console.log(""); // Add spacing

    // Then clean the raw text for speech and read it aloud
    const cleanedSummary = cleanTextForSpeech(rawSummary);
    await handleVoiceSynthesis(cleanedSummary, { language, ...options });
    return formattedSummary;
  }

  const summary = formattedSummary;

  const duration = Date.now() - startTime;
  logger.debug(`Total execution time: ${duration}ms`);

  return summary;
}

/**
 * Handle full content mode with optional AI formatting and translation
 */
async function handleFullContent(
  content: string,
  options: GlanceOptions & { language: string }
): Promise<string> {
  let finalContent = content;
  const needsTranslation = options.language && options.language !== "en";

  if (needsTranslation || true) { // Always apply smart formatting for better readability
    const fullModeSpinner = createSpinner(
      needsTranslation
        ? "🌍 Translating and formatting full content..."
        : "🧾 Applying smart formatting..."
    );
    fullModeSpinner.start();

    try {
      // Determine model to use
      const model = options.model || await getDefaultModel(undefined, !!options.preferQuality);
      const provider = detectProvider(model);

      // Use AI for translation or formatting
      const aiOptions = {
        model,
        language: options.language,
        stream: false, // Don't stream for full content
        maxTokens: options.maxTokens || 8000,
        translate: needsTranslation,
        format: true, // Always apply smart formatting
      };

      const processedContent = await summarize(finalContent, {
        model: aiOptions.model,
        language: aiOptions.language,
        stream: aiOptions.stream,
        maxTokens: aiOptions.maxTokens,
        translate: aiOptions.translate as boolean | undefined,
        format: aiOptions.format,
      });

      finalContent = sanitizeAIResponse(processedContent);

      fullModeSpinner.succeed(
        needsTranslation
          ? "Translation and formatting complete"
          : "Smart formatting applied"
      );
    } catch (error: any) {
      fullModeSpinner.fail(
        needsTranslation
          ? "Translation failed - showing original content"
          : "Smart formatting failed - showing original content"
      );
      logger.error("Full content processing error:", error);
    }
  }

  // Format the output
  const formattedOutput = formatOutput(finalContent, {
    format: "terminal",
    url: "full-content",
    isFullContent: true,
  });

  // Export if requested
  if (options.export) {
    await exportContent(formattedOutput, options.export, { isFullContent: true });
  }

  return formattedOutput;
}

/**
 * Summarize content using AI - returns both raw and formatted versions
 */
async function summarizeContentWithRaw(
  content: string,
  url: string,
  options: GlanceOptions & { language: string }
): Promise<{ rawSummary: string; formattedSummary: string }> {
  const model = options.model || await getDefaultModel(undefined, !!options.preferQuality);

  // Show cost warning if using premium model
  if (!options.freeOnly) {
    await showCostWarning(model);
  }

  const summarizeSpinner = options.stream
    ? null
    : createSpinner(`Processing with ${model}...`);

  summarizeSpinner?.start();

  try {
    const rawSummary = await withRetry(
      () => summarize(content, {
        model,
        tldr: options.tldr,
        keyPoints: options.keyPoints,
        eli5: options.eli5,
        language: options.language,
        stream: options.stream,
        maxTokens: options.maxTokens,
        customQuestion: options.customQuestion,
      }),
      {
        attempts: 2,
        onRetry: (attempt) => {
          if (summarizeSpinner) {
            summarizeSpinner.text = `Processing with ${model}... (retry ${attempt})`;
          }
        }
      }
    );

    summarizeSpinner?.succeed("Summary generated successfully");

    // Clean and format the summary
    const cleanSummary = sanitizeOutputForTerminal(sanitizeAIResponse(rawSummary));
    const formattedSummary = formatOutput(cleanSummary, {
      format: "terminal",
      url: url,
      customQuestion: options.customQuestion,
    });

    // Export if requested
    if (options.export) {
      await exportContent(formattedSummary, options.export, { url });
    }

    return { rawSummary: cleanSummary, formattedSummary };
  } catch (error: any) {
    summarizeSpinner?.fail("Failed to generate summary");
    throw new GlanceError(
      error.message,
      ErrorCodes.SUMMARIZE_FAILED,
      "Failed to generate summary. The AI service might be unavailable.",
      true,
      "Try a different model with --model or check your API keys"
    );
  }
}

/**
 * Summarize content using AI
 */
async function summarizeContent(
  content: string,
  url: string,
  options: GlanceOptions & { language: string }
): Promise<string> {
  const model = options.model || await getDefaultModel(undefined, !!options.preferQuality);

  // Show cost warning if using premium model
  if (!options.freeOnly) {
    await showCostWarning(model);
  }

  const summarizeSpinner = options.stream
    ? null
    : createSpinner(`Processing with ${model}...`);

  summarizeSpinner?.start();

  try {
    const summary = await withRetry(
      () => summarize(content, {
        model,
        tldr: options.tldr,
        keyPoints: options.keyPoints,
        eli5: options.eli5,
        language: options.language,
        stream: options.stream,
        maxTokens: options.maxTokens,
        customQuestion: options.customQuestion,
      }),
      {
        attempts: 2,
        onRetry: (attempt) => {
          if (summarizeSpinner) {
            summarizeSpinner.text = `Processing with ${model}... (retry ${attempt})`;
          }
        }
      }
    );

    summarizeSpinner?.succeed("Summary generated successfully");

    // Clean and format the summary
    const cleanSummary = sanitizeOutputForTerminal(sanitizeAIResponse(summary));
    const formattedSummary = formatOutput(cleanSummary, {
      format: "terminal",
      url: url,
      customQuestion: options.customQuestion,
    });

    // Export if requested
    if (options.export) {
      await exportContent(formattedSummary, options.export, { url });
    }

    return formattedSummary;
  } catch (error: any) {
    summarizeSpinner?.fail("Failed to generate summary");
    throw new GlanceError(
      error.message,
      ErrorCodes.SUMMARIZE_FAILED,
      "Failed to generate summary. The AI service might be unavailable.",
      true,
      "Try a different model with --model or check your API keys"
    );
  }
}

/**
 * Handle voice synthesis
 */
async function handleVoiceSynthesis(
  cleanedText: string,
  options: GlanceOptions & { language: string }
): Promise<void> {
  try {
    const synthesizer = createVoiceSynthesizer();

    if (options.audioOutput) {
      const audioSpinner = createSpinner(`🎵 Generating audio file: ${options.audioOutput}`);
      audioSpinner.start();

      // Use the already cleaned text directly
      const result = await synthesizer.synthesizeCleanedText(cleanedText, {
        voice: options.voice,
        language: options.language,
        outputFile: options.audioOutput,
      });

      if (!result.success) {
        throw new Error(result.error || 'Voice synthesis failed');
      }

      audioSpinner.succeed(`🎵 Audio saved to ${options.audioOutput}`);
    } else {
      const readSpinner = createSpinner(`🎤 Generating speech and preparing to read aloud...`);
      readSpinner.start();

      // Use the already cleaned text directly
      const result = await synthesizer.synthesizeCleanedText(cleanedText, {
        voice: options.voice,
        language: options.language,
      });

      if (!result.success) {
        throw new Error(result.error || 'Voice synthesis failed');
      }

      readSpinner.succeed(`🎤 Reading aloud completed`);
    }
  } catch (error: any) {
    logger.error("Voice synthesis failed:", error);
    throw new GlanceError(
      error.message,
      ErrorCodes.VOICE_SYNTHESIS_FAILED,
      "Failed to synthesize voice. Check your voice settings or try a different voice.",
      false
    );
  }
}

/**
 * Handle screenshot capture
 */
async function handleScreenshot(url: string, filename: string): Promise<void> {
  const screenshotSpinner = createSpinner(`Capturing screenshot: ${filename}`);
  screenshotSpinner.start();

  try {
    await takeScreenshot(url, filename);
    screenshotSpinner.succeed(`Screenshot saved to ${filename}`);
  } catch (error: any) {
    screenshotSpinner.fail("Failed to capture screenshot");
    logger.error("Screenshot error:", error);
  }
}

/**
 * Export content to file
 */
async function exportContent(
  content: string,
  filename: string,
  options: { url?: string; isFullContent?: boolean } = {}
): Promise<void> {
  const extension = getFileExtension(filename);
  const format = extension || "txt";

  const formattedContent = formatOutput(content, {
    format: format as "terminal" | "markdown" | "json" | "html" | "plain",
    url: options.url || "exported-content",
    isFullContent: options.isFullContent,
  });

  try {
    await writeFile(filename, formattedContent, "utf-8");
    logger.info(`Content exported to ${filename}`);
  } catch (error: any) {
    throw new GlanceError(
      error.message,
      ErrorCodes.EXPORT_FAILED,
      `Failed to export content to ${filename}`,
      false
    );
  }
}

// Cache functionality removed - see next-features/cache-system-plan.md

/**
 * List voices command
 */
export async function listVoicesCommand(): Promise<void> {
  try {
    const synthesizer = createVoiceSynthesizer();
    // Get all available voices
    const englishVoices = await synthesizer.listVoices("en");
    const frenchVoices = await synthesizer.listVoices("fr");
    const spanishVoices = await synthesizer.listVoices("es");
    const haitianVoices = await synthesizer.listVoices("ht");

    console.log(chalk.bold("\n🎤 Available Voices by Language:\n"));

    if (englishVoices.length > 0) {
      console.log(chalk.bold("🇺🇸 English:"));
      englishVoices.forEach(v => console.log(`  ${v}`));
    }

    if (frenchVoices.length > 0) {
      console.log(chalk.bold("\n🇫🇷 French:"));
      frenchVoices.forEach(v => console.log(`  ${v}`));
    }

    if (spanishVoices.length > 0) {
      console.log(chalk.bold("\n🇪🇸 Spanish:"));
      spanishVoices.forEach(v => console.log(`  ${v}`));
    }

    if (haitianVoices.length > 0) {
      console.log(chalk.bold("\n🇭🇹 Haitian Creole:"));
      haitianVoices.forEach(v => console.log(`  ${v}`));
    }

    console.log(chalk.dim("\nUse with: glance <url> --voice <voice-name> --read"));
  } catch (error: any) {
    logger.error("Failed to list voices:", error);
    throw error;
  }
}

/**
 * Check services command
 */
export async function checkServicesCommand(): Promise<void> {
  const spinner = createSpinner("Detecting available services...");
  spinner.start();

  try {
    // Use our own validators instead of the old detectServices
    const [ollamaCheck, openaiCheck, geminiCheck] = await Promise.all([
      validateAPIKeys("ollama").catch(() => ({ valid: false, error: "Connection failed" })),
      validateAPIKeys("openai").catch(() => ({ valid: false, error: "API key missing" })),
      validateAPIKeys("google").catch(() => ({ valid: false, error: "API key missing" }))
    ]);

    // Get Ollama models if available
    let ollamaModels: string[] = [];
    if (ollamaCheck.valid) {
      try {
        const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
        const response = await fetch(`${endpoint}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          ollamaModels = data.models?.map((m: any) => m.name) || [];
        }
      } catch {
        // Ignore model fetch errors
      }
    }

    // Check ElevenLabs
    const elevenlabsCheck = {
      valid: !!process.env.ELEVENLABS_API_KEY,
      error: process.env.ELEVENLABS_API_KEY ? undefined : "API key missing"
    };

    spinner.succeed("Service detection complete");

    const serviceStatus: ServiceStatus = {
      ollama: {
        available: ollamaCheck.valid,
        models: ollamaModels,
        error: ollamaCheck.error
      },
      openai: {
        available: openaiCheck.valid,
        error: openaiCheck.error
      },
      gemini: {
        available: geminiCheck.valid,
        error: geminiCheck.error
      },
      elevenlabs: {
        available: elevenlabsCheck.valid,
        voices: [], // Could be populated with API call if needed
        error: elevenlabsCheck.error
      },
      defaultModel: ollamaCheck.valid ? "ollama" : openaiCheck.valid ? "gpt-4o-mini" : geminiCheck.valid ? "gemini-2.0-flash-exp" : "None available",
      priority: "Free services first",
      recommendations: []
    };

    // Add recommendations based on missing services
    if (!serviceStatus.ollama.available) {
      serviceStatus.recommendations?.push("Install Ollama for free local AI");
    }
    if (!serviceStatus.openai.available) {
      serviceStatus.recommendations?.push("Add OpenAI API key for premium quality");
    }
    if (!serviceStatus.elevenlabs.available) {
      serviceStatus.recommendations?.push("Add ElevenLabs API key for natural voice synthesis");
    }

    showServiceStatus(serviceStatus);
  } catch (error: any) {
    spinner.fail("Service detection failed");
    logger.error("Service detection error:", error);

    // Show empty status with error message
    const emptyStatus: ServiceStatus = {
      ollama: { available: false, error: "Detection failed" },
      openai: { available: false, error: "Detection failed" },
      gemini: { available: false, error: "Detection failed" },
      elevenlabs: { available: false, error: "Detection failed" },
      recommendations: ["Check your internet connection and try again"]
    };

    showServiceStatus(emptyStatus);
    throw error;
  }
}

/**
 * List Ollama models command
 */
export async function listModelsCommand(): Promise<void> {
  const endpoint = process.env.OLLAMA_ENDPOINT || CONFIG.OLLAMA_ENDPOINT;
  const spinner = createSpinner("Fetching Ollama models...");
  spinner.start();

  try {
    const response = await fetch(`${endpoint}/api/tags`);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = (await response.json()) as { models: Array<{ name: string; size?: number; details?: { parameter_size?: string } }> };
    spinner.succeed("Models fetched successfully");

    if (!data.models || data.models.length === 0) {
      console.log(chalk.yellow("\nNo models found. Install models with:"));
      console.log(chalk.cyan("  ollama pull llama3"));
      console.log(chalk.cyan("  ollama pull mistral"));
      return;
    }

    console.log(chalk.bold(`\n📦 Available Ollama Models (${data.models.length}):\n`));

    data.models.forEach((model: any) => {
      const size = model.size ? `(${(model.size / 1e9).toFixed(1)}GB)` : "";
      console.log(`  ${chalk.cyan(model.name)} ${chalk.gray(size)}`);
      if (model.details?.parameter_size) {
        console.log(`    ${chalk.gray(model.details.parameter_size)} parameters`);
      }
    });

    console.log(chalk.dim("\nUse any model with: glance <url> --model <model-name>"));
  } catch (error: any) {
    spinner.fail("Failed to fetch models");
    console.error(chalk.red("\nCannot connect to Ollama. Make sure it's running:"));
    console.log(chalk.cyan("  ollama serve"));
    throw error;
  }
}