/**
 * Language Detection Module
 * 
 * Smart language detection using multiple signals:
 * - URL patterns (/fr, /es, ?lang=fr, etc.)
 * - HTML lang attributes
 * - Content-based detection
 * - Domain patterns (example.fr, example.es)
 */

import * as cheerio from "cheerio";

// Supported languages mapping
export const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'fr': 'French', 
  'es': 'Spanish',
  'ht': 'Haitian Creole'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Language detection result
export interface LanguageDetectionResult {
  detected: SupportedLanguage;
  confidence: 'high' | 'medium' | 'low';
  source: 'url' | 'html' | 'content' | 'default';
  signals: string[];
}

/**
 * Detect language from URL patterns
 */
function detectLanguageFromURL(url: string): { lang: SupportedLanguage | null; confidence: 'high' | 'medium' } {
  const urlObj = new URL(url);
  
  // Check URL path segments (/fr/, /es/, /en/)
  const pathSegments = urlObj.pathname.toLowerCase().split('/').filter(Boolean);
  for (const segment of pathSegments) {
    if (segment === 'fr' || segment === 'french') return { lang: 'fr', confidence: 'high' };
    if (segment === 'es' || segment === 'spanish' || segment === 'espanol') return { lang: 'es', confidence: 'high' };
    if (segment === 'ht' || segment === 'haitian' || segment === 'kreyol') return { lang: 'ht', confidence: 'high' };
    if (segment === 'en' || segment === 'english') return { lang: 'en', confidence: 'high' };
  }
  
  // Check query parameters (?lang=fr, ?locale=es, etc.)
  const langParam = urlObj.searchParams.get('lang') || 
                    urlObj.searchParams.get('language') ||
                    urlObj.searchParams.get('locale') ||
                    urlObj.searchParams.get('hl'); // Google uses 'hl'
                    
  if (langParam) {
    const normalized = langParam.toLowerCase().slice(0, 2);
    if (normalized in SUPPORTED_LANGUAGES) {
      return { lang: normalized as SupportedLanguage, confidence: 'high' };
    }
  }
  
  // Check domain TLD (.fr, .es, .ht)
  const domain = urlObj.hostname.toLowerCase();
  if (domain.endsWith('.fr')) return { lang: 'fr', confidence: 'medium' };
  if (domain.endsWith('.es')) return { lang: 'es', confidence: 'medium' };
  if (domain.endsWith('.ht')) return { lang: 'ht', confidence: 'medium' };
  
  // Check subdomain (fr.example.com, es.example.com)
  const subdomain = domain.split('.')[0];
  if (subdomain === 'fr') return { lang: 'fr', confidence: 'medium' };
  if (subdomain === 'es') return { lang: 'es', confidence: 'medium' };
  if (subdomain === 'ht') return { lang: 'ht', confidence: 'medium' };
  
  return { lang: null, confidence: 'medium' };
}

/**
 * Detect language from HTML attributes
 */
function detectLanguageFromHTML(html: string): { lang: SupportedLanguage | null; confidence: 'high' | 'medium' } {
  try {
    const $ = cheerio.load(html);
    
    // Check <html lang="...">
    const htmlLang = $('html').attr('lang')?.toLowerCase().slice(0, 2);
    if (htmlLang && htmlLang in SUPPORTED_LANGUAGES) {
      return { lang: htmlLang as SupportedLanguage, confidence: 'high' };
    }
    
    // Check meta tags
    const contentLanguage = $('meta[http-equiv="content-language"]').attr('content')?.toLowerCase().slice(0, 2);
    if (contentLanguage && contentLanguage in SUPPORTED_LANGUAGES) {
      return { lang: contentLanguage as SupportedLanguage, confidence: 'high' };
    }
    
    // Check Open Graph locale
    const ogLocale = $('meta[property="og:locale"]').attr('content')?.toLowerCase().slice(0, 2);
    if (ogLocale && ogLocale in SUPPORTED_LANGUAGES) {
      return { lang: ogLocale as SupportedLanguage, confidence: 'medium' };
    }
    
    // Check language meta tag
    const languageMeta = $('meta[name="language"]').attr('content')?.toLowerCase().slice(0, 2);
    if (languageMeta && languageMeta in SUPPORTED_LANGUAGES) {
      return { lang: languageMeta as SupportedLanguage, confidence: 'medium' };
    }
    
  } catch (error) {
    // Ignore parsing errors
  }
  
  return { lang: null, confidence: 'medium' };
}

/**
 * Simple content-based language detection
 * Looks for common words and patterns
 */
function detectLanguageFromContent(text: string): { lang: SupportedLanguage | null; confidence: 'low' | 'medium' } {
  // Normalize text for analysis
  const normalizedText = text.toLowerCase().slice(0, 1000); // Check first 1000 chars
  
  // Language fingerprints - common words that indicate language
  const languagePatterns = {
    fr: {
      words: ['le', 'la', 'les', 'de', 'et', 'est', 'un', 'une', 'pour', 'dans', 'avec', 'sur', 'par', 'vous', 'nous', 'ils', 'elle'],
      patterns: [/\bqu'/g, /\bd'/g, /\bl'/g, /\bc'/g], // French contractions
      score: 0
    },
    es: {
      words: ['el', 'la', 'los', 'las', 'de', 'y', 'es', 'en', 'por', 'para', 'con', 'un', 'una', 'que', 'del'],
      patterns: [/ñ/g, /¿/g, /¡/g], // Spanish-specific characters
      score: 0
    },
    ht: {
      words: ['nan', 'ak', 'pou', 'yo', 'li', 'nou', 'mwen', 'ou', 'se', 'ki', 'gen', 'bay', 'fè', 'ka'],
      patterns: [/\bm'/g, /\bl'/g, /\bn'/g], // Haitian Creole contractions
      score: 0
    },
    en: {
      words: ['the', 'is', 'at', 'of', 'and', 'to', 'in', 'for', 'with', 'on', 'by', 'from', 'up', 'about', 'into'],
      patterns: [/\b(you|your|you're|you'll)\b/g, /\b(it's|isn't|aren't|won't)\b/g],
      score: 0
    }
  };
  
  // Count occurrences of language-specific indicators
  for (const [lang, data] of Object.entries(languagePatterns)) {
    // Check common words
    for (const word of data.words) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        data.score += matches.length * 2; // Weight word matches heavily
      }
    }
    
    // Check patterns
    for (const pattern of data.patterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        data.score += matches.length;
      }
    }
  }
  
  // Find language with highest score
  let detectedLang: SupportedLanguage | null = null;
  let highestScore = 10; // Minimum threshold
  
  for (const [lang, data] of Object.entries(languagePatterns)) {
    if (data.score > highestScore) {
      highestScore = data.score;
      detectedLang = lang as SupportedLanguage;
    }
  }
  
  // Determine confidence based on score difference
  const scores = Object.values(languagePatterns).map(d => d.score).sort((a, b) => b - a);
  const scoreDifference = scores[0]! - scores[1]!;
  
  const confidence = scoreDifference > 20 ? 'medium' : 'low';
  
  return { lang: detectedLang, confidence };
}

/**
 * Main language detection function
 * Combines multiple detection methods for best accuracy
 */
export function detectLanguage(
  url: string, 
  html?: string,
  content?: string,
  userSpecifiedLang?: string
): LanguageDetectionResult {
  const signals: string[] = [];
  
  // Priority 1: User-specified language (always wins)
  if (userSpecifiedLang && userSpecifiedLang in SUPPORTED_LANGUAGES) {
    return {
      detected: userSpecifiedLang as SupportedLanguage,
      confidence: 'high',
      source: 'url',
      signals: ['user-specified']
    };
  }
  
  // Priority 2: URL detection (most explicit)
  const urlResult = detectLanguageFromURL(url);
  if (urlResult.lang) {
    signals.push(`URL: ${urlResult.lang}`);
    if (urlResult.confidence === 'high') {
      return {
        detected: urlResult.lang,
        confidence: 'high',
        source: 'url',
        signals
      };
    }
  }
  
  // Priority 3: HTML lang attribute (author's intent)
  if (html) {
    const htmlResult = detectLanguageFromHTML(html);
    if (htmlResult.lang) {
      signals.push(`HTML: ${htmlResult.lang}`);
      if (htmlResult.confidence === 'high') {
        return {
          detected: htmlResult.lang,
          confidence: urlResult.lang === htmlResult.lang ? 'high' : 'medium',
          source: 'html',
          signals
        };
      }
    }
  }
  
  // Priority 4: Content-based detection (fallback)
  if (content) {
    const contentResult = detectLanguageFromContent(content);
    if (contentResult.lang) {
      signals.push(`Content: ${contentResult.lang}`);
      
      // If URL and content agree, boost confidence
      const confidence = urlResult.lang === contentResult.lang ? 'medium' : contentResult.confidence;
      
      return {
        detected: contentResult.lang,
        confidence,
        source: 'content',
        signals
      };
    }
  }
  
  // If we found any URL hint, use it with low confidence
  if (urlResult.lang) {
    return {
      detected: urlResult.lang,
      confidence: 'low',
      source: 'url',
      signals
    };
  }
  
  // Default to English
  return {
    detected: 'en',
    confidence: 'low',
    source: 'default',
    signals: ['fallback to English']
  };
}

/**
 * Check if auto-detection should be enabled
 * (can be controlled by environment variable or config)
 */
export function shouldAutoDetectLanguage(): boolean {
  // Can be controlled via env variable if needed
  return process.env.DISABLE_LANGUAGE_DETECTION !== 'true';
}

/**
 * Get language name for display
 */
export function getLanguageName(code: SupportedLanguage): string {
  return SUPPORTED_LANGUAGES[code] || 'Unknown';
}