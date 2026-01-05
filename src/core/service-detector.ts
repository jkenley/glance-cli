/**
 * Service Detection and Smart Fallback System
 * Prioritizes free/local services to avoid API costs
 */

import chalk from "chalk";

interface ServiceStatus {
	available: boolean;
	name: string;
	type: "free" | "paid";
	reason?: string;
}

interface DetectionResult {
	ai: {
		preferred: string;
		available: ServiceStatus[];
		fallbackChain: string[];
	};
	voice: {
		preferred: string;
		available: ServiceStatus[];
		fallbackChain: string[];
	};
}

/**
 * Check if Ollama is running
 */
async function checkOllama(
	endpoint: string = "http://localhost:11434",
): Promise<ServiceStatus> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		const res = await fetch(`${endpoint}/api/tags`, {
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (res.ok) {
			const data = await res.json();
			const models = (data as { models?: { name: string }[] }).models || [];

			if (models.length === 0) {
				return {
					available: false,
					name: "Ollama",
					type: "free",
					reason: "No models installed. Run: ollama pull llama3",
				};
			}

			return {
				available: true,
				name: "Ollama",
				type: "free",
			};
		}

		return {
			available: false,
			name: "Ollama",
			type: "free",
			reason: "Server not responding",
		};
	} catch (_error) {
		return {
			available: false,
			name: "Ollama",
			type: "free",
			reason: "Not running. Start with: ollama serve",
		};
	}
}

/**
 * Check if OpenAI API key is set
 */
function checkOpenAI(): ServiceStatus {
	if (!process.env.OPENAI_API_KEY) {
		return {
			available: false,
			name: "OpenAI",
			type: "paid",
			reason: "OPENAI_API_KEY not set",
		};
	}

	return {
		available: true,
		name: "OpenAI",
		type: "paid",
	};
}

/**
 * Check if Gemini API key is set
 */
function checkGemini(): ServiceStatus {
	if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
		return {
			available: false,
			name: "Google Gemini",
			type: "paid",
			reason: "GEMINI_API_KEY not set",
		};
	}

	return {
		available: true,
		name: "Google Gemini",
		type: "paid",
	};
}

/**
 * Check if ElevenLabs API key is set
 */
function checkElevenLabs(): ServiceStatus {
	if (!process.env.ELEVENLABS_API_KEY) {
		return {
			available: false,
			name: "ElevenLabs",
			type: "paid",
			reason: "ELEVENLABS_API_KEY not set",
		};
	}

	return {
		available: true,
		name: "ElevenLabs",
		type: "paid",
	};
}

/**
 * Check if local TTS is available
 */
async function checkLocalTTS(): Promise<ServiceStatus> {
	const platform = process.platform;

	if (platform === "darwin") {
		// macOS always has 'say' command
		return {
			available: true,
			name: "macOS Say",
			type: "free",
		};
	} else if (platform === "win32") {
		// Windows always has SAPI
		return {
			available: true,
			name: "Windows SAPI",
			type: "free",
		};
	} else {
		// Linux - check for espeak or festival
		try {
			const { spawn } = await import("node:child_process");

			return new Promise((resolve) => {
				const proc = spawn("which", ["espeak"]);

				proc.on("close", (code) => {
					if (code === 0) {
						resolve({
							available: true,
							name: "espeak",
							type: "free",
						});
					} else {
						// Try festival
						const festProc = spawn("which", ["festival"]);
						festProc.on("close", (festCode) => {
							if (festCode === 0) {
								resolve({
									available: true,
									name: "festival",
									type: "free",
								});
							} else {
								resolve({
									available: false,
									name: "Linux TTS",
									type: "free",
									reason: "Install espeak or festival",
								});
							}
						});
					}
				});
			});
		} catch {
			return {
				available: false,
				name: "Linux TTS",
				type: "free",
				reason: "Unable to detect TTS engine",
			};
		}
	}
}

/**
 * Detect all available services and create smart fallback chains
 */
export async function detectServices(
	options: {
		preferFree?: boolean;
		ollamaEndpoint?: string;
		verbose?: boolean;
	} = {},
): Promise<DetectionResult> {
	const { preferFree = true, ollamaEndpoint, verbose = false } = options;

	// Check all services in parallel
	const [ollama, openai, gemini, elevenlabs, localTTS] = await Promise.all([
		checkOllama(ollamaEndpoint),
		checkOpenAI(),
		checkGemini(),
		checkElevenLabs(),
		checkLocalTTS(),
	]);

	// Create AI fallback chain
	const aiServices = [ollama, openai, gemini];
	const _availableAI = aiServices.filter((s) => s.available);

	let aiFallbackChain: string[] = [];
	if (preferFree) {
		// Prioritize free services
		aiFallbackChain = [
			...(ollama.available ? ["ollama"] : []),
			...(openai.available ? ["openai"] : []),
			...(gemini.available ? ["google"] : []),
		];
	} else {
		// Prioritize paid services (potentially better quality)
		aiFallbackChain = [
			...(openai.available ? ["openai"] : []),
			...(gemini.available ? ["google"] : []),
			...(ollama.available ? ["ollama"] : []),
		];
	}

	// Create Voice fallback chain
	const voiceServices = [localTTS, elevenlabs];
	const _availableVoice = voiceServices.filter((s) => s.available);

	let voiceFallbackChain: string[] = [];
	if (preferFree) {
		// Always prioritize free TTS
		voiceFallbackChain = [
			...(localTTS.available ? ["local"] : []),
			...(elevenlabs.available ? ["elevenlabs"] : []),
		];
	} else {
		voiceFallbackChain = [
			...(elevenlabs.available ? ["elevenlabs"] : []),
			...(localTTS.available ? ["local"] : []),
		];
	}

	// Determine preferred services
	const preferredAI = aiFallbackChain[0] || "none";
	const preferredVoice = voiceFallbackChain[0] || "none";

	// Print status if verbose
	if (verbose) {
		console.log(chalk.cyan("\n📊 Service Detection Report:\n"));

		console.log(chalk.bold("AI Services:"));
		aiServices.forEach((service) => {
			const icon = service.available ? "✅" : "❌";
			const badge =
				service.type === "free"
					? chalk.green("[FREE]")
					: chalk.yellow("[PAID]");
			console.log(
				`  ${icon} ${service.name} ${badge} ${service.reason ? chalk.dim(`- ${service.reason}`) : ""}`,
			);
		});

		console.log(chalk.bold("\nVoice Services:"));
		voiceServices.forEach((service) => {
			const icon = service.available ? "✅" : "❌";
			const badge =
				service.type === "free"
					? chalk.green("[FREE]")
					: chalk.yellow("[PAID]");
			console.log(
				`  ${icon} ${service.name} ${badge} ${service.reason ? chalk.dim(`- ${service.reason}`) : ""}`,
			);
		});

		console.log(chalk.bold("\n🎯 Selected:"));
		console.log(
			`  AI: ${preferredAI !== "none" ? chalk.green(preferredAI) : chalk.red("No AI service available")}`,
		);
		console.log(
			`  Voice: ${preferredVoice !== "none" ? chalk.green(preferredVoice) : chalk.red("No voice service available")}`,
		);

		if (
			preferFree &&
			(openai.available || gemini.available || elevenlabs.available)
		) {
			console.log(
				chalk.dim(
					"\n💡 Tip: Using free services by default. Use --prefer-quality for premium services.",
				),
			);
		}
	}

	return {
		ai: {
			preferred: preferredAI,
			available: aiServices,
			fallbackChain: aiFallbackChain,
		},
		voice: {
			preferred: preferredVoice,
			available: voiceServices,
			fallbackChain: voiceFallbackChain,
		},
	};
}

/**
 * Get the default model based on available services
 */
export async function getDefaultModel(
	ollamaEndpoint?: string,
	preferQuality?: boolean,
): Promise<string> {
	const detection = await detectServices({
		ollamaEndpoint,
		verbose: false,
		preferFree: !preferQuality,
	});

	switch (detection.ai.preferred) {
		case "ollama":
			// Get the first available Ollama model
			try {
				const res = await fetch(
					`${ollamaEndpoint || "http://localhost:11434"}/api/tags`,
				);
				if (res.ok) {
					const data = await res.json();
					const models = (data as { models?: { name: string }[] }).models || [];
					if (models.length > 0) {
						// Prefer llama3 if available, otherwise use the first model
						const llama3 = models.find((m) => m.name.includes("llama3"));
						return llama3 ? llama3.name : models[0].name;
					}
				}
			} catch {}
			return "llama3"; // Default Ollama model

		case "openai":
			return "gpt-4o-mini"; // Cheapest OpenAI model

		case "google":
			return "gemini-2.0-flash-exp"; // Free tier Gemini model

		default:
			// No service available, return a sensible default
			return "llama3";
	}
}

/**
 * Show cost warning for paid services
 */
export function showCostWarning(service: string, model?: string): void {
	const warnings: Record<string, string> = {
		openai: `Using OpenAI (${model || "gpt-4o-mini"}) - This will consume API credits! Use --model llama3 for free local processing.`,
		google: `Using Google Gemini (${model || "gemini-2.0-flash-exp"}) - This may consume API credits! Use --model llama3 for free local processing.`,
		elevenlabs:
			"Using ElevenLabs voices - This will consume API credits! Use --read without API key for free local TTS.",
	};

	if (warnings[service]) {
		console.log(chalk.yellow(`\n⚠️  ${warnings[service]}`));
	}
}

/**
 * Check if we should use only free services
 */
export function shouldUseFreeOnly(): boolean {
	// Check environment variable
	if (process.env.GLANCE_FREE_ONLY === "true") {
		return true;
	}

	// Check if user has no API keys set (implicit free-only mode)
	const hasAPIKeys = !!(
		process.env.OPENAI_API_KEY ||
		process.env.GEMINI_API_KEY ||
		process.env.GOOGLE_API_KEY ||
		process.env.ELEVENLABS_API_KEY
	);

	return !hasAPIKeys;
}
