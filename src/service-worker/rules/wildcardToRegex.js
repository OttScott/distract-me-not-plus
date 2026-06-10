/**
 * Wildcard to Regex Conversion Module
 *
 * Handles conversion of wildcard URL patterns to RegExp.
 * This is a thin wrapper exposing the regex conversion logic
 * from helpers/regex.js for direct use.
 */

import { regex } from '../../helpers/regex';

/**
 * Convert a wildcard pattern to a regex-ready string
 * Handles protocol defaults and trailing wildcards
 * @param {string} pattern - Wildcard pattern (e.g., "*.example.com", "example.com/path/*")
 * @returns {string} - Regex-ready pattern string
 */
export function wildcardToRegexString(pattern) {
  return regex.wildcard(pattern);
}

/**
 * Convert a wildcard pattern to a compiled RegExp
 * @param {string} pattern - Wildcard pattern
 * @returns {RegExp} - Compiled regex
 */
export function wildcardToRegex(pattern) {
  const wildcardPattern = regex.wildcard(pattern);
  return regex.parseUrl(wildcardPattern);
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeRegex(str) {
  return regex.escape(str);
}

/**
 * Create a RegExp from a pattern string
 * Handles error cases gracefully
 * @param {string} pattern - Pattern string
 * @param {string} flags - Regex flags
 * @returns {RegExp|string} - Compiled regex or original string on error
 */
export function createRegex(pattern, flags) {
  return regex.create(pattern, flags);
}

/**
 * Parse a URL pattern that may already be in regex format
 * Detects patterns starting with ^ as raw regex
 * @param {string} urlPattern - URL or regex pattern
 * @returns {RegExp} - Compiled regex
 */
export function parseUrlPattern(urlPattern) {
  return regex.parseUrl(urlPattern);
}

/**
 * Check if a pattern is already in regex format
 * @param {string} pattern - Pattern to check
 * @returns {boolean} - True if pattern starts with ^
 */
export function isRegexPattern(pattern) {
  return typeof pattern === 'string' && pattern.startsWith('^');
}

/**
 * Normalize a URL pattern for consistent matching
 * @param {string} pattern - URL pattern
 * @returns {string} - Normalized pattern
 */
export function normalizePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return '';
  }
  return pattern.trim().toLowerCase();
}
