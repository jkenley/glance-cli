/**
 * Command handlers for Glance CLI
 * Exports individual command functions that can be used programmatically
 */

import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import chalk from "chalk";
import * as cheerio from "cheerio";
import clipboard from "clipboardy";
import {
	extractCleanText,
	extractLinks,
	extractMetadata,
} from "../core/extractor";
import { fetchPage } from "../core/fetcher";
import { formatOutput } from "../core/formatter";
import {
	detectLanguage,
	shouldAutoDetectLanguage,
} from "../core/language-detector";
import { takeScreenshot } from "../core/screenshot";
import { getDefaultModel, showCostWarning } from "../core/service-detector";
import { detectProvider, summarize } from "../core/summarizer";
import { sanitizeAIResponse } from "../core/text-cleaner";
import { cleanTextForSpeech, createVoiceSynthesizer } from "../core/voice";
import { CONFIG, LANGUAGE_MAP } from "./config";
import { showServiceStatus } from "./display";
import { ErrorCodes, GlanceError } from "./errors";
import { logger } from "./logger";
import type { ServiceStatus } from "./types";
import {
	createSpinner,
	formatFileSize,
	getFileExtension,
	sanitizeOutputForTerminal,
	withRetry,
} from "./utils";
import { validateAPIKeys } from "./validators";

export interface GlanceOptions {
	url?: string;
	model?: string;
	language?: string;
	tldr?: boolean;
	keyPoints?: boolean;
	eli5?: boolean;
	full?: boolean;
	customQuestion?: string;
	stream?: boolean;
	maxTokens?: number;
	format?: string;
	output?: string;
	screenshot?: string;
	fullRender?: boolean;
	metadata?: boolean;
	links?: boolean;
	read?: boolean;
	voice?: string;
	audioOutput?: string;
	listVoices?: boolean;
	checkServices?: boolean;
	freeOnly?: boolean;
	preferQuality?: boolean;
	debug?: boolean;
	copy?: boolean;
	browse?: boolean;
	disableStdinHandling?: boolean; // For browse mode to prevent spinner interference
}

/**
 * Main glance command - fetch and summarize a webpage
 */
export async function glance(
	url: string,
	options: GlanceOptions = {},
): Promise<string> {
	const startTime = Date.now();

	// Set debug logging if requested
	if (options.debug) {
		logger.setLevel("debug");
	}

	// Language will be determined after fetching content
	let language: string = options.language || "en";
	let languageName =
		LANGUAGE_MAP[language as keyof typeof LANGUAGE_MAP] || "English";

	// Note: Caching temporarily disabled to eliminate corruption issues

	// Fetch the webpage
	const fetchSpinner = createSpinner(
		"Fetching webpage...",
		options.disableStdinHandling,
	);
	fetchSpinner.start();

	let html: string;
	try {
		html = await withRetry(
			() => fetchPage(url, { fullRender: options.fullRender }),
			{
				onRetry: (attempt, _error) => {
					fetchSpinner.text = `Fetching webpage... (retry ${attempt})`;
				},
			},
		);
		fetchSpinner.succeed("Webpage fetched successfully");
	} catch (error: unknown) {
		fetchSpinner.fail("Failed to fetch webpage");
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.FETCH_FAILED,
			"Could not fetch the webpage. Please check the URL and your internet connection.",
			true,
			"Try again or use --full-render for JavaScript-heavy sites",
		);
	}

	// Extract content
	const extractSpinner = createSpinner(
		"Extracting content...",
		options.disableStdinHandling,
	);
	extractSpinner.start();

	const cleanText = extractCleanText(html);

	// Auto-detect language if not specified by user
	if (!options.language && shouldAutoDetectLanguage()) {
		const detectionResult = detectLanguage(
			url,
			html,
			cleanText,
			options.language,
		);
		language = detectionResult.detected;
		languageName =
			LANGUAGE_MAP[language as keyof typeof LANGUAGE_MAP] || "English";

		// Show detection info to user if confidence is not high
		if (
			detectionResult.confidence !== "high" &&
			detectionResult.source !== "default"
		) {
			logger.info(`Auto-detected language: ${languageName}`);
		}

		// Log detection result if in debug mode
		if (options.debug) {
			logger.debug(
				`Language detected: ${language} (${detectionResult.confidence} confidence from ${detectionResult.source})`,
			);
			logger.debug(`Detection signals: ${detectionResult.signals.join(", ")}`);
		}
	}

	if (cleanText.length > CONFIG.MAX_CONTENT_SIZE) {
		extractSpinner.fail("Content too large");
		throw new GlanceError(
			`Content size (${formatFileSize(cleanText.length)}) exceeds maximum allowed`,
			ErrorCodes.CONTENT_TOO_LARGE,
			`The webpage content is too large to process (>${formatFileSize(CONFIG.MAX_CONTENT_SIZE)})`,
			false,
		);
	}

	extractSpinner.succeed(
		`Content extracted (${formatFileSize(cleanText.length)})`,
	);

	// Handle metadata extraction
	if (options.metadata) {
		const metadata = extractMetadata(html);
		console.log(chalk.bold("\n📊 Page Metadata:"));
		console.log(JSON.stringify(metadata, null, 2));
	}

	// Handle links extraction
	if (options.links) {
		const links = extractLinks(html);
		console.log(chalk.bold(`\n🔗 Found ${links.length} links:`));
		links.forEach((link) => {
			const display = link.text ? `${link.text} (${link.href})` : link.href;
			console.log(chalk.cyan(`  • ${display}`));
		});
	}

	// Handle screenshot
	if (options.screenshot) {
		await handleScreenshot(url, options.screenshot);
	}

	// Handle full content mode (no summarization)
	if (options.full) {
		const fullContent = await handleFullContent(cleanText, {
			...options,
			language,
		});

		// Note: Caching disabled

		return fullContent;
	}

	// Summarize content with detected or specified language
	const { rawSummary, formattedSummary } = await summarizeContentWithRaw(
		cleanText,
		url,
		{ ...options, language },
	);

	// Note: Caching disabled

	// Display summary immediately if voice synthesis is requested
	if (options.read || options.audioOutput) {
		// Show the full formatted summary first
		console.log(formattedSummary);
		console.log(""); // Add spacing

		// Then clean the raw text for speech and read it aloud
		const cleanedSummary = cleanTextForSpeech(rawSummary);
		await handleVoiceSynthesis(cleanedSummary, { ...options, language });
		return formattedSummary;
	}

	const summary = formattedSummary;

	// Save to file if output specified
	if (options.output) {
		await saveToFile(summary, options.output);
	}

	// Copy to clipboard if requested
	if (options.copy) {
		// Copy formatted output for JSON/markdown, raw summary for terminal
		const contentToCopy =
			options.format === "json" || options.format === "markdown"
				? summary
				: rawSummary || summary;
		await copyToClipboard(contentToCopy);
	}

	const duration = Date.now() - startTime;
	logger.debug(`Total execution time: ${duration}ms`);

	return summary;
}

/**
 * Determine output format from user options
 * Priority: 1) --format flag, 2) file extension, 3) terminal default
 */
function getOutputFormat(
	options: GlanceOptions,
): "terminal" | "markdown" | "json" | "plain" {
	// 1. If format is explicitly specified, use it
	if (options.format) {
		const formatMap: Record<string, string> = {
			md: "markdown",
			json: "json",
			plain: "plain",
			markdown: "markdown",
			terminal: "terminal",
		};
		return (formatMap[options.format.toLowerCase()] || "terminal") as
			| "terminal"
			| "markdown"
			| "json"
			| "plain";
	}

	// 2. If output file is specified, auto-detect from extension
	if (options.output) {
		const extension = getFileExtension(options.output).toLowerCase();
		const extensionMap: Record<string, string> = {
			md: "markdown",
			markdown: "markdown",
			json: "json",
			txt: "plain",
			text: "plain",
		};
		const detectedFormat = extensionMap[extension];
		if (detectedFormat) {
			return detectedFormat as "terminal" | "markdown" | "json" | "plain";
		}
	}

	// 3. Default to terminal if no output file or unrecognized extension
	return "terminal";
}

/**
 * Save content to file
 */
async function saveToFile(content: string, filename: string): Promise<void> {
	try {
		await writeFile(filename, content, "utf-8");
		logger.info(`Content saved to ${filename}`);
	} catch (error: unknown) {
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.EXPORT_FAILED,
			`Failed to save content to ${filename}`,
			false,
		);
	}
}

/**
 * Copy content to clipboard
 */
async function copyToClipboard(content: string): Promise<void> {
	try {
		await clipboard.write(content);
		logger.info(chalk.green("✓ Copied to clipboard"));
	} catch (error: unknown) {
		logger.warn(
			chalk.yellow("⚠ Could not copy to clipboard:"),
			error instanceof Error ? error.message : String(error),
		);
	}
}

/**
 * Handle full content mode with optional AI formatting and translation
 */
async function handleFullContent(
	content: string,
	options: GlanceOptions & { language: string },
): Promise<string> {
	let finalContent = content;
	const needsTranslation = options.language && options.language !== "en";

	// Always apply smart formatting for better readability
	const fullModeSpinner = createSpinner(
		needsTranslation
			? "🌍 Translating and formatting full content..."
			: "🧾 Applying smart formatting...",
		options.disableStdinHandling,
	);
	fullModeSpinner.start();

	try {
		// Determine model to use
		const model =
			options.model ||
			(await getDefaultModel(undefined, !!options.preferQuality));
		const _provider = detectProvider(model);

		// Use AI for translation or formatting
		const aiOptions = {
			model,
			language: options.language,
			stream: false, // Don't stream for full content
			maxTokens: options.maxTokens || 8000,
			translate: needsTranslation,
			format: true, // Always apply smart formatting
		};

		const processedContent = await summarize(finalContent, {
			model: aiOptions.model,
			language: aiOptions.language,
			stream: aiOptions.stream,
			maxTokens: aiOptions.maxTokens,
			translate: aiOptions.translate as boolean | undefined,
			format: aiOptions.format,
		});

		finalContent = sanitizeAIResponse(processedContent);

		fullModeSpinner.succeed(
			needsTranslation
				? "Translation and formatting complete"
				: "Smart formatting applied",
		);
	} catch (error: unknown) {
		fullModeSpinner.fail(
			needsTranslation
				? "Translation failed - showing original content"
				: "Smart formatting failed - showing original content",
		);
		logger.error("Full content processing error:", error);
	}

	// Format the output
	const formattedOutput = formatOutput(finalContent, {
		format: getOutputFormat(options),
		url: "full-content",
		isFullContent: true,
	});

	// Save to file if output specified
	if (options.output) {
		await saveToFile(formattedOutput, options.output);
	}

	return formattedOutput;
}

/**
 * Summarize content using AI - returns both raw and formatted versions
 */
async function summarizeContentWithRaw(
	content: string,
	url: string,
	options: GlanceOptions & { language: string },
): Promise<{ rawSummary: string; formattedSummary: string }> {
	const model =
		options.model ||
		(await getDefaultModel(undefined, !!options.preferQuality));

	// Show cost warning if using premium model
	if (!options.freeOnly) {
		await showCostWarning(model);
	}

	const summarizeSpinner = options.stream
		? null
		: createSpinner(
			`Processing with ${model}...`,
			options.disableStdinHandling,
		);

	summarizeSpinner?.start();

	try {
		const rawSummary = await withRetry(
			() =>
				summarize(content, {
					model,
					tldr: options.tldr,
					keyPoints: options.keyPoints,
					eli5: options.eli5,
					language: options.language,
					stream: options.stream,
					maxTokens: options.maxTokens,
					customQuestion: options.customQuestion,
				}),
			{
				attempts: 2,
				onRetry: (attempt) => {
					if (summarizeSpinner) {
						summarizeSpinner.text = `Processing with ${model}... (retry ${attempt})`;
					}
				},
			},
		);

		summarizeSpinner?.succeed("Summary generated successfully");

		// Clean and format the summary
		const cleanSummary = sanitizeOutputForTerminal(
			sanitizeAIResponse(rawSummary),
		);
		const formattedSummary = formatOutput(cleanSummary, {
			format: getOutputFormat(options),
			url: url,
			customQuestion: options.customQuestion,
		});

		return { rawSummary: cleanSummary, formattedSummary };
	} catch (error: unknown) {
		summarizeSpinner?.fail("Failed to generate summary");
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.SUMMARIZE_FAILED,
			"Failed to generate summary. The AI service might be unavailable.",
			true,
			"Try a different model with --model or check your API keys",
		);
	}
}

/**
 * Summarize content using AI
 */
async function _summarizeContent(
	content: string,
	url: string,
	options: GlanceOptions & { language: string },
): Promise<string> {
	const model =
		options.model ||
		(await getDefaultModel(undefined, !!options.preferQuality));

	// Show cost warning if using premium model
	if (!options.freeOnly) {
		await showCostWarning(model);
	}

	const summarizeSpinner = options.stream
		? null
		: createSpinner(
			`Processing with ${model}...`,
			options.disableStdinHandling,
		);

	summarizeSpinner?.start();

	try {
		const summary = await withRetry(
			() =>
				summarize(content, {
					model,
					tldr: options.tldr,
					keyPoints: options.keyPoints,
					eli5: options.eli5,
					language: options.language,
					stream: options.stream,
					maxTokens: options.maxTokens,
					customQuestion: options.customQuestion,
				}),
			{
				attempts: 2,
				onRetry: (attempt) => {
					if (summarizeSpinner) {
						summarizeSpinner.text = `Processing with ${model}... (retry ${attempt})`;
					}
				},
			},
		);

		summarizeSpinner?.succeed("Summary generated successfully");

		// Clean and format the summary
		const cleanSummary = sanitizeOutputForTerminal(sanitizeAIResponse(summary));
		const formattedSummary = formatOutput(cleanSummary, {
			format: getOutputFormat(options),
			url: url,
			customQuestion: options.customQuestion,
		});

		return formattedSummary;
	} catch (error: unknown) {
		summarizeSpinner?.fail("Failed to generate summary");
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.SUMMARIZE_FAILED,
			"Failed to generate summary. The AI service might be unavailable.",
			true,
			"Try a different model with --model or check your API keys",
		);
	}
}

/**
 * Handle voice synthesis
 */
async function handleVoiceSynthesis(
	cleanedText: string,
	options: GlanceOptions & { language: string },
): Promise<void> {
	try {
		const synthesizer = createVoiceSynthesizer();

		if (options.audioOutput) {
			const audioSpinner = createSpinner(
				`🎵 Generating audio file: ${options.audioOutput}`,
				options.disableStdinHandling,
			);
			audioSpinner.start();

			// Use the already cleaned text directly
			const result = await synthesizer.synthesizeCleanedText(cleanedText, {
				voice: options.voice,
				language: options.language,
				outputFile: options.audioOutput,
			});

			if (!result.success) {
				throw new Error(result.error || "Voice synthesis failed");
			}

			audioSpinner.succeed(`🎵 Audio saved to ${options.audioOutput}`);
		} else {
			const readSpinner = createSpinner(
				`🎤 Generating speech and preparing to read aloud...`,
				options.disableStdinHandling,
			);
			readSpinner.start();

			// Use the already cleaned text directly
			const result = await synthesizer.synthesizeCleanedText(cleanedText, {
				voice: options.voice,
				language: options.language,
			});

			if (!result.success) {
				throw new Error(result.error || "Voice synthesis failed");
			}

			readSpinner.succeed(`🎤 Reading aloud completed`);
		}
	} catch (error: unknown) {
		logger.error("Voice synthesis failed:", error);
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.VOICE_SYNTHESIS_FAILED,
			"Failed to synthesize voice. Check your voice settings or try a different voice.",
			false,
		);
	}
}

/**
 * Handle screenshot capture
 */
async function handleScreenshot(url: string, filename: string): Promise<void> {
	const screenshotSpinner = createSpinner(`Capturing screenshot: ${filename}`);
	screenshotSpinner.start();

	try {
		await takeScreenshot(url, filename);
		screenshotSpinner.succeed(`Screenshot saved to ${filename}`);
	} catch (error: unknown) {
		screenshotSpinner.fail("Failed to capture screenshot");
		logger.error("Screenshot error:", error);
	}
}

/**
 * Export content to file
 */
async function _exportContent(
	content: string,
	filename: string,
	options: { url?: string; isFullContent?: boolean } = {},
): Promise<void> {
	const extension = getFileExtension(filename);
	const format = extension || "txt";

	const formattedContent = formatOutput(content, {
		format: format as "terminal" | "markdown" | "json" | "html" | "plain",
		url: options.url || "exported-content",
		isFullContent: options.isFullContent,
	});

	try {
		await writeFile(filename, formattedContent, "utf-8");
		logger.info(`Content exported to ${filename}`);
	} catch (error: unknown) {
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.EXPORT_FAILED,
			`Failed to export content to ${filename}`,
			false,
		);
	}
}

// Cache functionality removed - see next-features/cache-system-plan.md

/**
 * List voices command
 */
export async function listVoicesCommand(): Promise<void> {
	try {
		const synthesizer = createVoiceSynthesizer();
		// Get all available voices
		const englishVoices = await synthesizer.listVoices("en");
		const frenchVoices = await synthesizer.listVoices("fr");
		const spanishVoices = await synthesizer.listVoices("es");
		const haitianVoices = await synthesizer.listVoices("ht");

		console.log(chalk.bold("\n🎤 Available Voices by Language:\n"));

		if (englishVoices.length > 0) {
			console.log(chalk.bold("🇺🇸 English:"));
			for (const v of englishVoices) console.log(`  ${v}`);
		}

		if (frenchVoices.length > 0) {
			console.log(chalk.bold("\n🇫🇷 French:"));
			for (const v of frenchVoices) console.log(`  ${v}`);
		}

		if (spanishVoices.length > 0) {
			console.log(chalk.bold("\n🇪🇸 Spanish:"));
			for (const v of spanishVoices) console.log(`  ${v}`);
		}

		if (haitianVoices.length > 0) {
			console.log(chalk.bold("\n🇭🇹 Haitian Creole:"));
			for (const v of haitianVoices) console.log(`  ${v}`);
		}

		console.log(
			chalk.dim("\nUse with: glance <url> --voice <voice-name> --read"),
		);
	} catch (error: unknown) {
		logger.error("Failed to list voices:", error);
		throw error;
	}
}

/**
 * Check services command
 */
export async function checkServicesCommand(): Promise<void> {
	const spinner = createSpinner("Detecting available services...");
	spinner.start();

	try {
		// Use our own validators instead of the old detectServices
		const [ollamaCheck, openaiCheck, geminiCheck] = await Promise.all([
			validateAPIKeys("ollama").catch(() => ({
				valid: false,
				error: "Connection failed",
			})),
			validateAPIKeys("openai").catch(() => ({
				valid: false,
				error: "API key missing",
			})),
			validateAPIKeys("google").catch(() => ({
				valid: false,
				error: "API key missing",
			})),
		]);

		// Get Ollama models if available
		let ollamaModels: string[] = [];
		if (ollamaCheck.valid) {
			try {
				const endpoint =
					process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
				const response = await fetch(`${endpoint}/api/tags`);
				if (response.ok) {
					const data = (await response.json()) as {
						models: { name: string }[];
					};
					ollamaModels =
						(data as { models: { name: string }[] }).models?.map(
							(m: { name: string }) => m.name,
						) || [];
				}
			} catch {
				// Ignore model fetch errors
			}
		}

		// Check ElevenLabs
		const elevenlabsCheck = {
			valid: !!process.env.ELEVENLABS_API_KEY,
			error: process.env.ELEVENLABS_API_KEY ? undefined : "API key missing",
		};

		spinner.succeed("Service detection complete");

		const serviceStatus: ServiceStatus = {
			ollama: {
				available: ollamaCheck.valid,
				models: ollamaModels,
				error: ollamaCheck.error,
			},
			openai: {
				available: openaiCheck.valid,
				error: openaiCheck.error,
			},
			gemini: {
				available: geminiCheck.valid,
				error: geminiCheck.error,
			},
			elevenlabs: {
				available: elevenlabsCheck.valid,
				voices: [],
				error: elevenlabsCheck.error,
			},
			defaultModel: ollamaCheck.valid
				? "ollama"
				: openaiCheck.valid
					? "gpt-4o-mini"
					: geminiCheck.valid
						? "gemini-2.0-flash-exp"
						: "None available",
			priority: "Free services first",
			recommendations: [],
		};

		// Add recommendations based on missing services
		if (!serviceStatus.ollama.available) {
			serviceStatus.recommendations?.push("Install Ollama for free local AI");
		}
		if (!serviceStatus.openai.available) {
			serviceStatus.recommendations?.push(
				"Add OpenAI API key for premium quality",
			);
		}
		if (!serviceStatus.elevenlabs.available) {
			serviceStatus.recommendations?.push(
				"Add ElevenLabs API key for natural voice synthesis",
			);
		}

		showServiceStatus(serviceStatus);
	} catch (error: unknown) {
		spinner.fail("Service detection failed");
		logger.error("Service detection error:", error);

		// Show empty status with error message
		const emptyStatus: ServiceStatus = {
			ollama: { available: false, error: "Detection failed" },
			openai: { available: false, error: "Detection failed" },
			gemini: { available: false, error: "Detection failed" },
			elevenlabs: { available: false, error: "Detection failed" },
			recommendations: ["Check your internet connection and try again"],
		};

		showServiceStatus(emptyStatus);
		throw error;
	}
}

/**
 * List Ollama models command
 */
export async function listModelsCommand(): Promise<void> {
	const endpoint = process.env.OLLAMA_ENDPOINT || CONFIG.OLLAMA_ENDPOINT;
	const spinner = createSpinner("Fetching Ollama models...");
	spinner.start();

	try {
		const response = await fetch(`${endpoint}/api/tags`);

		if (!response.ok) {
			throw new Error(`Failed to fetch models: ${response.statusText}`);
		}

		const data = (await response.json()) as {
			models: Array<{
				name: string;
				size?: number;
				details?: { parameter_size?: string };
			}>;
		};
		spinner.succeed("Models fetched successfully");

		if (!data.models || data.models.length === 0) {
			console.log(chalk.yellow("\nNo models found. Install models with:"));
			console.log(chalk.cyan("  ollama pull llama3"));
			console.log(chalk.cyan("  ollama pull mistral"));
			return;
		}

		console.log(
			chalk.bold(`\n📦 Available Ollama Models (${data.models.length}):\n`),
		);

		data.models.forEach(
			(model: {
				name: string;
				size?: number;
				details?: { parameter_size?: string };
			}) => {
				const size = model.size ? `(${(model.size / 1e9).toFixed(1)}GB)` : "";
				console.log(`  ${chalk.cyan(model.name)} ${chalk.gray(size)}`);
				if (model.details?.parameter_size) {
					console.log(
						`    ${chalk.gray(model.details.parameter_size)} parameters`,
					);
				}
			},
		);

		console.log(
			chalk.dim("\nUse any model with: glance <url> --model <model-name>"),
		);
	} catch (error: unknown) {
		spinner.fail("Failed to fetch models");
		console.error(
			chalk.red("\nCannot connect to Ollama. Make sure it's running:"),
		);
		console.log(chalk.cyan("  ollama serve"));
		throw error;
	}
}

/**
 * Enhanced link extraction with categorization
 */
function extractCategorizedLinks(html: string, baseUrl: string) {
	const $ = cheerio.load(html);
	const seenUrls = new Set<string>();

	// Simplified categories: Navigation (same domain) and External (different domain)
	const categories = {
		navigation: [] as Array<{ href: string; text: string }>,
		external: [] as Array<{ href: string; text: string }>,
	};

	// For backwards compatibility, keep these empty
	const emptyCategories = {
		content: [] as Array<{ href: string; text: string }>,
		footer: [] as Array<{ href: string; text: string }>,
	};

	// Helper function to process links
	const processLink = (element: any) => {
		const $element = $(element);
		let href = $element.attr("href")?.trim() || "";

		// Skip invalid links
		if (
			!href ||
			href.startsWith("javascript:") ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:") ||
			href === "#" ||
			href.startsWith("#")
		) {
			return;
		}

		// Extract clean text from the link element
		let text = "";
		const rawText = $element.text().trim() || "";

		// Check if text contains CSS class names or other code artifacts
		const isInvalidText = (t: string) => {
			return (
				t.startsWith(".css-") ||
				t.includes("{") ||
				t.includes("}") ||
				t.includes("@media") ||
				t.includes("::") ||
				t.includes("var(--") ||
				/^\.[a-z]+-[a-z0-9]+/i.test(t) || // CSS class pattern
				/^#[a-z]+-[a-z0-9]+/i.test(t)
			); // CSS ID pattern
		};

		if (!isInvalidText(rawText)) {
			text = rawText;
		} else {
			// Try to extract clean text by looking for actual text nodes
			const imgAlt = $element.find("img").attr("alt") || "";
			const ariaLabel = $element.attr("aria-label") || "";
			const title = $element.attr("title") || "";

			// Priority: aria-label > title > img alt > extracted text
			if (ariaLabel && !isInvalidText(ariaLabel)) {
				text = ariaLabel;
			} else if (title && !isInvalidText(title)) {
				text = title;
			} else if (imgAlt && !isInvalidText(imgAlt)) {
				text = imgAlt;
			} else {
				// Try to extract text without CSS elements
				const cleanedElement = $element.clone();
				cleanedElement.find("style").remove();
				cleanedElement.find('[class*="css-"]').remove();
				const cleanText = cleanedElement.text().trim() || "";

				if (cleanText && !isInvalidText(cleanText)) {
					text = cleanText;
				}
			}
		}

		// If still no valid text, create meaningful text from URL
		if (!text || isInvalidText(text)) {
			try {
				const url = new URL(
					href.startsWith("http") ? href : new URL(href, baseUrl).href,
				);

				// Special handling for known domains
				const hostname = url.hostname.replace("www.", "");
				const pathname = url.pathname;

				// Extract meaningful name from pathname
				if (pathname && pathname !== "/") {
					const pathParts = pathname
						.split("/")
						.filter((p) => p && !p.match(/^\d+$/)); // Filter out numbers
					if (pathParts.length > 0) {
						const lastPart = pathParts[pathParts.length - 1] || "";
						// Clean up the path part
						text = lastPart
							.replace(/[-_]/g, " ")
							.replace(/\.[^.]+$/, "") // Remove file extension
							.split(" ")
							.map(
								(word) =>
									word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
							)
							.join(" ");
					}
				}

				// If still no text, use the domain name
				if (!text) {
					text = hostname.charAt(0).toUpperCase() + hostname.slice(1);
				}
			} catch {
				text = "Link";
			}
		}

		// Final cleanup - remove extra whitespace and truncate if too long
		text = text.replace(/\s+/g, " ").trim();
		if (text.length > 100) {
			text = text.substring(0, 97) + "...";
		}

		// Resolve relative URLs
		try {
			if (!href.startsWith("http")) {
				href = new URL(href, baseUrl).href;
			}
		} catch {
			return; // Skip invalid URLs
		}

		// Only accept HTTPS links for security
		if (!href.startsWith("https://")) {
			return;
		}

		// Remove query strings for cleaner URLs
		try {
			const url = new URL(href);
			href = `${url.protocol}//${url.hostname}${url.pathname}`;
			// Remove trailing slash if it's just the domain
			if (url.pathname === "/") {
				href = `${url.protocol}//${url.hostname}`;
			}
		} catch {
			// If URL parsing fails, use original
		}

		// Check if we've already seen this URL (deduplication)
		if (seenUrls.has(href)) {
			return;
		}
		seenUrls.add(href);

		// Determine if link is internal (navigation) or external
		const linkUrl = new URL(href);
		const base = new URL(baseUrl);

		// Same domain = Navigation link
		// Different domain = External link
		const isSameDomain = linkUrl.hostname === base.hostname;

		const linkData = { href, text };

		if (isSameDomain) {
			categories.navigation.push(linkData);
		} else {
			categories.external.push(linkData);
		}
	};

	// Process ALL links on the page exactly once
	$("a[href]").each((_, el) => {
		processLink(el);
	});

	// Return categories with backwards-compatible structure
	return {
		navigation: categories.navigation,
		external: categories.external,
		content: emptyCategories.content,
		footer: emptyCategories.footer,
	};
}

/**
 * Browse command - interactive link exploration
 */
export async function browseCommand(url: string): Promise<void> {
	console.log(chalk.bold("🌐 Browse Mode - Interactive Link Navigation"));
	console.log(
		chalk.dim("Navigate through links on the webpage interactively\n"),
	);

	try {
		// Fetch the initial page
		const fetchSpinner = createSpinner("Fetching webpage...");
		fetchSpinner.start();

		const html = await fetchPage(url, { fullRender: false });
		fetchSpinner.succeed("Webpage fetched");

		// Extract links with categorization
		const extractSpinner = createSpinner(
			"Extracting and categorizing links...",
		);
		extractSpinner.start();

		const categorizedLinks = extractCategorizedLinks(html, url);
		const allLinks = [
			...categorizedLinks.navigation,
			...categorizedLinks.content,
			...categorizedLinks.external,
			...categorizedLinks.footer,
		];
		extractSpinner.succeed(`Found ${allLinks.length} links`);

		if (allLinks.length === 0) {
			console.log(chalk.yellow("No links found on this page."));
			return;
		}

		// Show initial page info
		const metadata = extractMetadata(html);
		const pageTitle = metadata.title || url;
		console.log(chalk.bold(`\nCurrent Page: ${pageTitle}`));
		if (metadata.description) {
			console.log(chalk.dim(`Description: ${metadata.description}`));
		}
		console.log("");

		// Interactive link selection
		await interactiveLinkNavigation(categorizedLinks, url, pageTitle);
	} catch (error: unknown) {
		throw new GlanceError(
			error instanceof Error ? error.message : String(error),
			ErrorCodes.FETCH_FAILED,
			"Failed to start browse mode",
			false,
		);
	}
}

/**
 * Interactive link navigation
 */
async function interactiveLinkNavigation(
	categorizedLinks: {
		navigation: Array<{ href: string; text: string }>;
		content: Array<{ href: string; text: string }>;
		footer: Array<{ href: string; text: string }>;
		external: Array<{ href: string; text: string }>;
	},
	currentUrl: string,
	pageTitle: string,
): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const browsingHistory: string[] = [currentUrl];
	let currentCategorizedLinks = categorizedLinks;
	let currentPage = currentUrl;
	let currentPageTitle = pageTitle;
	let displayMode: "all" | "nav" | "external" = "all";

	const displayLinks = () => {
		let linkIndex = 1;
		const linkMap = new Map<number, { href: string; text: string }>();

		// Show links based on display mode
		if (displayMode === "all" || displayMode === "nav") {
			if (currentCategorizedLinks.navigation.length > 0) {
				if (displayMode === "nav") {
					console.log(
						chalk.magenta(
							`\n🧭 Navigation Links Only (${currentCategorizedLinks.navigation.length} total):`,
						),
					);
				} else {
					console.log(
						chalk.magenta(
							`\nNavigation Links (${currentCategorizedLinks.navigation.length} total):`,
						),
					);
				}
				currentCategorizedLinks.navigation.forEach((link) => {
					const displayText = link.text || "Link";
					console.log(
						chalk.cyan(`  ${linkIndex}. `) + chalk.blue.underline(link.href),
					);
					linkMap.set(linkIndex, { href: link.href, text: link.text });
					linkIndex++;
				});
			}
		}

		if (displayMode === "all" || displayMode === "external") {
			if (currentCategorizedLinks.external.length > 0) {
				if (displayMode === "external") {
					console.log(
						chalk.yellow(
							`\n🌍 External Links Only (${currentCategorizedLinks.external.length} total):`,
						),
					);
				} else {
					console.log(
						chalk.yellow(
							`\nExternal Links (${currentCategorizedLinks.external.length} total):`,
						),
					);
				}
				currentCategorizedLinks.external.forEach((link) => {
					const displayText = link.text || "Link";
					console.log(
						chalk.cyan(`  ${linkIndex}. `) + chalk.blue.underline(link.href),
					);
					linkMap.set(linkIndex, { href: link.href, text: link.text });
					linkIndex++;
				});
			}
		}

		return linkMap;
	};

	let lastCommandResult: string | null = null;
	let lastCommand: string | null = null;

	while (true) {
		// Clear screen and show current state
		console.clear();

		// Show current page header
		console.log(chalk.bold.cyan(`\nCurrent Page: ${pageTitle}`));
		// console.log(chalk.dim("─".repeat(60)));

		// Display links
		const linkMap = displayLinks();

		const totalDisplayed = linkMap.size;

		// If there was a last command, show it and its results here
		if (lastCommand && lastCommandResult) {
			console.log("");
			console.log(chalk.dim("─".repeat(60)));
			console.log(chalk.cyan("Last command: ") + chalk.yellow(lastCommand));
			console.log("");
			console.log(lastCommandResult);
			console.log(chalk.dim("─".repeat(60)));
		}

		// Show commands menu at the bottom
		console.log(chalk.dim("\nCommands:"));
		console.log(chalk.dim(`  1-${totalDisplayed}: Navigate to link`));
		console.log(chalk.dim("  'n': Show only navigation links"));
		console.log(chalk.dim("  'e': Show only external links"));
		console.log(chalk.dim("  'a': Show all links"));
		console.log(chalk.dim("  'b': Go back"));
		console.log(chalk.dim("  'h': History"));
		console.log(chalk.dim("  'q': Quit"));
		console.log(chalk.dim("\nEnhanced Commands:"));
		console.log(
			chalk.dim("  '5 --read -l fr': Navigate to link 5 and read in French"),
		);
		console.log(
			chalk.dim("  '3 --tldr --copy': Navigate to link 3, get TLDR and copy"),
		);
		console.log(
			chalk.dim("  '1 --eli5 -m gemini': Navigate to link 1, ELI5 with Gemini"),
		);

		let input: string;
		try {
			input = await new Promise<string>((resolve, reject) => {
				rl.question(chalk.yellow("\n> "), (answer) => {
					resolve(answer);
				});
				// Check if readline was closed
				if ((rl as any).closed) {
					reject(new Error("Readline interface was closed"));
				}
			});
		} catch (error) {
			// Readline was closed, break out of the loop gracefully
			console.log(chalk.yellow("Browse mode ended"));
			break;
		}

		const command = input.trim().toLowerCase();

		if (command === "q" || command === "quit") {
			console.log(chalk.green("\n👋 Exiting browse mode"));
			break;
		}

		if (command === "n") {
			displayMode = "nav";
			lastCommand = null; // Clear last command for navigation changes
			lastCommandResult = null;
			continue;
		}

		if (command === "e") {
			displayMode = "external";
			lastCommand = null; // Clear last command for navigation changes
			lastCommandResult = null;
			continue;
		}

		if (command === "a") {
			displayMode = "all";
			lastCommand = null; // Clear last command for navigation changes
			lastCommandResult = null;
			continue;
		}


		if (command === "b" || command === "back") {
			if (browsingHistory.length > 1) {
				browsingHistory.pop();
				const previousPage = browsingHistory[browsingHistory.length - 1];

				try {
					const html = await fetchPage(previousPage!, { fullRender: false });
					currentCategorizedLinks = extractCategorizedLinks(
						html,
						previousPage!,
					);
					currentPage = previousPage!;
					displayMode = "all";

					const metadata = extractMetadata(html);
					currentPageTitle = metadata.title || currentPage;
					pageTitle = currentPageTitle; // Update page title

					// Clear last command after navigation
					lastCommand = null;
					lastCommandResult = null;
				} catch (error) {
					lastCommand = "b";
					lastCommandResult = chalk.red("Failed to go back to previous page");
					browsingHistory.push(currentPage);
				}
			} else {
				lastCommand = "b";
				lastCommandResult = chalk.yellow("No previous page in history");
			}
			continue;
		}

		if (command === "h" || command === "history") {
			let historyOutput = chalk.bold("📚 Browsing History:\n");
			browsingHistory.forEach((url, index) => {
				const indicator = index === browsingHistory.length - 1 ? "→ " : "  ";
				historyOutput += chalk.cyan(indicator) + chalk.white(url) + "\n";
			});
			lastCommand = "h";
			lastCommandResult = historyOutput.trim();
			continue;
		}

		// Handle numeric input for link navigation with optional CLI options
		// Parse input to support commands like "5 --read -l fr"
		const inputParts = input.trim().split(/\s+/);
		const linkNumber = Number.parseInt(inputParts[0] || "");

		if (linkNumber >= 1 && linkNumber <= totalDisplayed) {
			const selectedLink = linkMap.get(linkNumber);
			if (selectedLink) {
				const targetUrl = new URL(selectedLink.href, currentPage).href;

				// Check if additional CLI options were provided
				if (inputParts.length > 1) {
					// Parse CLI options after the link number
					try {
						const cliArgs = inputParts.slice(1);
						const { values } = parseArgs({
							args: cliArgs,
							allowPositionals: false,
							options: {
								// Summary options
								tldr: { type: "boolean" },
								"key-points": { type: "boolean" },
								eli5: { type: "boolean" },
								full: { type: "boolean" },
								ask: { type: "string", short: "q" },

								// Language options
								language: { type: "string", short: "l" },

								// Voice options
								read: { type: "boolean", short: "r" },
								voice: { type: "string" },
								"audio-output": { type: "string" },

								// AI options
								model: { type: "string", short: "m" },
								stream: { type: "boolean" },
								"max-tokens": { type: "string" },

								// Service options
								"free-only": { type: "boolean" },
								"prefer-quality": { type: "boolean" },

								// Format & Output options
								format: { type: "string" },
								output: { type: "string", short: "o" },
								copy: { type: "boolean", short: "c" },

								// Advanced options
								"full-render": { type: "boolean" },
								screenshot: { type: "string" },
								metadata: { type: "boolean" },
								links: { type: "boolean" },
							},
						});

						console.log(chalk.blue(`📍 Processing: ${targetUrl}`));

						// Show which options are being applied
						const activeOptions = [];
						if (values.tldr) activeOptions.push("TLDR");
						if (values.eli5) activeOptions.push("ELI5");
						if (values["key-points"]) activeOptions.push("Key Points");
						if (values.full) activeOptions.push("Full Content");
						if (values.read) activeOptions.push("Read Aloud");
						if (values.language)
							activeOptions.push(`Language: ${values.language}`);
						if (values.copy) activeOptions.push("Copy to Clipboard");
						if (values.model) activeOptions.push(`Model: ${values.model}`);

						if (activeOptions.length > 0) {
							console.log(chalk.dim(`🔧 Options: ${activeOptions.join(", ")}`));
						}
						console.log("");

						// Navigate and apply glance with options
						const glanceOptions: GlanceOptions = {
							model: values.model,
							language: values.language,
							tldr: values.tldr,
							keyPoints: values["key-points"],
							eli5: values.eli5,
							full: values.full,
							customQuestion: values.ask,
							stream: values.stream,
							maxTokens: values["max-tokens"]
								? Number.parseInt(values["max-tokens"])
								: undefined,
							format: values.format,
							output: values.output,
							screenshot: values.screenshot,
							fullRender: values["full-render"],
							metadata: values.metadata,
							links: values.links,
							read: values.read,
							voice: values.voice,
							audioOutput: values["audio-output"],
							freeOnly: values["free-only"],
							preferQuality: values["prefer-quality"],
							copy: values.copy,
							disableStdinHandling: true, // Prevent spinner from interfering with readline
						};

						// Run glance command with the options
						const result = await glance(targetUrl, glanceOptions);

						// Store the result for display
						lastCommand = inputParts[0] + " " + inputParts.slice(1).join(" ");

						if (glanceOptions.output) {
							// File was saved, show confirmation
							lastCommandResult = chalk.green(
								`✅ Content saved to ${glanceOptions.output}`,
							);
						} else if (
							!glanceOptions.stream &&
							!glanceOptions.read &&
							!glanceOptions.audioOutput
						) {
							// Show the result content
							lastCommandResult = chalk.bold.green("🎯 Result:\n") + result;
						} else {
							lastCommandResult = chalk.green("✅ Processing completed");
						}

						// Don't update navigation state when using options - just process and return to current page
						continue;
					} catch (parseError) {
						console.log(
							chalk.red(
								`Invalid options: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
							),
						);
						console.log(chalk.dim("Example: 5 --read -l fr"));
						continue;
					}
				} else {
					// Regular navigation with default summary (like normal glance behavior)
					console.log(chalk.blue(`📍 Navigating to: ${targetUrl}`));

					try {
						const html = await fetchPage(targetUrl, { fullRender: false });
						const newCategorizedLinks = extractCategorizedLinks(
							html,
							targetUrl,
						);

						browsingHistory.push(targetUrl);
						currentCategorizedLinks = newCategorizedLinks;
						currentPage = targetUrl;
						displayMode = "all";

						const metadata = extractMetadata(html);
						currentPageTitle = metadata.title || targetUrl;
						pageTitle = currentPageTitle; // Update page title
						const newTotalLinks =
							newCategorizedLinks.navigation.length +
							newCategorizedLinks.external.length;

						// Get summary like normal glance behavior
						const result = await glance(targetUrl, {
							tldr: true,
							disableStdinHandling: true,
						});

						// Store the result for display
						lastCommand = inputParts[0] || "";
						lastCommandResult = chalk.bold.green("📄 Summary:\n") + result;
					} catch (error) {
						console.log(chalk.red("Failed to navigate to that link"));
					}
				}
			}
		} else if (linkNumber > 0) {
			console.log(
				chalk.yellow(`Invalid link number. Please choose 1-${totalDisplayed}`),
			);
		} else {
			console.log(
				chalk.yellow(
					"Invalid command. Type 'q' to quit or a number to navigate.",
				),
			);
		}
	}

	rl.close();
}
