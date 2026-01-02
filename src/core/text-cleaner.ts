/**
 * Nuclear-level text cleaner to eliminate ALL binary artifacts and corrupted data
 * This is the most aggressive text cleaning possible while preserving legitimate content
 */

/**
 * Nuclear text cleaner - eliminates ALL suspicious patterns
 * Uses whitelist approach - only allows verified safe characters
 */
export function nuclearCleanText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Step 1: Split into lines and process each separately
  const lines = text.split('\n');
  const cleanLines: string[] = [];

  for (let line of lines) {
    // Step 2: Remove ALL control characters except tab and newline
    line = line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Step 3: Remove ALL high-bit characters that could be binary
    line = line.replace(/[\x80-\xFF]+/g, '');
    
    // Step 4: Remove Unicode replacement/control characters
    line = line.replace(/[\uFFFD\uFEFF\u200B-\u200D\u2060]/g, '');
    
    // Step 5: Remove patterns that look like JavaScript/system artifacts
    line = line.replace(/\bconsole\b/g, '');
    line = line.replace(/\bwarn\b/g, '');
    line = line.replace(/\bTextDecoder\b/g, '');
    line = line.replace(/\bDecompression failed\b/g, '');
    line = line.replace(/\baccessCount\b/g, '');
    line = line.replace(/\blastAccessedAt\b/g, '');
    line = line.replace(/\bhits\b/g, '');
    line = line.replace(/\b_Cache get error\b/g, '');
    line = line.replace(/\bmessage\b/g, '');
    line = line.replace(/\bdecode\b/g, '');
    
    // Step 6: Remove memory address patterns
    line = line.replace(/0x[0-9A-Fa-f]+/g, '');
    line = line.replace(/[0-9A-Fa-f]{8,}/g, '');
    line = line.replace(/@@[A-Z@]+@@/g, '');
    
    // Step 7: Remove repeated special character patterns
    line = line.replace(/[^\w\s]{3,}/g, '');
    line = line.replace(/(.)\1{5,}/g, '$1');
    
    // Step 8: Remove patterns with mixed numbers and symbols
    line = line.replace(/[A-Za-z]\d+[A-Za-z]\d+/g, '');
    line = line.replace(/\d+[^\w\s]\d+[^\w\s]/g, '');
    
    // Step 9: Remove encoding artifacts
    line = line.replace(/â€™/g, "'");
    line = line.replace(/â€œ/g, '"');
    line = line.replace(/â€\x9D/g, '"');
    line = line.replace(/â€"/g, '—');
    line = line.replace(/â€\x93/g, '–');
    line = line.replace(/Â /g, ' ');
    
    // Step 10: Final whitelist - only allow safe printable characters
    line = line.replace(/[^\x09\x20-\x7E\u00A0-\u024F]/g, '');
    
    // Step 11: Clean up whitespace
    line = line.replace(/\s+/g, ' ').trim();
    
    // Only keep lines with actual content
    if (line.length > 0 && !/^[\s\W]*$/.test(line)) {
      cleanLines.push(line);
    }
  }

  // Step 12: Join and final cleanup
  let result = cleanLines.join('\n');
  
  // Step 13: Remove any remaining suspicious patterns
  result = result
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/^\s+|\s+$/g, '')   // Trim
    .replace(/[\x80-\xFF]/g, ''); // Final pass to remove any high-bit chars
    
  return result;
}

/**
 * Sanitize AI response text specifically
 * Removes patterns that commonly appear in corrupted AI responses
 */
export function sanitizeAIResponse(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    // Remove JavaScript/system function references
    .replace(/\b(console|warn|error|log|TextDecoder|Buffer|ArrayBuffer)\b/gi, '')
    // Remove cache-related artifacts
    .replace(/\b(cache|hits|lastAccessed|accessCount|Decompression)\b/gi, '')
    // Remove error message patterns
    .replace(/\b(failed|error|message|decode)\s*:/gi, '')
    // Remove memory/pointer patterns
    .replace(/[0-9A-Fa-f]{6,}/g, '')
    .replace(/\b0x[0-9A-Fa-f]+/g, '')
    // Remove repeated symbols
    .replace(/[^\w\s]{4,}/g, '')
    // Clean up
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Emergency text cleaner - most aggressive possible
 * Only allows basic ASCII printable characters and common punctuation
 */
export function emergencyTextClean(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Only allow: letters, numbers, basic punctuation, spaces, newlines
  return text
    .replace(/[^a-zA-Z0-9\s\.\,\!\?\'\"\-\:\;\(\)\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Detect if text contains suspicious binary artifacts
 */
export function hasBinaryArtifacts(text: string): boolean {
  if (!text) return false;
  
  // Check for common corruption patterns
  const suspiciousPatterns = [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/,  // Control chars
    /[\x80-\xFF]{3,}/,                         // High-bit sequences
    /[0-9A-Fa-f]{8,}/,                        // Hex patterns
    /\b(console|TextDecoder|cache)\b/i,       // System artifacts
    /[^\w\s]{5,}/,                            // Symbol sequences
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(text));
}