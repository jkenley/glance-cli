/**
 * glance v0.7.0 – Production-Ready Multi-Provider Summarizer
 * Enhanced with Expert-Level Prompt Engineering
 *
 * Supports:
 * - OpenAI (gpt-*, o1-*)
 * - Google Gemini (gemini-*)
 * - Ollama (local models, e.g., llama3, mistral)
 * - Custom questions (--ask)
 * - Streaming, maxTokens, languages (en/fr/es/ht), emoji, tldr, key-points, eli5
 * - Retry on transients
 * - Advanced prompt engineering for superior results
 */

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import chalk from "chalk";
import { nuclearCleanText, sanitizeAIResponse, hasBinaryArtifacts } from "./text-cleaner";

const LANGUAGE_MAP: Record<string, string> = {
    en: "English",
    fr: "French",
    es: "Spanish",
    ht: "Haitian Creole",
} as const;

export interface SummarizeOptions {
    model: string;
    tldr?: boolean;
    keyPoints?: boolean;
    eli5?: boolean;
    emoji?: boolean;
    language: string;
    stream?: boolean;
    maxTokens?: number;
    customQuestion?: string;
}

/**
 * Validate language
 */
function validateLanguage(lang: string): asserts lang is keyof typeof LANGUAGE_MAP {
    if (!LANGUAGE_MAP[lang as keyof typeof LANGUAGE_MAP]) {
        throw new Error(`Unsupported language: "${lang}". Use: en, fr, es, ht`);
    }
}

/**
 * Detect provider
 */
export const detectProvider = (model: string): "openai" | "google" | "ollama" => {
    const lower = model.toLowerCase();
    if (lower.startsWith("gpt-") || lower.startsWith("o1-")) return "openai";
    if (lower.startsWith("gemini-")) return "google";
    return "ollama"; // Default to local if not cloud
};

/**
 * Expert-Level Prompt Templates
 * 
 * These prompts are engineered for:
 * - Maximum clarity and precision
 * - Consistent high-quality outputs
 * - Proper constraint handling
 * - Language-specific nuances
 * - Context preservation
 */
const PROMPT_TEMPLATES = {
    /**
     * System instruction - The foundation for all operations
     */
    systemInstruction: (langName: string) => `You are an expert content analyst and summarizer with deep expertise in extracting, analyzing, and presenting information clearly and accurately.

    **Core Capabilities:**
    - Extract key information with precision and context
    - Identify main themes, arguments, and supporting evidence
    - Synthesize complex content into accessible formats
    - Maintain factual accuracy and avoid hallucinations
    - Adapt tone and complexity to audience needs

    **Quality Standards:**
    - Base ALL responses strictly on the provided text
    - Preserve important context and nuances
    - Use clear, concise language appropriate to the task
    - Structure information logically for easy comprehension
    - Cite specific details when relevant

    **Language Requirements:**
    - Respond exclusively in ${langName}
    - Use natural, fluent phrasing native to ${langName}
    - Adapt idioms and expressions appropriately for ${langName} speakers`,

    /**
     * Standard Summary - Balanced, comprehensive
     */
    standardSummary: (emoji: boolean) => `**Task:** Create a comprehensive yet concise summary of the webpage content.

    **Requirements:**
    - Length: 250-400 words (approximately 3-5 paragraphs)
    - Structure: Begin with the main topic/thesis, followed by key supporting points, conclude with significance or implications
    - Coverage: Include all major themes, arguments, and important details
    - Tone: Professional, objective, and informative
    - Context: Preserve essential context that helps understanding${emoji ? '\n- Style: Enhance readability with relevant emojis (2-5 total, placed strategically)' : ''}

    **Format:**
    - Use clear paragraphs (no bullet points unless in original content)
    - Maintain logical flow between ideas
    - Highlight critical insights or unique perspectives
    - Avoid generic phrases like "this article discusses" - dive straight into content

    **Quality Checks:**
    - Does this capture the essence someone would miss by not reading the original?
    - Are technical terms explained adequately?
    - Is the hierarchy of information clear (main points vs. details)?`,

    /**
     * TL;DR - Ultra-concise single sentence
     */
    tldr: (emoji: boolean) => `**Task:** Distill the ENTIRE webpage into ONE powerful sentence (maximum 25 words).

    **Requirements:**
    - Capture the absolute core message or value proposition
    - Include the most critical insight or takeaway
    - Make it self-contained (understandable without context)${emoji ? '\n- Start with ONE highly relevant emoji' : ''}
    - Use active voice and strong verbs
    - Avoid generic openings ("This page is about...")

    **Formula:** [Who/What] + [Key Action/Finding] + [Primary Impact/Significance]

    **Example of Great TL;DR:**
    ❌ Bad: "This article talks about climate change and its effects."
    ✅ Good: "Global temperatures rising 1.5°C by 2030 will trigger irreversible ecosystem collapse across 40% of Earth."

    Focus on specificity and impact.`,

    /**
     * Key Points - Structured extraction
     */
    keyPoints: (emoji: boolean) => `**Task:** Extract 6-10 key points that comprehensively represent the webpage's content.

    **Requirements:**
    - Each point should be substantive (15-30 words)
    - Cover different aspects/sections of content
    - Prioritize actionable insights, data, and unique perspectives
    - Maintain logical order (chronological, hierarchical, or thematic)${emoji ? '\n- Begin each point with a relevant emoji' : ''}
    - Use parallel structure for consistency

    **Point Structure:**
    ${emoji ? '- 🎯 [Specific claim/fact] + [Supporting detail or context]' : '- [Specific claim/fact] + [Supporting detail or context]'}

    **Quality Standards:**
    - No generic or vague statements
    - Include specific numbers, names, or examples where available
    - Ensure points are independent (minimal overlap)
    - Balance breadth (coverage) with depth (detail)

    **Coverage Checklist:**
    - Main argument or thesis ✓
    - Supporting evidence or data ✓
    - Methodology or approach (if applicable) ✓
    - Results or findings ✓
    - Implications or conclusions ✓
    - Novel or surprising insights ✓`,

    /**
     * ELI5 - Simple, engaging explanation
     */
    eli5: (emoji: boolean) => `**Task:** Explain this webpage's content as if teaching a curious 10-year-old child.

    **Requirements:**
    - Use simple, everyday words (avoid jargon; explain technical terms with analogies)
    - Make it engaging and relatable with concrete examples
    - Length: 150-250 words (2-3 short paragraphs)${emoji ? '\n- Use 3-6 emojis to make it fun and visual' : ''}
    - Maintain accuracy while simplifying complexity
    - Use "you" and conversational tone

    **Techniques:**
    - Analogies: Compare complex concepts to familiar experiences
    - Stories: Frame information as a mini-narrative if possible
    - Questions: Pose and answer questions a child might ask
    - Concrete examples: Replace abstract ideas with tangible scenarios

    **Structure:**
    1. Hook: Start with something relatable or intriguing
    2. Core explanation: Break down the main idea simply
    3. Why it matters: Connect to the child's world

    **Example Transformation:**
    ❌ Complex: "The algorithm leverages machine learning to optimize resource allocation."
    ✅ ELI5: "Imagine a super-smart robot that watches how you use your toys 🤖 It learns which ones you play with most and puts those on the top shelf where you can reach them easily! That's what this computer program does with information."`,

    /**
     * Custom Question - Precise, grounded responses
     */
    customQuestion: (question: string, emoji: boolean) => `**Task:** Answer the following question using ONLY information found in the provided webpage text.

    **Question:** ${question}

    **Answer Requirements:**
    - Ground your answer exclusively in the provided text
    - Quote or reference specific details when relevant
    - If the information is partially available, clearly state what IS and ISN'T covered
    - If the information is completely absent, respond: "The webpage doesn't contain information about [question topic]. The content focuses on [brief description of actual content]."
    - Length: Be thorough but concise (100-300 words depending on complexity)${emoji ? '\n- Use 1-3 relevant emojis if appropriate to the question' : ''}

    **Answer Structure:**
    1. **Direct answer** (if available): Lead with the specific answer
    2. **Supporting details**: Provide context, evidence, or elaboration from the text
    3. **Limitations** (if any): Note gaps or ambiguities in the source material

    **Quality Standards:**
    - Precision: Answer exactly what was asked
    - Completeness: Include all relevant information from the text
    - Honesty: Never infer or assume beyond what's explicitly stated
    - Clarity: Organize information logically

    **Forbidden:**
    - Speculation or external knowledge
    - Generic filler phrases
    - Restating the question without answering it`,

    /**
     * Final output instruction - Applies to all tasks
     */
    outputInstruction: () => `
    **CRITICAL OUTPUT RULES:**
    - Respond ONLY with the requested content (summary/points/answer)
    - NO meta-commentary (don't say "Here's a summary..." or "Based on the text...")
    - NO preambles, introductions, or sign-offs
    - NO explanations of your process
    - Start directly with the content
    - End when content is complete

    Begin your response now:`,
};

/**
 * Advanced Prompt Builder with Expert Engineering
 * @param text - The text to summarize
 * @param options - The options for the summary
 * @returns The prompt
 */
function buildPrompt(text: string, options: SummarizeOptions): string {
    const langName = LANGUAGE_MAP[options.language as keyof typeof LANGUAGE_MAP];
    
    // System instruction - foundation for all tasks
    let prompt = PROMPT_TEMPLATES.systemInstruction(langName || "English");
    prompt += "\n\n---\n\n";

    // Task-specific instruction
    if (options.customQuestion) {
        prompt += PROMPT_TEMPLATES.customQuestion(options.customQuestion, options.emoji || false);
    } else if (options.tldr) {
        prompt += PROMPT_TEMPLATES.tldr(options.emoji || false);
    } else if (options.keyPoints) {
        prompt += PROMPT_TEMPLATES.keyPoints(options.emoji || false);
    } else if (options.eli5) {
        prompt += PROMPT_TEMPLATES.eli5(options.emoji || false);
    } else {
        prompt += PROMPT_TEMPLATES.standardSummary(options.emoji || false);
    }

    // Output instructions
    prompt += PROMPT_TEMPLATES.outputInstruction();

    // Content injection with smart truncation
    const maxContentLength = 100_000;
    const truncatedText = text.length > maxContentLength 
        ? text.slice(0, maxContentLength) + "\n\n[Content truncated due to length...]"
        : text;

    prompt += `\n\n---\n\n**WEBPAGE CONTENT:**\n\n${truncatedText}`;

    return prompt;
}

/**
 * Main summarize function
 * 
 * @param text - The text to summarize
 * @param options - The options for the summary
 * @returns The summarized text
 */
export async function summarize(
    text: string,
    options: SummarizeOptions
): Promise<string> {
    validateLanguage(options.language);
    const provider = detectProvider(options.model);

    const prompt = buildPrompt(text, options);

    switch (provider) {
        case "openai":
            return await openaiSummarize(prompt, options);
        case "google":
            return await geminiSummarize(prompt, options);
        case "ollama":
            return await ollamaSummarize(prompt, options);
        default:
            throw new Error("Invalid provider");
    }
}

/**
 * OpenAI adapter with optimized parameters
 */
async function openaiSummarize(prompt: string, options: SummarizeOptions): Promise<string> {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Optimized temperature for different tasks
    const temperature = options.eli5 ? 0.7 : 0.3; // Higher creativity for ELI5
    
    // Smart max_tokens based on task
    const defaultMaxTokens = options.tldr ? 100 : 
                            options.keyPoints ? 800 : 
                            options.eli5 ? 600 : 
                            1200;

    if (options.stream) {
        const stream = await client.chat.completions.create({
            model: options.model,
            messages: [{ role: "user", content: prompt }],
            temperature,
            max_tokens: options.maxTokens ?? defaultMaxTokens,
            stream: true,
        });

        let full = "";
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            process.stdout.write(chalk.gray(content));
            full += content;
        }
        process.stdout.write("\n");
        return full;
    }

    const res = await client.chat.completions.create({
        model: options.model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: options.maxTokens ?? defaultMaxTokens,
        top_p: 0.95, // Slightly reduce randomness for consistency
    });

    const rawContent = res.choices[0]?.message?.content?.trim() ?? "";
    
    // NUCLEAR CLEANING: Apply aggressive sanitization to AI response
    if (hasBinaryArtifacts(rawContent)) {
        console.error("🚨 CRITICAL: Binary artifacts in OpenAI response! Applying emergency cleaning...");
    }
    
    return nuclearCleanText(sanitizeAIResponse(rawContent));
}

/**
 * Google Gemini with optimized configuration
 * 
 */
async function geminiSummarize(prompt: string, options: SummarizeOptions): Promise<string> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const temperature = options.eli5 ? 0.7 : 0.3;

    const response = await ai.models.generateContent({
        model: options.model,
        contents: prompt,
        config: {
            temperature,
            topP: 0.95,
            topK: 40,
        },
    });

    const rawText = response.text?.trim() ?? "";
    
    // NUCLEAR CLEANING: Apply aggressive sanitization to Gemini response
    if (hasBinaryArtifacts(rawText)) {
        console.error("🚨 CRITICAL: Binary artifacts in Gemini response! Applying emergency cleaning...");
    }
    
    const text = nuclearCleanText(sanitizeAIResponse(rawText));

    if (options.stream) {
        for (const char of text) {
            process.stdout.write(chalk.gray(char));
            await new Promise((r) => setTimeout(r, 4));
        }
        process.stdout.write("\n");
    }

    return text;
}

/**
 * Ollama adapter with optimized parameters
 * 
 * @param prompt - The prompt to summarize
 * @param options - The options for the summary
 * @returns The summarized text
 */
async function ollamaSummarize(prompt: string, options: SummarizeOptions): Promise<string> {
    const temperature = options.eli5 ? 0.7 : 0.3;
    
    const defaultMaxTokens = options.tldr ? 100 : 
                            options.keyPoints ? 800 : 
                            options.eli5 ? 600 : 
                            1200;

    const body = JSON.stringify({
        model: options.model,
        messages: [{ role: "user", content: prompt }],
        stream: options.stream ?? false,
        options: {
            temperature,
            num_predict: options.maxTokens ?? defaultMaxTokens,
            top_p: 0.95,
            top_k: 40,
        },
    });

    const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama error: ${res.status} - ${err}`);
    }

    if (options.stream) {
        let full = "";
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter(Boolean);
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    const content = json.message?.content || "";
                    process.stdout.write(chalk.gray(content));
                    full += content;
                } catch { }
            }
        }
        process.stdout.write("\n");
        return full;
    }

    const data = await res.json();
    const rawContent = (data as any).message?.content?.trim() ?? "";
    
    // NUCLEAR CLEANING: Apply aggressive sanitization to Ollama response
    if (hasBinaryArtifacts(rawContent)) {
        console.error("🚨 CRITICAL: Binary artifacts in Ollama response! Applying emergency cleaning...");
    }
    
    return nuclearCleanText(sanitizeAIResponse(rawContent));
}

/**
 * Retry wrapper with exponential backoff
 * @param fn - The function to retry
 * @param retries - The number of retries
 * @returns The result of the function
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            const status = err.status || err.code;
            if (![429, 500, 502, 503, 504].includes(status)) throw err;
            const delay = 1000 * 2 ** i;
            console.warn(chalk.yellow(`Retry ${i + 1}/${retries} after ${delay}ms...`));
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastError;
}