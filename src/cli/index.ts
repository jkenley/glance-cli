/**
 * Main CLI entry point
 * This is a cleaner, modular version that exports all components
 */

import { parseArgs } from "node:util";
import chalk from "chalk";
import {
	browseCommand,
	checkServicesCommand,
	type GlanceOptions,
	glance,
	listModelsCommand,
	listVoicesCommand,
} from "./commands";
import { formatErrorMessage, showHelp, showVersion } from "./display";
// Import modules
import { GlanceError } from "./errors";
import { logger } from "./logger";
import { validateLanguage, validateMaxTokens, validateURL } from "./validators";

export * from "./commands";
// Export all modules for programmatic use
export * from "./config";
export * from "./display";
export * from "./errors";
export * from "./logger";
export * from "./types";
export * from "./utils";
export * from "./validators";

/**
 * Parse CLI arguments
 */
function parseCliArgs() {
	try {
		const { values, positionals } = parseArgs({
			args: process.argv.slice(2),
			allowPositionals: true,
			options: {
				// Core options
				help: { type: "boolean", short: "h" },
				version: { type: "boolean", short: "v" },

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
				"list-voices": { type: "boolean" },
				"audio-output": { type: "string" },

				// AI options
				model: { type: "string", short: "m" },
				"list-models": { type: "boolean" },
				stream: { type: "boolean" },
				"max-tokens": { type: "string" },

				// Service options
				"check-services": { type: "boolean" },
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
				browse: { type: "boolean" },
				debug: { type: "boolean" },
			},
		});

		return { values, positionals };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error parsing arguments: ${message}`));
		console.log(chalk.dim("Run 'glance --help' for usage information"));
		process.exit(1);
	}
}

/**
 * Main CLI function
 */
export async function runCli() {
	try {
		const { values, positionals } = parseCliArgs();

		// Handle help
		if (values.help) {
			showHelp();
			process.exit(0);
		}

		// Handle version
		if (values.version) {
			showVersion();
			process.exit(0);
		}

		// Handle special commands that don't require a URL

		if (values["list-voices"]) {
			await listVoicesCommand();
			process.exit(0);
		}

		if (values["check-services"]) {
			await checkServicesCommand();
			process.exit(0);
		}

		if (values["list-models"]) {
			await listModelsCommand();
			process.exit(0);
		}

		// Handle browse mode
		if (values.browse) {
			// Validate URL is provided for browse mode
			if (positionals.length === 0) {
				console.error(chalk.red("Error: No URL provided for browse mode"));
				console.log(chalk.dim("Usage: glance <url> --browse"));
				process.exit(1);
			}

			const url = positionals[0];
			if (!url) {
				console.error(chalk.red("Error: URL is required for browse mode."));
				process.exit(1);
			}

			// Validate URL format
			const urlValidation = validateURL(url);
			if (!urlValidation.valid) {
				console.error(chalk.red(`Error: ${urlValidation.error}`));
				process.exit(1);
			}

			await browseCommand(url);
			process.exit(0);
		}

		// Validate URL is provided
		if (positionals.length === 0) {
			console.error(chalk.red("Error: No URL provided"));
			console.log(chalk.dim("Usage: glance <url> [options]"));
			console.log(chalk.dim("Run 'glance --help' for more information"));
			process.exit(1);
		}

		const url = positionals[0];

		if (!url) {
			console.error(chalk.red("Error: URL is required."));
			process.exit(1);
		}

		// Validate URL format
		const urlValidation = validateURL(url);

		if (!urlValidation.valid) {
			console.error(chalk.red(`Error: ${urlValidation.error}`));
			process.exit(1);
		}

		// Validate language if provided
		if (values.language) {
			const langValidation = validateLanguage(values.language);
			if (!langValidation.valid) {
				console.error(chalk.red(`Error: ${langValidation.error}`));
				process.exit(1);
			}
		}

		// Validate max tokens if provided
		let maxTokens: number | undefined;
		if (values["max-tokens"]) {
			const tokensValidation = validateMaxTokens(values["max-tokens"]);
			if (!tokensValidation.valid) {
				console.error(chalk.red(`Error: ${tokensValidation.error}`));
				process.exit(1);
			}
			maxTokens = tokensValidation.parsed;
		}

		// Prepare options
		const options: GlanceOptions = {
			model: values.model,
			language: values.language,
			tldr: values.tldr,
			keyPoints: values["key-points"],
			eli5: values.eli5,
			full: values.full,
			customQuestion: values.ask,
			stream: values.stream,
			maxTokens,
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
			debug: values.debug,
			copy: values.copy,
			browse: values.browse,
		};

		// Run the main command
		const result = await glance(url, options);

		// Output result (if not already handled by streaming or voice)
		if (!options.stream && !options.read && !options.audioOutput) {
			console.log(result);
		}
	} catch (error: unknown) {
		// Handle errors gracefully
		if (error instanceof GlanceError) {
			console.error(formatErrorMessage(error));
			if (error.hint) {
				console.log(chalk.yellow(`\n💡 Hint: ${error.hint}`));
			}
		} else {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(chalk.red(`\n❌ Unexpected error: ${errorMessage}`));
			if (logger.getLevel() === "debug" && error instanceof Error) {
				console.error(error.stack);
			} else {
				console.log(chalk.dim("Run with --debug for more details"));
			}
		}

		process.exit(1);
	}
}

// Run CLI if this is the main module
// Use process check for Bun compatibility
if (
	typeof process !== "undefined" &&
	process.argv &&
	process.argv[1] &&
	process.argv[1].endsWith("index.ts")
) {
	runCli();
} else if (typeof require !== "undefined" && require.main === module) {
	runCli();
}
