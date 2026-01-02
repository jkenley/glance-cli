/**
 * glance v0.7.0 – Production-Ready AI Web Reader CLI
 * 
 * Production Enhancements:
 * - Comprehensive error handling with retry logic
 * - Input validation and sanitization
 * - Provider health checks
 * - Structured logging with levels
 * - Performance tracking
 * - Graceful degradation
 * - Better user feedback
 *
 * Features:
 * - Multi-provider: OpenAI (gpt-*), Google Gemini (gemini-*), Ollama (local models)
 * - --ask / -q custom questions
 * - Streaming, caching, export, max-tokens, languages, emoji, tldr, key-points, eli5
 * - Full rendering, screenshot, links, metadata
 * - --list-models for Ollama
 * - Expert-level prompt engineering for superior results
 */

import { parseArgs } from "node:util";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";

import { fetchPage } from "./core/fetcher";
import { extractCleanText, extractLinks, extractMetadata } from "./core/extractor";
import { summarize } from "./core/summarizer";
import { formatOutput } from "./core/formatter";
import { takeScreenshot } from "./core/screenshot";
import { getCacheKey, getCache, setCache, clearCache } from "./core/cache";
import { detectProvider } from "./core/summarizer";
import { createVoiceSynthesizer } from "./core/voice";
import { detectServices, getDefaultModel, showCostWarning, shouldUseFreeOnly } from "./core/service-detector";

// === Configuration ===
const CONFIG = {
  VERSION: "0.8.0",
  MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB
  FETCH_TIMEOUT: 30000, // 30s
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  OLLAMA_ENDPOINT: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
} as const;

// === Custom Error Types ===
class GlanceError extends Error {
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

// === Logging Utility ===
const logger = {
  level: "info" as "debug" | "info" | "warn" | "error",

  setLevel(level: "debug" | "info" | "warn" | "error") {
    this.level = level;
  },

  debug(...args: any[]) {
    if (this.level === "debug") {
      console.log(chalk.gray("[DEBUG]"), ...args);
    }
  },

  info(...args: any[]) {
    if (["debug", "info"].includes(this.level)) {
      console.log(chalk.blue("[INFO]"), ...args);
    }
  },

  warn(...args: any[]) {
    if (["debug", "info", "warn"].includes(this.level)) {
      console.warn(chalk.yellow("[WARN]"), ...args);
    }
  },

  error(...args: any[]) {
    console.error(chalk.red("[ERROR]"), ...args);
  },

  success(...args: any[]) {
    console.log(chalk.green("[SUCCESS]"), ...args);
  },
};

// === Validation Functions ===
/**
 * Validate the URL for a given string
 * @param urlString - The URL to validate
 * @returns The validation result
 */
function validateURL(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { valid: false, error: "URL must use http:// or https:// protocol" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format. Must include protocol (http:// or https://)" };
  }
}

/**
 * Validate the language for a given string
 * @param lang - The language to validate
 * @returns The validation result
 */
function validateLanguage(lang: string): { valid: boolean; error?: string } {
  const supported = ["en", "fr", "es", "ht"];
  if (!supported.includes(lang)) {
    return {
      valid: false,
      error: `Unsupported language "${lang}". Supported: ${supported.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * Validate the maximum tokens for a given value
 * @param value - The value to validate
 * @returns The validation result
 */
function validateMaxTokens(value: string | undefined): { valid: boolean; parsed?: number; error?: string } {
  if (!value) return { valid: true };

  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: "--max-tokens must be a number" };
  }
  if (num <= 0) {
    return { valid: false, error: "--max-tokens must be positive" };
  }
  if (num > 100000) {
    return { valid: false, error: "--max-tokens exceeds maximum (100,000)" };
  }

  return { valid: true, parsed: num };
}

/**
 * Validate the API keys for a given provider
 * @param provider - The provider to validate the API keys for
 * @returns The validation result
 */
async function validateAPIKeys(provider: "openai" | "google" | "ollama"): Promise<{ valid: boolean; error?: string; hint?: string }> {
  switch (provider) {
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        return {
          valid: false,
          error: "OPENAI_API_KEY environment variable not set",
          hint: "Get your API key from https://platform.openai.com/api-keys\nThen: export OPENAI_API_KEY=sk-...",
        };
      }
      // Basic format check
      if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
        return {
          valid: false,
          error: "OPENAI_API_KEY appears invalid (should start with 'sk-')",
          hint: "Double-check your API key from https://platform.openai.com/api-keys",
        };
      }
      return { valid: true };

    case "google":
      if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        return {
          valid: false,
          error: "GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set",
          hint: "Get your API key from https://makersuite.google.com/app/apikey\nThen: export GEMINI_API_KEY=...",
        };
      }
      return { valid: true };

    case "ollama":
      // Health check
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${CONFIG.OLLAMA_ENDPOINT}/api/tags`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          return {
            valid: false,
            error: "Ollama server responded with error",
            hint: "Check if Ollama is running: ollama serve",
          };
        }
        return { valid: true };
      } catch (err: any) {
        if (err.name === "AbortError") {
          return {
            valid: false,
            error: "Ollama server not responding (timeout)",
            hint: "Start Ollama: ollama serve\nInstall from: https://ollama.com",
          };
        }
        return {
          valid: false,
          error: "Cannot connect to Ollama server",
          hint: "Start Ollama: ollama serve\nInstall from: https://ollama.com",
        };
      }
  }
}

// === Retry Logic ===
/**
 * Retry a given function with a given number of attempts and delay
 * @param fn - The function to retry
 * @param options - The options for the retry
 * @returns The result of the function
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const { attempts = CONFIG.RETRY_ATTEMPTS, delay = CONFIG.RETRY_DELAY, onRetry } = options;

  let lastError: any;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      // Don't retry on non-transient errors
      const status = err.status || err.code;
      const nonRetryable = [400, 401, 403, 404];
      if (nonRetryable.includes(status)) {
        throw err;
      }

      // Last attempt - don't retry
      if (i === attempts - 1) {
        throw err;
      }

      // Retry with exponential backoff
      const retryDelay = delay * Math.pow(2, i);

      if (onRetry) {
        onRetry(i + 1, err);
      }

      logger.debug(`Retry ${i + 1}/${attempts} after ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError;
}

// === Performance Tracking ===
/**
 * Performance tracker class
 */
class PerformanceTracker {
  private start: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.start = Date.now();
  }

  checkpoint(name: string) {
    this.checkpoints.set(name, Date.now());
  }

  getDuration(checkpoint?: string): number {
    const end = checkpoint ? this.checkpoints.get(checkpoint) || Date.now() : Date.now();
    return end - this.start;
  }

  getSegment(from: string, to: string): number {
    const fromTime = this.checkpoints.get(from) || this.start;
    const toTime = this.checkpoints.get(to) || Date.now();
    return toTime - fromTime;
  }

  summary(): string {
    const total = this.getDuration();
    const parts: string[] = [`Total: ${(total / 1000).toFixed(2)}s`];

    const checkpointArray = Array.from(this.checkpoints.entries()).sort((a, b) => a[1] - b[1]);
    let prev = this.start;

    for (const [name, time] of checkpointArray) {
      const duration = time - prev;
      parts.push(`${name}: ${(duration / 1000).toFixed(2)}s`);
      prev = time;
    }

    return parts.join(" | ");
  }
}

// === CLI Argument Parsing ===
/**
 * Parse the CLI arguments
 * @returns The parsed arguments
 */
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  strict: true,
  allowPositionals: true,
  options: {
    tldr: { type: "boolean", short: "t" },
    "key-points": { type: "boolean", short: "k" },
    model: { type: "string", short: "m" }, // No default - will be auto-detected
    language: { type: "string", short: "l", default: "en" },
    "max-tokens": { type: "string" },
    emoji: { type: "boolean", short: "e" },
    eli5: { type: "boolean" },
    "full-render": { type: "boolean", short: "r" },
    markdown: { type: "boolean" },
    json: { type: "boolean", short: "j" },
    screenshot: { type: "string", short: "s" },
    "raw-html": { type: "boolean" },
    links: { type: "boolean" },
    metadata: { type: "boolean" },
    export: { type: "string", short: "o" },
    stream: { type: "boolean" },
    cache: { type: "boolean", short: "c", default: true },
    "clear-cache": { type: "boolean" },
    ask: { type: "string", short: "q" },
    "list-models": { type: "boolean" },
    verbose: { type: "boolean", short: "v" },
    "dry-run": { type: "boolean", short: "d" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "V" },
    // Voice/TTS options
    read: { type: "boolean" },
    speak: { type: "boolean" },
    voice: { type: "string" },
    "audio-output": { type: "string" },
    "list-voices": { type: "boolean" },
    // Cost control options
    "free-only": { type: "boolean" },
    "prefer-quality": { type: "boolean" },
    "check-services": { type: "boolean" },
  },
});

// === Help Text ===
if (values.help) {
  console.log(chalk.cyan(`
${chalk.bold("glance")} v${CONFIG.VERSION} – AI-powered web reader

${chalk.bold("Usage:")} glance <url> [options]

${chalk.bold("Core:")}
  -t, --tldr                One-line TL;DR
  -k, --key-points          Bullet points (6-10 key insights)
      --eli5                Explain like I'm 5

${chalk.bold("Ask:")}
  -q, --ask "question"      Ask anything about the page

${chalk.bold("LLM:")}
  -m, --model <name>        Model: gpt-*, gemini-*, or local (e.g. llama3)
                            Default: Auto-detected (prefers free/local)
  -l, --language <code>     Language: en, fr, es, ht (default: en)
      --max-tokens <n>      Limit output tokens
      --free-only           Use only free services (no API costs)
      --prefer-quality      Prefer paid services for better quality

${chalk.bold("Style:")}
  -e, --emoji               Add relevant emojis

${chalk.bold("Voice/TTS:")}
      --read, --speak       Read the summary aloud (text-to-speech)
      --voice <name/id>     Voice to use (auto-selected by language)
      --audio-output <file> Save audio to file (.mp3)
      --list-voices         List available voices (language-organized)

${chalk.bold("Output:")}
      --markdown            Markdown format
  -j, --json                JSON output
  -o, --export <file>       Save to file (.txt, .md, .json)
      --stream              Live streaming output
  -c, --cache               Enable caching (default: true)

${chalk.bold("Advanced:")}
  -r, --full-render         Render JavaScript (slower, for SPAs)
  -s, --screenshot <file>   Save screenshot (.png)
      --raw-html            Print raw HTML
      --links               List all links
      --metadata            Show page metadata
      --clear-cache         Clear cache and exit
      --list-models         List available Ollama models
      --check-services      Check which services are available

${chalk.bold("Debug:")}
  -v, --verbose             Verbose logging (debug level)
  -d, --dry-run             Preview content without AI processing

${chalk.bold("Examples:")}
  ${chalk.gray("# Quick summary (auto-selects best free model)")}
  glance https://example.com

  ${chalk.gray("# Ask a question with streaming")}
  glance https://react.dev -q "What are React Server Components?" --stream

  ${chalk.gray("# TL;DR with local model (free)")}
  glance https://long-article.com --model llama3 --tldr

  ${chalk.gray("# Force free-only mode (no API costs)")}
  glance https://example.com --free-only

  ${chalk.gray("# Key points in French with emojis, export to file")}
  glance https://lemonde.fr -k -l fr -e -o summary.md

  ${chalk.gray("# Full render for JavaScript-heavy site")}
  glance https://spa-app.com --full-render

  ${chalk.gray("# Read summary aloud (text-to-speech)")}
  glance https://article.com --tldr --read

  ${chalk.gray("# Save audio summary to file")}
  glance https://blog.com --key-points --audio-output summary.mp3

  ${chalk.gray("# French content with French voice")}
  glance https://lemonde.fr --tldr -l fr --read

${chalk.bold("Environment Variables:")}
  OPENAI_API_KEY           For GPT models (optional - costs money)
  GEMINI_API_KEY           For Gemini models (optional - may cost money)
  OLLAMA_ENDPOINT          Ollama server (default: http://localhost:11434)
  ELEVENLABS_API_KEY       For ElevenLabs voices (optional - costs money)
  GLANCE_FREE_ONLY         Set to 'true' to always use free services

${chalk.bold("Learn more:")} https://github.com/jkenley/glance-cli
`));
  process.exit(0);
}

// === Version ===
if (values.version) {
  console.log(`glance v${CONFIG.VERSION}`);
  process.exit(0);
}

// === Check Services ===
if (values["check-services"]) {
  console.log(chalk.cyan("\n🔍 Checking available services...\n"));
  await detectServices({ 
    verbose: true, 
    ollamaEndpoint: CONFIG.OLLAMA_ENDPOINT,
    preferFree: !values["prefer-quality"]
  });
  process.exit(0);
}

// === Clear Cache ===
if (values["clear-cache"]) {
  try {
    clearCache();
    logger.success("Cache cleared successfully");
  } catch (err: any) {
    logger.error("Failed to clear cache:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

// === List Voices ===
if (values["list-voices"]) {
  const spinner = ora(chalk.blue("Fetching available voices...")).start();

  try {
    const voiceSynthesizer = createVoiceSynthesizer();
    const voices = await voiceSynthesizer.listVoices();
    
    spinner.succeed(chalk.green("Available voices:"));
    
    if (voices.length === 0) {
      console.log(chalk.yellow("\nNo voices available."));
      console.log(chalk.gray("Set ELEVENLABS_API_KEY for cloud voices"));
      console.log(chalk.gray("Or use system TTS (macOS 'say', Windows SAPI, Linux espeak)"));
    } else {
      console.log();
      voices.forEach((voice) => {
        console.log(`  ${chalk.green("•")} ${voice}`);
      });
    }
  } catch (err: any) {
    spinner.fail(chalk.red("Failed to list voices"));
    console.log(chalk.yellow(`\n${err.message}`));
  }
  process.exit(0);
}

// === List Models ===
if (values["list-models"]) {
  const spinner = ora(chalk.blue("Fetching Ollama models...")).start();

  try {
    const res = await fetch(`${CONFIG.OLLAMA_ENDPOINT}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    spinner.succeed(chalk.green("Available Ollama models:"));

    if ((data as any).models?.length === 0) {
      console.log(chalk.yellow("\nNo models installed."));
      console.log(chalk.gray("Install a model: ollama pull llama3"));
    } else {
      console.log();
      (data as any).models.forEach((m: any) => {
        const size = m.size ? `(${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB)` : "";
        console.log(`  ${chalk.green("•")} ${chalk.bold(m.name)} ${chalk.dim(size)}`);
      });
    }
  } catch (err: any) {
    spinner.fail(chalk.red("Failed to connect to Ollama"));
    if (err.name === "TimeoutError") {
      console.log(chalk.yellow("\n💡 Ollama server not responding"));
    } else {
      console.log(chalk.yellow("\n💡 Ollama is not running"));
    }
    console.log(chalk.gray("Start Ollama: ollama serve"));
    console.log(chalk.gray("Install: https://ollama.com"));
    process.exit(1);
  }

  process.exit(0);
}

// === Main Execution ===
(async () => {
  // Enable verbose logging
  if (values.verbose) {
    logger.setLevel("debug");
  }

  const perf = new PerformanceTracker();

  // === Input Validation ===

  // URL required
  if (positionals.length === 0) {
    console.error(chalk.red("❌ Error: URL required\n"));
    console.log(chalk.gray("Usage: glance <url> [options]"));
    console.log(chalk.gray("Run: glance --help"));
    process.exit(1);
  }

  const url = positionals[0] as string;

  // Validate URL
  const urlValidation = validateURL(url);
  if (!urlValidation.valid) {
    console.error(chalk.red(`❌ Invalid URL: ${urlValidation.error}\n`));
    console.log(chalk.gray("Example: glance https://example.com"));
    process.exit(1);
  }

  // Validate language
  const langValidation = validateLanguage(values.language!);
  if (!langValidation.valid) {
    console.error(chalk.red(`❌ ${langValidation.error}`));
    process.exit(1);
  }

  // Validate max-tokens
  const tokensValidation = validateMaxTokens(values["max-tokens"]);
  if (!tokensValidation.valid) {
    console.error(chalk.red(`❌ ${tokensValidation.error}`));
    process.exit(1);
  }
  const maxTokens = tokensValidation.parsed;

  // Auto-detect best available model if not specified
  let modelToUse = values.model as string | undefined;
  if (!modelToUse) {
    modelToUse = await getDefaultModel(CONFIG.OLLAMA_ENDPOINT);
    if (values.verbose) {
      console.log(chalk.dim(`Auto-selected model: ${modelToUse}`));
    }
  }

  // Check if free-only mode is enabled
  const freeOnly = values["free-only"] || shouldUseFreeOnly();
  if (freeOnly && values.verbose) {
    console.log(chalk.cyan("🆓 Free-only mode enabled"));
  }

  // Detect provider and validate
  let provider: "openai" | "google" | "ollama";
  let providerName: string;

  try {
    const p = detectProvider(modelToUse);
    provider = p;
    providerName = p === "openai" ? "OpenAI" : p === "google" ? "Google Gemini" : "Ollama (local)";
    logger.debug(`Detected provider: ${providerName}`);
    
    // Block paid services in free-only mode
    if (freeOnly && (provider === "openai" || provider === "google")) {
      console.error(chalk.red(`\n❌ Cannot use ${providerName} in free-only mode`));
      console.log(chalk.yellow("💡 Install Ollama for free local AI: https://ollama.com"));
      console.log(chalk.gray("   Then run: ollama pull llama3"));
      console.log(chalk.gray("\n   Or disable free-only mode with --prefer-quality"));
      process.exit(1);
    }
    
    // Show cost warning for paid services
    if (!freeOnly && (provider === "openai" || provider === "google")) {
      showCostWarning(provider, modelToUse);
    }
  } catch (err: any) {
    console.error(chalk.red(`❌ Invalid model: ${modelToUse}`));
    console.error(chalk.yellow(err.message));
    process.exit(1);
  }

  // Validate API keys / provider availability
  const apiValidation = await validateAPIKeys(provider);
  if (!apiValidation.valid) {
    console.error(chalk.red(`❌ ${apiValidation.error}\n`));
    if (apiValidation.hint) {
      console.log(chalk.yellow("💡 " + apiValidation.hint));
    }
    
    // Suggest alternatives
    if (provider === "openai" || provider === "google") {
      console.log(chalk.cyan("\n🆓 Try free local AI instead:"));
      console.log(chalk.gray("   1. Install Ollama: https://ollama.com"));
      console.log(chalk.gray("   2. Run: ollama pull llama3"));
      console.log(chalk.gray("   3. Use: glance <url> --model llama3"));
    }
    process.exit(1);
  }

  perf.checkpoint("validation");

  // === Main Processing ===
  const spinner = ora(chalk.blue(`Fetching ${url}...`)).start();

  try {
    // Fetch page with retry
    let html: string;
    try {
      html = await withRetry(
        () => fetchPage(url, { fullRender: !!values["full-render"] }),
        {
          attempts: 3,
          onRetry: (attempt, err) => {
            spinner.text = chalk.yellow(`Retry ${attempt}/3: Network error, retrying...`);
          },
        }
      );
    } catch (err: any) {
      throw new GlanceError(
        err.message,
        "FETCH_ERROR",
        "Failed to fetch webpage",
        true,
        values["full-render"]
          ? "The page may be blocking requests. Try without --full-render first."
          : "Try using --full-render if the site requires JavaScript."
      );
    }

    perf.checkpoint("fetch");

    // Size check
    if (html.length > CONFIG.MAX_CONTENT_SIZE) {
      logger.warn(
        `Large page detected (${(html.length / 1024 / 1024).toFixed(1)}MB). This may be slow.`
      );
    }

    // Extract content
    spinner.text = "Extracting content...";
    const cleanText = extractCleanText(html);
    const links = extractLinks(html);
    const metadata = extractMetadata(html);

    perf.checkpoint("extract");

    const fetchTime = perf.getSegment("validation", "extract");
    spinner.succeed(chalk.green(`Fetched and extracted in ${(fetchTime / 1000).toFixed(1)}s`));

    // === Priority Modes (non-AI) ===

    if (values["raw-html"]) {
      console.log(html);
      return;
    }

    if (values.links) {
      console.log(chalk.bold.magenta("\n📎 Links Found:\n"));
      if (links.length === 0) {
        console.log(chalk.dim("No links found"));
      } else {
        links.forEach((link, i) => {
          const text = link.text ? chalk.dim(`— ${link.text.trim().slice(0, 60)}`) : "";
          console.log(`${chalk.gray(`${i + 1}.`)} ${chalk.cyan(link.href)} ${text}`);
        });
      }
      return;
    }

    if (values.metadata) {
      console.log(chalk.bold.magenta("\n📄 Page Metadata:\n"));
      console.log(JSON.stringify(metadata, null, 2));
      return;
    }

    if (values.screenshot) {
      const filePath = values.screenshot || "screenshot.png";
      spinner.start(chalk.blue(`Capturing screenshot...`));

      try {
        await takeScreenshot(url, filePath);
        spinner.succeed(chalk.green(`Screenshot saved → ${path.resolve(filePath)}`));
      } catch (err: any) {
        spinner.fail(chalk.red("Screenshot failed"));
        throw new GlanceError(
          err.message,
          "SCREENSHOT_ERROR",
          "Failed to capture screenshot",
          false,
          "Make sure the URL is accessible and not blocking headless browsers."
        );
      }
      return;
    }

    if (values["dry-run"]) {
      console.log(chalk.bold.yellow("\n📝 Content Preview (first 3000 chars):\n"));
      console.log(cleanText.slice(0, 3000));
      if (cleanText.length > 3000) {
        console.log(chalk.dim(`\n... (${cleanText.length - 3000} more characters)`));
      }
      console.log(chalk.dim(`\nTotal length: ${cleanText.length} characters`));
      return;
    }

    // === AI Processing ===

    const useCache = values.cache !== false;
    const cacheKey = getCacheKey(url, {
      model: values.model!,
      flags: values,
      maxTokens,
      question: values.ask,
    });

    let result = "";
    let fromCache = false;

    // Check cache
    if (useCache) {
      const cached = await getCache(cacheKey);
      if (cached !== null) {
        result = cached;
        fromCache = true;
        console.log(chalk.dim.italic("⚡ Cache hit"));
        logger.debug("Using cached result");
      }
    }

    // Process with AI
    if (!fromCache) {
      spinner.start(`Processing with ${providerName}...`);

      try {
        result = await withRetry(
          () =>
            summarize(cleanText, {
              model: modelToUse,
              tldr: values.tldr,
              keyPoints: values["key-points"],
              eli5: values.eli5,
              emoji: values.emoji,
              language: values.language!,
              stream: values.stream,
              maxTokens,
              customQuestion: values.ask,
            }),
          {
            attempts: 2, // AI calls get fewer retries
            onRetry: (attempt, err) => {
              spinner.text = chalk.yellow(`Retry ${attempt}/2: ${err.message}`);
            },
          }
        );

        perf.checkpoint("ai");

        // Cache result
        if (useCache) {
          await setCache(cacheKey, result);
          logger.debug("Result cached");
        }
      } catch (err: any) {
        spinner.fail(chalk.red("AI processing failed"));

        // Provider-specific error handling
        if (err.message?.includes("rate_limit") || err.status === 429) {
          throw new GlanceError(
            err.message,
            "RATE_LIMIT",
            "Rate limit exceeded",
            true,
            "Wait a moment and try again, or use a different model."
          );
        }

        if (err.message?.includes("invalid_api_key") || err.status === 401) {
          throw new GlanceError(
            err.message,
            "AUTH_ERROR",
            "Authentication failed",
            false,
            provider === "openai"
              ? "Check your OPENAI_API_KEY"
              : "Check your GEMINI_API_KEY or GOOGLE_API_KEY"
          );
        }

        throw new GlanceError(
          err.message,
          "AI_ERROR",
          `${providerName} request failed`,
          err.status >= 500,
          err.status >= 500
            ? "The AI service may be experiencing issues. Try again in a moment."
            : undefined
        );
      }
    }

    const aiTime = fromCache ? 0 : perf.getSegment("extract", "ai");
    spinner.succeed(
      fromCache
        ? chalk.green("Loaded from cache")
        : chalk.green(`Processed in ${(aiTime / 1000).toFixed(1)}s`)
    );

    // === Format Output ===
    const output = formatOutput(result, {
      markdown: values.markdown,
      json: values.json,
      metadata,
      url,
      customQuestion: values.ask,
    });

    // === Export ===
    if (values.export) {
      let content = output;
      const ext = path.extname(values.export).toLowerCase();

      // Auto-format based on extension
      if (ext === ".json" && !values.json) {
        content = formatOutput(result, { json: true, metadata, url, customQuestion: values.ask });
      } else if (ext === ".md" && !values.markdown) {
        content = formatOutput(result, { markdown: true, metadata, url, customQuestion: values.ask });
      }

      try {
        await Bun.write(values.export, content);
        const absolutePath = path.resolve(values.export);
        logger.success(`Saved → ${absolutePath}`);
      } catch (err: any) {
        throw new GlanceError(
          err.message,
          "EXPORT_ERROR",
          "Failed to save file",
          false,
          "Check file path and permissions."
        );
      }
    }

    // === Display Output ===
    console.log("\n" + output);

    // === Voice/TTS Output ===
    if (values.read || values.speak || values["audio-output"]) {
      const voiceSpinner = ora(chalk.blue("Generating audio...")).start();
      
      try {
        const voiceSynthesizer = createVoiceSynthesizer();
        
        // Use the raw result text, not the formatted output
        const textToSpeak = result;
        
        const voiceResult = await voiceSynthesizer.synthesize(textToSpeak, {
          voice: values.voice as string | undefined,
          outputFile: values["audio-output"] as string | undefined,
          apiKey: process.env.ELEVENLABS_API_KEY,
          language: values.language!, // Pass language for intelligent voice selection
        });
        
        if (voiceResult.success) {
          if (values["audio-output"]) {
            voiceSpinner.succeed(chalk.green(`Audio saved → ${values["audio-output"]}`));
          } else {
            voiceSpinner.succeed(chalk.green("Playing audio..."));
          }
        } else {
          voiceSpinner.warn(chalk.yellow(`Voice synthesis failed: ${voiceResult.error}`));
        }
      } catch (err: any) {
        voiceSpinner.warn(chalk.yellow(`Voice error: ${err.message}`));
        if (values.verbose) {
          console.error(chalk.dim("Voice error details:"), err);
        }
      }
    }

    // === Performance Summary ===
    if (values.verbose) {
      console.log(chalk.dim(`\n⏱️  ${perf.summary()}`));
    }

  } catch (error: any) {
    spinner.fail(chalk.red("Failed"));

    // Handle custom errors
    if (error instanceof GlanceError) {
      console.error(chalk.red(`\n❌ ${error.userMessage}`));
      if (error.hint) {
        console.log(chalk.yellow(`\n💡 ${error.hint}`));
      }
      if (values.verbose) {
        console.error(chalk.dim(`\nDebug: ${error.code} - ${error.message}`));
      }
      process.exit(error.recoverable ? 2 : 1);
    }

    // Handle generic errors
    if (values.verbose) {
      console.error(chalk.red("\n❌ Unexpected error:"));
      console.error(error);
    } else {
      console.error(chalk.red(`\n❌ ${error.message || "Unknown error"}`));
      console.log(chalk.dim("\nRun with --verbose for more details"));
    }

    // Generic hints
    if (error.message?.includes("Ollama")) {
      console.log(chalk.yellow("\n💡 Make sure Ollama is running: ollama serve"));
    }
    if (error.message?.includes("API_KEY") || error.message?.includes("OPENAI") || error.message?.includes("GEMINI")) {
      console.log(chalk.yellow("\n💡 Set your API key:"));
      console.log(chalk.gray("  export OPENAI_API_KEY=sk-..."));
      console.log(chalk.gray("  export GEMINI_API_KEY=..."));
    }

    process.exit(1);
  }
})();