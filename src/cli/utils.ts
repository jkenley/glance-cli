/**
 * Utility functions for Glance CLI
 */

import ora, { type Ora } from "ora";
import {
	hasBinaryArtifacts,
	nuclearCleanText,
	sanitizeAIResponse,
} from "../core/text-cleaner";
import { CONFIG } from "./config";
import { GlanceError } from "./errors";
import { logger } from "./logger";

/**
 * Sanitize text output for terminal display
 */
export function sanitizeOutputForTerminal(text: string): string {
	// Preserve terminal color codes while cleaning text
	const ansiRegex = /\x1b\[[0-9;]*m/g;
	const ansiCodes: string[] = [];
	let cleanText = text;

	// Extract ANSI codes
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: RegExp.exec pattern is idiomatic
	while ((match = ansiRegex.exec(text)) !== null) {
		ansiCodes.push(match[0]);
	}

	// Check if nuclear cleaning is needed
	const needsNuclearCleaning = hasBinaryArtifacts(text);

	if (needsNuclearCleaning) {
		// Apply nuclear cleaning for binary artifacts
		logger.warn("Binary artifacts detected, applying nuclear cleaning");
		cleanText = nuclearCleanText(sanitizeAIResponse(text));
	} else {
		// Light cleaning for normal text
		cleanText = text
			// Remove null bytes and other control characters
			.replace(/\0/g, "")
			.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
			// Fix common encoding issues
			.replace(/â€™/g, "'")
			.replace(/â€"/g, "—")
			.replace(/â€œ/g, '"')
			.replace(/â€�/g, '"')
			.replace(/â€˜/g, "'")
			.replace(/â€¦/g, "...")
			.replace(/Ã©/g, "é")
			.replace(/Ã¨/g, "è")
			.replace(/Ã /g, "à")
			.replace(/Ã¢/g, "â")
			.replace(/Ã®/g, "î")
			.replace(/Ã´/g, "ô")
			.replace(/Ã§/g, "ç")
			// Fix spacing
			.replace(/\r\n/g, "\n")
			.replace(/\r/g, "\n")
			.replace(/\n{4,}/g, "\n\n\n")
			.trim();
	}

	return cleanText;
}

/**
 * Retry logic for async operations
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options: {
		attempts?: number;
		delay?: number;
		backoff?: number;
		onRetry?: (attempt: number, error: unknown) => void;
	} = {},
): Promise<T> {
	const {
		attempts = CONFIG.RETRY_ATTEMPTS,
		delay = CONFIG.RETRY_DELAY,
		backoff = 2,
		onRetry,
	} = options;

	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await operation();
		} catch (error: unknown) {
			lastError = error;

			// Don't retry on non-recoverable errors
			if (error instanceof GlanceError && !error.recoverable) {
				throw error;
			}

			// Check for specific non-recoverable HTTP status codes
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				typeof error.status === "number" &&
				[400, 401, 403, 404].includes(error.status)
			) {
				throw error;
			}

			if (attempt < attempts) {
				const waitTime = delay * backoff ** (attempt - 1);

				if (onRetry) {
					onRetry(attempt, error);
				} else {
					logger.debug(
						`Retry attempt ${attempt}/${attempts} after ${waitTime}ms`,
					);
				}

				await new Promise((resolve) => setTimeout(resolve, waitTime));
			}
		}
	}

	throw lastError;
}

/**
 * Create a spinner with consistent styling
 */
export function createSpinner(text: string, disableStdin = false): Ora {
	return ora({
		text,
		spinner: "dots",
		color: "cyan",
		discardStdin: !disableStdin,
	});
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);

	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}

	return `${seconds}s`;
}

/**
 * Check if running in TTY environment
 */
export function isTTY(): boolean {
	return process.stdout.isTTY || false;
}

/**
 * Get terminal width
 */
export function getTerminalWidth(): number {
	return process.stdout.columns || 80;
}

/**
 * Truncate text to fit terminal width
 */
export function truncateToWidth(text: string, maxWidth?: number): string {
	const width = maxWidth || getTerminalWidth() - 4;

	if (text.length <= width) {
		return text;
	}

	return `${text.substring(0, width - 3)}...`;
}

/**
 * Parse file extension for export
 */
export function getFileExtension(filename: string): string {
	const parts = filename.split(".");
	return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? "") : "";
}

/**
 * Check if model is a premium model
 */
export function isPremiumModel(model: string): boolean {
	const premiumPrefixes = ["gpt-4", "claude", "gemini-pro", "gemini-ultra"];
	return premiumPrefixes.some((prefix) =>
		model.toLowerCase().startsWith(prefix),
	);
}

/**
 * Format model name for display
 */
export function formatModelName(model: string): string {
	// Add provider labels for clarity
	if (model.startsWith("gpt")) {
		return `${model} (OpenAI)`;
	}
	if (model.startsWith("gemini")) {
		return `${model} (Google)`;
	}
	if (
		model.includes("llama") ||
		model.includes("mistral") ||
		model.includes("phi")
	) {
		return `${model} (Local)`;
	}
	return model;
}
