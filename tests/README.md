# Glance CLI Test Suite

Comprehensive test suite for the Glance CLI project using Bun's built-in Jest-compatible test runner.

## Overview

This test suite provides **152 tests** across **4 test files** covering the core functionality of the Glance CLI tool.

### Test Coverage

- ✅ **Validators** (50+ tests) - URL validation, language validation, max tokens validation, API key validation
- ✅ **Language Detector** (55+ tests) - URL-based detection, HTML attribute detection, content-based detection
- ✅ **Text Cleaner** (30+ tests) - Binary artifact removal, encoding cleanup, sanitization
- ✅ **Formatter** (40+ tests) - Terminal, Markdown, JSON, HTML, and Plain text output formatting

## Running Tests

### Prerequisites

Install dependencies:
```bash
npm install
```

### Run All Tests

```bash
npm test
```

Or using bun directly:
```bash
bun test
```

### Watch Mode

Run tests in watch mode for development:
```bash
npm run test:watch
```

### Coverage Report

Generate test coverage report:
```bash
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/
│   ├── validators.test.ts       # Input validation tests
│   ├── language-detector.test.ts # Language detection tests
│   ├── text-cleaner.test.ts     # Text sanitization tests
│   └── formatter.test.ts        # Output formatting tests
└── integration/
    ├── cli.test.ts              # CLI command integration tests
    ├── ai-features.test.ts      # AI-powered features (requires AI service)
    └── advanced-features.test.ts # Screenshots, metadata, file output
```

## Test Files

### validators.test.ts

Tests for input validation utilities:
- **validateURL**: HTTP/HTTPS URL validation with protocol and hostname checks
- **validateLanguage**: Support for en, fr, es, ht language codes
- **validateMaxTokens**: Range validation (1-100000) with integer parsing
- **validateAPIKeys**: OpenAI, Gemini, and Ollama API key/connection validation

### language-detector.test.ts

Tests for multi-signal language detection:
- **URL Detection**: Path segments (/fr/), query parameters (?lang=fr), TLDs (.fr), subdomains
- **HTML Detection**: `<html lang>` attribute, meta tags, Open Graph locale
- **Content Detection**: Pattern matching for French, Spanish, English, Haitian Creole
- **Priority System**: User override > URL > HTML > Content > Default

### text-cleaner.test.ts

Tests for production-grade text sanitization:
- **nuclearCleanText**: Aggressive cleaning for binary artifacts and corrupted data
- **sanitizeAIResponse**: AI response-specific artifact removal
- **emergencyTextClean**: Whitelist-based cleaning allowing only safe ASCII
- **hasBinaryArtifacts**: Detection of control characters, hex patterns, system artifacts

### formatter.test.ts

Tests for multi-format output generation:
- **Terminal Format**: Colored output with emojis and metadata
- **Markdown Format**: GitHub-flavored markdown with frontmatter
- **JSON Format**: Structured data with metadata and processing info
- **HTML Format**: Standalone HTML with CSS styling and XSS protection
- **Plain Text Format**: Clean text output without formatting

## Test Patterns

### Unit Test Example

```typescript
import { describe, expect, test } from "bun:test";
import { validateURL } from "../../src/cli/validators";

describe("validateURL", () => {
	test("should accept valid HTTPS URLs", () => {
		const result = validateURL("https://example.com");
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should reject invalid URLs", () => {
		const result = validateURL("not a url");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});
});
```

### Testing Best Practices

1. **Descriptive Test Names**: Use clear, action-oriented test names
2. **Arrange-Act-Assert**: Follow AAA pattern in test structure
3. **Edge Cases**: Test boundary conditions, null/undefined, empty strings
4. **Error Handling**: Verify both success and failure paths
5. **Isolation**: Each test should be independent and idempotent

## CI/CD Integration

Tests are designed to run in CI environments with:
- Fast execution time (~150ms for full suite)
- Zero external dependencies (except optional Ollama)
- Deterministic results
- Clear failure messages

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test
```

## Performance

Current test performance:
- **152 tests** across **4 files**
- **308 expect() calls**
- **Average runtime**: ~150ms
- **All tests passing**: ✅

### cli.test.ts (Integration)

End-to-end integration tests for CLI commands:
- **Basic URL Fetching**: Tests fetching from real websites (example.com, GitHub, Wikipedia)
- **Language Detection**: Auto-detection from URL patterns and HTML
- **Output Formats**: Terminal, JSON, Markdown, HTML, Plain text
- **Metadata Extraction**: Page title, description, author
- **Link Extraction**: Extract all links from pages
- **Error Handling**: Invalid URLs, non-existent domains, malformed HTML
- **Content Processing**: Sanitization, structure preservation
- **Multiple Requests**: Sequential and concurrent fetching

### ai-features.test.ts (Integration)

AI-powered features (requires Ollama or API keys):
- **Summary Modes**: TLDR, key points, ELI5, custom questions
- **Model Selection**: Default, Ollama (llama3, etc.), OpenAI, Gemini
- **Service Commands**: List models, check service status
- **Free-Only Mode**: Ensure only free services are used
- **Language Translation**: Translate summaries to different languages
- **AI + Formats**: Generate AI summaries in Markdown, HTML, JSON

**Note**: AI tests are automatically skipped if no AI service is available.

### advanced-features.test.ts (Integration)

Advanced functionality tests:
- **File Output**: Save to JSON, Markdown, HTML, plain text files
- **Auto-Format Detection**: Detect format from file extension
- **Screenshot Capture**: Take screenshots (requires puppeteer)
- **Full Render Mode**: JavaScript execution for SPA sites
- **Combined Features**: Multiple flags working together
- **Performance**: Handle rapid requests, large output files
- **Edge Cases**: Minimal content, query parameters, URL fragments

## Running Integration Tests

Integration tests use real URLs and may take longer to run:

```bash
# Run all tests (unit + integration)
npm test

# Run only integration tests
bun test tests/integration/

# Run specific integration test file
bun test tests/integration/cli.test.ts

# Skip AI tests (no Ollama/API keys needed)
bun test tests/integration/cli.test.ts tests/integration/advanced-features.test.ts
```

## Performance

Current test performance:
- **Unit Tests**: 152 tests in ~150ms
- **Integration Tests**: 100+ tests in ~2-5 minutes (depends on network and AI services)
- **Total**: 250+ comprehensive tests
- **All tests passing**: ✅

## Future Enhancements

- [x] Integration tests for CLI commands
- [x] E2E tests with real web scraping
- [ ] Performance benchmarks
- [ ] Visual regression tests
- [ ] API mocking for external services
- [ ] Snapshot testing for formatter outputs

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all existing tests still pass
3. Aim for >80% code coverage
4. Add integration tests for new commands
5. Update this README with new test files

## Troubleshooting

### Tests Failing

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Run tests with verbose output
bun test --verbose
```

### Dependencies Missing

```bash
# Install all dependencies
npm install

# For Bun-specific issues
npx bun upgrade
```

## License

MIT - Same as the main project
