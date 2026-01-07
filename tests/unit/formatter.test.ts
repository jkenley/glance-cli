/**
 * Unit tests for formatter module
 */

import { describe, expect, test } from "bun:test";
import {
	autoDetectFormat,
	type FormatOptions,
	formatOutput,
	formatOutputWithMetadata,
	type PageMetadata,
} from "../../src/core/formatter";

describe("formatOutput - Terminal format", () => {
	const basicOptions: FormatOptions = {
		url: "https://example.com/article",
		format: "terminal",
	};

	test("should format basic terminal output", () => {
		const summary = "This is a test summary.";
		const result = formatOutput(summary, basicOptions);

		expect(result).toContain("Source:");
		expect(result).toContain("https://example.com/article");
		expect(result).toContain(summary);
	});

	test("should include metadata when provided", () => {
		const metadata: PageMetadata = {
			title: "Test Article",
			author: "John Doe",
			publishDate: "2024-01-01",
		};

		const result = formatOutput("Summary text", {
			...basicOptions,
			metadata,
			includeMetadata: true,
		});

		expect(result).toContain("Test Article");
		expect(result).toContain("John Doe");
		expect(result).toContain("2024-01-01");
	});

	test("should include custom question", () => {
		const result = formatOutput("Answer text", {
			...basicOptions,
			customQuestion: "What is the main topic?",
		});

		expect(result).toContain("Question:");
		expect(result).toContain("What is the main topic?");
		expect(result).toContain("Answer:");
	});

	test("should include processing information", () => {
		const result = formatOutput("Summary", {
			...basicOptions,
			model: "gpt-4o-mini",
			processingTime: 2500,
			fromCache: true,
		});

		expect(result).toContain("gpt-4o-mini");
		expect(result).toContain("2.5s");
		expect(result).toContain("cached");
	});

	test("should handle compact mode", () => {
		const result = formatOutput("Summary", {
			...basicOptions,
			compact: true,
			metadata: {
				author: "Author",
				publishDate: "2024-01-01",
			},
		});

		// Compact mode should exclude extra metadata
		expect(result).not.toContain("Author:");
	});
});

describe("formatOutput - Markdown format", () => {
	const markdownOptions: FormatOptions = {
		url: "https://example.com",
		format: "markdown",
	};

	test("should format as markdown", () => {
		const result = formatOutput("Summary text", markdownOptions);

		expect(result).toContain("# Summary");
		expect(result).toContain("**Source:**");
		expect(result).toContain("https://example.com");
		expect(result).toContain("---");
	});

	test("should include markdown metadata", () => {
		const result = formatOutput("Summary", {
			...markdownOptions,
			metadata: {
				title: "Article Title",
				author: "Jane Doe",
			},
			includeMetadata: true,
		});

		expect(result).toContain("**Title:** Article Title");
		expect(result).toContain("**Author:** Jane Doe");
	});

	test("should format custom question as markdown", () => {
		const result = formatOutput("Answer here", {
			...markdownOptions,
			customQuestion: "What is this about?",
		});

		expect(result).toContain("# Answer");
		expect(result).toContain("**Question:**");
		expect(result).toContain("What is this about?");
	});

	test("should include timestamp in markdown", () => {
		const result = formatOutput("Summary", {
			...markdownOptions,
			includeTimestamp: true,
		});

		expect(result).toContain("Generated:");
	});
});

describe("formatOutput - JSON format", () => {
	const jsonOptions: FormatOptions = {
		url: "https://example.com",
		format: "json",
	};

	test("should format as valid JSON", () => {
		const result = formatOutput("Summary text", jsonOptions);
		const parsed = JSON.parse(result);

		expect(parsed).toHaveProperty("url");
		expect(parsed).toHaveProperty("content");
		expect(parsed).toHaveProperty("metadata");
		expect(parsed.url).toContain("https://example.com");
		expect(parsed.content).toBe("Summary text");
	});

	test("should include type in JSON", () => {
		const summaryResult = JSON.parse(formatOutput("Summary", jsonOptions));
		expect(summaryResult.type).toBe("summary");

		const answerResult = JSON.parse(
			formatOutput("Answer", {
				...jsonOptions,
				customQuestion: "Question?",
			}),
		);
		expect(answerResult.type).toBe("answer");
		expect(answerResult.question).toBe("Question?");

		const fullResult = JSON.parse(
			formatOutput("Full content", {
				...jsonOptions,
				isFullContent: true,
			}),
		);
		expect(fullResult.type).toBe("full_content");
	});

	test("should include metadata in JSON", () => {
		const result = JSON.parse(
			formatOutput("Summary", {
				...jsonOptions,
				metadata: {
					title: "Article",
					author: "Author",
				},
				includeMetadata: true,
			}),
		);

		expect(result.metadata.title).toBe("Article");
		expect(result.metadata.author).toBe("Author");
	});

	test("should include processing info in JSON", () => {
		const result = JSON.parse(
			formatOutput("Summary", {
				...jsonOptions,
				model: "llama3",
				processingTime: 1500,
				fromCache: true,
			}),
		);

		expect(result.model).toBe("llama3");
		expect(result.processingTimeMs).toBe(1500);
		expect(result.fromCache).toBe(true);
	});

	test("should format compact JSON", () => {
		const result = formatOutput("Summary", {
			...jsonOptions,
			compact: true,
		});

		// Compact JSON should have no indentation
		expect(result).not.toContain("  ");
		expect(JSON.parse(result)).toBeDefined();
	});

	test("should format pretty JSON by default", () => {
		const result = formatOutput("Summary", jsonOptions);

		// Pretty JSON should have indentation
		expect(result).toContain("  ");
		expect(JSON.parse(result)).toBeDefined();
	});
});

describe("formatOutput - HTML format", () => {
	const htmlOptions: FormatOptions = {
		url: "https://example.com",
		format: "html",
	};

	test("should format as valid HTML", () => {
		const result = formatOutput("Summary text", htmlOptions);

		expect(result).toContain("<!DOCTYPE html>");
		expect(result).toContain("<html");
		expect(result).toContain("</html>");
		expect(result).toContain("<body>");
		expect(result).toContain("</body>");
	});

	test("should escape HTML special characters", () => {
		const result = formatOutput('Text with <script>alert("XSS")</script>', {
			url: "https://example.com",
			format: "html",
		});

		expect(result).toContain("&lt;script&gt;");
		expect(result).toContain("&lt;/script&gt;");
		expect(result).not.toContain("<script>");
	});

	test("should include metadata in HTML", () => {
		const result = formatOutput("Summary", {
			...htmlOptions,
			metadata: {
				title: "Article Title",
				author: "Author Name",
			},
			includeMetadata: true,
		});

		expect(result).toContain("Article Title");
		expect(result).toContain("Author Name");
	});

	test("should include styling in HTML", () => {
		const result = formatOutput("Summary", htmlOptions);

		expect(result).toContain("<style>");
		expect(result).toContain("font-family");
	});

	test("should format question in HTML", () => {
		const result = formatOutput("Answer", {
			...htmlOptions,
			customQuestion: "What is this?",
		});

		expect(result).toContain("What is this?");
		expect(result).toContain('class="question"');
	});
});

describe("formatOutput - Plain text format", () => {
	const plainOptions: FormatOptions = {
		url: "https://example.com",
		format: "plain",
	};

	test("should format as plain text", () => {
		const result = formatOutput("Summary text", plainOptions);

		expect(result).toContain("SUMMARY");
		expect(result).toContain("=====");
		expect(result).toContain("Source:");
		expect(result).toContain("Summary text");
	});

	test("should not contain ANSI color codes", () => {
		const result = formatOutput("Summary", plainOptions);

		// Should not contain chalk color codes
		expect(result).not.toContain("\x1b[");
	});

	test("should include metadata in plain text", () => {
		const result = formatOutput("Summary", {
			...plainOptions,
			metadata: {
				title: "Title",
				author: "Author",
			},
			includeMetadata: true,
		});

		expect(result).toContain("Title: Title");
		expect(result).toContain("Author: Author");
	});
});

describe("formatOutput - Input validation", () => {
	test("should throw error for empty summary", () => {
		expect(() => formatOutput("", { url: "https://example.com" })).toThrow(
			"non-empty string",
		);
	});

	test("should throw error for non-string summary", () => {
		expect(() =>
			formatOutput(123 as any, { url: "https://example.com" }),
		).toThrow("non-empty string");
	});

	test("should throw error for missing options", () => {
		expect(() => formatOutput("Summary", null as any)).toThrow(
			"Options must be an object",
		);
	});

	test("should throw error for missing URL", () => {
		expect(() => formatOutput("Summary", {} as any)).toThrow("URL is required");
	});
});

describe("formatOutput - Text sanitization", () => {
	test("should remove dangerous patterns from summary", () => {
		const dirtyText = "Summary with console.log and TextDecoder artifacts";
		const result = formatOutput(dirtyText, {
			url: "https://example.com",
			format: "plain",
		});

		expect(result).not.toContain("console.log");
		expect(result).not.toContain("TextDecoder");
	});

	test("should sanitize metadata", () => {
		const result = formatOutput("Summary", {
			url: "https://example.com",
			format: "plain",
			metadata: {
				title: "Title with\x00null bytes",
				author: "Author\uFFFDwith replacement chars",
			},
		});

		expect(result).not.toContain("\x00");
		expect(result).not.toContain("\uFFFD");
	});

	test("should handle long metadata gracefully", () => {
		const longTitle = "A".repeat(200);
		const result = formatOutput("Summary", {
			url: "https://example.com",
			format: "json",
			metadata: {
				title: longTitle,
			},
		});

		const parsed = JSON.parse(result);
		expect(parsed.metadata.title.length).toBeLessThanOrEqual(103); // 100 + "..."
	});
});

describe("formatOutput - Legacy options", () => {
	test("should support legacy markdown flag", () => {
		const result = formatOutput("Summary", {
			url: "https://example.com",
			markdown: true,
		});

		expect(result).toContain("# Summary");
		expect(result).toContain("**Source:**");
	});

	test("should support legacy json flag", () => {
		const result = formatOutput("Summary", {
			url: "https://example.com",
			json: true,
		});

		const parsed = JSON.parse(result);
		expect(parsed.content).toBe("Summary");
	});

	test("should prioritize format over legacy flags", () => {
		const result = formatOutput("Summary", {
			url: "https://example.com",
			format: "plain",
			json: true,
			markdown: true,
		});

		// Should be plain text, not JSON or markdown
		expect(result).toContain("SUMMARY");
		expect(() => JSON.parse(result)).toThrow();
	});
});

describe("formatOutputWithMetadata", () => {
	test("should return formatted output with metadata", () => {
		const result = formatOutputWithMetadata("Summary text", {
			url: "https://example.com",
			format: "plain",
		});

		expect(result).toHaveProperty("content");
		expect(result).toHaveProperty("format");
		expect(result).toHaveProperty("length");
		expect(result).toHaveProperty("lines");

		expect(result.format).toBe("plain");
		expect(result.content).toContain("Summary text");
		expect(result.length).toBeGreaterThan(0);
		expect(result.lines).toBeGreaterThan(0);
	});

	test("should calculate line count correctly", () => {
		const multilineText = "Line 1\nLine 2\nLine 3";
		const result = formatOutputWithMetadata(multilineText, {
			url: "https://example.com",
			format: "plain",
		});

		expect(result.lines).toBeGreaterThan(3);
	});

	test("should detect format from legacy flags", () => {
		const jsonResult = formatOutputWithMetadata("Summary", {
			url: "https://example.com",
			json: true,
		});
		expect(jsonResult.format).toBe("json");

		const mdResult = formatOutputWithMetadata("Summary", {
			url: "https://example.com",
			markdown: true,
		});
		expect(mdResult.format).toBe("markdown");

		const terminalResult = formatOutputWithMetadata("Summary", {
			url: "https://example.com",
		});
		expect(terminalResult.format).toBe("terminal");
	});
});

describe("autoDetectFormat", () => {
	test("should detect markdown files", () => {
		expect(autoDetectFormat("output.md")).toBe("markdown");
		expect(autoDetectFormat("file.markdown")).toBe("markdown");
		expect(autoDetectFormat("/path/to/file.MD")).toBe("markdown");
	});

	test("should detect JSON files", () => {
		expect(autoDetectFormat("data.json")).toBe("json");
		expect(autoDetectFormat("/path/to/file.JSON")).toBe("json");
	});

	test("should detect HTML files", () => {
		expect(autoDetectFormat("page.html")).toBe("html");
		expect(autoDetectFormat("page.htm")).toBe("html");
		expect(autoDetectFormat("/path/to/file.HTML")).toBe("html");
	});

	test("should detect plain text files", () => {
		expect(autoDetectFormat("notes.txt")).toBe("plain");
		expect(autoDetectFormat("/path/to/file.TXT")).toBe("plain");
	});

	test("should default to markdown for unknown extensions", () => {
		expect(autoDetectFormat("file.unknown")).toBe("markdown");
		expect(autoDetectFormat("noextension")).toBe("markdown");
		expect(autoDetectFormat("file.pdf")).toBe("markdown");
	});

	test("should handle files with no extension", () => {
		expect(autoDetectFormat("README")).toBe("markdown");
		expect(autoDetectFormat("/path/to/file")).toBe("markdown");
	});
});

describe("formatOutput - Full Content Mode", () => {
	test("should indicate full content in terminal format", () => {
		const result = formatOutput("Full article text here", {
			url: "https://example.com",
			format: "terminal",
			isFullContent: true,
		});

		expect(result).toContain("Full Content:");
	});

	test("should set correct type in JSON for full content", () => {
		const result = JSON.parse(
			formatOutput("Full text", {
				url: "https://example.com",
				format: "json",
				isFullContent: true,
			}),
		);

		expect(result.type).toBe("full_content");
	});
});
