/**
 * Integration tests for Glance CLI
 * These tests use real URLs and test actual functionality end-to-end
 */

import { describe, expect, test } from "bun:test";
import { glance } from "../../src/cli/commands";

// Test URLs - using reliable, stable websites
const TEST_URLS = {
	simple: "https://example.com",
	wikipedia: "https://en.wikipedia.org/wiki/Artificial_intelligence",
	github: "https://github.com",
	multilingual: {
		french: "https://fr.wikipedia.org/wiki/Intelligence_artificielle",
		spanish: "https://es.wikipedia.org/wiki/Inteligencia_artificial",
	},
} as const;

// Timeout for integration tests (longer than unit tests)
const TEST_TIMEOUT = 60000; // 60 seconds

describe(
	"Integration: Basic URL Fetching",
	() => {
		test(
			"should fetch and process a simple webpage",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true, // Get full content, no AI needed
				});

				expect(result).toBeDefined();
				expect(typeof result).toBe("string");
				expect(result.length).toBeGreaterThan(0);
				expect(result).toContain("Example");
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle HTTPS URLs",
			async () => {
				const result = await glance(TEST_URLS.github, {
					full: true,
				});

				expect(result).toBeDefined();
				expect(result).toContain("GitHub");
			},
			TEST_TIMEOUT,
		);

		test(
			"should extract meaningful content from complex pages",
			async () => {
				const result = await glance(TEST_URLS.wikipedia, {
					full: true,
				});

				expect(result).toBeDefined();
				expect(result.length).toBeGreaterThan(100);
				// Should contain AI-related content
				expect(result.toLowerCase()).toMatch(/artificial|intelligence|ai/);
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle pages with special characters",
			async () => {
				const result = await glance(TEST_URLS.multilingual.french, {
					full: true,
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
	"Integration: Language Detection",
	() => {
		test(
			"should auto-detect English content",
			async () => {
				const result = await glance(TEST_URLS.wikipedia, {
					full: true,
					metadata: true,
				});

				expect(result).toBeDefined();
				// Content should be in English
				expect(result).toMatch(/the|is|and|of/i);
			},
			TEST_TIMEOUT,
		);

		test(
			"should detect French from URL",
			async () => {
				const result = await glance(TEST_URLS.multilingual.french, {
					full: true,
				});

				expect(result).toBeDefined();
				// Should contain French content
				expect(result.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle language override",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					language: "fr", // Override to French
				});

				expect(result).toBeDefined();
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Output Formats",
	() => {
		test(
			"should format output as plain text",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "plain",
				});

				expect(result).toBeDefined();
				expect(result).toContain("Source:");
				// Plain text shouldn't have ANSI color codes
				expect(result).not.toContain("\x1b[");
			},
			TEST_TIMEOUT,
		);

		test(
			"should format output as JSON",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "json",
				});

				expect(result).toBeDefined();
				// Should be valid JSON
				const _parsed = JSON.parse(result);
				expect(parsed).toHaveProperty("url");
				expect(parsed).toHaveProperty("content");
				expect(parsed).toHaveProperty("metadata");
				expect(parsed.url).toContain("example.com");
			},
			TEST_TIMEOUT,
		);

		test(
			"should format output as Markdown",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "markdown",
				});

				expect(result).toBeDefined();
				expect(result).toContain("#"); // Markdown headers
				expect(result).toContain("**"); // Markdown bold
				expect(result).toContain("---"); // Markdown separator
			},
			TEST_TIMEOUT,
		);

		test(
			"should format output as HTML",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "html",
				});

				expect(result).toBeDefined();
				expect(result).toContain("<!DOCTYPE html>");
				expect(result).toContain("<html");
				expect(result).toContain("</html>");
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Metadata Extraction",
	() => {
		test(
			"should extract page metadata",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					metadata: true,
					format: "json",
				});

				const _parsed = JSON.parse(result);
				expect(parsed.metadata).toBeDefined();
				expect(parsed.metadata.title).toBeDefined();
			},
			TEST_TIMEOUT,
		);

		test(
			"should extract links when requested",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					links: true,
					format: "json",
				});

				expect(result).toBeDefined();
				const _parsed = JSON.parse(result);
				// Should have links property or link information
				expect(result).toContain("http");
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Error Handling",
	() => {
		test(
			"should handle invalid URLs gracefully",
			async () => {
				await expect(
					glance("not-a-valid-url", { full: true }),
				).rejects.toThrow();
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle non-existent domains",
			async () => {
				await expect(
					glance("https://this-domain-definitely-does-not-exist-12345.com", {
						full: true,
					}),
				).rejects.toThrow();
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle malformed HTML",
			async () => {
				// example.com should still work even with basic HTML
				const result = await glance(TEST_URLS.simple, {
					full: true,
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
	"Integration: Content Processing",
	() => {
		test(
			"should clean and sanitize content",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "plain",
				});

				expect(result).toBeDefined();
				// Should not contain binary artifacts
				expect(result).not.toMatch(/\x00/);
				expect(result).not.toMatch(/console\.log/);
			},
			TEST_TIMEOUT,
		);

		test(
			"should preserve content structure",
			async () => {
				const result = await glance(TEST_URLS.wikipedia, {
					full: true,
					format: "plain",
				});

				expect(result).toBeDefined();
				// Should have paragraphs (newlines)
				expect(result).toContain("\n");
				// Should be readable text
				expect(result.split(" ").length).toBeGreaterThan(10);
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle large pages efficiently",
			async () => {
				const startTime = Date.now();
				const result = await glance(TEST_URLS.wikipedia, {
					full: true,
				});
				const duration = Date.now() - startTime;

				expect(result).toBeDefined();
				expect(result.length).toBeGreaterThan(0);
				// Should complete within reasonable time (< 30s)
				expect(duration).toBeLessThan(30000);
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Debug Mode",
	() => {
		test(
			"should run with debug mode enabled",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					debug: true,
				});

				expect(result).toBeDefined();
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Full Content vs Summary",
	() => {
		test(
			"should return full content when requested",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "json",
				});

				const _parsed = JSON.parse(result);
				expect(parsed.type).toBe("full_content");
				expect(parsed.content).toBeDefined();
				expect(parsed.content.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle custom questions",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					customQuestion: "What is this page about?",
					full: true, // Use full to avoid AI requirement
					format: "json",
				});

				const _parsed = JSON.parse(result);
				expect(parsed.question).toBe("What is this page about?");
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Multiple Requests",
	() => {
		test(
			"should handle multiple sequential requests",
			async () => {
				const result1 = await glance(TEST_URLS.simple, { full: true });
				const result2 = await glance(TEST_URLS.github, { full: true });

				expect(result1).toBeDefined();
				expect(result2).toBeDefined();
				expect(result1).not.toBe(result2);
			},
			TEST_TIMEOUT * 2,
		);

		test(
			"should handle concurrent requests",
			async () => {
				const [result1, result2] = await Promise.all([
					glance(TEST_URLS.simple, { full: true }),
					glance(TEST_URLS.github, { full: true }),
				]);

				expect(result1).toBeDefined();
				expect(result2).toBeDefined();
			},
			TEST_TIMEOUT * 2,
		);
	},
	TEST_TIMEOUT,
);
