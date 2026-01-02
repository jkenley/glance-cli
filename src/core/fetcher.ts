/**
 * Production-Grade Page Fetcher
 * 
 * Features:
 * - Dual-mode: Fast fetch for static sites, Puppeteer for SPAs
 * - Comprehensive error handling with categorization
 * - Retry logic with exponential backoff
 * - Timeout protection (prevents hanging)
 * - Resource cleanup (no memory leaks)
 * - Redirect handling
 * - Content-type validation
 * - Size limits (prevents memory exhaustion)
 * - User-agent rotation
 * - Response validation
 * - Better error messages with hints
 */

import puppeteer, { Browser, Page } from "puppeteer";

// === Text Encoding Utilities ===

/**
 * Get text content with proper encoding handling
 */
async function getTextWithProperEncoding(response: Response): Promise<string> {
    // Get the content type header to check for encoding
    const contentType = response.headers.get("content-type") || "";
    
    // Try to extract encoding from Content-Type header
    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    const declaredCharset = charsetMatch ? charsetMatch[1].toLowerCase().trim() : null;
    
    try {
        // Get response as array buffer first to handle encoding properly
        const buffer = await response.arrayBuffer();
        
        // Convert to Uint8Array for processing
        const bytes = new Uint8Array(buffer);
        
        // Try to detect charset from HTML meta tags if not in header
        let detectedCharset = declaredCharset;
        
        if (!detectedCharset && bytes.length > 0) {
            // Convert first 1024 bytes to string to look for meta charset
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const preview = decoder.decode(bytes.slice(0, Math.min(1024, bytes.length)));
            
            // Look for charset in meta tags
            const metaCharsetMatch = preview.match(/<meta[^>]*charset[=\s]*["\']?([^"'\s>]+)/i);
            if (metaCharsetMatch) {
                detectedCharset = metaCharsetMatch[1].toLowerCase().trim();
            } else {
                // Look for HTTP-EQUIV content-type
                const httpEquivMatch = preview.match(/<meta[^>]*http-equiv[=\s]*["\']?content-type["\']?[^>]*content[=\s]*["\']?[^"']*charset[=\s]*([^"'\s;]+)/i);
                if (httpEquivMatch) {
                    detectedCharset = httpEquivMatch[1].toLowerCase().trim();
                }
            }
        }
        
        // Fallback to utf-8 if no charset detected
        if (!detectedCharset) {
            detectedCharset = 'utf-8';
        }
        
        // Handle common charset variations
        const normalizedCharset = normalizeCharset(detectedCharset);
        
        // Try to decode with the detected/declared charset
        try {
            const decoder = new TextDecoder(normalizedCharset, { fatal: false });
            let text = decoder.decode(bytes);
            
            // Clean up any remaining problematic characters
            text = cleanEncodingArtifacts(text);
            
            return text;
        } catch (encodingError) {
            // If charset-specific decoding fails, try UTF-8 with error replacement
            const decoder = new TextDecoder('utf-8', { fatal: false });
            let text = decoder.decode(bytes);
            
            // Clean up any remaining problematic characters
            text = cleanEncodingArtifacts(text);
            
            return text;
        }
    } catch (error) {
        // Ultimate fallback - use response.text() but clean it
        const text = await response.text();
        return cleanEncodingArtifacts(text);
    }
}

/**
 * Normalize charset names to standard forms
 */
function normalizeCharset(charset: string): string {
    const normalized = charset.toLowerCase().replace(/[-_\s]/g, '');
    
    // Common charset mappings
    const charsetMap: Record<string, string> = {
        'iso88591': 'iso-8859-1',
        'latin1': 'iso-8859-1',
        'utf8': 'utf-8',
        'windows1252': 'windows-1252',
        'cp1252': 'windows-1252',
        'ascii': 'us-ascii',
        'usascii': 'us-ascii',
        'gb2312': 'gb18030', // GB2312 is subset of GB18030
        'gbk': 'gb18030',    // GBK is subset of GB18030
    };
    
    return charsetMap[normalized] || charset;
}

/**
 * Clean up common encoding artifacts and problematic characters
 */
function cleanEncodingArtifacts(text: string): string {
    return text
        // Remove null bytes and other control characters that can cause terminal issues
        .replace(/\x00/g, '')
        // Remove DEL character
        .replace(/\x7F/g, '')
        // Remove other problematic control characters (except \n, \r, \t)
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
        // Remove Unicode replacement character that indicates encoding problems
        .replace(/\uFFFD/g, '')
        // Remove byte order marks that can cause display issues
        .replace(/\uFEFF/g, '')
        // Remove zero-width characters that can mess up display
        .replace(/[\u200B-\u200D\u2060]/g, '')
        // Handle common Windows-1252 characters that get mangled in UTF-8
        .replace(/â€™/g, "'")  // Smart apostrophe
        .replace(/â€œ/g, '"')  // Smart quote open
        .replace(/â€\x9D/g, '"')  // Smart quote close
        .replace(/â€"/g, '—')  // Em dash
        .replace(/â€\x93/g, '–')  // En dash
        .replace(/Â /g, ' ')   // Non-breaking space issues
        // Additional common encoding artifacts
        .replace(/â¢/g, '•')   // Bullet point
        .replace(/Ã©/g, 'é')   // e with acute
        .replace(/Ã¡/g, 'á')   // a with acute
        .replace(/Ã­/g, 'í')   // i with acute
        .replace(/Ã³/g, 'ó')   // o with acute
        .replace(/Ãº/g, 'ú')   // u with acute
        .replace(/Ã±/g, 'ñ')   // n with tilde
        .replace(/Ã\x87/g, 'Ç')   // C with cedilla
        // Remove any remaining high-bit characters that look like encoding artifacts
        .replace(/[^\x00-\x7F\u00A0-\uFFFF]/g, '');
}

// === Configuration ===
const FETCH_CONFIG = {
    // Timeouts
    SIMPLE_FETCH_TIMEOUT: 30000,      // 30s for simple fetch
    FULL_RENDER_TIMEOUT: 60000,       // 60s for full render
    PAGE_LOAD_TIMEOUT: 45000,         // 45s for page.goto

    // Limits
    MAX_CONTENT_SIZE: 50 * 1024 * 1024,  // 50MB max
    MAX_REDIRECTS: 10,

    // Retry
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,                // Base delay in ms

    // User agents
    USER_AGENTS: [
        "glance-cli/1.0 (https://github.com/jkenley/glance-cli)",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ],

    // Accepted content types
    VALID_CONTENT_TYPES: [
        "text/html",
        "application/xhtml+xml",
        "application/xml",
        "text/plain",
    ],
} as const;

// === Custom Error Types ===
class FetchError extends Error {
    constructor(
        message: string,
        public code: string,
        public userMessage: string,
        public recoverable: boolean = false,
        public hint?: string,
        public statusCode?: number
    ) {
        super(message);
        this.name = "FetchError";
    }
}

// === Fetch Options ===
export interface FetchOptions {
    /** Use Puppeteer for JavaScript-heavy sites */
    fullRender?: boolean;
    /** Custom timeout in milliseconds */
    timeout?: number;
    /** Custom user agent */
    userAgent?: string;
    /** Follow redirects (default: true) */
    followRedirects?: boolean;
    /** Maximum content size in bytes */
    maxSize?: number;
    /** Wait strategy for full render */
    waitUntil?: "networkidle2" | "networkidle0" | "load" | "domcontentloaded";
    /** Maximum retry attempts */
    maxRetries?: number;
}

// === Validation Functions ===

/**
 * Validate URL format
 */
function validateURL(url: string): void {
    if (!url || typeof url !== "string") {
        throw new FetchError(
            "Invalid URL: empty or not a string",
            "INVALID_URL",
            "Invalid URL provided",
            false,
            "URL must be a non-empty string starting with http:// or https://"
        );
    }

    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new FetchError(
                `Invalid protocol: ${parsed.protocol}`,
                "INVALID_PROTOCOL",
                "Invalid URL protocol",
                false,
                "URL must start with http:// or https://"
            );
        }
    } catch (err: any) {
        if (err instanceof FetchError) throw err;

        throw new FetchError(
            `Malformed URL: ${err.message}`,
            "MALFORMED_URL",
            "Invalid URL format",
            false,
            "URL must be properly formatted (e.g., https://example.com)"
        );
    }
}

/**
 * Validate content type
 */
function validateContentType(contentType: string | null): void {
    if (!contentType) return; // Some servers don't send Content-Type

    const type = contentType.split(";")[0]?.trim().toLowerCase() || "";

    if (!FETCH_CONFIG.VALID_CONTENT_TYPES.some(valid => type.includes(valid))) {
        throw new FetchError(
            `Invalid content type: ${contentType}`,
            "INVALID_CONTENT_TYPE",
            "Page is not HTML",
            false,
            `Expected HTML but got ${type}. This URL may point to a file download or API endpoint.`
        );
    }
}

/**
 * Validate content size
 */
function validateContentSize(size: number, maxSize: number): void {
    if (size > maxSize) {
        const sizeMB = (size / 1024 / 1024).toFixed(1);
        const maxMB = (maxSize / 1024 / 1024).toFixed(1);

        throw new FetchError(
            `Content too large: ${sizeMB}MB`,
            "CONTENT_TOO_LARGE",
            "Page is too large",
            false,
            `Page size (${sizeMB}MB) exceeds maximum (${maxMB}MB). Try a different page or increase the limit.`
        );
    }
}

/**
 * Get random user agent
 */
function getUserAgent(custom?: string): string {
    if (custom) return custom;

    const randomIndex = Math.floor(Math.random() * FETCH_CONFIG.USER_AGENTS.length);
    return FETCH_CONFIG.USER_AGENTS[randomIndex] || "";
}

// === Simple Fetch Implementation ===

/**
 * Simple fetch for static pages (fast path)
 */
async function simpleFetch(
    url: string,
    options: Required<FetchOptions>
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": getUserAgent(options.userAgent),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            redirect: options.followRedirects ? "follow" : "manual",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
            const statusCode = response.status;

            // Categorize errors
            if (statusCode === 404) {
                throw new FetchError(
                    `HTTP 404: Not Found`,
                    "NOT_FOUND",
                    "Page not found",
                    false,
                    "The URL doesn't exist. Check for typos.",
                    404
                );
            }

            if (statusCode === 403) {
                throw new FetchError(
                    `HTTP 403: Forbidden`,
                    "FORBIDDEN",
                    "Access denied",
                    false,
                    "The server is blocking access. Try with --full-render to use a real browser.",
                    403
                );
            }

            if (statusCode === 401) {
                throw new FetchError(
                    `HTTP 401: Unauthorized`,
                    "UNAUTHORIZED",
                    "Authentication required",
                    false,
                    "This page requires login. glance-cli cannot access authenticated pages.",
                    401
                );
            }

            if (statusCode === 429) {
                throw new FetchError(
                    `HTTP 429: Too Many Requests`,
                    "RATE_LIMITED",
                    "Rate limited",
                    true,
                    "The server is rate limiting requests. Wait a moment and try again.",
                    429
                );
            }

            if (statusCode >= 500) {
                throw new FetchError(
                    `HTTP ${statusCode}: ${response.statusText}`,
                    "SERVER_ERROR",
                    "Server error",
                    true,
                    "The server is experiencing issues. Try again later.",
                    statusCode
                );
            }

            // Generic HTTP error
            throw new FetchError(
                `HTTP ${statusCode}: ${response.statusText}`,
                "HTTP_ERROR",
                `HTTP ${statusCode} error`,
                statusCode >= 500,
                undefined,
                statusCode
            );
        }

        // Validate content type
        const contentType = response.headers.get("content-type");
        validateContentType(contentType);

        // Check content length before downloading
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
            const size = parseInt(contentLength, 10);
            validateContentSize(size, options.maxSize);
        }

        // Get content with proper encoding handling
        const html = await getTextWithProperEncoding(response);

        // Validate actual size
        validateContentSize(html.length, options.maxSize);

        // Basic HTML validation
        if (!html.trim()) {
            throw new FetchError(
                "Empty response",
                "EMPTY_RESPONSE",
                "Page is empty",
                false,
                "The server returned an empty page. The URL may be incorrect."
            );
        }

        if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
            // Might not be HTML - warn but allow
            // Some valid pages don't have proper HTML tags
        }

        return html;

    } catch (err: any) {
        clearTimeout(timeoutId);

        // Re-throw FetchError as-is
        if (err instanceof FetchError) {
            throw err;
        }

        // Handle abort (timeout)
        if (err.name === "AbortError") {
            throw new FetchError(
                "Request timeout",
                "TIMEOUT",
                "Request timed out",
                true,
                `Page took too long to load (>${options.timeout / 1000}s). Try with --full-render or increase timeout.`
            );
        }

        // Handle network errors
        if (err.message?.includes("fetch failed") || err.cause?.code === "ENOTFOUND") {
            throw new FetchError(
                err.message,
                "DNS_ERROR",
                "Cannot resolve domain",
                false,
                "Check if the domain name is correct and you have internet connection."
            );
        }

        if (err.cause?.code === "ECONNREFUSED") {
            throw new FetchError(
                err.message,
                "CONNECTION_REFUSED",
                "Connection refused",
                false,
                "The server refused the connection. Check if the URL is correct."
            );
        }

        if (err.cause?.code === "ECONNRESET" || err.message?.includes("socket hang up")) {
            throw new FetchError(
                err.message,
                "CONNECTION_RESET",
                "Connection reset",
                true,
                "The connection was reset. Try again or use --full-render."
            );
        }

        if (err.cause?.code === "ETIMEDOUT") {
            throw new FetchError(
                err.message,
                "NETWORK_TIMEOUT",
                "Network timeout",
                true,
                "Network connection timed out. Check your internet connection."
            );
        }

        // SSL/TLS errors
        if (err.message?.includes("certificate") || err.cause?.code?.includes("CERT")) {
            throw new FetchError(
                err.message,
                "SSL_ERROR",
                "SSL/TLS error",
                false,
                "The server has an invalid SSL certificate. This may be a security risk."
            );
        }

        // Generic network error
        throw new FetchError(
            err.message,
            "NETWORK_ERROR",
            "Network error",
            true,
            "A network error occurred. Check your connection and try again."
        );
    }
}

// === Full Render Implementation ===

/**
 * Full render using Puppeteer (for JavaScript-heavy sites)
 */
async function fullRenderFetch(
    url: string,
    options: Required<FetchOptions>
): Promise<string> {
    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-web-security",  // For CORS issues
                "--disable-features=IsolateOrigins,site-per-process",
            ],
            timeout: 10000,  // 10s to launch
        });

        // Create page
        page = await browser.newPage();

        // Set user agent
        await page.setUserAgent(getUserAgent(options.userAgent));

        // Set viewport (affects rendering)
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });

        // Set timeouts
        page.setDefaultTimeout(options.timeout);
        page.setDefaultNavigationTimeout(FETCH_CONFIG.PAGE_LOAD_TIMEOUT);

        // Navigate to page
        try {
            await page.goto(url, {
                waitUntil: options.waitUntil,
                timeout: FETCH_CONFIG.PAGE_LOAD_TIMEOUT,
            });
        } catch (err: any) {
            // Categorize navigation errors
            if (err.message?.includes("net::ERR_NAME_NOT_RESOLVED")) {
                throw new FetchError(
                    err.message,
                    "DNS_ERROR",
                    "Cannot resolve domain",
                    false,
                    "Check if the domain name is correct."
                );
            }

            if (err.message?.includes("net::ERR_CONNECTION_REFUSED")) {
                throw new FetchError(
                    err.message,
                    "CONNECTION_REFUSED",
                    "Connection refused",
                    false,
                    "The server refused the connection."
                );
            }

            if (err.message?.includes("net::ERR_CERT")) {
                throw new FetchError(
                    err.message,
                    "SSL_ERROR",
                    "SSL/TLS error",
                    false,
                    "The server has an invalid SSL certificate."
                );
            }

            if (err.message?.includes("Timeout") || err.message?.includes("timeout")) {
                throw new FetchError(
                    err.message,
                    "PAGE_TIMEOUT",
                    "Page took too long to load",
                    true,
                    "The page is very slow or unresponsive. Try again or check the URL."
                );
            }

            if (err.message?.includes("net::ERR_ABORTED")) {
                throw new FetchError(
                    err.message,
                    "PAGE_ABORTED",
                    "Page load aborted",
                    true,
                    "The page navigation was aborted. Try again."
                );
            }

            // Generic navigation error
            throw new FetchError(
                err.message,
                "NAVIGATION_ERROR",
                "Failed to load page",
                true,
                "The page failed to load. Try again or check the URL."
            );
        }

        // Get rendered HTML
        const html = await page.content();

        // Validate size
        validateContentSize(html.length, options.maxSize);

        // Validate content
        if (!html.trim()) {
            throw new FetchError(
                "Empty page",
                "EMPTY_PAGE",
                "Page is empty",
                false,
                "The page rendered but is empty. The URL may be incorrect."
            );
        }

        // Cleanup
        await page.close();
        await browser.close();

        return html;

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

        // Re-throw FetchError as-is
        if (err instanceof FetchError) {
            throw err;
        }

        // Puppeteer not found
        if (err.message?.includes("Could not find") || err.message?.includes("Chromium")) {
            throw new FetchError(
                err.message,
                "BROWSER_NOT_FOUND",
                "Chromium browser not found",
                false,
                "Puppeteer's Chromium is missing. Reinstall: bun install puppeteer"
            );
        }

        // Browser launch failed
        if (err.message?.includes("Failed to launch")) {
            throw new FetchError(
                err.message,
                "BROWSER_LAUNCH_FAILED",
                "Failed to launch browser",
                false,
                "Cannot launch Puppeteer. Check system resources or try without --full-render."
            );
        }

        // Generic Puppeteer error
        throw new FetchError(
            err.message,
            "RENDER_ERROR",
            "Page rendering failed",
            true,
            "Full render failed. Try without --full-render or check the URL."
        );
    }
}

// === Retry Logic ===

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
    url: string,
    options: Required<FetchOptions>,
    attempt: number = 1
): Promise<string> {
    try {
        // Use appropriate fetch method
        if (options.fullRender) {
            return await fullRenderFetch(url, options);
        } else {
            return await simpleFetch(url, options);
        }
    } catch (err: any) {
        // Don't retry on non-recoverable errors
        if (err instanceof FetchError && !err.recoverable) {
            throw err;
        }

        // Last attempt - don't retry
        if (attempt >= options.maxRetries) {
            throw err;
        }

        // Retry with exponential backoff
        const delay = FETCH_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));

        return fetchWithRetry(url, options, attempt + 1);
    }
}

// === Main Export Function ===

/**
 * Fetch webpage content
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns HTML content
 * 
 * @example
 * // Simple fetch (fast)
 * const html = await fetchPage("https://example.com");
 * 
 * @example
 * // Full render for JavaScript-heavy sites
 * const html = await fetchPage("https://react-app.com", { fullRender: true });
 * 
 * @example
 * // Custom options
 * const html = await fetchPage("https://example.com", {
 *   timeout: 60000,
 *   maxSize: 100 * 1024 * 1024,  // 100MB
 *   userAgent: "Custom Bot/1.0"
 * });
 */
export async function fetchPage(
    url: string,
    options: FetchOptions = {}
): Promise<string> {
    // Validate URL
    validateURL(url);

    // Apply defaults
    const completeOptions: Required<FetchOptions> = {
        fullRender: options.fullRender ?? false,
        timeout: options.timeout ?? (options.fullRender
            ? FETCH_CONFIG.FULL_RENDER_TIMEOUT
            : FETCH_CONFIG.SIMPLE_FETCH_TIMEOUT),
        userAgent: options.userAgent ?? getUserAgent(),
        followRedirects: options.followRedirects ?? true,
        maxSize: options.maxSize ?? FETCH_CONFIG.MAX_CONTENT_SIZE,
        waitUntil: options.waitUntil ?? "networkidle2",
        maxRetries: options.maxRetries ?? FETCH_CONFIG.MAX_RETRIES,
    };

    // Fetch with retry
    return await fetchWithRetry(url, completeOptions);
}

/**
 * Check if URL is accessible (HEAD request)
 */
export async function checkURL(url: string): Promise<{
    accessible: boolean;
    status?: number;
    error?: string;
}> {
    try {
        validateURL(url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: "HEAD",
            headers: {
                "User-Agent": getUserAgent(),
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return {
            accessible: response.ok,
            status: response.status,
        };
    } catch (err: any) {
        return {
            accessible: false,
            error: err.message,
        };
    }
}