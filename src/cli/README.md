# Glance CLI Module Structure

The CLI has been refactored into a modular, production-ready architecture that allows for better maintainability, testing, and programmatic usage.

## Module Organization

```
src/cli/
├── index.ts       # Main entry point and CLI runner
├── commands.ts    # Command handlers (exportable for programmatic use)
├── config.ts      # Configuration constants and settings
├── types.ts       # TypeScript type definitions
├── errors.ts      # Custom error classes
├── logger.ts      # Logging utility
├── validators.ts  # Input validation functions
├── display.ts     # Display utilities (help, examples, formatting)
├── utils.ts       # Utility functions (retry, formatting, etc.)
└── README.md      # This file
```

## Benefits of Modular Structure

### 1. **Better Maintainability**
- Each module has a single responsibility
- Easier to locate and fix issues
- Clear separation of concerns

### 2. **Programmatic Usage**
All modules are exportable and can be used in other applications:

```typescript
import { glance, type GlanceOptions } from "glance-cli/cli";
import { validateURL } from "glance-cli/cli/validators";
import { CONFIG } from "glance-cli/cli/config";

// Use glance programmatically
const summary = await glance("https://example.com", {
  tldr: true,
  language: "en"
});
```

### 3. **Better Testing**
Each module can be tested independently:

```typescript
import { validateURL, validateLanguage } from "./validators";

test("validateURL accepts valid URLs", () => {
  const result = validateURL("https://example.com");
  expect(result.valid).toBe(true);
});
```

### 4. **Type Safety**
Strong TypeScript types throughout:

```typescript
import type { 
  GlanceOptions, 
  ServiceStatus, 
  VoiceOptions 
} from "./types";
```

### 5. **Extensibility**
Easy to add new features:
- New commands go in `commands.ts`
- New validators go in `validators.ts`
- New display formats go in `display.ts`

## Module Details

### `index.ts` - Main Entry Point
- Parses CLI arguments
- Routes to appropriate commands
- Handles errors gracefully
- Exports all modules for programmatic use

### `commands.ts` - Command Handlers
Exportable functions for each CLI command:
- `glance()` - Main summarization command
- `clearCacheCommand()` - Clear cache
- `listVoicesCommand()` - List available voices
- `checkServicesCommand()` - Check service availability
- `listModelsCommand()` - List Ollama models

### `config.ts` - Configuration
Central configuration:
- `VERSION` - Current version
- `CONFIG` - All configuration constants
- `LANGUAGE_MAP` - Supported languages
- `SUPPORTED_LANGUAGES` - Language codes

### `types.ts` - Type Definitions
TypeScript interfaces for:
- `ServiceStatus` - Service detection results
- `GlanceOptions` - Command options
- `VoiceOptions` - Voice synthesis options
- `SummaryOptions` - Summary generation options
- And more...

### `errors.ts` - Error Handling
Custom error classes:
- `GlanceError` - Main error class with recovery hints
- `ErrorCodes` - Standardized error codes

### `logger.ts` - Logging
Configurable logging utility:
```typescript
logger.setLevel("debug");
logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning");
logger.error("Error");
```

### `validators.ts` - Input Validation
Validation functions:
- `validateURL()` - Validate URL format
- `validateLanguage()` - Check language support
- `validateMaxTokens()` - Validate token limits
- `validateAPIKeys()` - Check API key configuration

### `display.ts` - Display Utilities
User-facing output:
- `showHelp()` - Display help text
- `showVersion()` - Show version
- `showExamples()` - Show usage examples
- `showServiceStatus()` - Display service availability
- `formatErrorMessage()` - Format errors for display

### `utils.ts` - Utilities
Helper functions:
- `withRetry()` - Retry logic for operations
- `createSpinner()` - Create loading spinners
- `formatFileSize()` - Format bytes for display
- `sanitizeOutputForTerminal()` - Clean text output
- `isPremiumModel()` - Check if model is premium

## Usage Examples

### Basic CLI Usage
```bash
# Standard usage
glance https://example.com --tldr

# With options
glance https://example.com --full --language fr --read
```

### Programmatic Usage
```typescript
import { glance, checkServicesCommand } from "glance-cli/cli";

async function main() {
  // Check available services
  await checkServicesCommand();
  
  // Summarize content
  const summary = await glance("https://example.com", {
    tldr: true,
    language: "en",
    noCache: false
  });
  
  console.log(summary);
}
```

### Custom Integration
```typescript
import { 
  validateURL, 
  withRetry,
  logger,
  GlanceError,
  ErrorCodes
} from "glance-cli/cli";

async function customProcessor(url: string) {
  // Validate input
  const validation = validateURL(url);
  if (!validation.valid) {
    throw new GlanceError(
      "Invalid URL",
      ErrorCodes.INVALID_URL,
      validation.error!,
      false
    );
  }
  
  // Process with retry logic
  return withRetry(
    () => processUrl(url),
    { attempts: 3, delay: 1000 }
  );
}
```

## Error Handling

The modular structure provides comprehensive error handling:

```typescript
try {
  await glance(url, options);
} catch (error) {
  if (error instanceof GlanceError) {
    console.error("User message:", error.userMessage);
    if (error.hint) {
      console.log("Hint:", error.hint);
    }
    if (error.recoverable) {
      // Can retry
    }
  }
}
```

## Contributing

When adding new features:

1. **Add types** to `types.ts` if needed
2. **Add validators** to `validators.ts` for new inputs
3. **Add commands** to `commands.ts` for new functionality
4. **Add display functions** to `display.ts` for new output formats
5. **Update help** in `display.ts` to document new options
6. **Export new functions** from `index.ts` for programmatic use

## Performance

The modular structure improves performance:
- Smaller bundle sizes with tree-shaking
- Lazy loading of modules when needed
- Better caching with isolated functions
- Parallel processing capabilities

## Testing

Each module can be tested independently:

```bash
# Test validators
bun test src/cli/validators.test.ts

# Test commands
bun test src/cli/commands.test.ts

# Test utilities
bun test src/cli/utils.test.ts
```

## Future Improvements

- [ ] Add comprehensive test suite
- [ ] Add JSDoc comments for all exports
- [ ] Create plugin system for extensions
- [ ] Add metrics and telemetry (opt-in)
- [ ] Create CLI configuration file support
- [ ] Add command aliases and shortcuts

## License

MIT - See LICENSE file in project root.