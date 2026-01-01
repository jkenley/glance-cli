/**
 * Production-Grade Content Extraction
 * 
 * Features:
 * - Advanced content detection with scoring algorithm
 * - Deduplication and cleaning
 * - Structured data extraction (JSON-LD, microdata)
 * - Comprehensive metadata (OpenGraph, Twitter Cards, Schema.org)
 * - Table extraction with structure preservation
 * - Code block detection and formatting
 * - Language detection
 * - Reading time estimation
 * - Author and publication date extraction
 * - Error handling and validation
 * - Performance optimization
 */

import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";

// === Types ===

export interface Link {
    href: string;
    text: string;
    title?: string;
    rel?: string;
    type?: "internal" | "external" | "anchor";
}

export interface ExtendedMetadata {
    // Basic
    title: string;
    description: string;
    keywords: string[];
    language?: string;

    // Author & Publishing
    author?: string;
    publishDate?: string;
    modifiedDate?: string;
    publisher?: string;

    // Open Graph
    og: Record<string, string>;

    // Twitter Cards
    twitter: Record<string, string>;

    // Schema.org / JSON-LD
    structuredData?: any[];

    // Page info
    siteName?: string;
    type?: string;
    url?: string;
    image?: string;

    // Technical
    canonical?: string;
    robots?: string;
    viewport?: string;

    // Reading info
    wordCount?: number;
    readingTime?: number; // minutes
}

export interface ExtractedContent {
    text: string;
    html?: string;
    wordCount: number;
    charCount: number;
    paragraphCount: number;
    hasCode?: boolean;
    hasTables?: boolean;
}

export interface TableData {
    headers: string[];
    rows: string[][];
}

export interface CodeBlock {
    language?: string;
    code: string;
}

// === Configuration ===

const EXTRACTOR_CONFIG = {
    MIN_CONTENT_LENGTH: 200,        // Minimum text length to consider valid content
    MIN_PARAGRAPH_LENGTH: 50,       // Minimum paragraph length
    MAX_LINK_TEXT_RATIO: 0.5,       // Max ratio of link text to total text
    READING_WORDS_PER_MINUTE: 200,  // Average reading speed
} as const;

// Content selectors with priority scores
const CONTENT_SELECTORS = [
    { selector: "article", score: 100 },
    { selector: "[role='main']", score: 95 },
    { selector: "main", score: 90 },
    { selector: ".post-content", score: 85 },
    { selector: ".entry-content", score: 85 },
    { selector: ".article-content", score: 85 },
    { selector: ".content-body", score: 80 },
    { selector: "#content", score: 75 },
    { selector: ".content", score: 70 },
    { selector: ".post", score: 65 },
    { selector: ".markdown-body", score: 90 },  // GitHub, docs
    { selector: "[itemprop='articleBody']", score: 95 },  // Schema.org
] as const;

// Elements to remove (noise)
const NOISE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "header:not(article header)",  // Keep article headers
    "footer:not(article footer)",  // Keep article footers
    "aside",
    ".advertisement",
    ".ad",
    ".ads",
    ".social-share",
    ".comments",
    ".related-posts",
    ".sidebar",
    "[role='navigation']",
    "[role='banner']",
    "[role='complementary']",
    "[class*='cookie']",
    "[id*='cookie']",
    "[class*='popup']",
    "[class*='modal']",
    "[class*='newsletter']",
    ".hidden",
    "[hidden]",
    "[aria-hidden='true']",
] as const;

// === Validation ===

/**
 * Validate HTML input
 */
function validateHTML(html: string): void {
    if (!html || typeof html !== "string") {
        throw new Error("HTML must be a non-empty string");
    }

    if (html.trim().length === 0) {
        throw new Error("HTML is empty");
    }

    // Basic sanity check
    if (!html.includes("<") || !html.includes(">")) {
        throw new Error("Invalid HTML: missing tags");
    }
}

// === Content Scoring ===

/**
 * Score an element's content quality
 */
function scoreElement($: CheerioAPI, element: Cheerio<Element>): number {
    let score = 0;

    // Text length (more is better, up to a point)
    const text = element.text().trim();
    const textLength = text.length;

    if (textLength < EXTRACTOR_CONFIG.MIN_CONTENT_LENGTH) {
        return 0; // Too short, skip
    }

    score += Math.min(textLength / 10, 100); // Cap at 100 points

    // Paragraph count (more structured content)
    const paragraphs = element.find("p").length;
    score += paragraphs * 5;

    // Penalize high link density
    const linkText = element.find("a").text().trim().length;
    const linkRatio = textLength > 0 ? linkText / textLength : 0;

    if (linkRatio > EXTRACTOR_CONFIG.MAX_LINK_TEXT_RATIO) {
        score -= 50; // Navigation or link list
    }

    // Bonus for semantic elements
    if (element.find("h1, h2, h3").length > 0) score += 10;
    if (element.find("p").length > 3) score += 10;
    if (element.find("blockquote").length > 0) score += 5;
    if (element.find("ul, ol").length > 0) score += 5;

    // Penalize certain patterns
    if (element.find(".comments, .comment").length > 0) score -= 20;
    if (element.find("form").length > 2) score -= 15;

    return score;
}

/**
 * Find best content element using scoring
 */
function findBestContent($: CheerioAPI): Cheerio<Element> | null {
    let bestElement: Cheerio<Element> | null = null;
    let bestScore = 0;

    // Try priority selectors first
    for (const { selector, score: selectorScore } of CONTENT_SELECTORS) {
        const elements = $(selector);

        elements.each((_, el) => {
            const element = $(el);
            const contentScore = scoreElement($, element);
            const totalScore = contentScore + selectorScore;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestElement = element;
            }
        });
    }

    // If still nothing good, try all divs with decent content
    if (!bestElement || bestScore < 100) {
        $("div").each((_, el) => {
            const element = $(el);
            const contentScore = scoreElement($, element);

            if (contentScore > bestScore) {
                bestScore = contentScore;
                bestElement = element;
            }
        });
    }

    return bestElement;
}

// === Text Cleaning ===

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
    return text
        // Normalize whitespace
        .replace(/\s+/g, " ")
        // Convert multiple newlines to double newline
        .replace(/\n\s*\n\s*\n+/g, "\n\n")
        // Remove leading/trailing whitespace per line
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        // Final trim
        .trim();
}

/**
 * Extract text with better formatting preservation
 */
function extractFormattedText($: CheerioAPI, element: Cheerio<Element>): string {
    // Clone to avoid modifying original
    const clone = element.clone();

    // Add newlines around block elements
    clone.find("p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre").each((_, el) => {
        $(el).before("\n");
        $(el).after("\n");
    });

    // Add newlines for list items
    clone.find("li").each((_, el) => {
        $(el).prepend("• ");
    });

    // Get text and clean
    const text = clone.text();
    return cleanText(text);
}

// === Main Extraction Functions ===

/**
 * Extract clean text content from HTML
 * 
 * @param html - HTML string
 * @returns Extracted and cleaned text content
 * 
 * @example
 * const text = extractCleanText(html);
 */
export function extractCleanText(html: string): string {
    validateHTML(html);

    const $ = cheerio.load(html);

    // Remove noise
    NOISE_SELECTORS.forEach(selector => {
        $(selector).remove();
    });

    // Find best content
    const bestElement = findBestContent($);

    let text: string;

    if (bestElement && bestElement.length > 0) {
        text = extractFormattedText($, bestElement);
    } else {
        // Fallback to body
        text = extractFormattedText($, $("body"));
    }

    // Final validation
    if (!text || text.length < EXTRACTOR_CONFIG.MIN_CONTENT_LENGTH) {
        // Try one more time with minimal processing
        text = cleanText($("body").text());
    }

    return text;
}

/**
 * Extract content with additional metadata
 */
export function extractContent(html: string): ExtractedContent {
    validateHTML(html);

    const $ = cheerio.load(html);

    // Remove noise
    NOISE_SELECTORS.forEach(selector => {
        $(selector).remove();
    });

    // Find best content
    const bestElement = findBestContent($);
    const element = bestElement && bestElement.length > 0 ? bestElement : $("body");

    // Extract text
    const text = extractFormattedText($, element);

    // Get HTML (cleaned)
    const html_content = element.html() || "";

    // Count paragraphs
    const paragraphs = text.split("\n\n").filter(p => p.length > EXTRACTOR_CONFIG.MIN_PARAGRAPH_LENGTH);

    // Detect features
    const hasCode = element.find("pre, code").length > 0;
    const hasTables = element.find("table").length > 0;

    return {
        text,
        html: html_content,
        wordCount: text.split(/\s+/).length,
        charCount: text.length,
        paragraphCount: paragraphs.length,
        hasCode,
        hasTables,
    };
}

/**
 * Extract links with categorization
 * 
 * @param html - HTML string
 * @param baseUrl - Optional base URL for resolving relative links
 * @returns Array of extracted links
 */
export function extractLinks(html: string, baseUrl?: string): Link[] {
    validateHTML(html);

    const $ = cheerio.load(html);
    const links: Link[] = [];
    const seen = new Set<string>(); // Deduplication

    $("a[href]").each((_, el) => {
        let href = $(el).attr("href")?.trim();
        if (!href) return;

        const text = $(el).text().trim();
        const title = $(el).attr("title")?.trim();
        const rel = $(el).attr("rel")?.trim();

        // Skip empty or javascript links
        if (!href || href.startsWith("javascript:") || href.startsWith("#")) {
            return;
        }

        // Resolve relative URLs if base provided
        if (baseUrl && !href.startsWith("http")) {
            try {
                href = new URL(href, baseUrl).href;
            } catch {
                // Invalid URL, skip
                return;
            }
        }

        // Only include http/https links
        if (!href.startsWith("http")) return;

        // Deduplicate
        if (seen.has(href)) return;
        seen.add(href);

        // Categorize link type
        let type: "internal" | "external" | "anchor" = "external";

        if (baseUrl) {
            try {
                const linkUrl = new URL(href);
                const base = new URL(baseUrl);

                if (linkUrl.hostname === base.hostname) {
                    type = "internal";
                }
            } catch {
                // Invalid URL
            }
        }

        if (href.includes("#")) {
            type = "anchor";
        }

        links.push({
            href,
            text: text || href,
            title,
            rel,
            type,
        });
    });

    return links;
}

/**
 * Extract comprehensive metadata
 */
export function extractMetadata(html: string): ExtendedMetadata {
    validateHTML(html);

    const $ = cheerio.load(html);

    // Helper to get meta content
    const getMeta = (selector: string): string | undefined => {
        return $(selector).attr("content")?.trim();
    };

    // Extract Open Graph
    const og: Record<string, string> = {};
    $("meta[property^='og:']").each((_, el) => {
        const property = $(el).attr("property")?.replace("og:", "");
        const content = $(el).attr("content");
        if (property && content) {
            og[property] = content.trim();
        }
    });

    // Extract Twitter Cards
    const twitter: Record<string, string> = {};
    $("meta[name^='twitter:']").each((_, el) => {
        const name = $(el).attr("name")?.replace("twitter:", "");
        const content = $(el).attr("content");
        if (name && content) {
            twitter[name] = content.trim();
        }
    });

    // Extract JSON-LD structured data
    const structuredData: any[] = [];
    $("script[type='application/ld+json']").each((_, el) => {
        try {
            const json = JSON.parse($(el).html() || "{}");
            structuredData.push(json);
        } catch {
            // Invalid JSON, skip
        }
    });

    // Extract keywords
    const keywordsRaw = getMeta("meta[name='keywords']") || "";
    const keywords = keywordsRaw
        .split(",")
        .map(k => k.trim())
        .filter(Boolean);

    // Title with fallback chain
    const title =
        $("title").first().text().trim() ||
        og.title ||
        getMeta("meta[property='og:title']") ||
        getMeta("meta[name='twitter:title']") ||
        $("h1").first().text().trim() ||
        "";

    // Description with fallback chain
    const description =
        getMeta("meta[name='description']") ||
        og.description ||
        getMeta("meta[property='og:description']") ||
        getMeta("meta[name='twitter:description']") ||
        "";

    // Author detection
    const author =
        getMeta("meta[name='author']") ||
        getMeta("meta[property='article:author']") ||
        getMeta("meta[name='twitter:creator']") ||
        $("[rel='author']").text().trim() ||
        $("[itemprop='author']").text().trim();

    // Publication dates
    const publishDate =
        getMeta("meta[property='article:published_time']") ||
        getMeta("meta[name='published_time']") ||
        getMeta("meta[name='date']") ||
        $("time[datetime]").first().attr("datetime");

    const modifiedDate =
        getMeta("meta[property='article:modified_time']") ||
        getMeta("meta[name='modified_time']");

    // Publisher
    const publisher =
        getMeta("meta[property='article:publisher']") ||
        og.site_name;

    // Site name
    const siteName =
        og.site_name ||
        getMeta("meta[property='og:site_name']") ||
        getMeta("meta[name='application-name']");

    // Type
    const type = og.type || "website";

    // URL
    const url =
        og.url ||
        getMeta("meta[property='og:url']") ||
        $("link[rel='canonical']").attr("href");

    // Image
    const image =
        og.image ||
        getMeta("meta[property='og:image']") ||
        getMeta("meta[name='twitter:image']");

    // Technical metadata
    const canonical = $("link[rel='canonical']").attr("href");
    const robots = getMeta("meta[name='robots']");
    const viewport = getMeta("meta[name='viewport']");
    const language =
        $("html").attr("lang") ||
        getMeta("meta[http-equiv='content-language']") ||
        getMeta("meta[name='language']");

    // Calculate reading time
    const bodyText = $("body").text();
    const wordCount = bodyText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / EXTRACTOR_CONFIG.READING_WORDS_PER_MINUTE);

    return {
        title,
        description,
        keywords,
        language,
        author,
        publishDate,
        modifiedDate,
        publisher,
        og,
        twitter,
        structuredData: structuredData.length > 0 ? structuredData : undefined,
        siteName,
        type,
        url,
        image,
        canonical,
        robots,
        viewport,
        wordCount,
        readingTime,
    };
}

/**
 * Extract tables from HTML
 */
export function extractTables(html: string): TableData[] {
    validateHTML(html);

    const $ = cheerio.load(html);
    const tables: TableData[] = [];

    $("table").each((_, table) => {
        const headers: string[] = [];
        const rows: string[][] = [];

        // Extract headers
        $(table).find("thead th, tr:first-child th").each((_, th) => {
            headers.push($(th).text().trim());
        });

        // If no explicit headers, try first row
        if (headers.length === 0) {
            $(table).find("tr:first-child td").each((_, td) => {
                headers.push($(td).text().trim());
            });
        }

        // Extract rows (skip header row if it was used)
        const startRow = headers.length > 0 ? 1 : 0;
        $(table).find("tr").slice(startRow).each((_, tr) => {
            const row: string[] = [];
            $(tr).find("td").each((_, td) => {
                row.push($(td).text().trim());
            });
            if (row.length > 0) {
                rows.push(row);
            }
        });

        if (headers.length > 0 || rows.length > 0) {
            tables.push({ headers, rows });
        }
    });

    return tables;
}

/**
 * Extract code blocks from HTML
 */
export function extractCodeBlocks(html: string): CodeBlock[] {
    validateHTML(html);

    const $ = cheerio.load(html);
    const codeBlocks: CodeBlock[] = [];

    // Pre-formatted code blocks
    $("pre").each((_, pre) => {
        const code = $(pre).find("code").first();
        const text = code.length > 0 ? code.text() : $(pre).text();

        // Detect language from class
        const classAttr = code.attr("class") || $(pre).attr("class") || "";
        const languageMatch = classAttr.match(/language-(\w+)|lang-(\w+)/);
        const language = languageMatch ? (languageMatch[1] || languageMatch[2]) : undefined;

        if (text.trim()) {
            codeBlocks.push({
                language,
                code: text.trim(),
            });
        }
    });

    // Inline code (if no pre blocks found)
    if (codeBlocks.length === 0) {
        $("code").each((_, code) => {
            const text = $(code).text().trim();
            if (text && text.length > 10) { // Only substantial code
                codeBlocks.push({ code: text });
            }
        });
    }

    return codeBlocks;
}

/**
 * Extract all data (convenience function)
 */
export function extractAll(html: string, baseUrl?: string) {
    return {
        content: extractContent(html),
        metadata: extractMetadata(html),
        links: extractLinks(html, baseUrl),
        tables: extractTables(html),
        codeBlocks: extractCodeBlocks(html),
    };
}