/**
 * Blocking Modes Module
 *
 * Implements the three blocking modes: denylist, allowlist, and combined.
 * Extracted from Background component's isUrlBlocked() and getUrlBlockingDetails().
 */

import { Mode } from '../../helpers/block';
import { isAccessible } from '../../helpers/block';
import { matchesDenylist, matchesAllowlist } from '../rules/patternMatcher';
import { matchesDenyKeywords, matchesAllowKeywords } from '../rules/keywordMatcher';
import { blockDecision, allowDecision, neutralDecision } from './types';

/**
 * @typedef {import('./types').BlockDecision} BlockDecision
 * @typedef {import('./types').BlockSource} BlockSource
 */

/**
 * @typedef {Object} BlockingResult
 * @property {boolean} blocked - Whether the URL should be blocked
 * @property {string} reason - Human-readable reason for the decision
 * @property {string|null} matchedPattern - The pattern/keyword that matched, if any
 * @deprecated Use BlockDecision from types.js instead
 */

/**
 * @typedef {Object} RulesContext
 * @property {RegExp[]} denyPatterns - Compiled deny list patterns
 * @property {RegExp[]} allowPatterns - Compiled allow list patterns
 * @property {RegExp[]} denyKeywords - Compiled deny keywords
 * @property {RegExp[]} allowKeywords - Compiled allow keywords
 * @property {string[]} originalDenyPatterns - Original deny pattern strings
 * @property {string[]} originalAllowPatterns - Original allow pattern strings
 * @property {string[]} originalDenyKeywords - Original deny keyword strings
 * @property {string[]} originalAllowKeywords - Original allow keyword strings
 * @property {Function} isTmpAllowed - Function to check if URL is temporarily allowed
 */

/**
 * Check if URL is temporarily allowed
 * @param {string} url - URL to check
 * @param {Function} isTmpAllowedFn - Function to check temp allowed status
 * @returns {boolean}
 */
function checkTmpAllowed(url, isTmpAllowedFn) {
  if (typeof isTmpAllowedFn === 'function') {
    return isTmpAllowedFn(url);
  }
  return false;
}

/**
 * Check if URL matches deny list (patterns + keywords)
 * @param {string} url - URL to check
 * @param {RulesContext} context - Rules context
 * @returns {{ matched: boolean, pattern: string|null, isKeyword: boolean }}
 */
function checkDenyMatch(url, context) {
  // Check deny patterns
  const patternMatch = matchesDenylist(
    url,
    context.denyPatterns,
    context.originalDenyPatterns,
  );
  if (patternMatch.matched) {
    return { ...patternMatch, isKeyword: false };
  }

  // Check deny keywords
  const keywordMatch = matchesDenyKeywords(
    url,
    context.denyKeywords,
    context.originalDenyKeywords,
  );
  if (keywordMatch.matched) {
    return { matched: true, pattern: keywordMatch.keyword, isKeyword: true };
  }

  return { matched: false, pattern: null, isKeyword: false };
}

/**
 * Check if URL matches allow list (patterns + keywords)
 * @param {string} url - URL to check
 * @param {RulesContext} context - Rules context
 * @returns {{ matched: boolean, pattern: string|null, isKeyword: boolean }}
 */
function checkAllowMatch(url, context) {
  // Always allow inaccessible URLs
  if (!isAccessible(url)) {
    return { matched: true, pattern: 'system allowed (inaccessible)', isKeyword: false };
  }

  // Check allow patterns
  const patternMatch = matchesAllowlist(
    url,
    context.allowPatterns,
    context.originalAllowPatterns,
  );
  if (patternMatch.matched) {
    return { ...patternMatch, isKeyword: false };
  }

  // Check allow keywords
  const keywordMatch = matchesAllowKeywords(
    url,
    context.allowKeywords,
    context.originalAllowKeywords,
  );
  if (keywordMatch.matched) {
    return { matched: true, pattern: keywordMatch.keyword, isKeyword: true };
  }

  return { matched: false, pattern: null, isKeyword: false };
}

/**
 * Evaluate URL in denylist mode
 * Block if URL matches denylist, otherwise allow
 * @param {string} url - URL to evaluate
 * @param {RulesContext} context - Rules context
 * @returns {BlockDecision}
 */
function evaluateDenylistMode(url, context) {
  // Check temp allowed first
  if (checkTmpAllowed(url, context.isTmpAllowed)) {
    return allowDecision('Temporarily allowed', 'tempAllow');
  }

  const denyMatch = checkDenyMatch(url, context);
  if (denyMatch.matched) {
    // Determine if it's a keyword or pattern match
    const isKeyword = denyMatch.keyword !== undefined;
    return blockDecision(
      `pattern: ${denyMatch.pattern}`,
      isKeyword ? 'keyword' : 'legacyDenylist',
      isKeyword
        ? { matchedKeyword: denyMatch.pattern }
        : { matchedPattern: denyMatch.pattern },
    );
  }

  return allowDecision('Not in Deny List', 'legacyDenylist');
}

/**
 * Evaluate URL in allowlist mode
 * Block if URL does NOT match allowlist
 * @param {string} url - URL to evaluate
 * @param {RulesContext} context - Rules context
 * @returns {BlockDecision}
 */
function evaluateAllowlistMode(url, context) {
  // Check temp allowed first
  if (checkTmpAllowed(url, context.isTmpAllowed)) {
    return allowDecision('Temporarily allowed', 'tempAllow');
  }

  // Always allow inaccessible URLs
  if (!isAccessible(url)) {
    return allowDecision('System page (inaccessible)', 'system');
  }

  const allowMatch = checkAllowMatch(url, context);
  if (allowMatch.matched) {
    return allowDecision(
      `Allow pattern: ${allowMatch.pattern}`,
      allowMatch.isKeyword ? 'keyword' : 'legacyAllowlist',
      allowMatch.isKeyword
        ? { matchedKeyword: allowMatch.pattern }
        : { matchedPattern: allowMatch.pattern },
    );
  }

  return blockDecision('Not in Allow List (Allow List mode)', 'legacyAllowlist');
}

/**
 * Evaluate URL in combined mode
 * Check allowlist first (takes precedence), then denylist
 * @param {string} url - URL to evaluate
 * @param {RulesContext} context - Rules context
 * @returns {BlockDecision}
 */
function evaluateCombinedMode(url, context) {
  // Check temp allowed first
  if (checkTmpAllowed(url, context.isTmpAllowed)) {
    return allowDecision('Temporarily allowed', 'tempAllow');
  }

  // Always allow inaccessible URLs
  if (!isAccessible(url)) {
    return allowDecision('System page (inaccessible)', 'system');
  }

  // Check allowlist first - allowlist takes precedence in combined mode
  const allowMatch = checkAllowMatch(url, context);
  if (allowMatch.matched) {
    return allowDecision(
      `Allow pattern: ${allowMatch.pattern}`,
      allowMatch.isKeyword ? 'keyword' : 'legacyAllowlist',
      allowMatch.isKeyword
        ? { matchedKeyword: allowMatch.pattern }
        : { matchedPattern: allowMatch.pattern },
    );
  }

  // Check denylist
  const denyMatch = checkDenyMatch(url, context);
  if (denyMatch.matched) {
    return blockDecision(
      `pattern: ${denyMatch.pattern}`,
      denyMatch.isKeyword ? 'keyword' : 'legacyDenylist',
      denyMatch.isKeyword
        ? { matchedKeyword: denyMatch.pattern }
        : { matchedPattern: denyMatch.pattern },
    );
  }

  // Not in either list - allow by default in combined mode
  return neutralDecision('No matching rules', 'system');
}

/**
 * Evaluate URL blocking based on mode
 * Main entry point for mode-based URL evaluation
 *
 * @param {string} url - URL to evaluate
 * @param {string} mode - Blocking mode (denylist, allowlist, combined)
 * @param {RulesContext} context - Rules context with compiled patterns
 * @returns {BlockDecision}
 */
export function evaluateUrlForMode(url, mode, context) {
  // Normalize mode value (handle legacy blacklist/whitelist values)
  const normalizedMode = normalizeMode(mode);

  switch (normalizedMode) {
    case Mode.denylist:
    case 'denylist':
      return evaluateDenylistMode(url, context);

    case Mode.allowlist:
    case 'allowlist':
      return evaluateAllowlistMode(url, context);

    case Mode.combined:
    case 'combined':
    default:
      return evaluateCombinedMode(url, context);
  }
}

/**
 * Normalize mode value to handle legacy naming
 * @param {string} mode - Mode value
 * @returns {string} - Normalized mode
 */
function normalizeMode(mode) {
  if (!mode) {
    return 'combined';
  }

  const modeStr = String(mode).toLowerCase();

  // Handle legacy values
  if (modeStr === 'blacklist') {
    return 'denylist';
  }
  if (modeStr === 'whitelist') {
    return 'allowlist';
  }

  return modeStr;
}

/**
 * Simple boolean check if URL is blocked (without reason details)
 * @param {string} url - URL to check
 * @param {string} mode - Blocking mode
 * @param {RulesContext} context - Rules context
 * @returns {boolean}
 */
export function isUrlBlocked(url, mode, context) {
  return evaluateUrlForMode(url, mode, context).blocked;
}

// Export mode evaluation functions for direct use if needed
export {
  evaluateDenylistMode,
  evaluateAllowlistMode,
  evaluateCombinedMode,
  normalizeMode,
};
