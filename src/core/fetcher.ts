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
 * - User-agent rotation with glance-cli default
 * - Response validation
 * - Better error messages with hints
 * - Precise byte-size validation
 * - Optimized encoding detection
 */

// Puppeteer types for when we dynamically import
type Browser = import("puppeteer").Browser;
type Page = import("puppeteer").Page;

// === Text Encoding Utilities ===

/**
 * Get text content with proper encoding handling
 */
async function getTextWithProperEncoding(response: Response): Promise<string> {
	const contentType = response.headers.get("content-type") || "";
	const charsetMatch = contentType.match(/charset=([^;]+)/i);
	const declaredCharset = charsetMatch
		? (charsetMatch[1]?.toLowerCase().trim() ?? null)
		: null;

	try {
		const buffer = await response.arrayBuffer();
		const bytes = new Uint8Array(buffer);

		let detectedCharset = declaredCharset;

		if (!detectedCharset && bytes.length > 0) {
			// Reduced to 512 bytes - sufficient for most meta tags
			const decoder = new TextDecoder("utf-8", { fatal: false });
			const preview = decoder.decode(
				bytes.slice(0, Math.min(512, bytes.length)),
			);

			const metaCharsetMatch = preview.match(
				/<meta[^>]*charset[=\s]*["']?([^"'\s>]+)/i,
			);
			if (metaCharsetMatch) {
				detectedCharset = metaCharsetMatch[1]?.toLowerCase().trim() ?? null;
			} else {
				const httpEquivMatch = preview.match(
					/<meta[^>]*http-equiv[=\s]*["']?content-type["']?[^>]*content[=\s]*["']?[^"']*charset[=\s]*([^"'\s;]+)/i,
				);
				if (httpEquivMatch) {
					detectedCharset = httpEquivMatch[1]?.toLowerCase().trim() ?? null;
				}
			}
		}

		if (!detectedCharset) detectedCharset = "utf-8";

		const normalizedCharset = normalizeCharset(detectedCharset);

		try {
			const decoder = new TextDecoder(normalizedCharset as any, {
				fatal: false,
			});
			const text = decoder.decode(bytes);
			return cleanEncodingArtifacts(text);
		} catch {
			const decoder = new TextDecoder("utf-8", { fatal: false });
			const text = decoder.decode(bytes);
			return cleanEncodingArtifacts(text);
		}
	} catch {
		const text = await response.text();
		return cleanEncodingArtifacts(text);
	}
}

/**
 * Normalize charset names to standard forms
 */
function normalizeCharset(charset: string): string {
	const normalized = charset.toLowerCase().replace(/[-_\s]/g, "");
	const charsetMap: Record<string, string> = {
		iso88591: "iso-8859-1",
		latin1: "iso-8859-1",
		utf8: "utf-8",
		windows1252: "windows-1252",
		cp1252: "windows-1252",
		ascii: "us-ascii",
		usascii: "us-ascii",
		gb2312: "gb18030",
		gbk: "gb18030",
	};
	return charsetMap[normalized] || charset;
}

/**
 * Clean up common encoding artifacts and problematic characters
 */
function cleanEncodingArtifacts(text: string): string {
	return text
		.replace(/\x00/g, "")
		.replace(/\x7F/g, "")
		.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "")
		.replace(/\uFFFD/g, "")
		.replace(/\uFEFF/g, "")
		.replace(/[\u200B-\u200D\u2060]/g, "")
		.replace(/â€™/g, "'")
		.replace(/â€œ/g, '"')
		.replace(/â€\x9D/g, '"')
		.replace(/â€"/g, "—")
		.replace(/â€\x93/g, "–")
		.replace(/Â /g, " ")
		.replace(/â¢/g, "•")
		.replace(/Ã©/g, "é")
		.replace(/Ã¡/g, "á")
		.replace(/Ã­/g, "í")
		.replace(/Ã³/g, "ó")
		.replace(/Ãº/gu, "ú")
		.replace(/Ã±/g, "ñ")
		.replace(/Ã\x87/g, "Ç")
		.replace(/[^\x00-\x7F\u00A0-\uFFFF]/g, "");
}

// === Configuration ===
const FETCH_CONFIG = {
	SIMPLE_FETCH_TIMEOUT: 30000,
	FULL_RENDER_TIMEOUT: 60000,
	PAGE_LOAD_TIMEOUT: 45000,
	MAX_CONTENT_SIZE: 50 * 1024 * 1024, // 50MB
	MAX_REDIRECTS: 10,
	MAX_RETRIES: 3,
	RETRY_DELAY: 1000,
	USER_AGENTS: [
		"glance-cli/1.0[](https://github.com/jkenley/glance-cli)",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	],
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
		public statusCode?: number,
	) {
		super(message);
		this.name = "FetchError";
	}
}

// === Fetch Options ===
export interface FetchOptions {
	fullRender?: boolean;
	timeout?: number;
	userAgent?: string;
	followRedirects?: boolean;
	maxSize?: number;
	waitUntil?: "networkidle2" | "networkidle0" | "load" | "domcontentloaded";
	maxRetries?: number;
}

// === Validation Functions ===

function validateURL(url: string): void {
	if (!url || typeof url !== "string") {
		throw new FetchError(
			"Invalid URL: empty or not a string",
			"INVALID_URL",
			"Invalid URL provided",
			false,
			"URL must be a non-empty string starting with http:// or https://",
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
				"URL must start with http:// or https://",
			);
		}
	} catch (err: any) {
		if (err instanceof FetchError) throw err;
		throw new FetchError(
			`Malformed URL: ${err.message}`,
			"MALFORMED_URL",
			"Invalid URL format",
			false,
			"URL must be properly formatted (e.g., https://example.com)",
		);
	}
}

function validateContentType(contentType: string | null): void {
	if (!contentType) return;
	const type = contentType.split(";")[0]?.trim().toLowerCase() || "";
	if (!FETCH_CONFIG.VALID_CONTENT_TYPES.some((valid) => type.includes(valid))) {
		throw new FetchError(
			`Invalid content type: ${contentType}`,
			"INVALID_CONTENT_TYPE",
			"Page is not HTML",
			false,
			`Expected HTML but got ${type}. This URL may point to a file download or API endpoint.`,
		);
	}
}

function validateContentSize(sizeBytes: number, maxSize: number): void {
	if (sizeBytes > maxSize) {
		const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
		const maxMB = (maxSize / 1024 / 1024).toFixed(1);
		throw new FetchError(
			`Content too large: ${sizeMB}MB`,
			"CONTENT_TOO_LARGE",
			"Page is too large",
			false,
			`Page size (${sizeMB}MB) exceeds maximum (${maxMB}MB).`,
		);
	}
}

function getUserAgent(custom?: string): string {
	if (custom) return custom;
	// Default to glance-cli UA for better identification
	return FETCH_CONFIG.USER_AGENTS[0];
}

// === Simple Fetch Implementation ===

async function simpleFetch(
	url: string,
	options: Required<FetchOptions>,
): Promise<string> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), options.timeout);

	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": getUserAgent(options.userAgent),
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"Accept-Encoding": "gzip, deflate, br",
				"Cache-Control": "no-cache",
				Pragma: "no-cache",
			},
			redirect: options.followRedirects ? "follow" : "manual",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const statusCode = response.status;
			if (statusCode === 404)
				throw new FetchError(
					`HTTP 404: Not Found`,
					"NOT_FOUND",
					"Page not found",
					false,
					"The URL doesn't exist. Check for typos.",
					404,
				);
			if (statusCode === 403)
				throw new FetchError(
					`HTTP 403: Forbidden`,
					"FORBIDDEN",
					"Access denied",
					false,
					"The server is blocking access. Try with --full-render.",
					403,
				);
			if (statusCode === 401)
				throw new FetchError(
					`HTTP 401: Unauthorized`,
					"UNAUTHORIZED",
					"Authentication required",
					false,
					"This page requires login.",
					401,
				);
			if (statusCode === 429)
				throw new FetchError(
					`HTTP 429: Too Many Requests`,
					"RATE_LIMITED",
					"Rate limited",
					true,
					"The server is rate limiting requests. Wait a moment.",
					429,
				);
			if (statusCode >= 500)
				throw new FetchError(
					`HTTP ${statusCode}: ${response.statusText}`,
					"SERVER_ERROR",
					"Server error",
					true,
					"The server is experiencing issues. Try again later.",
					statusCode,
				);
			throw new FetchError(
				`HTTP ${statusCode}: ${response.statusText}`,
				"HTTP_ERROR",
				`HTTP ${statusCode} error`,
				statusCode >= 500,
				undefined,
				statusCode,
			);
		}

		const contentType = response.headers.get("content-type");
		validateContentType(contentType);

		const contentLength = response.headers.get("content-length");
		if (contentLength) {
			const size = parseInt(contentLength, 10);
			validateContentSize(size, options.maxSize);
		}

		const html = await getTextWithProperEncoding(response);

		// Precise byte size validation (more accurate than string.length)
		const byteSize = new TextEncoder().encode(html).length;
		validateContentSize(byteSize, options.maxSize);

		if (!html.trim()) {
			throw new FetchError(
				"Empty response",
				"EMPTY_RESPONSE",
				"Page is empty",
				false,
				"The server returned an empty page. The URL may be incorrect.",
			);
		}

		return html;
	} catch (err: any) {
		clearTimeout(timeoutId);
		if (err instanceof FetchError) throw err;
		if (err.name === "AbortError")
			throw new FetchError(
				"Request timeout",
				"TIMEOUT",
				"Request timed out",
				true,
				`Page took too long (>${options.timeout / 1000}s).`,
			);
		if (
			err.message?.includes("fetch failed") ||
			err.cause?.code === "ENOTFOUND"
		)
			throw new FetchError(
				err.message,
				"DNS_ERROR",
				"Cannot resolve domain",
				false,
				"Check domain and internet connection.",
			);
		if (err.cause?.code === "ECONNREFUSED")
			throw new FetchError(
				err.message,
				"CONNECTION_REFUSED",
				"Connection refused",
				false,
				"The server refused the connection.",
			);
		if (
			err.cause?.code === "ECONNRESET" ||
			err.message?.includes("socket hang up")
		)
			throw new FetchError(
				err.message,
				"CONNECTION_RESET",
				"Connection reset",
				true,
				"The connection was reset.",
			);
		if (err.cause?.code === "ETIMEDOUT")
			throw new FetchError(
				err.message,
				"NETWORK_TIMEOUT",
				"Network timeout",
				true,
				"Network connection timed out.",
			);
		if (
			err.message?.includes("certificate") ||
			err.cause?.code?.includes("CERT")
		)
			throw new FetchError(
				err.message,
				"SSL_ERROR",
				"SSL/TLS error",
				false,
				"Invalid SSL certificate.",
			);
		throw new FetchError(
			err.message,
			"NETWORK_ERROR",
			"Network error",
			true,
			"A network error occurred.",
		);
	}
}

// === Full Render Implementation ===

async function fullRenderFetch(
	url: string,
	options: Required<FetchOptions>,
	puppeteer: typeof import("puppeteer"),
): Promise<string> {
	let browser: Browser | undefined;
	let page: Page | undefined;

	try {
		browser = await puppeteer.default.launch({
			headless: true,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-accelerated-2d-canvas",
				"--no-first-run",
				"--no-zygote",
				"--disable-gpu",
				"--disable-web-security",
				"--disable-features=IsolateOrigins,site-per-process",
				// Added for better performance in headless mode
				"--disable-background-timer-throttling",
				"--disable-renderer-backgrounding",
				"--disable-backgrounding-occluded-windows",
			],
			timeout: 10000,
		});

		page = await browser.newPage();
		await page.setUserAgent(getUserAgent(options.userAgent));
		await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
		page.setDefaultTimeout(options.timeout);
		page.setDefaultNavigationTimeout(FETCH_CONFIG.PAGE_LOAD_TIMEOUT);

		await page.goto(url, {
			waitUntil: options.waitUntil,
			timeout: FETCH_CONFIG.PAGE_LOAD_TIMEOUT,
		});

		const html = await page.content();
		const byteSize = new TextEncoder().encode(html).length;
		validateContentSize(byteSize, options.maxSize);

		if (!html.trim()) {
			throw new FetchError(
				"Empty page",
				"EMPTY_PAGE",
				"Page is empty",
				false,
				"The page rendered but is empty.",
			);
		}

		await page.close();
		await browser.close();
		return html;
	} catch (err: any) {
		if (page) await page.close().catch(() => {});
		if (browser) await browser.close().catch(() => {});

		if (err instanceof FetchError) throw err;
		if (
			err.message?.includes("Could not find") ||
			err.message?.includes("Chromium")
		) {
			throw new FetchError(
				err.message,
				"BROWSER_NOT_FOUND",
				"Chromium not found",
				false,
				"Reinstall: bun install puppeteer",
			);
		}
		if (err.message?.includes("Failed to launch")) {
			throw new FetchError(
				err.message,
				"BROWSER_LAUNCH_FAILED",
				"Failed to launch browser",
				false,
				"Check system resources.",
			);
		}
		throw new FetchError(
			err.message,
			"RENDER_ERROR",
			"Page rendering failed",
			true,
			"Full render failed.",
		);
	}
}

// === Retry Logic ===

async function fetchWithRetry(
	url: string,
	options: Required<FetchOptions>,
	attempt: number = 1,
): Promise<string> {
	try {
		if (options.fullRender) {
			const puppeteer = await import("puppeteer");
			return await fullRenderFetch(url, options, puppeteer);
		}
		return await simpleFetch(url, options);
	} catch (err: any) {
		if (err instanceof FetchError && !err.recoverable) throw err;
		if (attempt >= options.maxRetries) throw err;

		const delay = FETCH_CONFIG.RETRY_DELAY * 2 ** (attempt - 1);
		await new Promise((resolve) => setTimeout(resolve, delay));
		return fetchWithRetry(url, options, attempt + 1);
	}
}

// === Main Export Function ===

export async function fetchPage(
	url: string,
	options: FetchOptions = {},
): Promise<string> {
	validateURL(url);

	const completeOptions: Required<FetchOptions> = {
		fullRender: options.fullRender ?? false,
		timeout:
			options.timeout ??
			(options.fullRender
				? FETCH_CONFIG.FULL_RENDER_TIMEOUT
				: FETCH_CONFIG.SIMPLE_FETCH_TIMEOUT),
		userAgent: options.userAgent ?? getUserAgent(),
		followRedirects: options.followRedirects ?? true,
		maxSize: options.maxSize ?? FETCH_CONFIG.MAX_CONTENT_SIZE,
		waitUntil: options.waitUntil ?? "networkidle2",
		maxRetries: options.maxRetries ?? FETCH_CONFIG.MAX_RETRIES,
	};

	return await fetchWithRetry(url, completeOptions);
}

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
			headers: { "User-Agent": getUserAgent() },
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		return { accessible: response.ok, status: response.status };
	} catch (err: any) {
		return { accessible: false, error: err.message };
	}
}
