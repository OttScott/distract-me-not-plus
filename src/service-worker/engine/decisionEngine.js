/**
 * Decision Engine Module
 *
 * The core URL blocking decision logic that combines:
 * - Mode evaluation (denylist, allowlist, combined)
 * - Schedule checking
 * - Timer state
 * - Temporary allow state
 *
 * This is the central decision point for whether a URL should be blocked.
 */

import { evaluateUrlForMode } from './blockingModes';
import { isAccessible } from '../../helpers/block';
import { allowDecision } from './types';

/**
 * @typedef {import('./types').BlockDecision} BlockDecision
 */

/**
 * @typedef {Object} DecisionState
 * @property {boolean} isEnabled - Whether blocking is enabled
 * @property {string} mode - Blocking mode (denylist, allowlist, combined)
 * @property {RegExp[]} denyPatterns - Compiled deny patterns
 * @property {RegExp[]} allowPatterns - Compiled allow patterns
 * @property {RegExp[]} denyKeywords - Compiled deny keywords
 * @property {RegExp[]} allowKeywords - Compiled allow keywords
 * @property {string[]} originalDenyPatterns - Original deny pattern strings
 * @property {string[]} originalAllowPatterns - Original allow pattern strings
 * @property {string[]} originalDenyKeywords - Original deny keyword strings
 * @property {string[]} originalAllowKeywords - Original allow keyword strings
 * @property {Object} schedule - Schedule configuration
 * @property {Object} timer - Timer state
 * @property {Array} tmpAllowed - Temporarily allowed URLs/hostnames
 */

/**
 * @typedef {Object} DecisionResult
 * @property {boolean} blocked - Whether the URL should be blocked
 * @property {string} reason - Human-readable reason for the decision
 * @property {string|null} matchedPattern - The pattern/keyword that matched
 * @deprecated Use BlockDecision from types.js instead
 */

/**
 * Check if URL is a browser internal page
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isInternalBrowserPage(url) {
  return (
    url.startsWith('edge://') ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('extension://') ||
    url.startsWith('about:')
  );
}

/**
 * Check if URL is the extension's own page
 * @param {string} url - URL to check
 * @param {string} indexUrl - Extension's index URL
 * @returns {boolean}
 */
function isExtensionPage(url, indexUrl) {
  return indexUrl && url.startsWith(indexUrl);
}

/**
 * Check if timer is currently active
 * @param {Object} timer - Timer state
 * @returns {boolean}
 */
function isTimerActive(timer) {
  if (!timer || !timer.isEnabled) {
    return false;
  }

  const now = Date.now();
  const endDate = timer.runtime?.endDate || 0;

  return endDate > now;
}

/**
 * Check if URL is temporarily allowed
 * @param {string} url - URL to check
 * @param {Array} tmpAllowed - Array of temp allowed entries
 * @returns {boolean}
 */
function isTmpAllowed(url, tmpAllowed) {
  if (!Array.isArray(tmpAllowed) || tmpAllowed.length === 0) {
    return false;
  }

  const now = Date.now();

  // Extract hostname from URL for comparison
  let hostname = '';
  try {
    hostname = new URL(url).hostname.split('.').slice(-2).join('.');
  } catch (e) {
    // If URL parsing fails, use regex fallback
    hostname = url.replace(/^(?:.*:\/\/)?(?:(?:www|m|\*)\.)?([^/]+).*/i, '$1');
  }

  // Check if any temp allowed entry matches and is still valid
  for (const allowed of tmpAllowed) {
    const isExpired = now > allowed.startedAt + allowed.time;
    if (!isExpired && allowed.hostname === hostname) {
      return true;
    }
  }

  return false;
}

/**
 * Check if current time is within allowed schedule
 * NOTE: This wraps the schedule helper logic from Background component
 *
 * @param {Object} schedule - Schedule configuration
 * @param {Function} getTodayScheduleFn - Function to get today's schedule
 * @param {Function} isScheduleAllowedFn - Function to check if schedule allows
 * @returns {{ isAllowedTime: boolean, todaySchedule: any }}
 */
function checkSchedule(schedule, getTodayScheduleFn, isScheduleAllowedFn) {
  if (!schedule || !schedule.isEnabled) {
    // No schedule configured - don't block based on schedule
    return { isAllowedTime: false, todaySchedule: null };
  }

  // Get today's schedule
  const todaySchedule = getTodayScheduleFn ? getTodayScheduleFn(schedule) : null;

  // Check if current time is in allowed time
  const isAllowedTime = isScheduleAllowedFn ? isScheduleAllowedFn(todaySchedule) : false;

  return { isAllowedTime, todaySchedule };
}

/**
 * Main decision function - checks if a URL should be blocked
 *
 * Incorporates:
 * - Extension enabled state
 * - Schedule check (from Background's parseUrl, lines 1062-1090)
 * - Timer check (from Background's isTimerActive influence)
 * - Mode-based evaluation
 *
 * @param {string} url - URL to check
 * @param {DecisionState} state - Current state
 * @param {Object} options - Optional helpers
 * @param {Function} options.getTodaySchedule - Schedule helper
 * @param {Function} options.isScheduleAllowed - Schedule helper
 * @param {string} options.indexUrl - Extension index URL (to skip)
 * @returns {BlockDecision}
 */
export function checkUrlShouldBeBlocked(url, state, options = {}) {
  const { getTodaySchedule, isScheduleAllowed, indexUrl } = options;

  // Early return for invalid URL
  if (!url) {
    return allowDecision('No URL provided', 'system');
  }

  // Skip internal browser pages
  if (isInternalBrowserPage(url)) {
    return allowDecision('Internal browser page', 'system');
  }

  // Skip extension's own pages
  if (isExtensionPage(url, indexUrl)) {
    return allowDecision('Extension page', 'system');
  }

  // Skip inaccessible URLs
  if (!isAccessible(url)) {
    return allowDecision('Inaccessible URL', 'system');
  }

  // Check if extension is enabled
  if (!state.isEnabled) {
    return allowDecision('Extension disabled', 'system');
  }

  // Handle schedule (unless timer is active, which overrides schedule)
  if (!isTimerActive(state.timer)) {
    const { isAllowedTime, todaySchedule: _todaySchedule } = checkSchedule(
      state.schedule,
      getTodaySchedule,
      isScheduleAllowed,
    );

    if (isAllowedTime) {
      return allowDecision('Not in scheduled blocking time', 'schedule');
    }
  }

  // Build rules context for mode evaluation
  const rulesContext = {
    denyPatterns: state.denyPatterns || [],
    allowPatterns: state.allowPatterns || [],
    denyKeywords: state.denyKeywords || [],
    allowKeywords: state.allowKeywords || [],
    originalDenyPatterns: state.originalDenyPatterns || [],
    originalAllowPatterns: state.originalAllowPatterns || [],
    originalDenyKeywords: state.originalDenyKeywords || [],
    originalAllowKeywords: state.originalAllowKeywords || [],
    isTmpAllowed: (checkUrl) => isTmpAllowed(checkUrl, state.tmpAllowed),
  };

  // Evaluate based on mode
  return evaluateUrlForMode(url, state.mode, rulesContext);
}

/**
 * Simplified check for whether URL is still blocked
 * Used for re-checking URLs after state changes
 *
 * @param {string} url - URL to check
 * @param {DecisionState} state - Current state
 * @param {Object} options - Optional helpers
 * @returns {boolean}
 */
export function isUrlStillBlocked(url, state, options = {}) {
  if (!state.isEnabled) {
    return false;
  }

  const result = checkUrlShouldBeBlocked(url, state, options);
  return result.blocked;
}

/**
 * Get detailed blocking information for diagnostics
 * @param {string} url - URL to check
 * @param {DecisionState} state - Current state
 * @param {Object} options - Optional helpers
 * @returns {Object} - Detailed blocking info
 */
export function getBlockingDiagnostics(url, state, options = {}) {
  const result = checkUrlShouldBeBlocked(url, state, options);

  return {
    url,
    ...result,
    state: {
      isEnabled: state.isEnabled,
      mode: state.mode,
      timerActive: isTimerActive(state.timer),
      scheduleEnabled: state.schedule?.isEnabled || false,
      tmpAllowedCount: state.tmpAllowed?.length || 0,
      denyPatternCount: state.denyPatterns?.length || 0,
      allowPatternCount: state.allowPatterns?.length || 0,
      denyKeywordCount: state.denyKeywords?.length || 0,
      allowKeywordCount: state.allowKeywords?.length || 0,
    },
  };
}

// Export helper functions for testing
export {
  isInternalBrowserPage,
  isExtensionPage,
  isTimerActive,
  isTmpAllowed,
  checkSchedule,
};
