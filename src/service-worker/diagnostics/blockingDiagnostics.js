/**
 * Blocking Diagnostics Module
 *
 * Debug/diagnostic functions from service-worker.js.
 * Provides tools for testing URL matching and debugging blocking behavior.
 */

import { wildcardToRegex, testSinglePattern } from '../rules/patternMatcher';
import { testSingleKeyword } from '../rules/keywordMatcher';

/**
 * Test a URL against a pattern (diagnostic function)
 * @param {string} url - URL to test
 * @param {string} pattern - Pattern to test against
 * @returns {Object} - Test result with details
 */
export function testUrlMatch(url, pattern) {
  try {
    const regex = wildcardToRegex(pattern);
    const isMatch = regex.test(url);

    // Also try hostname matching
    let hostname = '';
    let hostnameMatch = false;
    try {
      const parsedUrl = new URL(url);
      hostname = parsedUrl.hostname;
      hostnameMatch = regex.test(hostname);
    } catch (e) {
      // URL parsing failed
    }

    const result = {
      url,
      pattern,
      regex: regex.toString(),
      matched: isMatch,
      hostname,
      hostnameMatch,
    };

    console.log(`[BlockingDiagnostics] Test result:`, result);
    return result;
  } catch (error) {
    console.error('[BlockingDiagnostics] Error testing URL match:', error);
    return {
      url,
      pattern,
      error: error.message,
      matched: false,
    };
  }
}

/**
 * Test domain matching for debugging
 * @returns {Object[]} - Test results
 */
export function testDomainMatching() {
  console.log('=== TESTING DOMAIN MATCHING ===');

  const tests = [
    // Basic domain matching
    { url: 'https://example.com', pattern: 'example.com' },
    { url: 'https://www.example.com', pattern: 'example.com' },
    { url: 'https://sub.example.com/page', pattern: '*.example.com' },
    { url: 'https://example.com/page', pattern: '*.example.com' },

    // Path matching
    { url: 'https://example.com/path', pattern: 'example.com/path' },
    { url: 'https://example.com/path/sub', pattern: 'example.com/path/*' },

    // Case insensitivity
    { url: 'https://EXAMPLE.COM/page', pattern: 'example.com' },
  ];

  const results = tests.map((test) => testUrlMatch(test.url, test.pattern));

  console.log('=== END TESTING ===');
  return results;
}

/**
 * Debug URL matching with full details
 * @param {string} url - URL to debug
 * @param {Object} state - Current blocking state
 * @returns {Object} - Debug information
 */
export function debugUrlMatching(url, state = {}) {
  console.log('[BlockingDiagnostics] Debug URL matching:', url);

  const debug = {
    url,
    timestamp: new Date().toISOString(),
    state: {
      isEnabled: state.isEnabled,
      mode: state.mode,
      denyPatternCount: state.denyPatterns?.length || state.blacklist?.length || 0,
      allowPatternCount: state.allowPatterns?.length || state.whitelist?.length || 0,
      denyKeywordCount:
        state.denyKeywords?.length || state.blacklistKeywords?.length || 0,
      allowKeywordCount:
        state.allowKeywords?.length || state.whitelistKeywords?.length || 0,
    },
    matches: {
      deny: [],
      allow: [],
      denyKeywords: [],
      allowKeywords: [],
    },
  };

  // Test against deny patterns
  const denyPatterns = state.originalDenyPatterns || state.blacklist || [];
  for (const pattern of denyPatterns) {
    if (testSinglePattern(url, pattern)) {
      debug.matches.deny.push(pattern);
    }
  }

  // Test against allow patterns
  const allowPatterns = state.originalAllowPatterns || state.whitelist || [];
  for (const pattern of allowPatterns) {
    if (testSinglePattern(url, pattern)) {
      debug.matches.allow.push(pattern);
    }
  }

  // Test against deny keywords
  const denyKeywords = state.originalDenyKeywords || state.blacklistKeywords || [];
  for (const keyword of denyKeywords) {
    if (testSingleKeyword(url, keyword)) {
      debug.matches.denyKeywords.push(keyword);
    }
  }

  // Test against allow keywords
  const allowKeywords = state.originalAllowKeywords || state.whitelistKeywords || [];
  for (const keyword of allowKeywords) {
    if (testSingleKeyword(url, keyword)) {
      debug.matches.allowKeywords.push(keyword);
    }
  }

  // Determine expected result
  debug.expectedResult = determineExpectedResult(debug.matches, state.mode);

  console.log('[BlockingDiagnostics] Debug result:', debug);
  return debug;
}

/**
 * Determine expected blocking result from matches
 * @param {Object} matches - Match results
 * @param {string} mode - Blocking mode
 * @returns {Object} - Expected result
 */
function determineExpectedResult(matches, mode) {
  const hasDenyMatch = matches.deny.length > 0 || matches.denyKeywords.length > 0;
  const hasAllowMatch = matches.allow.length > 0 || matches.allowKeywords.length > 0;

  switch (mode) {
    case 'denylist':
    case 'blacklist':
      return {
        blocked: hasDenyMatch,
        reason: hasDenyMatch
          ? `Matched deny: ${matches.deny[0] || matches.denyKeywords[0]}`
          : 'Not in deny list',
      };

    case 'allowlist':
    case 'whitelist':
      return {
        blocked: !hasAllowMatch,
        reason: hasAllowMatch
          ? `Matched allow: ${matches.allow[0] || matches.allowKeywords[0]}`
          : 'Not in allow list',
      };

    case 'combined':
    default:
      if (hasAllowMatch) {
        return {
          blocked: false,
          reason: `Allowed: ${matches.allow[0] || matches.allowKeywords[0]}`,
        };
      }
      if (hasDenyMatch) {
        return {
          blocked: true,
          reason: `Denied: ${matches.deny[0] || matches.denyKeywords[0]}`,
        };
      }
      return {
        blocked: false,
        reason: 'No matching rules',
      };
  }
}

/**
 * Test whitelist pattern matching
 * @param {Object} state - Current blocking state
 * @returns {Object} - Test results
 */
export function testWhitelistPatternMatching(state = {}) {
  console.log('[BlockingDiagnostics] Testing whitelist pattern matching');

  const allowPatterns = state.originalAllowPatterns || state.whitelist || [];

  if (allowPatterns.length === 0) {
    return { message: 'No whitelist patterns configured' };
  }

  const results = allowPatterns.map((pattern, index) => {
    try {
      const regex = wildcardToRegex(pattern);
      return {
        index,
        pattern,
        regex: regex.toString(),
        valid: true,
      };
    } catch (error) {
      return {
        index,
        pattern,
        error: error.message,
        valid: false,
      };
    }
  });

  console.log('[BlockingDiagnostics] Whitelist patterns:', results);
  return results;
}

/**
 * Get current blocking configuration summary
 * @param {Object} state - Current state
 * @returns {Object} - Configuration summary
 */
export function getBlockingConfigSummary(state = {}) {
  return {
    timestamp: new Date().toISOString(),
    isEnabled: state.isEnabled,
    mode: state.mode,
    rules: {
      denyPatterns: state.denyPatterns?.length || state.blacklist?.length || 0,
      allowPatterns: state.allowPatterns?.length || state.whitelist?.length || 0,
      denyKeywords: state.denyKeywords?.length || state.blacklistKeywords?.length || 0,
      allowKeywords: state.allowKeywords?.length || state.whitelistKeywords?.length || 0,
    },
    timer: {
      enabled: state.timer?.isEnabled,
      active: state.timer?.runtime?.endDate > Date.now(),
    },
    schedule: {
      enabled: state.schedule?.isEnabled,
    },
    tmpAllowed: state.tmpAllowed?.length || 0,
  };
}

/**
 * Safe wrapper for debug functions
 * @param {Function} fn - Function to wrap
 * @param {any} args - Arguments
 * @returns {any} - Function result or error
 */
export function safeDebugFunction(fn, ...args) {
  try {
    return fn(...args);
  } catch (error) {
    console.error('[BlockingDiagnostics] Error in debug function:', error);
    return { error: error.message };
  }
}

// Export as default
const blockingDiagnosticsModule = {
  testUrlMatch,
  testDomainMatching,
  debugUrlMatching,
  testWhitelistPatternMatching,
  getBlockingConfigSummary,
  safeDebugFunction,
};
export default blockingDiagnosticsModule;
