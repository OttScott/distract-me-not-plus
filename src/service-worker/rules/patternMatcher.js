/**
 * Pattern Matcher Module
 *
 * Wrapper around src/helpers/regex.js for URL pattern matching.
 * Handles compilation and testing of deny/allow patterns.
 */

import { transformList, regex } from '../../helpers/regex';

/**
 * Compile deny list patterns into regex patterns
 * @param {string[]} patterns - Array of wildcard patterns
 * @returns {RegExp[]} - Array of compiled regex patterns
 */
export function compileDenyPatterns(patterns) {
  if (!Array.isArray(patterns)) {
    return [];
  }
  // Filter out null/empty patterns before transforming
  const filteredPatterns = patterns.filter(
    (p) => p != null && typeof p === 'string' && p.trim() !== '',
  );
  return transformList(filteredPatterns);
}

/**
 * Compile allow list patterns into regex patterns
 * @param {string[]} patterns - Array of wildcard patterns
 * @returns {RegExp[]} - Array of compiled regex patterns
 */
export function compileAllowPatterns(patterns) {
  if (!Array.isArray(patterns)) {
    return [];
  }
  // Filter out null/empty patterns before transforming
  const filteredPatterns = patterns.filter(
    (p) => p != null && typeof p === 'string' && p.trim() !== '',
  );
  return transformList(filteredPatterns);
}

/**
 * Test a URL against compiled patterns
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledPatterns - Array of compiled regex patterns
 * @returns {{ matched: boolean, index: number }} - Match result with index of matched pattern
 */
export function testUrlAgainstPatterns(url, compiledPatterns) {
  if (!url || !Array.isArray(compiledPatterns)) {
    return { matched: false, index: -1 };
  }

  for (let i = 0; i < compiledPatterns.length; i++) {
    const pattern = compiledPatterns[i];
    try {
      if (pattern && pattern.test && pattern.test(url)) {
        return { matched: true, index: i };
      }
    } catch (e) {
      console.error('Error testing pattern:', pattern, e);
    }
  }

  return { matched: false, index: -1 };
}

/**
 * Test a URL against patterns and return the matched pattern
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledPatterns - Array of compiled regex patterns
 * @param {string[]} originalPatterns - Original pattern strings for reporting
 * @returns {{ matched: boolean, pattern: string|null }} - Match result with original pattern
 */
export function testUrlWithPatternReport(url, compiledPatterns, originalPatterns) {
  const result = testUrlAgainstPatterns(url, compiledPatterns);

  if (result.matched && result.index >= 0) {
    const pattern =
      originalPatterns?.[result.index] || `pattern at index ${result.index}`;
    return { matched: true, pattern };
  }

  return { matched: false, pattern: null };
}

/**
 * Check if a URL matches any deny list patterns
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledDenyPatterns - Compiled deny patterns
 * @param {string[]} originalDenyPatterns - Original deny pattern strings
 * @returns {{ matched: boolean, pattern: string|null }}
 */
export function matchesDenylist(url, compiledDenyPatterns, originalDenyPatterns) {
  return testUrlWithPatternReport(url, compiledDenyPatterns, originalDenyPatterns);
}

/**
 * Check if a URL matches any allow list patterns
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledAllowPatterns - Compiled allow patterns
 * @param {string[]} originalAllowPatterns - Original allow pattern strings
 * @returns {{ matched: boolean, pattern: string|null }}
 */
export function matchesAllowlist(url, compiledAllowPatterns, originalAllowPatterns) {
  return testUrlWithPatternReport(url, compiledAllowPatterns, originalAllowPatterns);
}

/**
 * Convert a wildcard pattern to a regex pattern
 * Exposed for testing and diagnostic purposes
 * @param {string} pattern - Wildcard pattern
 * @returns {RegExp} - Compiled regex
 */
export function wildcardToRegex(pattern) {
  const wildcardPattern = regex.wildcard(pattern);
  return regex.parseUrl(wildcardPattern);
}

/**
 * Test if a single pattern matches a URL
 * Utility function for diagnostics
 * @param {string} url - The URL to test
 * @param {string} pattern - The wildcard pattern
 * @returns {boolean} - True if pattern matches URL
 */
export function testSinglePattern(url, pattern) {
  try {
    const compiledPattern = wildcardToRegex(pattern);
    return compiledPattern.test(url);
  } catch (e) {
    console.error('Error testing single pattern:', pattern, e);
    return false;
  }
}
