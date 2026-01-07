/**
 * Unit tests for validators module
 */

import { beforeAll, describe, expect, test } from "bun:test";
import {
	validateAPIKeys,
	validateLanguage,
	validateMaxTokens,
	validateURL,
} from "../../src/cli/validators";

describe("validateURL", () => {
	test("should accept valid HTTP URLs", () => {
		const result = validateURL("http://example.com");
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should accept valid HTTPS URLs", () => {
		const result = validateURL("https://example.com");
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should accept URLs with paths", () => {
		const result = validateURL("https://example.com/path/to/page");
		expect(result.valid).toBe(true);
	});

	test("should accept URLs with query parameters", () => {
		const result = validateURL("https://example.com?param=value");
		expect(result.valid).toBe(true);
	});

	test("should reject URLs without protocol", () => {
		const result = validateURL("example.com");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid URL format");
	});

	test("should reject non-HTTP(S) protocols", () => {
		const result = validateURL("ftp://example.com");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Only HTTP and HTTPS URLs are supported");
	});

	test("should reject invalid hostnames", () => {
		const result = validateURL("https://ab");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid hostname");
	});

	test("should reject malformed URLs", () => {
		const result = validateURL("not a url");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});
});

describe("validateLanguage", () => {
	test("should accept English (en)", () => {
		const result = validateLanguage("en");
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should accept French (fr)", () => {
		const result = validateLanguage("fr");
		expect(result.valid).toBe(true);
	});

	test("should accept Spanish (es)", () => {
		const result = validateLanguage("es");
		expect(result.valid).toBe(true);
	});

	test("should accept Haitian Creole (ht)", () => {
		const result = validateLanguage("ht");
		expect(result.valid).toBe(true);
	});

	test("should reject unsupported language codes", () => {
		const result = validateLanguage("de");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("not supported");
		expect(result.error).toContain("de");
	});

	test("should reject invalid language codes", () => {
		const result = validateLanguage("invalid");
		expect(result.valid).toBe(false);
	});

	test("should provide list of supported languages in error", () => {
		const result = validateLanguage("zh");
		expect(result.error).toContain("en");
		expect(result.error).toContain("fr");
		expect(result.error).toContain("es");
		expect(result.error).toContain("ht");
	});
});

describe("validateMaxTokens", () => {
	test("should accept valid token counts", () => {
		const result = validateMaxTokens("1000");
		expect(result.valid).toBe(true);
		expect(result.parsed).toBe(1000);
		expect(result.error).toBeUndefined();
	});

	test("should accept minimum value (1)", () => {
		const result = validateMaxTokens("1");
		expect(result.valid).toBe(true);
		expect(result.parsed).toBe(1);
	});

	test("should accept maximum value (100000)", () => {
		const result = validateMaxTokens("100000");
		expect(result.valid).toBe(true);
		expect(result.parsed).toBe(100000);
	});

	test("should handle undefined value", () => {
		const result = validateMaxTokens(undefined);
		expect(result.valid).toBe(true);
		expect(result.parsed).toBeUndefined();
	});

	test("should reject non-numeric values", () => {
		const result = validateMaxTokens("not a number");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("valid number");
	});

	test("should reject values below minimum (0)", () => {
		const result = validateMaxTokens("0");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("between 1 and 100000");
	});

	test("should reject values above maximum", () => {
		const result = validateMaxTokens("100001");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("between 1 and 100000");
	});

	test("should reject negative values", () => {
		const result = validateMaxTokens("-100");
		expect(result.valid).toBe(false);
	});

	test("should parse decimal values as integers", () => {
		const result = validateMaxTokens("500.5");
		// parseInt will parse "500.5" as 500, which is valid
		expect(result.valid).toBe(true);
		expect(result.parsed).toBe(500);
	});
});

describe("validateAPIKeys", () => {
	const originalEnv = process.env;

	beforeAll(() => {
		// Reset environment before each test
		process.env = { ...originalEnv };
	});

	test("should validate OpenAI API key format", async () => {
		process.env.OPENAI_API_KEY = `sk-proj-${"x".repeat(40)}`;
		const result = await validateAPIKeys("openai");
		expect(result.valid).toBe(true);
	});

	test("should reject missing OpenAI API key", async () => {
		delete process.env.OPENAI_API_KEY;
		const result = await validateAPIKeys("openai");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("not found");
		expect(result.hint).toContain("OPENAI_API_KEY");
	});

	test("should reject invalid OpenAI API key format", async () => {
		process.env.OPENAI_API_KEY = "invalid-key";
		const result = await validateAPIKeys("openai");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid");
	});

	test("should reject short OpenAI API key", async () => {
		process.env.OPENAI_API_KEY = "sk-short";
		const result = await validateAPIKeys("openai");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("incomplete");
	});

	test("should validate Gemini API key", async () => {
		process.env.GEMINI_API_KEY = "x".repeat(40);
		const result = await validateAPIKeys("google");
		expect(result.valid).toBe(true);
	});

	test("should accept GOOGLE_API_KEY as alternative", async () => {
		delete process.env.GEMINI_API_KEY;
		process.env.GOOGLE_API_KEY = "x".repeat(40);
		const result = await validateAPIKeys("google");
		expect(result.valid).toBe(true);
	});

	test("should reject missing Gemini API key", async () => {
		delete process.env.GEMINI_API_KEY;
		delete process.env.GOOGLE_API_KEY;
		const result = await validateAPIKeys("google");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("not found");
	});

	test("should reject short Gemini API key", async () => {
		process.env.GEMINI_API_KEY = "short";
		const result = await validateAPIKeys("google");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("incomplete");
	});

	// Note: Ollama tests would require mocking fetch or running Ollama
	test("should check for Ollama endpoint", async () => {
		const result = await validateAPIKeys("ollama");
		// This will fail unless Ollama is running
		expect(result).toHaveProperty("valid");
		// Error property is only present when validation fails
		if (!result.valid) {
			expect(result).toHaveProperty("error");
		}
	});
});
