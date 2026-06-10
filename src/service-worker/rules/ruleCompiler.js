/**
 * Rule Compiler Module
 *
 * Compiles rules from storage format to match-ready format.
 * Handles transformation of raw pattern/keyword arrays into
 * compiled regex patterns ready for URL matching.
 */

import { compileDenyPatterns, compileAllowPatterns } from './patternMatcher';
import { compileKeywords } from './keywordMatcher';

/**
 * @typedef {Object} CompiledRules
 * @property {RegExp[]} denyPatterns - Compiled deny list patterns
 * @property {RegExp[]} allowPatterns - Compiled allow list patterns
 * @property {RegExp[]} denyKeywords - Compiled deny keywords
 * @property {RegExp[]} allowKeywords - Compiled allow keywords
 * @property {string[]} originalDenyPatterns - Original deny pattern strings
 * @property {string[]} originalAllowPatterns - Original allow pattern strings
 * @property {string[]} originalDenyKeywords - Original deny keyword strings
 * @property {string[]} originalAllowKeywords - Original allow keyword strings
 */

/**
 * Filter out invalid patterns (null, undefined, empty strings)
 * @param {any[]} patterns - Array of patterns
 * @returns {string[]} - Filtered array of valid string patterns
 */
function filterValidPatterns(patterns) {
  if (!Array.isArray(patterns)) {
    return [];
  }
  return patterns.filter((p) => p != null && typeof p === 'string' && p.trim() !== '');
}

/**
 * Compile all rules from raw storage format
 * @param {Object} rawRules - Rules from storage
 * @param {string[]} rawRules.blacklist - Deny list patterns (storage key)
 * @param {string[]} rawRules.whitelist - Allow list patterns (storage key)
 * @param {string[]} rawRules.blacklistKeywords - Deny keywords (storage key)
 * @param {string[]} rawRules.whitelistKeywords - Allow keywords (storage key)
 * @returns {CompiledRules} - Compiled rules ready for matching
 */
export function compileRules(rawRules) {
  const {
    blacklist = [],
    whitelist = [],
    blacklistKeywords = [],
    whitelistKeywords = [],
  } = rawRules || {};

  // Filter valid patterns
  const originalDenyPatterns = filterValidPatterns(blacklist);
  const originalAllowPatterns = filterValidPatterns(whitelist);
  const originalDenyKeywords = filterValidPatterns(blacklistKeywords);
  const originalAllowKeywords = filterValidPatterns(whitelistKeywords);

  // Compile patterns
  const denyPatterns = compileDenyPatterns(originalDenyPatterns);
  const allowPatterns = compileAllowPatterns(originalAllowPatterns);
  const denyKeywords = compileKeywords(originalDenyKeywords);
  const allowKeywords = compileKeywords(originalAllowKeywords);

  return {
    denyPatterns,
    allowPatterns,
    denyKeywords,
    allowKeywords,
    originalDenyPatterns,
    originalAllowPatterns,
    originalDenyKeywords,
    originalAllowKeywords,
  };
}

/**
 * Compile rules using internal terminology (denylist/allowlist)
 * @param {Object} rules - Rules with internal naming
 * @param {string[]} rules.denylist - Deny list patterns
 * @param {string[]} rules.allowlist - Allow list patterns
 * @param {string[]} rules.denylistKeywords - Deny keywords
 * @param {string[]} rules.allowlistKeywords - Allow keywords
 * @returns {CompiledRules} - Compiled rules ready for matching
 */
export function compileRulesInternal(rules) {
  const {
    denylist = [],
    allowlist = [],
    denylistKeywords = [],
    allowlistKeywords = [],
  } = rules || {};

  return compileRules({
    blacklist: denylist,
    whitelist: allowlist,
    blacklistKeywords: denylistKeywords,
    whitelistKeywords: allowlistKeywords,
  });
}

/**
 * Create an empty compiled rules object
 * @returns {CompiledRules} - Empty compiled rules
 */
export function createEmptyRules() {
  return {
    denyPatterns: [],
    allowPatterns: [],
    denyKeywords: [],
    allowKeywords: [],
    originalDenyPatterns: [],
    originalAllowPatterns: [],
    originalDenyKeywords: [],
    originalAllowKeywords: [],
  };
}

/**
 * Merge two compiled rule sets
 * @param {CompiledRules} rules1 - First rule set
 * @param {CompiledRules} rules2 - Second rule set
 * @returns {CompiledRules} - Merged rules
 */
export function mergeCompiledRules(rules1, rules2) {
  return {
    denyPatterns: [...rules1.denyPatterns, ...rules2.denyPatterns],
    allowPatterns: [...rules1.allowPatterns, ...rules2.allowPatterns],
    denyKeywords: [...rules1.denyKeywords, ...rules2.denyKeywords],
    allowKeywords: [...rules1.allowKeywords, ...rules2.allowKeywords],
    originalDenyPatterns: [
      ...rules1.originalDenyPatterns,
      ...rules2.originalDenyPatterns,
    ],
    originalAllowPatterns: [
      ...rules1.originalAllowPatterns,
      ...rules2.originalAllowPatterns,
    ],
    originalDenyKeywords: [
      ...rules1.originalDenyKeywords,
      ...rules2.originalDenyKeywords,
    ],
    originalAllowKeywords: [
      ...rules1.originalAllowKeywords,
      ...rules2.originalAllowKeywords,
    ],
  };
}

/**
 * Get summary statistics for compiled rules
 * @param {CompiledRules} rules - Compiled rules
 * @returns {Object} - Summary statistics
 */
export function getRulesSummary(rules) {
  return {
    denyPatternCount: rules.denyPatterns?.length || 0,
    allowPatternCount: rules.allowPatterns?.length || 0,
    denyKeywordCount: rules.denyKeywords?.length || 0,
    allowKeywordCount: rules.allowKeywords?.length || 0,
    totalRules:
      (rules.denyPatterns?.length || 0) +
      (rules.allowPatterns?.length || 0) +
      (rules.denyKeywords?.length || 0) +
      (rules.allowKeywords?.length || 0),
  };
}
