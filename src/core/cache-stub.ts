/**
 * Cache System - Disabled
 * 
 * All cache functionality has been temporarily disabled to eliminate
 * corruption issues. Functions return no-op or bypass values.
 */

// Stub functions to maintain API compatibility
export function getCacheKey(url: string, options: any = {}): string {
  // Return empty string to indicate no caching
  return "";
}

export async function getCache(key: string): Promise<string | null> {
  // Always return null (cache miss)
  return null;
}

export async function setCache(key: string, value: string): Promise<void> {
  // No-op: don't cache anything
  return;
}

export async function clearCache(): Promise<void> {
  // No-op: nothing to clear
  return;
}