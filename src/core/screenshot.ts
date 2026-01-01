/**
 * Production-Grade Screenshot Utility
 * 
 * Features:
 * - Timeout protection (prevents hanging)
 * - Retry logic for transient failures
 * - Better error messages with actionable hints
 * - Resource cleanup (prevents memory leaks)
 * - Configurable viewport and quality
 * - Support for different formats (PNG, JPEG, WebP)
 * - Page load strategies
 * - Error categorization
 */

import puppeteer, { Browser, Page } from "puppeteer";
import path from "node:path";

// === Configuration ===
const SCREENSHOT_CONFIG = {
  DEFAULT_TIMEOUT: 30000,        // 30s total timeout
  PAGE_LOAD_TIMEOUT: 20000,      // 20s for page load
  VIEWPORT_WIDTH: 1920,
  VIEWPORT_HEIGHT: 1080,
  DEFAULT_FORMAT: "png" as const,
  JPEG_QUALITY: 90,
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
} as const;

// === Custom Error Types ===
class ScreenshotError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public hint?: string
  ) {
    super(message);
    this.name = "ScreenshotError";
  }
}

// === Screenshot Options ===
export interface ScreenshotOptions {
  /** Output file path (determines format from extension) */
  filePath?: string;
  /** Full page screenshot (default: true) */
  fullPage?: boolean;
  /** Viewport width (default: 1920) */
  width?: number;
  /** Viewport height (default: 1080) */
  height?: number;
  /** JPEG quality 0-100 (default: 90) */
  quality?: number;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Wait strategy: 'networkidle2' | 'networkidle0' | 'load' | 'domcontentloaded' */
  waitUntil?: "networkidle2" | "networkidle0" | "load" | "domcontentloaded";
}

// === Helper Functions ===

/**
 * Detect image format from file extension
 */
function getImageFormat(filePath: string): "png" | "jpeg" | "webp" {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "jpeg";
    case ".webp":
      return "webp";
    case ".png":
    default:
      return "png";
  }
}

/**
 * Validate URL format
 */
function validateURL(url: string): void {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new ScreenshotError(
      `Invalid URL: ${url}`,
      "INVALID_URL",
      "Invalid URL format",
      "URL must start with http:// or https://"
    );
  }
}

/**
 * Validate file path
 */
function validateFilePath(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = [".png", ".jpg", ".jpeg", ".webp"];

  if (!validExtensions.includes(ext)) {
    throw new ScreenshotError(
      `Invalid file extension: ${ext}`,
      "INVALID_EXTENSION",
      "Unsupported image format",
      `Supported formats: ${validExtensions.join(", ")}`
    );
  }
}

/**
 * Launch browser with error handling
 */
async function launchBrowser(): Promise<Browser> {
  try {
    return await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",       // Prevent /dev/shm issues
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
      // Timeout for browser launch
      timeout: 10000,
    });
  } catch (err: any) {
    if (err.message?.includes("Could not find") || err.message?.includes("Chromium")) {
      throw new ScreenshotError(
        err.message,
        "BROWSER_NOT_FOUND",
        "Chromium browser not found",
        "Puppeteer's Chromium is missing. Reinstall: bun install puppeteer"
      );
    }

    throw new ScreenshotError(
      err.message,
      "BROWSER_LAUNCH_FAILED",
      "Failed to launch browser",
      "Check if you have enough system resources (memory, disk space)"
    );
  }
}

/**
 * Take screenshot with retry logic
 */
async function captureWithRetry(
  url: string,
  options: Required<ScreenshotOptions>,
  attempt: number = 1
): Promise<void> {
  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    // Launch browser
    browser = await launchBrowser();

    // Create page with timeout
    page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
    });

    // Set page timeout
    page.setDefaultTimeout(options.timeout);
    page.setDefaultNavigationTimeout(SCREENSHOT_CONFIG.PAGE_LOAD_TIMEOUT);

    // Navigate to URL
    try {
      await page.goto(url, {
        waitUntil: options.waitUntil,
        timeout: SCREENSHOT_CONFIG.PAGE_LOAD_TIMEOUT,
      });
    } catch (err: any) {
      // Navigation errors
      if (err.message?.includes("net::ERR_NAME_NOT_RESOLVED")) {
        throw new ScreenshotError(
          err.message,
          "DNS_ERROR",
          "Cannot resolve domain name",
          `Check if ${new URL(url).hostname} is accessible`
        );
      }

      if (err.message?.includes("net::ERR_CONNECTION_REFUSED")) {
        throw new ScreenshotError(
          err.message,
          "CONNECTION_REFUSED",
          "Connection refused",
          "The server is not accepting connections. Check if the URL is correct."
        );
      }

      if (err.message?.includes("Timeout") || err.message?.includes("timeout")) {
        throw new ScreenshotError(
          err.message,
          "PAGE_TIMEOUT",
          "Page took too long to load",
          "The page is slow or unresponsive. Try again or check your connection."
        );
      }

      // Generic navigation error
      throw new ScreenshotError(
        err.message,
        "NAVIGATION_ERROR",
        "Failed to load page",
        "The page may be blocking automated access or has loading issues."
      );
    }

    // Determine format and options
    const format = getImageFormat(options.filePath);
    const screenshotOptions: any = {
      path: options.filePath,
      fullPage: options.fullPage,
      type: format,
    };

    // Add quality for JPEG/WebP
    if (format === "jpeg" || format === "webp") {
      screenshotOptions.quality = options.quality;
    }

    // Take screenshot
    await page.screenshot(screenshotOptions);

    // Success - cleanup and return
    await page.close();
    await browser.close();

  } catch (err: any) {
    // Cleanup on error
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Retry on transient errors
    if (err instanceof ScreenshotError && err.code === "PAGE_TIMEOUT") {
      if (attempt < SCREENSHOT_CONFIG.MAX_RETRIES) {
        const delay = SCREENSHOT_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return captureWithRetry(url, options, attempt + 1);
      }
    }

    // Re-throw ScreenshotError as-is
    if (err instanceof ScreenshotError) {
      throw err;
    }

    // Wrap unknown errors
    throw new ScreenshotError(
      err.message || "Unknown error",
      "SCREENSHOT_FAILED",
      "Screenshot capture failed",
      "An unexpected error occurred. Try again or check the URL."
    );
  }
}

/**
 * Main screenshot function
 * 
 * @param url - Target URL to screenshot
 * @param options - Screenshot options
 * 
 * @example
 * // Basic usage
 * await takeScreenshot("https://example.com");
 * 
 * @example
 * // Custom options
 * await takeScreenshot("https://example.com", {
 *   filePath: "output.jpg",
 *   fullPage: false,
 *   quality: 85,
 *   width: 1280,
 *   height: 720,
 * });
 */
export async function takeScreenshot(
  url: string,
  options: ScreenshotOptions | string = {}
): Promise<void> {
  // Handle legacy string parameter (just filePath)
  const opts: ScreenshotOptions = typeof options === "string"
    ? { filePath: options }
    : options;

  // Apply defaults
  const finalOptions: Required<ScreenshotOptions> = {
    filePath: opts.filePath || "screenshot.png",
    fullPage: opts.fullPage ?? true,
    width: opts.width || SCREENSHOT_CONFIG.VIEWPORT_WIDTH,
    height: opts.height || SCREENSHOT_CONFIG.VIEWPORT_HEIGHT,
    quality: opts.quality || SCREENSHOT_CONFIG.JPEG_QUALITY,
    timeout: opts.timeout || SCREENSHOT_CONFIG.DEFAULT_TIMEOUT,
    waitUntil: opts.waitUntil || "networkidle2",
  };

  // Validate inputs
  validateURL(url);
  validateFilePath(finalOptions.filePath);

  // Validate dimensions
  if (finalOptions.width <= 0 || finalOptions.height <= 0) {
    throw new ScreenshotError(
      "Invalid dimensions",
      "INVALID_DIMENSIONS",
      "Width and height must be positive",
      "Use values like width: 1920, height: 1080"
    );
  }

  // Validate quality for JPEG/WebP
  const format = getImageFormat(finalOptions.filePath);
  if ((format === "jpeg" || format === "webp") &&
    (finalOptions.quality < 0 || finalOptions.quality > 100)) {
    throw new ScreenshotError(
      "Invalid quality",
      "INVALID_QUALITY",
      "Quality must be between 0-100",
      "Use values like quality: 90"
    );
  }

  // Capture screenshot with retry
  await captureWithRetry(url, finalOptions);
}

/**
 * Check if Puppeteer is available and working
 */
export async function checkPuppeteerAvailability(): Promise<{
  available: boolean;
  error?: string;
  hint?: string;
}> {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
      timeout: 5000,
    });
    await browser.close();
    return { available: true };
  } catch (err: any) {
    if (err.message?.includes("Could not find") || err.message?.includes("Chromium")) {
      return {
        available: false,
        error: "Chromium browser not found",
        hint: "Reinstall Puppeteer: bun install puppeteer",
      };
    }
    return {
      available: false,
      error: "Puppeteer initialization failed",
      hint: err.message,
    };
  }
}