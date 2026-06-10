/**
 * URL Deduplication Cache Module
 *
 * Provides a Set-based URL cache to prevent redundant blocking checks.
 * Extracted from service-worker.js blockedUrls Set (line 895).
 */

/**
 * URL cache for deduplication
 * Stores URLs that have been determined to need blocking
 */
let blockedUrlCache = new Set();

/**
 * Maximum cache size to prevent memory issues
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Add a URL to the blocked cache
 * @param {string} url - URL to add
 */
export function addToCache(url) {
  if (!url) return;

  // Enforce max size by clearing if exceeded
  if (blockedUrlCache.size >= MAX_CACHE_SIZE) {
    clearCache();
  }

  blockedUrlCache.add(url);
}

/**
 * Check if a URL is in the blocked cache
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isInCache(url) {
  if (!url) return false;
  return blockedUrlCache.has(url);
}

/**
 * Remove a URL from the cache
 * @param {string} url - URL to remove
 */
export function removeFromCache(url) {
  if (!url) return;
  blockedUrlCache.delete(url);
}

/**
 * Clear the entire cache
 */
export function clearCache() {
  blockedUrlCache.clear();
}

/**
 * Get the current cache size
 * @returns {number}
 */
export function getCacheSize() {
  return blockedUrlCache.size;
}

/**
 * Get all cached URLs (for diagnostics)
 * @returns {string[]}
 */
export function getCachedUrls() {
  return Array.from(blockedUrlCache);
}

/**
 * Check and add URL to cache in one operation
 * Returns true if URL was already in cache
 * @param {string} url - URL to check and add
 * @returns {boolean} - True if URL was already cached
 */
export function checkAndAdd(url) {
  if (!url) return false;

  const wasInCache = blockedUrlCache.has(url);

  if (!wasInCache) {
    addToCache(url);
  }

  return wasInCache;
}

/**
 * Add both original and normalized URL to cache
 * @param {string} originalUrl - Original URL
 * @param {string} normalizedUrl - Normalized URL
 */
export function addUrlPair(originalUrl, normalizedUrl) {
  if (originalUrl) {
    addToCache(originalUrl);
  }
  if (normalizedUrl && normalizedUrl !== originalUrl) {
    addToCache(normalizedUrl);
  }
}

/**
 * Check if either original or normalized URL is in cache
 * @param {string} originalUrl - Original URL
 * @param {string} normalizedUrl - Normalized URL
 * @returns {boolean}
 */
export function isEitherInCache(originalUrl, normalizedUrl) {
  return isInCache(originalUrl) || isInCache(normalizedUrl);
}

/**
 * Normalize a URL for consistent caching
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
export function normalizeUrl(url) {
  if (!url) return '';

  try {
    const parsedUrl = new URL(url);
    // Basic normalization - can be extended as needed
    return parsedUrl.href;
  } catch (e) {
    // If parsing fails, return original
    return url;
  }
}

/**
 * Create a new isolated cache instance
 * Useful for testing or isolated contexts
 * @returns {Object} - Cache instance with all methods
 */
export function createCache() {
  const cache = new Set();

  return {
    add: (url) => {
      if (url && cache.size < MAX_CACHE_SIZE) {
        cache.add(url);
      }
    },
    has: (url) => url && cache.has(url),
    delete: (url) => url && cache.delete(url),
    clear: () => cache.clear(),
    size: () => cache.size,
    getAll: () => Array.from(cache),
  };
}

// Export the global cache operations as default
const dedupeModule = {
  addToCache,
  isInCache,
  removeFromCache,
  clearCache,
  getCacheSize,
  getCachedUrls,
  checkAndAdd,
  addUrlPair,
  isEitherInCache,
  normalizeUrl,
  createCache,
};
export default dedupeModule;
