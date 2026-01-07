/**
 * Production-Grade Output Formatter
 *
 * Features:
 * - Multiple output formats (terminal, markdown, JSON, HTML, plain text)
 * - Input validation and sanitization
 * - Configurable styling and themes
 * - Metadata enrichment
 * - Error handling
 * - Extensible architecture
 * - Performance metrics inclusion
 * - Export-ready formats
 */

import chalk from "chalk";
import { hasBinaryArtifacts, nuclearCleanText } from "./text-cleaner";

// === Types ===

export interface PageMetadata {
	title?: string;
	description?: string;
	author?: string;
	publishDate?: string;
	keywords?: string[];
	language?: string;
	siteName?: string;
	type?: string;
	[key: string]: any;
}

export interface FormatOptions {
	/** Output format */
	format?: "terminal" | "markdown" | "json" | "html" | "plain";
	/** Legacy: Enable markdown format */
	markdown?: boolean;
	/** Legacy: Enable JSON format */
	json?: boolean;
	/** Page metadata */
	metadata?: PageMetadata;
	/** Source URL */
	url: string;
	/** Custom question asked */
	customQuestion?: string;
	/** Include metadata in output */
	includeMetadata?: boolean;
	/** Include timestamp */
	includeTimestamp?: boolean;
	/** Model used for generation */
	model?: string;
	/** Processing time in milliseconds */
	processingTime?: number;
	/** Cache hit indicator */
	fromCache?: boolean;
	/** Compact mode (less whitespace) */
	compact?: boolean;
	/** Custom title override */
	customTitle?: string;
	/** Flag indicating this is full content, not a summary */
	isFullContent?: boolean;
}

export interface FormattedOutput {
	/** Formatted content string */
	content: string;
	/** Output format used */
	format: string;
	/** Character count */
	length: number;
	/** Line count */
	lines: number;
}

// === Constants ===

const EMOJI = {
	source: "🌐",
	title: "📄",
	summary: "✨",
	answer: "💡",
	question: "❓",
	metadata: "ℹ️",
	time: "⏱️",
	model: "🤖",
	cache: "⚡",
	date: "📅",
} as const;

const _DEFAULT_TITLE = "Unknown Title";
const MAX_TITLE_LENGTH = 100;

// === Validation & Sanitization ===

/**
 * Validate and sanitize URL
 */
function sanitizeURL(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.href;
	} catch {
		// Return as-is if not valid URL (might be relative or invalid)
		return url;
	}
}

/**
 * Sanitize text for safe output with comprehensive encoding cleanup
 */
function sanitizeText(text: string, maxLength?: number): string {
	if (!text) return "";

	let sanitized = text.trim();

	// Remove null bytes and control characters that can cause terminal issues
	sanitized = sanitized.replace(/\x00/g, "");
	// Remove DEL character and other problematic control characters
	sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
	// Remove Unicode replacement characters that indicate encoding problems
	sanitized = sanitized.replace(/[\uFFFD\uFEFF]/g, "");
	// Remove zero-width characters that can cause display issues
	sanitized = sanitized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
	// Fix common Windows-1252 to UTF-8 encoding artifacts
	sanitized = sanitized
		.replace(/â€™/g, "'") // Smart apostrophe
		.replace(/â€œ/g, '"') // Smart quote open
		.replace(/â€\x9D/g, '"') // Smart quote close
		.replace(/â€"/g, "—") // Em dash
		.replace(/â€\x93/g, "–") // En dash
		.replace(/Â /g, " ") // Non-breaking space issues
		.replace(/â¢/g, "•") // Bullet point
		.replace(/Ã©/g, "é") // e with acute
		.replace(/Ã¡/g, "á") // a with acute
		.replace(/Ã­/g, "í") // i with acute
		.replace(/Ã³/g, "ó") // o with acute
		.replace(/Ãº/g, "ú") // u with acute
		.replace(/Ã±/g, "ñ") // n with tilde
		.replace(/Ã\x87/g, "Ç"); // C with cedilla

	// Remove remaining suspicious high-bit sequences that look like artifacts
	sanitized = sanitized.replace(/[^\x00-\x7F\u00A0-\uFFFF]/g, "");

	// Truncate if needed
	if (maxLength && sanitized.length > maxLength) {
		sanitized = `${sanitized.slice(0, maxLength - 3)}...`;
	}

	return sanitized;
}

/**
 * Sanitize metadata
 */
function sanitizeMetadata(metadata: any): PageMetadata {
	if (!metadata || typeof metadata !== "object") {
		return {};
	}

	return {
		title: sanitizeText(metadata.title, MAX_TITLE_LENGTH),
		description: sanitizeText(metadata.description, 500),
		author: sanitizeText(metadata.author, 100),
		publishDate: sanitizeText(metadata.publishDate, 50),
		keywords: Array.isArray(metadata.keywords)
			? metadata.keywords
					.slice(0, 10)
					.map((k: any) => sanitizeText(String(k), 50))
			: undefined,
		language: sanitizeText(metadata.language, 10),
		siteName: sanitizeText(metadata.siteName, 100),
		type: sanitizeText(metadata.type, 50),
	};
}

// === Content Formatting Helpers ===

/**
 * Format content for better readability by adding spacing between numbered lists and paragraphs
 */
function formatContentForReadability(content: string): string {
	if (!content || typeof content !== "string") {
		return content;
	}

	let formatted = content.trim();

	// Add spacing between numbered list items (1., 2., 3., etc.)
	formatted = formatted.replace(/^(\d+\.\s+.+)$/gm, (match, p1) => {
		return `${p1}\n`;
	});

	// Add spacing between bullet points (-,*, •)
	formatted = formatted.replace(/^([-*•]\s+.+)$/gm, (match, p1) => {
		return `${p1}\n`;
	});

	// Add spacing between paragraphs that are longer than 100 characters
	const lines = formatted.split("\n");
	const spaced: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const nextLine = lines[i + 1]?.trim();

		spaced.push(line);

		// Add extra spacing after:
		// 1. Long lines (likely paragraph endings)
		// 2. Lines ending with periods, exclamation marks, or question marks
		// 3. Before numbered items (1., 2., etc.)
		// 4. Before bullet points
		if (line && nextLine) {
			const isLongLine = line.length > 80;
			const endsWithPunctuation = /[.!?:]$/.test(line);
			const nextIsNumbered = /^\d+\.\s/.test(nextLine);
			const nextIsBullet = /^[-*•]\s/.test(nextLine);
			const lineIsNumbered = /^\d+\.\s/.test(line);

			if (
				(isLongLine && endsWithPunctuation) ||
				nextIsNumbered ||
				nextIsBullet ||
				(lineIsNumbered && nextLine.length > 40)
			) {
				spaced.push("");
			}
		}
	}

	// Clean up excessive blank lines (more than 2 consecutive)
	formatted = spaced.join("\n").replace(/\n{3,}/g, "\n\n");

	return formatted;
}

// === Format Implementations ===

/**
 * Format for terminal output with colors and emojis
 */
function formatTerminal(
	summary: string,
	options: Required<FormatOptions>,
): string {
	const parts: string[] = [];

	// Question (if custom question was asked)
	if (options.customQuestion) {
		parts.push(
			chalk.bold.yellow(`${EMOJI.question} Question: `) +
				chalk.white(options.customQuestion),
		);
		parts.push("");
	}

	// Source URL
	parts.push(
		chalk.bold.cyan(`${EMOJI.source} Source: `) + chalk.underline(options.url),
	);

	// Page metadata
	const meta = options.metadata;
	if (meta.title) {
		parts.push(
			chalk.bold.green(`${EMOJI.title} Title: `) + chalk.white(meta.title),
		);
	}

	// Additional metadata (only if includeMetadata is true)
	if (options.includeMetadata && !options.compact) {
		if (meta.author) {
			parts.push(chalk.gray(`   Author: ${meta.author}`));
		}
		if (meta.publishDate) {
			parts.push(chalk.gray(`   Published: ${meta.publishDate}`));
		}
		if (meta.siteName) {
			parts.push(chalk.gray(`   Site: ${meta.siteName}`));
		}
	}

	// Processing info (if available)
	if (!options.compact) {
		const processingParts: string[] = [];

		if (options.model) {
			processingParts.push(`${EMOJI.model} ${options.model}`);
		}
		if (options.processingTime !== undefined) {
			processingParts.push(
				`${EMOJI.time} ${(options.processingTime / 1000).toFixed(1)}s`,
			);
		}
		if (options.fromCache) {
			processingParts.push(`${EMOJI.cache} cached`);
		}

		if (processingParts.length > 0) {
			parts.push(chalk.dim(processingParts.join(" | ")));
		}
	}

	parts.push(""); // Blank line

	// Main content
	const contentTitle = options.customQuestion
		? "Answer"
		: options.isFullContent
			? "Full Content"
			: options.customTitle || "Summary";
	const contentEmoji = options.customQuestion
		? EMOJI.answer
		: options.isFullContent
			? "📖"
			: EMOJI.summary;
	parts.push(chalk.bold.magenta(`${contentEmoji} ${contentTitle}:`));
	parts.push("");

	// Format content with better spacing for readability
	const formattedContent = formatContentForReadability(summary);
	parts.push(chalk.white(formattedContent));

	// Timestamp (if enabled)
	if (options.includeTimestamp && !options.compact) {
		parts.push("");
		parts.push(
			chalk.dim(`${EMOJI.date} Generated: ${new Date().toLocaleString()}`),
		);
	}

	return parts.join("\n");
}

/**
 * Format as Markdown
 */
function formatMarkdown(
	summary: string,
	options: Required<FormatOptions>,
): string {
	const parts: string[] = [];

	// Title
	const title = options.customQuestion
		? "Answer"
		: options.customTitle || "Summary";
	parts.push(`# ${title}`);
	parts.push("");

	// Question (if asked)
	if (options.customQuestion) {
		parts.push(`**Question:** ${options.customQuestion}`);
		parts.push("");
	}

	// Source
	parts.push(`**Source:** [${options.url}](${options.url})`);

	// Metadata
	const meta = options.metadata;
	if (meta.title) {
		parts.push(`**Title:** ${meta.title}`);
	}
	if (options.includeMetadata) {
		if (meta.author) {
			parts.push(`**Author:** ${meta.author}`);
		}
		if (meta.publishDate) {
			parts.push(`**Published:** ${meta.publishDate}`);
		}
		if (meta.description) {
			parts.push(`**Description:** ${meta.description}`);
		}
	}

	parts.push("");

	// Processing info
	if (options.model || options.processingTime !== undefined) {
		const processingParts: string[] = [];
		if (options.model) {
			processingParts.push(`Model: ${options.model}`);
		}
		if (options.processingTime !== undefined) {
			processingParts.push(
				`Time: ${(options.processingTime / 1000).toFixed(1)}s`,
			);
		}
		if (options.fromCache) {
			processingParts.push("Cached: Yes");
		}

		if (processingParts.length > 0) {
			parts.push(`*${processingParts.join(" | ")}*`);
			parts.push("");
		}
	}

	// Main content
	parts.push("---");
	parts.push("");
	const formattedContent = formatContentForReadability(summary);
	parts.push(formattedContent);

	// Timestamp
	if (options.includeTimestamp) {
		parts.push("");
		parts.push("---");
		parts.push(`*Generated: ${new Date().toISOString()}*`);
	}

	return parts.join("\n");
}

/**
 * Format as JSON
 */
function formatJSON(summary: string, options: Required<FormatOptions>): string {
	const formattedContent = formatContentForReadability(summary);
	const output: any = {
		url: options.url,
		content: formattedContent,
		metadata: {
			title: options.metadata.title || null,
			description: options.metadata.description || null,
			author: options.metadata.author || null,
			publishDate: options.metadata.publishDate || null,
		},
	};

	if (options.customQuestion) {
		output.question = options.customQuestion;
		output.type = "answer";
	} else if (options.isFullContent) {
		output.type = "full_content";
	} else {
		output.type = "summary";
	}

	if (options.includeMetadata) {
		output.metadata = {
			...output.metadata,
			...options.metadata,
		};
	}

	if (options.model) {
		output.model = options.model;
	}

	if (options.processingTime !== undefined) {
		output.processingTimeMs = options.processingTime;
	}

	if (options.fromCache !== undefined) {
		output.fromCache = options.fromCache;
	}

	if (options.includeTimestamp) {
		output.generatedAt = new Date().toISOString();
	}

	return JSON.stringify(output, null, options.compact ? 0 : 2);
}

/**
 * Format as HTML
 */
function formatHTML(summary: string, options: Required<FormatOptions>): string {
	const meta = options.metadata;
	const title = options.customQuestion
		? "Answer"
		: options.customTitle || "Summary";

	// Escape HTML
	const escapeHTML = (str: string) =>
		str.replace(
			/[&<>"']/g,
			(char) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				})[char] || char,
		);

	const parts: string[] = [];

	parts.push("<!DOCTYPE html>");
	parts.push('<html lang="en">');
	parts.push("<head>");
	parts.push('  <meta charset="UTF-8">');
	parts.push(
		'  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
	);
	parts.push(`  <title>${escapeHTML(meta.title || title)}</title>`);
	parts.push("  <style>");
	parts.push(
		"    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }",
	);
	parts.push(
		"    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }",
	);
	parts.push(
		"    .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }",
	);
	parts.push("    .metadata p { margin: 5px 0; color: #666; }");
	parts.push("    .content { margin: 30px 0; }");
	parts.push(
		"    .question { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }",
	);
	parts.push(
		"    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }",
	);
	parts.push("    a { color: #3498db; text-decoration: none; }");
	parts.push("    a:hover { text-decoration: underline; }");
	parts.push("  </style>");
	parts.push("</head>");
	parts.push("<body>");

	// Title
	parts.push(`  <h1>${escapeHTML(title)}</h1>`);

	// Question
	if (options.customQuestion) {
		parts.push('  <div class="question">');
		parts.push(
			`    <strong>Question:</strong> ${escapeHTML(options.customQuestion)}`,
		);
		parts.push("  </div>");
	}

	// Metadata
	parts.push('  <div class="metadata">');
	parts.push(
		`    <p><strong>Source:</strong> <a href="${escapeHTML(options.url)}" target="_blank">${escapeHTML(options.url)}</a></p>`,
	);
	if (meta.title) {
		parts.push(`    <p><strong>Title:</strong> ${escapeHTML(meta.title)}</p>`);
	}
	if (options.includeMetadata) {
		if (meta.author) {
			parts.push(
				`    <p><strong>Author:</strong> ${escapeHTML(meta.author)}</p>`,
			);
		}
		if (meta.publishDate) {
			parts.push(
				`    <p><strong>Published:</strong> ${escapeHTML(meta.publishDate)}</p>`,
			);
		}
	}
	if (options.model) {
		parts.push(
			`    <p><strong>Model:</strong> ${escapeHTML(options.model)}</p>`,
		);
	}
	parts.push("  </div>");

	// Content
	parts.push('  <div class="content">');
	// Format content for better readability first
	const formattedContent = formatContentForReadability(summary);
	// Convert line breaks to paragraphs
	const paragraphs = formattedContent.split("\n\n");
	paragraphs.forEach((para) => {
		if (para.trim()) {
			parts.push(`    <p>${escapeHTML(para).replace(/\n/g, "<br>")}</p>`);
		}
	});
	parts.push("  </div>");

	// Footer
	if (options.includeTimestamp) {
		parts.push('  <div class="footer">');
		parts.push(`    <p>Generated: ${new Date().toLocaleString()}</p>`);
		parts.push("  </div>");
	}

	parts.push("</body>");
	parts.push("</html>");

	return parts.join("\n");
}

/**
 * Format as plain text (no colors, minimal formatting)
 */
function formatPlainText(
	summary: string,
	options: Required<FormatOptions>,
): string {
	const parts: string[] = [];

	// Title
	const title = options.customQuestion
		? "ANSWER"
		: (options.customTitle || "SUMMARY").toUpperCase();
	parts.push(title);
	parts.push("=".repeat(title.length));
	parts.push("");

	// Question
	if (options.customQuestion) {
		parts.push(`Question: ${options.customQuestion}`);
		parts.push("");
	}

	// Source
	parts.push(`Source: ${options.url}`);

	// Metadata
	const meta = options.metadata;
	if (meta.title) {
		parts.push(`Title: ${meta.title}`);
	}
	if (options.includeMetadata) {
		if (meta.author) {
			parts.push(`Author: ${meta.author}`);
		}
		if (meta.publishDate) {
			parts.push(`Published: ${meta.publishDate}`);
		}
	}

	parts.push("");
	parts.push("-".repeat(60));
	parts.push("");

	// Content
	const formattedContent = formatContentForReadability(summary);
	parts.push(formattedContent);

	// Footer
	if (options.includeTimestamp) {
		parts.push("");
		parts.push("-".repeat(60));
		parts.push(`Generated: ${new Date().toISOString()}`);
	}

	return parts.join("\n");
}

// === Main Export Function ===

/**
 * Format content for output
 *
 * @param summary - The content to format
 * @param options - Formatting options
 * @returns Formatted content string
 *
 * @example
 * // Terminal output (default)
 * const output = formatOutput(summary, { url: "https://example.com" });
 *
 * @example
 * // Markdown format
 * const md = formatOutput(summary, {
 *   url: "https://example.com",
 *   format: "markdown",
 *   includeMetadata: true
 * });
 *
 * @example
 * // JSON format
 * const json = formatOutput(summary, {
 *   url: "https://example.com",
 *   json: true,
 *   model: "gpt-4o-mini",
 *   processingTime: 2500
 * });
 */
export function formatOutput(summary: string, options: FormatOptions): string {
	// Input validation
	if (!summary || typeof summary !== "string") {
		throw new Error("Summary must be a non-empty string");
	}

	if (!options || typeof options !== "object") {
		throw new Error("Options must be an object");
	}

	if (!options.url) {
		throw new Error("URL is required in options");
	}

	// Smart cleaning: Preserve formatting while removing artifacts
	let cleanSummary = summary.trim();

	// Only apply nuclear cleaning if we detect actual binary artifacts
	if (hasBinaryArtifacts(cleanSummary)) {
		console.error(
			"⚠️ Binary artifacts detected in summary, applying nuclear cleaning...",
		);
		cleanSummary = nuclearCleanText(cleanSummary);
	} else {
		// For clean text, preserve formatting and only do minimal cleaning
		cleanSummary = cleanSummary
			// Remove dangerous artifacts but preserve newlines
			.replace(
				/\b(console|warn|error|log|TextDecoder|Buffer|ArrayBuffer)\b/gi,
				"",
			)
			.replace(/\b(cache|hits|lastAccessed|accessCount|Decompression)\b/gi, "")
			.replace(/\b0x[0-9A-Fa-f]+/g, "")
			// Clean up extra spaces within lines but preserve paragraph structure
			.replace(/ {2,}/g, " ") // Multiple spaces become single space
			.replace(/\t/g, " ") // Tabs become spaces
			.trim();
	}
	const cleanURL = sanitizeURL(options.url);
	const cleanMetadata = sanitizeMetadata(options.metadata);

	// Determine format (priority: format > json > markdown > default)
	let format: "terminal" | "markdown" | "json" | "html" | "plain" = "terminal";

	if (options.format) {
		format = options.format;
	} else if (options.json) {
		format = "json";
	} else if (options.markdown) {
		format = "markdown";
	}

	// Build complete options with defaults
	const completeOptions: Required<FormatOptions> = {
		format,
		markdown: options.markdown ?? false,
		json: options.json ?? false,
		metadata: cleanMetadata,
		url: cleanURL,
		customQuestion: options.customQuestion || "",
		includeMetadata: options.includeMetadata ?? false,
		includeTimestamp: options.includeTimestamp ?? false,
		model: options.model || "",
		processingTime: options.processingTime || 0,
		fromCache: options.fromCache || false,
		compact: options.compact ?? false,
		customTitle: options.customTitle || "",
		isFullContent: options.isFullContent ?? false,
	};

	// Format based on type
	let formatted: string;

	switch (format) {
		case "markdown":
			formatted = formatMarkdown(cleanSummary, completeOptions);
			break;
		case "json":
			formatted = formatJSON(cleanSummary, completeOptions);
			break;
		case "html":
			formatted = formatHTML(cleanSummary, completeOptions);
			break;
		case "plain":
			formatted = formatPlainText(cleanSummary, completeOptions);
			break;
		default:
			formatted = formatTerminal(cleanSummary, completeOptions);
			break;
	}

	return formatted;
}

/**
 * Get formatted output with metadata
 */
export function formatOutputWithMetadata(
	summary: string,
	options: FormatOptions,
): FormattedOutput {
	const content = formatOutput(summary, options);

	return {
		content,
		format:
			options.format ||
			(options.json ? "json" : options.markdown ? "markdown" : "terminal"),
		length: content.length,
		lines: content.split("\n").length,
	};
}

/**
 * Auto-detect best format based on file extension
 */
export function autoDetectFormat(
	filePath: string,
): "markdown" | "json" | "html" | "plain" {
	const ext = filePath.toLowerCase().split(".").pop();

	switch (ext) {
		case "md":
		case "markdown":
			return "markdown";
		case "json":
			return "json";
		case "html":
		case "htm":
			return "html";
		case "txt":
			return "plain";
		default:
			return "markdown"; // Default for unknown extensions
	}
}
