/**
 * Example: Using Glance CLI programmatically
 * 
 * This example shows how to import and use individual
 * components of the Glance CLI in your own applications.
 */

import { 
  glance,
  clearCacheCommand,
  checkServicesCommand,
  type GlanceOptions 
} from "../src/cli";

import { 
  CONFIG,
  LANGUAGE_MAP 
} from "../src/cli/config";

import { 
  validateURL,
  validateLanguage 
} from "../src/cli/validators";

import { 
  logger 
} from "../src/cli/logger";

// Example 1: Basic summarization
async function basicSummarization() {
  console.log("Example 1: Basic Summarization");
  
  const url = "https://example.com";
  const options: GlanceOptions = {
    tldr: true,
    language: "en"
  };
  
  try {
    const summary = await glance(url, options);
    console.log("Summary:", summary);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 2: Full content with translation
async function fullContentWithTranslation() {
  console.log("\nExample 2: Full Content with Translation");
  
  const url = "https://lemonde.fr/article";
  const options: GlanceOptions = {
    full: true,
    language: "en", // Translate French to English
    noCache: false
  };
  
  try {
    const content = await glance(url, options);
    console.log("Translated content:", content.substring(0, 200) + "...");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 3: Custom validation and processing
async function customValidationFlow() {
  console.log("\nExample 3: Custom Validation Flow");
  
  const urls = [
    "https://valid-site.com",
    "invalid-url",
    "ftp://not-supported.com"
  ];
  
  for (const url of urls) {
    const validation = validateURL(url);
    
    if (validation.valid) {
      console.log(`✅ ${url} is valid`);
      
      // Process valid URLs
      try {
        const summary = await glance(url, { 
          keyPoints: true,
          maxTokens: 500 
        });
        console.log("Key points extracted");
      } catch (error) {
        console.log("Processing failed:", error);
      }
    } else {
      console.log(`❌ ${url} is invalid: ${validation.error}`);
    }
  }
}

// Example 4: Service detection and model selection
async function serviceDetectionExample() {
  console.log("\nExample 4: Service Detection");
  
  try {
    await checkServicesCommand();
    
    // Based on available services, choose model
    const options: GlanceOptions = {
      model: "llama3", // or dynamically select based on services
      preferQuality: false,
      freeOnly: true
    };
    
    const summary = await glance("https://example.com", options);
    console.log("Processed with selected model");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 5: Batch processing with cache
async function batchProcessing() {
  console.log("\nExample 5: Batch Processing");
  
  const articles = [
    "https://techcrunch.com/article1",
    "https://hackernews.com/article2",
    "https://dev.to/article3"
  ];
  
  const summaries = [];
  
  // Enable debug logging
  logger.setLevel("debug");
  
  for (const article of articles) {
    try {
      const summary = await glance(article, {
        tldr: true,
        emoji: true,
        export: `summaries/${article.replace(/[^a-z0-9]/gi, '_')}.md`
      });
      
      summaries.push({
        url: article,
        summary: summary
      });
      
      console.log(`✓ Processed: ${article}`);
    } catch (error) {
      console.error(`✗ Failed: ${article}`);
    }
  }
  
  console.log(`\nProcessed ${summaries.length} articles successfully`);
}

// Example 6: Using configuration
function showConfiguration() {
  console.log("\nExample 6: Configuration");
  
  console.log("Version:", CONFIG.VERSION);
  console.log("Max content size:", CONFIG.MAX_CONTENT_SIZE);
  console.log("Supported languages:", Object.keys(LANGUAGE_MAP).join(", "));
  console.log("Ollama endpoint:", CONFIG.OLLAMA_ENDPOINT);
}

// Example 7: Error handling with custom messages
async function errorHandlingExample() {
  console.log("\nExample 7: Error Handling");
  
  try {
    await glance("https://this-will-definitely-fail-12345.com", {
      tldr: true,
      debug: true
    });
  } catch (error: any) {
    if (error.code) {
      console.log("Error code:", error.code);
      console.log("User message:", error.userMessage);
      if (error.hint) {
        console.log("Hint:", error.hint);
      }
      console.log("Recoverable:", error.recoverable);
    } else {
      console.log("Unexpected error:", error.message);
    }
  }
}

// Run examples
async function main() {
  console.log("🚀 Glance CLI Programmatic Usage Examples\n");
  
  // Show configuration
  showConfiguration();
  
  // Run examples (comment out ones you don't want to run)
  // await basicSummarization();
  // await fullContentWithTranslation();
  // await customValidationFlow();
  // await serviceDetectionExample();
  // await batchProcessing();
  // await errorHandlingExample();
  
  // Clear cache at the end (optional)
  // await clearCacheCommand();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };