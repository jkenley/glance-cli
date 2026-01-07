# Glance CLI - Testing Guide

Complete testing infrastructure for the **glance-cli** project with both unit and integration tests.

## 🎉 Test Suite Overview

### Statistics

- ✅ **250+ tests** total
- ✅ **Unit Tests**: 152 tests (core functionality)
- ✅ **Integration Tests**: 100+ tests (end-to-end scenarios)
- ✅ **All tests passing** with real-world scenarios
- ⚡ **Fast execution**: Unit tests ~150ms, Integration tests ~2-5min

### Coverage

The test suite comprehensively covers:

#### Unit Tests (152 tests)
- **Validators** (50+ tests): URL, language, tokens, API keys
- **Language Detector** (55+ tests): Multi-signal detection (URL, HTML, content)
- **Text Cleaner** (30+ tests): Sanitization, artifact removal
- **Formatter** (40+ tests): 5 output formats (terminal, markdown, JSON, HTML, plain)

#### Integration Tests (100+ tests)
- **CLI Commands** (40+ tests): Real URL fetching, error handling
- **AI Features** (30+ tests): Summaries, translations, models
- **Advanced Features** (40+ tests): File output, screenshots, metadata

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run only unit tests
bun test tests/unit/

# Run only integration tests
bun test tests/integration/

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📋 Test Files

### Unit Tests

| File | Tests | Description |
|------|-------|-------------|
| `validators.test.ts` | 50+ | Input validation (URLs, languages, tokens, API keys) |
| `language-detector.test.ts` | 55+ | Multi-signal language detection |
| `text-cleaner.test.ts` | 30+ | Text sanitization and artifact removal |
| `formatter.test.ts` | 40+ | Output formatting (5 formats) |

### Integration Tests

| File | Tests | Description |
|------|-------|-------------|
| `cli.test.ts` | 40+ | End-to-end CLI functionality with real URLs |
| `ai-features.test.ts` | 30+ | AI-powered features (auto-skips if no AI service) |
| `advanced-features.test.ts` | 40+ | Screenshots, file output, metadata |

## 🔬 Running Specific Test Suites

### Unit Tests Only

```bash
# All unit tests
bun test tests/unit/

# Specific module
bun test tests/unit/validators.test.ts
bun test tests/unit/language-detector.test.ts
bun test tests/unit/text-cleaner.test.ts
bun test tests/unit/formatter.test.ts
```

### Integration Tests

```bash
# All integration tests
bun test tests/integration/

# Without AI (no Ollama/API keys needed)
bun test tests/integration/cli.test.ts tests/integration/advanced-features.test.ts

# Only AI features (requires Ollama or API keys)
bun test tests/integration/ai-features.test.ts
```

## 🤖 AI Feature Testing

AI-powered features require either:
- **Ollama** running locally (recommended, 100% free)
- **API Keys**: `OPENAI_API_KEY` or `GEMINI_API_KEY`

AI tests automatically skip if no service is available:

```bash
# Start Ollama (for AI tests)
ollama serve

# Pull a model
ollama pull llama3

# Run AI tests
bun test tests/integration/ai-features.test.ts
```

If no AI service is available, you'll see:
```
⚠️  Skipping: No AI service available
```

## 📊 Test Coverage Areas

### 1. URL Processing
- ✅ HTTP/HTTPS validation
- ✅ Real webpage fetching (example.com, GitHub, Wikipedia)
- ✅ Error handling (invalid URLs, 404s, timeouts)
- ✅ Special characters and encoding
- ✅ Query parameters and fragments

### 2. Language Detection
- ✅ URL-based detection (/fr/, .fr, ?lang=fr)
- ✅ HTML attribute detection (`<html lang>`, meta tags)
- ✅ Content analysis (French, Spanish, English, Haitian Creole)
- ✅ Priority system (user > URL > HTML > content)
- ✅ Auto-translation

### 3. Content Processing
- ✅ Text extraction and cleaning
- ✅ Binary artifact removal
- ✅ Encoding normalization
- ✅ Metadata extraction
- ✅ Link extraction

### 4. Output Formats
- ✅ Terminal (with colors and emojis)
- ✅ Markdown (GitHub-flavored)
- ✅ JSON (structured data)
- ✅ HTML (standalone pages)
- ✅ Plain text (no ANSI codes)

### 5. AI Features
- ✅ Summary modes (TLDR, key points, ELI5)
- ✅ Custom questions
- ✅ Model selection (Ollama, OpenAI, Gemini)
- ✅ Language translation
- ✅ Token limits

### 6. Advanced Features
- ✅ File output (.md, .json, .html, .txt)
- ✅ Format auto-detection
- ✅ Screenshot capture (with puppeteer)
- ✅ Full JavaScript rendering
- ✅ Metadata extraction
- ✅ Combined features

## 🎯 Test Examples

### Unit Test Example

```typescript
import { describe, expect, test } from "bun:test";
import { validateURL } from "../../src/cli/validators";

describe("validateURL", () => {
  test("should accept valid HTTPS URLs", () => {
    const result = validateURL("https://example.com");
    expect(result.valid).toBe(true);
  });
});
```

### Integration Test Example

```typescript
import { describe, expect, test } from "bun:test";
import { glance } from "../../src/cli/commands";

describe("Integration: Basic URL Fetching", () => {
  test("should fetch and process webpage", async () => {
    const result = await glance("https://example.com", {
      full: true,
      format: "json",
    });

    const parsed = JSON.parse(result);
    expect(parsed.content).toBeDefined();
  }, 60000); // 60 second timeout
});
```

## 🐛 Debugging Tests

### Verbose Output

```bash
# See all test output
bun test --verbose

# Debug specific test
bun test tests/integration/cli.test.ts --verbose
```

### Test Isolation

```bash
# Run single test file
bun test tests/unit/validators.test.ts

# Bail on first failure
bun test --bail

# Bail after 5 failures
bun test --bail=5
```

### Debugging Tips

1. **Add console.log** in tests for debugging
2. **Use `--bail`** to stop on first failure
3. **Check network** for integration test failures
4. **Verify Ollama** is running for AI tests
5. **Check file permissions** for file output tests

## 🔄 CI/CD Integration

### GitHub Actions

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
      - run: bun test tests/unit/ # Unit tests only
      - run: bun test tests/integration/cli.test.ts # Basic integration
```

### Test Performance

- **Unit Tests**: ~150-200ms (fast, no network)
- **Integration Tests**: ~2-5min (depends on network and AI)
- **Full Suite**: ~3-6min total

**Recommendation**: Run unit tests on every commit, integration tests on PR.

## 📝 Writing New Tests

### Test Structure

```typescript
import { describe, expect, test, beforeAll, afterEach } from "bun:test";

describe("Feature Name", () => {
  beforeAll(() => {
    // Setup before all tests
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test("should do something specific", () => {
    // Arrange
    const input = "test data";

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe("expected output");
  });
});
```

### Best Practices

1. **Clear test names**: "should validate HTTPS URLs"
2. **Independent tests**: No shared state between tests
3. **Appropriate timeouts**: Unit: 5s, Integration: 60s
4. **Cleanup resources**: Files, network connections
5. **Skip when appropriate**: AI tests without services

## 🎓 Test Categories

### Fast Tests (< 1s)
- All unit tests
- Input validation
- Text processing
- Format generation

### Medium Tests (1-10s)
- Basic URL fetching
- Metadata extraction
- File operations

### Slow Tests (10-60s)
- AI summaries
- Complex page processing
- Screenshot capture
- Full JavaScript rendering

## 📚 Additional Resources

- **Bun Test Docs**: https://bun.sh/docs/cli/test
- **Jest Compatibility**: https://jestjs.io/docs/getting-started
- **Test README**: `tests/README.md`

## 🏆 Test Quality

Our tests follow industry best practices:
- ✅ Comprehensive coverage
- ✅ Real-world scenarios
- ✅ Fast execution
- ✅ Clear error messages
- ✅ Isolated and independent
- ✅ Well-documented
- ✅ CI/CD ready

---

**All tests passing ✅** - The glance-cli project is production-ready with comprehensive test coverage!
