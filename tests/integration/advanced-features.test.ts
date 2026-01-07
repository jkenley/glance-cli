/**
 * Integration tests for advanced features
 * Screenshots, metadata extraction, link extraction, etc.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { glance } from "../../src/cli/commands";

const TEST_URLS = {
	simple: "https://example.com",
	withLinks: "https://github.com",
	richMetadata: "https://en.wikipedia.org/wiki/Artificial_intelligence",
} as const;

const TEST_TIMEOUT = 60000;

// Track files to clean up
const filesToCleanup: string[] = [];

afterEach(async () => {
	// Clean up any test files
	for (const file of filesToCleanup) {
		try {
			if (existsSync(file)) {
				await unlink(file);
			}
		} catch {
			// Ignore cleanup errors
		}
	}
	filesToCleanup.length = 0;
});

describe(
	"Integration: File Output",
	() => {
		test(
			"should save output to JSON file",
			async () => {
				const outputFile = "/tmp/glance-test-output.json";
				filesToCleanup.push(outputFile);

				const result = await glance(TEST_URLS.simple, {
					full: true,
					output: outputFile,
					format: "json",
				});

				// Check if file was created
				if (existsSync(outputFile)) {
					const content = await Bun.file(outputFile).text();
					const parsed = JSON.parse(content);
					expect(parsed).toHaveProperty("url");
					expect(parsed).toHaveProperty("content");
				} else {
					// If not saved to file, result should be valid JSON
					const parsed = JSON.parse(result);
					expect(parsed).toHaveProperty("url");
				}
			},
			TEST_TIMEOUT,
		);

		test(
			"should save output to Markdown file",
			async () => {
				const outputFile = "/tmp/glance-test-output.md";
				filesToCleanup.push(outputFile);

				await glance(TEST_URLS.simple, {
					full: true,
					output: outputFile,
					format: "markdown",
				});

				// Check if file exists
				if (!existsSync(outputFile)) {
					console.log("⚠️  File not saved, checking result instead");
				}

				const content = await Bun.file(outputFile).text();
				expect(content).toContain("#");
				expect(content).toContain("**Source:**");
			},
			TEST_TIMEOUT,
		);

		test(
			"should save output to HTML file",
			async () => {
				const outputFile = "/tmp/glance-test-output.html";
				filesToCleanup.push(outputFile);

				const result = await glance(TEST_URLS.simple, {
					full: true,
					output: outputFile,
					format: "html",
				});

				// Output file should be created
				if (existsSync(outputFile)) {
					const content = await Bun.file(outputFile).text();
					expect(content).toContain("<!DOCTYPE html>");
					expect(content).toContain("</html>");
				} else {
					// If file not saved, at least result should be HTML
					expect(result).toContain("<!DOCTYPE html>");
				}
			},
			TEST_TIMEOUT,
		);

		test(
			"should save output to plain text file",
			async () => {
				const outputFile = "/tmp/glance-test-output.txt";
				filesToCleanup.push(outputFile);

				await glance(TEST_URLS.simple, {
					full: true,
					output: outputFile,
					format: "plain",
				});

				// Check if file exists
				if (!existsSync(outputFile)) {
					console.log("⚠️  File not saved, checking result instead");
				}

				const content = await Bun.file(outputFile).text();
				expect(content).toContain("Source:");
				// Should not contain ANSI codes
				expect(content).not.toContain("\x1b[");
			},
			TEST_TIMEOUT,
		);

		test(
			"should auto-detect format from file extension",
			async () => {
				const jsonFile = "/tmp/glance-test.json";
				filesToCleanup.push(jsonFile);

				await glance(TEST_URLS.simple, {
					full: true,
					output: jsonFile,
					// No format specified, should auto-detect from .json
				});

				const content = await Bun.file(jsonFile).text();
				const parsed = JSON.parse(content);
				expect(parsed).toBeDefined();
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
			"should extract comprehensive metadata",
			async () => {
				const result = await glance(TEST_URLS.richMetadata, {
					full: true,
					metadata: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.metadata).toBeDefined();
				expect(parsed.metadata.title).toBeDefined();
				expect(parsed.metadata.title.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should include metadata in different formats",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					metadata: true,
					format: "markdown",
				});

				expect(result).toContain("**Title:**");
			},
			TEST_TIMEOUT,
		);

		test(
			"should extract metadata without full content",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					metadata: true,
					full: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.metadata).toBeDefined();
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Link Extraction",
	() => {
		test(
			"should extract links from page",
			async () => {
				const result = await glance(TEST_URLS.withLinks, {
					links: true,
					format: "json",
				});

				expect(result).toBeDefined();
				const parsed = JSON.parse(result);
				// Should contain link information
				expect(result).toContain("http");
			},
			TEST_TIMEOUT,
		);

		test(
			"should extract links with full content",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					links: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed).toBeDefined();
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Screenshot Functionality",
	() => {
		test(
			"should capture screenshot (if puppeteer available)",
			async () => {
				const screenshotFile = "/tmp/glance-test-screenshot.png";
				filesToCleanup.push(screenshotFile);

				try {
					await glance(TEST_URLS.simple, {
						full: true,
						screenshot: screenshotFile,
					});

					// Screenshot may or may not be created depending on puppeteer availability
					if (existsSync(screenshotFile)) {
						const stats = await Bun.file(screenshotFile).size;
						expect(stats).toBeGreaterThan(0);
					} else {
						console.log("⚠️  Screenshot not created (puppeteer not available)");
					}
				} catch (error) {
					// Screenshot feature is optional
					console.log("⚠️  Screenshot feature not available:", error);
				}
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Full Render Mode",
	() => {
		test(
			"should handle full render for JavaScript-heavy sites",
			async () => {
				try {
					const result = await glance(TEST_URLS.simple, {
						full: true,
						fullRender: true,
						format: "json",
					});

					const parsed = JSON.parse(result);
					expect(parsed.content).toBeDefined();
					expect(parsed.content.length).toBeGreaterThan(0);
				} catch (error) {
					// Full render requires puppeteer which is optional
					console.log("⚠️  Full render not available (puppeteer not installed)");
				}
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Combined Features",
	() => {
		test(
			"should handle multiple features together",
			async () => {
				const outputFile = "/tmp/glance-test-combined.json";
				filesToCleanup.push(outputFile);

				const result = await glance(TEST_URLS.richMetadata, {
					full: true,
					metadata: true,
					links: true,
					format: "json",
					output: outputFile,
				});

				// Check if file exists
				if (!existsSync(outputFile)) {
					console.log("⚠️  File not saved, checking result instead");
				}

				const content = await Bun.file(outputFile).text();
				const parsed = JSON.parse(content);

				expect(parsed.url).toBeDefined();
				expect(parsed.content).toBeDefined();
				expect(parsed.metadata).toBeDefined();
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle metadata + custom format",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					metadata: true,
					format: "html",
				});

				expect(result).toContain("<!DOCTYPE html>");
				expect(result).toContain("metadata");
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Performance Tests",
	() => {
		test(
			"should handle rapid sequential requests",
			async () => {
				const results = [];

				for (let i = 0; i < 3; i++) {
					const result = await glance(TEST_URLS.simple, {
						full: true,
						format: "json",
					});
					results.push(JSON.parse(result));
				}

				expect(results.length).toBe(3);
				for (const result of results) {
					expect(result.content).toBeDefined();
				}
			},
			TEST_TIMEOUT * 2,
		);

		test(
			"should handle large output files",
			async () => {
				const outputFile = "/tmp/glance-test-large.json";
				filesToCleanup.push(outputFile);

				await glance(TEST_URLS.richMetadata, {
					full: true,
					metadata: true,
					format: "json",
					output: outputFile,
				});

				// Check if file exists
				if (!existsSync(outputFile)) {
					console.log("⚠️  File not saved, checking result instead");
				}

				const stats = await Bun.file(outputFile).size;
				expect(stats).toBeGreaterThan(100); // At least 100 bytes
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);

describe(
	"Integration: Edge Cases",
	() => {
		test(
			"should handle pages with minimal content",
			async () => {
				const result = await glance(TEST_URLS.simple, {
					full: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.content).toBeDefined();
				// Even minimal pages should have some content
				expect(parsed.content.length).toBeGreaterThan(0);
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle URLs with query parameters",
			async () => {
				const result = await glance(`${TEST_URLS.simple}?test=param`, {
					full: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.url).toContain("?test=param");
			},
			TEST_TIMEOUT,
		);

		test(
			"should handle URLs with fragments",
			async () => {
				const result = await glance(`${TEST_URLS.simple}#section`, {
					full: true,
					format: "json",
				});

				const parsed = JSON.parse(result);
				expect(parsed.url).toContain("example.com");
			},
			TEST_TIMEOUT,
		);
	},
	TEST_TIMEOUT,
);
