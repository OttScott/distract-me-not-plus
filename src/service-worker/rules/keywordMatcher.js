/**
 * Keyword Matcher Module
 *
 * Handles keyword-based URL matching.
 * Wraps src/helpers/regex.js transformKeywords().
 */

import { transformKeywords, regex } from '../../helpers/regex';

/**
 * Compile keywords into regex patterns
 * @param {string[]} keywords - Array of keyword strings
 * @returns {RegExp[]} - Array of compiled regex patterns
 */
export function compileKeywords(keywords) {
  if (!Array.isArray(keywords)) {
    return [];
  }
  // Filter out null/empty keywords before transforming
  const filteredKeywords = keywords.filter(
    (k) => k != null && typeof k === 'string' && k.trim() !== '',
  );
  return transformKeywords(filteredKeywords);
}

/**
 * Test a URL against compiled keyword patterns
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledKeywords - Array of compiled keyword regex patterns
 * @returns {{ matched: boolean, index: number }} - Match result with index
 */
export function testUrlAgainstKeywords(url, compiledKeywords) {
  if (!url || !Array.isArray(compiledKeywords)) {
    return { matched: false, index: -1 };
  }

  for (let i = 0; i < compiledKeywords.length; i++) {
    const keywordPattern = compiledKeywords[i];
    try {
      if (keywordPattern && keywordPattern.test && keywordPattern.test(url)) {
        return { matched: true, index: i };
      }
    } catch (e) {
      console.error('Error testing keyword pattern:', keywordPattern, e);
    }
  }

  return { matched: false, index: -1 };
}

/**
 * Test a URL against keywords and return the matched keyword
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledKeywords - Array of compiled keyword patterns
 * @param {string[]} originalKeywords - Original keyword strings for reporting
 * @returns {{ matched: boolean, keyword: string|null }} - Match result with original keyword
 */
export function testUrlWithKeywordReport(url, compiledKeywords, originalKeywords) {
  const result = testUrlAgainstKeywords(url, compiledKeywords);

  if (result.matched && result.index >= 0) {
    const keyword =
      originalKeywords?.[result.index] || `keyword at index ${result.index}`;
    return { matched: true, keyword };
  }

  return { matched: false, keyword: null };
}

/**
 * Check if a URL contains any deny keywords
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledDenyKeywords - Compiled deny keywords
 * @param {string[]} originalDenyKeywords - Original deny keyword strings
 * @returns {{ matched: boolean, keyword: string|null }}
 */
export function matchesDenyKeywords(url, compiledDenyKeywords, originalDenyKeywords) {
  return testUrlWithKeywordReport(url, compiledDenyKeywords, originalDenyKeywords);
}

/**
 * Check if a URL contains any allow keywords
 * @param {string} url - The URL to test
 * @param {RegExp[]} compiledAllowKeywords - Compiled allow keywords
 * @param {string[]} originalAllowKeywords - Original allow keyword strings
 * @returns {{ matched: boolean, keyword: string|null }}
 */
export function matchesAllowKeywords(url, compiledAllowKeywords, originalAllowKeywords) {
  return testUrlWithKeywordReport(url, compiledAllowKeywords, originalAllowKeywords);
}

/**
 * Parse a single keyword into a regex pattern
 * Exposed for testing and diagnostic purposes
 * @param {string} keyword - Keyword string (can be plain text or /regex/)
 * @returns {RegExp} - Compiled regex
 */
export function parseKeyword(keyword) {
  return regex.parseKeyword(keyword);
}

/**
 * Test if a single keyword matches a URL
 * Utility function for diagnostics
 * @param {string} url - The URL to test
 * @param {string} keyword - The keyword to test
 * @returns {boolean} - True if keyword matches URL
 */
export function testSingleKeyword(url, keyword) {
  try {
    const compiledKeyword = parseKeyword(keyword);
    return compiledKeyword.test(url);
  } catch (e) {
    console.error('Error testing single keyword:', keyword, e);
    return false;
  }
}

/**
 * Extract hostname from URL for keyword matching
 * @param {string} url - The URL
 * @returns {string} - Hostname or empty string
 */
export function extractHostname(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

/**
 * Check if a keyword appears in the hostname portion of a URL
 * More targeted matching for hostname-specific keywords
 * @param {string} url - The URL to test
 * @param {string} keyword - The keyword to search for
 * @returns {boolean} - True if keyword is in hostname
 */
export function keywordInHostname(url, keyword) {
  const hostname = extractHostname(url);
  if (!hostname || !keyword) {
    return false;
  }
  return hostname.toLowerCase().includes(keyword.toLowerCase());
}
