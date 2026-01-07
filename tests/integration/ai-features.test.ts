/**
 * Integration tests for AI-powered features
 * These tests require either Ollama running or API keys configured
 * Tests are skipped if no AI service is available
 */

import { beforeAll, describe, expect, test } from "bun:test";
import {
	checkServicesCommand,
	glance,
	listModelsCommand,
} from "../../src/cli/commands";

const TEST_URL = "https://example.com";
const TEST_TIMEOUT = 90000; // 90 seconds for AI operations

// Helper to check if any AI service is available
async function hasAIService(): Promise<boolean> {
	try {
		// Check for Ollama
		const ollamaCheck = await fetch("http://localhost:11434/api/version");
		if (ollamaCheck.ok) return true;
	} catch {
		// Ollama not available
	}

	// Check for API keys
	if (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY) {
		return true;
	}

	return false;
}

describe(
	"Integration: AI Summary Modes",
	() => {
		let aiAvailable = false;

		beforeAll(async () => {
			aiAvailable = await hasAIService();
		});

		test(
			"should generate TLDR summary",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.content).toBeDefined();
				expect(parsed.content.length).toBeGreaterThan(0);
				// TLDR should be relatively short
				expect(parsed.content.length).toBeLessThan(500);
			},
			TEST_TIMEOUT,
		);

		test(
			"should generate key points summary",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					keyPoints: true,
					format: "plain",
				});

				expect(result).toBeDefined();
				expect(result.length).toBeGreaterThan(0);
				// Key points often use bullet points or numbers
				expect(result).toMatch(/[-•*\d.]/);
			},
			TEST_TIMEOUT,
		);

		test(
			"should generate ELI5 explanation",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					eli5: true,
					format: "plain",
				});

				expect(result).toBeDefined();
				expect(result.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should answer custom questions",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					customQuestion: "What is the main purpose of this website?",
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.type).toBe("answer");
				expect(parsed.question).toBe(
					"What is the main purpose of this website?",
				);
				expect(parsed.content).toBeDefined();
				expect(parsed.content.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should use default summary when no mode specified",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.type).toBe("summary");
				expect(parsed.content).toBeDefined();
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Model Selection",
	() => {
		let aiAvailable = false;

		beforeAll(async () => {
			aiAvailable = await hasAIService();
		});

		test(
			"should work with default model",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
				});

				expect(result).toBeDefined();
				expect(result.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should work with Ollama model (if available)",
			async () => {
				try {
					const check = await fetch("http://localhost:11434/api/version");
					if (!check.ok) {
						console.log("⚠️  Skipping: Ollama not running");
						return;
					}
				} catch {
					console.log("⚠️  Skipping: Ollama not available");
					return;
				}

				const result = await glance(TEST_URL, {
					model: "llama3:latest",
					tldr: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.content).toBeDefined();
				expect(parsed.model).toContain("llama3");
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle max tokens parameter",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					maxTokens: 100,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.content).toBeDefined();
				// With max tokens of 100, output should be relatively short
				expect(parsed.content.split(" ").length).toBeLessThan(150);
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Service Commands",
	() => {
		test(
			"should list available models",
			async () => {
				try {
					const check = await fetch("http://localhost:11434/api/version");
					if (!check.ok) {
						console.log("⚠️  Skipping: Ollama not running");
						return;
					}
				} catch {
					console.log("⚠️  Skipping: Ollama not available");
					return;
				}

				// This function outputs to console, so we just ensure it doesn't throw
				await expect(listModelsCommand()).resolves.not.toThrow();
			},
			TEST_TIMEOUT,
		);

		test(
			"should check service status",
			async () => {
				// This function outputs to console, so we just ensure it doesn't throw
				await expect(checkServicesCommand()).resolves.not.toThrow();
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Free-Only Mode",
	() => {
		test(
			"should respect free-only flag",
			async () => {
				try {
					const check = await fetch("http://localhost:11434/api/version");
					if (!check.ok) {
						console.log("⚠️  Skipping: Ollama not running");
						return;
					}
				} catch {
					console.log("⚠️  Skipping: Ollama not available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					freeOnly: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.content).toBeDefined();
				// Should use Ollama model, not paid API
				if (parsed.model) {
					expect(parsed.model).not.toContain("gpt");
					expect(parsed.model).not.toContain("gemini");
				}
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Language Translation with AI",
	() => {
		let aiAvailable = false;

		beforeAll(async () => {
			aiAvailable = await hasAIService();
		});

		test(
			"should translate to specified language",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					language: "fr",
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.content).toBeDefined();
				// Content should be in French (basic check)
				expect(parsed.content.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle Spanish translation",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					language: "es",
				});

				expect(result).toBeDefined();
				expect(result.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: AI with Different Formats",
	() => {
		let aiAvailable = false;

		beforeAll(async () => {
			aiAvailable = await hasAIService();
		});

		test(
			"should generate AI summary in Markdown",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					format: "markdown",
				});

				expect(result).toContain("#");
				expect(result).toContain("**");
				expect(result).toContain("---");
			},
			TEST_TIMEOUT,
		);

		test(
			"should generate AI summary in HTML",
			async () => {
				if (!aiAvailable) {
					console.log("⚠️  Skipping: No AI service available");
					return;
				}

				const result = await glance(TEST_URL, {
					tldr: true,
					format: "html",
				});

				expect(result).toContain("<!DOCTYPE html>");
				expect(result).toContain("<html");
				expect(result).toContain("</html>");
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);
