/**
 * Unit tests for text cleaner module
 */

import { describe, expect, test } from "bun:test";
import {
	emergencyTextClean,
	hasBinaryArtifacts,
	nuclearCleanText,
	sanitizeAIResponse,
} from "../../src/core/text-cleaner";

describe("nuclearCleanText", () => {
	test("should preserve clean text", () => {
		const input = "This is a clean sentence.";
		const result = nuclearCleanText(input);
		expect(result).toBe(input);
	});

	test("should remove control characters", () => {
		const input = "Hello\x00World\x1F";
		const result = nuclearCleanText(input);
		expect(result).toBe("HelloWorld");
	});

	test("should remove high-bit characters", () => {
		const input = "Hello\x80\x90\xFFWorld";
		const result = nuclearCleanText(input);
		expect(result).toBe("HelloWorld");
	});

	test("should remove Unicode replacement characters", () => {
		const input = "Hello\uFFFD\uFEFFWorld";
		const result = nuclearCleanText(input);
		expect(result).toBe("HelloWorld");
	});

	test("should remove JavaScript artifacts", () => {
		const input = "Some text console.log more text";
		const result = nuclearCleanText(input);
		expect(result).toBe("Some text more text");
	});

	test("should remove memory address patterns", () => {
		const input = "Text 0x1234ABCD more text";
		const result = nuclearCleanText(input);
		expect(result).toBe("Text more text");
	});

	test("should remove repeated special characters", () => {
		const input = "Hello!!!!! World";
		const result = nuclearCleanText(input);
		expect(result).toBe("Hello World");
	});

	test("should clean up whitespace", () => {
		const input = "Hello    World   \n\n\n\n  Test";
		const result = nuclearCleanText(input);
		expect(result).toBe("Hello World\nTest");
	});

	test("should handle empty string", () => {
		const result = nuclearCleanText("");
		expect(result).toBe("");
	});

	test("should handle null/undefined gracefully", () => {
		expect(nuclearCleanText(null as any)).toBe("");
		expect(nuclearCleanText(undefined as any)).toBe("");
	});

	test("should fix common encoding artifacts", () => {
		const input = "Don't worry, it's fine.";
		const result = nuclearCleanText(input);
		expect(result).toContain("Don't");
		expect(result).toContain("it's");
	});

	test("should preserve line breaks", () => {
		const input = "Line 1\nLine 2\nLine 3";
		const result = nuclearCleanText(input);
		expect(result).toContain("\n");
		const lines = result.split("\n");
		expect(lines.length).toBe(3);
	});

	test("should remove empty lines", () => {
		const input = "Line 1\n\n\n\nLine 2";
		const result = nuclearCleanText(input);
		expect(result).toBe("Line 1\nLine 2");
	});

	test("should preserve valid punctuation", () => {
		const input = "Hello, world! How are you? I'm fine.";
		const result = nuclearCleanText(input);
		expect(result).toContain(",");
		expect(result).toContain("!");
		expect(result).toContain("?");
		expect(result).toContain("'");
	});
});

describe("sanitizeAIResponse", () => {
	test("should preserve clean AI response", () => {
		const input = "This is a clean AI response.";
		const result = sanitizeAIResponse(input);
		expect(result).toBe(input);
	});

	test("should remove console.log references", () => {
		const input = "Response with console.log() embedded";
		const result = sanitizeAIResponse(input);
		expect(result).not.toContain("console.log");
	});

	test("should remove TextDecoder references", () => {
		const input = "Text with TextDecoder artifact";
		const result = sanitizeAIResponse(input);
		expect(result).not.toContain("TextDecoder");
	});

	test("should remove cache artifacts", () => {
		const input = "Response lastAccessed accessCount data";
		const result = sanitizeAIResponse(input);
		expect(result).not.toContain("lastAccessed");
		expect(result).not.toContain("accessCount");
	});

	test("should remove error patterns", () => {
		const input = "Some text failed: error occurred";
		const result = sanitizeAIResponse(input);
		expect(result).not.toContain("failed:");
		expect(result).not.toContain("error:");
	});

	test("should remove hex patterns", () => {
		const input = "Text with ABCD1234EFGH hex";
		const result = sanitizeAIResponse(input);
		expect(result).not.toContain("ABCD1234EFGH");
	});

	test("should clean up extra spaces", () => {
		const input = "Text  with    many     spaces";
		const result = sanitizeAIResponse(input);
		expect(result).toBe("Text with many spaces");
	});

	test("should handle empty string", () => {
		const result = sanitizeAIResponse("");
		expect(result).toBe("");
	});

	test("should handle null/undefined", () => {
		expect(sanitizeAIResponse(null as any)).toBe("");
		expect(sanitizeAIResponse(undefined as any)).toBe("");
	});
});

describe("emergencyTextClean", () => {
	test("should preserve basic text", () => {
		const input = "Hello World";
		const result = emergencyTextClean(input);
		expect(result).toBe(input);
	});

	test("should preserve numbers and letters", () => {
		const input = "ABC123 test 456";
		const result = emergencyTextClean(input);
		expect(result).toBe(input);
	});

	test("should preserve basic punctuation", () => {
		const input = "Hello, world! How are you?";
		const result = emergencyTextClean(input);
		expect(result).toBe(input);
	});

	test("should remove special characters", () => {
		const input = "Hello@#$%World";
		const result = emergencyTextClean(input);
		expect(result).toBe("HelloWorld");
	});

	test("should remove emoji and Unicode", () => {
		const input = "Hello 👋 World 🌍";
		const result = emergencyTextClean(input);
		expect(result).not.toContain("👋");
		expect(result).not.toContain("🌍");
	});

	test("should clean up whitespace", () => {
		const input = "Hello    World   Test";
		const result = emergencyTextClean(input);
		expect(result).toBe("Hello World Test");
	});

	test("should limit consecutive newlines", () => {
		const input = "Line1\n\n\n\n\nLine2";
		const result = emergencyTextClean(input);
		expect(result).toContain("Line1");
		expect(result).toContain("Line2");
	});

	test("should handle empty input", () => {
		expect(emergencyTextClean("")).toBe("");
		expect(emergencyTextClean(null as any)).toBe("");
		expect(emergencyTextClean(undefined as any)).toBe("");
	});

	test("should preserve parentheses and brackets", () => {
		const input = "Text (with) [brackets]";
		const result = emergencyTextClean(input);
		expect(result).toContain("(");
		expect(result).toContain(")");
		expect(result).toContain("[");
		expect(result).toContain("]");
	});
});

describe("hasBinaryArtifacts", () => {
	test("should detect control characters", () => {
		const input = "Hello\x00World";
		expect(hasBinaryArtifacts(input)).toBe(true);
	});

	test("should detect high-bit sequences", () => {
		const input = "Hello\x80\x81\x82World";
		expect(hasBinaryArtifacts(input)).toBe(true);
	});

	test("should detect hex patterns", () => {
		const input = "Text with ABCDEF123456 pattern";
		expect(hasBinaryArtifacts(input)).toBe(true);
	});

	test("should detect system artifacts", () => {
		expect(hasBinaryArtifacts("console.log test")).toBe(true);
		expect(hasBinaryArtifacts("TextDecoder test")).toBe(true);
		expect(hasBinaryArtifacts("_Cache test")).toBe(true);
	});

	test("should detect symbol sequences", () => {
		const input = "Text with !!!!! symbols";
		expect(hasBinaryArtifacts(input)).toBe(true);
	});

	test("should return false for clean text", () => {
		const input = "This is clean text with no binary artifacts.";
		expect(hasBinaryArtifacts(input)).toBe(false);
	});

	test("should handle empty input", () => {
		expect(hasBinaryArtifacts("")).toBe(false);
		expect(hasBinaryArtifacts(null as any)).toBe(false);
	});

	test("should allow normal punctuation", () => {
		const input = "Hello, world! How are you? I'm fine.";
		expect(hasBinaryArtifacts(input)).toBe(false);
	});
});

describe("Integration - Full text cleaning pipeline", () => {
	test("should handle severely corrupted text", () => {
		const input =
			"Hello\x00\x80World console.log ABCD123456!! \uFFFD Test\n\n\n\nEnd";
		const result = nuclearCleanText(input);
		expect(result).not.toContain("\x00");
		expect(result).not.toContain("\x80");
		expect(result).not.toContain("console.log");
		expect(result).toBeDefined();
		expect(result.length).toBeGreaterThan(0);
	});

	test("should preserve meaningful content while cleaning", () => {
		const input =
			"The article discusses AI and machine learning. It's interesting!";
		const result = nuclearCleanText(input);
		expect(result).toContain("article");
		expect(result).toContain("AI");
		expect(result).toContain("machine learning");
	});

	test("should handle multilingual content", () => {
		const input = "Bonjour le monde. Hola mundo. Hello world.";
		const result = nuclearCleanText(input);
		expect(result).toContain("Bonjour");
		expect(result).toContain("Hola");
		expect(result).toContain("Hello");
	});
});
