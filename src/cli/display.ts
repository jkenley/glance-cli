/**
 * Display utilities for Glance CLI
 * Handles help text, examples, and other user-facing output
 */

import chalk from "chalk";
import { CONFIG } from "./config";
import type { ServiceStatus } from "./types";

export function showHelp(): void {
	console.log(`
${chalk.bold("glance")} v${CONFIG.VERSION} – AI-powered web reader

${chalk.bold("Usage:")}
  glance <url> [options]

${chalk.bold("Options:")}
  ${chalk.cyan("--help, -h")}           Show this help message
  ${chalk.cyan("--version, -v")}        Show version number
  
  ${chalk.bold("Summary Options:")}
  ${chalk.cyan("--tldr")}               Get a one-sentence summary
  ${chalk.cyan("--key-points")}         Extract key points as bullet points
  ${chalk.cyan("--eli5")}               Explain like I'm five
  ${chalk.cyan("--full")}               Read complete article without summarization ${chalk.green("(NEW!)")}
  ${chalk.cyan("--ask, -q <question>")} Ask a specific question about the content
  
  ${chalk.bold("Language & Voice:")}
  ${chalk.cyan("--language, -l <lang>")} Output language (en, fr, es, ht)
  ${chalk.cyan("--read, -r")}           Read the summary aloud using text-to-speech
  ${chalk.cyan("--voice <voice>")}      Select voice for speech synthesis (e.g., nova, antoine)
  ${chalk.cyan("--list-voices")}        List all available voices by language
  ${chalk.cyan("--audio-output <file>")} Save audio to file (mp3/wav)
  
  ${chalk.bold("AI Provider Options:")}
  ${chalk.cyan("--model, -m <model>")} Specify AI model (e.g., gpt-4o-mini, gemini-2.0-flash-exp, llama3)
  ${chalk.cyan("--list-models")}        List available Ollama models
  ${chalk.cyan("--stream")}             Stream the response as it's generated
  ${chalk.cyan("--max-tokens <n>")}     Maximum tokens for response (1-100000)
  ${chalk.cyan("--free-only")}          Only use free services (never use paid APIs)
  ${chalk.cyan("--prefer-quality")}     Prefer paid services for better quality
  
  ${chalk.bold("Service Management:")}
  ${chalk.cyan("--check-services")}     Check available AI services and their status
  
  ${chalk.bold("Output Format:")}
  ${chalk.cyan("--format <type>")}      Output format: md, json, plain (default: terminal)
  ${chalk.cyan("--output, -o <file>")} Save to file (auto-detects format from extension)
  
  ${chalk.bold("Advanced Options:")}
  ${chalk.cyan("--full-render")}        Enable JavaScript rendering (slower, for SPAs)
  ${chalk.cyan("--screenshot <file>")} Capture a screenshot of the page
  ${chalk.cyan("--metadata")}           Show page metadata (author, dates, etc.)
  ${chalk.cyan("--links")}              Extract all links from the page
  ${chalk.cyan("--debug")}              Enable debug output

${chalk.bold("Examples:")}
  ${chalk.gray("# Quick summary")}
  glance https://www.ayiti.ai

  ${chalk.gray("# One-sentence summary with voice")}
  glance https://news.site/article --tldr --read

  ${chalk.gray("# Read full article with AI formatting")}
  glance https://blog.com/post --full --read

  ${chalk.gray("# Ask a specific question")}
  glance https://docs.site/api --ask "How do I authenticate?"

  ${chalk.gray("# French summary with French voice")}
  glance https://www.ayiti.ai -l fr --voice antoine --read

  ${chalk.gray("# Use specific AI model")}
  glance https://www.ayiti.ai --model gpt-4o-mini

  ${chalk.gray("# Check available services")}
  glance --check-services

${chalk.bold("Environment Variables:")}
  ${chalk.cyan("OPENAI_API_KEY")}       API key for OpenAI
  ${chalk.cyan("GEMINI_API_KEY")}       API key for Google Gemini
  ${chalk.cyan("ELEVENLABS_API_KEY")}  API key for ElevenLabs voice synthesis
  ${chalk.cyan("OLLAMA_ENDPOINT")}      Custom Ollama endpoint (default: http://localhost:11434)

${chalk.dim("For more information: https://github.com/jkenley/glance-cli")}
`);
}

export function showVersion(): void {
	console.log(`glance v${CONFIG.VERSION}`);
}

export function showExamples(): void {
	console.log(`
${chalk.bold("Glance CLI Examples")}

${chalk.bold("Basic Usage:")}
  ${chalk.gray("# Standard summary")}
  glance https://www.ayiti.ai

  ${chalk.gray("# One-sentence summary")}
  glance https://www.ayiti.ai --tldr

  ${chalk.gray("# Key points extraction")}
  glance https://www.ayiti.ai --key-points

  ${chalk.gray("# Simple explanation")}
  glance https://www.ayiti.ai --eli5

  ${chalk.gray("# Full article without summarization")}
  glance https://www.ayiti.ai --full

${chalk.bold("Voice & Audio:")}
  ${chalk.gray("# Read summary aloud")}
  glance https://www.ayiti.ai --tldr --read

  ${chalk.gray("# Use specific voice")}
  glance https://www.ayiti.ai --voice nova --read

  ${chalk.gray("# Save as audio file")}
  glance https://www.ayiti.ai --tldr --audio-output summary.mp3

  ${chalk.gray("# List available voices")}
  glance --list-voices

${chalk.bold("Multilingual:")}
  ${chalk.gray("# French summary with French voice")}
  glance https://www.ayiti.ai -l fr --voice antoine --read

  ${chalk.gray("# Spanish summary")}
  glance https://www.ayiti.ai -l es

  ${chalk.gray("# Translate French article to English")}
  glance https://lemonde.fr/article --full -l en

${chalk.bold("AI Models:")}
  ${chalk.gray("# Use GPT-4")}
  glance https://www.ayiti.ai --model gpt-4o-mini

  ${chalk.gray("# Use Gemini")}
  glance https://www.ayiti.ai --model gemini-2.0-flash-exp

  ${chalk.gray("# Use local Ollama")}
  glance https://www.ayiti.ai --model llama3

  ${chalk.gray("# Force free services only")}
  glance https://www.ayiti.ai --free-only

  ${chalk.gray("# Prefer quality (paid) services")}
  glance https://www.ayiti.ai --prefer-quality

${chalk.bold("Advanced:")}
  ${chalk.gray("# JavaScript-heavy sites")}
  glance https://spa-site.com --full-render

  ${chalk.gray("# Take screenshot")}
  glance https://www.ayiti.ai --screenshot page.png

  ${chalk.gray("# Extract metadata")}
  glance https://www.ayiti.ai --metadata

  ${chalk.gray("# Extract all links")}
  glance https://www.ayiti.ai --links

  ${chalk.gray("# Stream response")}
  glance https://www.ayiti.ai --stream

  ${chalk.gray("# Debug mode")}
  glance https://www.ayiti.ai --debug
`);
}

export function formatErrorMessage(error: unknown): string {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "ENOTFOUND"
	) {
		return chalk.red(
			`Cannot reach the website. Please check your internet connection and the URL.`,
		);
	}

	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "ETIMEDOUT"
	) {
		return chalk.red(
			`Request timed out. The website might be slow or unresponsive.`,
		);
	}

	if (error && typeof error === "object" && "userMessage" in error) {
		return chalk.red(String(error.userMessage));
	}

	const message = error instanceof Error ? error.message : String(error);
	return chalk.red(`Error: ${message || "Unknown error occurred"}`);
}

export function showServiceStatus(services: ServiceStatus): void {
	if (!services) {
		console.error(
			chalk.red("Service detection failed - no services information available"),
		);
		return;
	}

	console.log(chalk.bold("\n🔍 Service Detection Results:\n"));

	const formatStatus = (available: boolean) =>
		available ? chalk.green("✅ Available") : chalk.gray("❌ Not Available");

	console.log(chalk.bold("AI Services:"));

	if (services.ollama) {
		console.log(
			`  Ollama (Local):    ${formatStatus(services.ollama.available)} ${services.ollama.available && services.ollama.models ? chalk.gray(`(${services.ollama.models.length} models)`) : ""}`,
		);
	}

	if (services.openai) {
		console.log(
			`  OpenAI:            ${formatStatus(services.openai.available)}`,
		);
	}

	if (services.gemini) {
		console.log(
			`  Google Gemini:     ${formatStatus(services.gemini.available)}`,
		);
	}

	console.log(chalk.bold("\nVoice Services:"));

	if (services.elevenlabs) {
		console.log(
			`  ElevenLabs:        ${formatStatus(services.elevenlabs.available)} ${services.elevenlabs.available && services.elevenlabs.voices ? chalk.gray(`(${services.elevenlabs.voices.length} voices)`) : ""}`,
		);
	}

	console.log(
		`  System TTS:        ${formatStatus(true)} ${chalk.gray("(fallback)")}`,
	);

	console.log(chalk.bold("\nDefault Configuration:"));
	console.log(
		`  Default AI Model:  ${chalk.cyan(services.defaultModel || "None available")}`,
	);
	console.log(
		`  Priority:          ${chalk.cyan(services.priority || "Free services first")}`,
	);

	if (services.recommendations && services.recommendations.length > 0) {
		console.log(chalk.bold("\n💡 Recommendations:"));
		services.recommendations.forEach((rec: string) => {
			console.log(`  • ${rec}`);
		});
	}

	console.log(
		chalk.dim(
			"\nFor setup instructions, visit: https://github.com/jkenley/glance-cli#setup",
		),
	);
}
