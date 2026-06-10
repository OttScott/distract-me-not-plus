/**
 * Block Actions Module
 *
 * Implements block action execution (redirect, custom URL, close-tab).
 * Extracted from Background component's handleAction() (lines 645-680).
 */

import { Action } from '../../helpers/block';

/**
 * @typedef {Object} ActionContext
 * @property {number} tabId - Tab ID to act on
 * @property {string} url - URL that was blocked
 * @property {string} reason - Reason for blocking
 * @property {string} redirectUrl - Custom redirect URL (for redirectToUrl action)
 * @property {string} indexUrl - Extension's index.html URL
 * @property {string} customMessage - Custom block message
 */

/**
 * @typedef {Object} ActionResult
 * @property {string} redirectUrl - URL to redirect to
 * @property {boolean} shouldCloseTab - Whether to close the tab instead
 */

/**
 * Build the blocked page URL with all parameters
 * @param {string} indexUrl - Extension's index.html URL
 * @param {string} blockedUrl - The URL that was blocked
 * @param {string} reason - Reason for blocking
 * @param {string} customMessage - Optional custom message
 * @returns {string} - Full blocked page URL
 */
export function buildBlockedPageUrl(indexUrl, blockedUrl, reason, customMessage) {
  const encodedUrl = encodeURIComponent(blockedUrl);
  const encodedReason = encodeURIComponent(reason || 'Blocked');

  let url = `${indexUrl}#/blocked?url=${encodedUrl}&reason=${encodedReason}`;

  if (customMessage) {
    url += `&message=${encodeURIComponent(customMessage)}`;
  }

  return url;
}

/**
 * Execute block action - redirect to blocked page
 * @param {ActionContext} context - Action context
 * @returns {ActionResult}
 */
function executeBlockTabAction(context) {
  const { url, reason, indexUrl, customMessage } = context;
  const blockedPageUrl = buildBlockedPageUrl(indexUrl, url, reason, customMessage);

  return {
    redirectUrl: blockedPageUrl,
    shouldCloseTab: false,
  };
}

/**
 * Execute redirect to URL action
 * Redirects to custom URL if set, otherwise falls back to blocked page
 * @param {ActionContext} context - Action context
 * @returns {ActionResult}
 */
function executeRedirectToUrlAction(context) {
  const { url, reason, redirectUrl, indexUrl, customMessage } = context;

  // If custom redirect URL is set and valid, use it
  if (redirectUrl && redirectUrl.length > 0) {
    return {
      redirectUrl: redirectUrl,
      shouldCloseTab: false,
    };
  }

  // Fall back to blocked page
  const blockedPageUrl = buildBlockedPageUrl(indexUrl, url, reason, customMessage);
  return {
    redirectUrl: blockedPageUrl,
    shouldCloseTab: false,
  };
}

/**
 * Execute close tab action
 * NOTE: The actual tab closing must be done by the caller using nativeAPI.tabs.remove()
 * This is because nativeAPI is needed to fix weird errors on Chrome due to browser-polyfill
 *
 * @param {ActionContext} context - Action context
 * @returns {ActionResult}
 */
function executeCloseTabAction(_context) {
  return {
    // eslint-disable-next-line no-script-url
    redirectUrl: 'javascript:window.close()',
    shouldCloseTab: true,
  };
}

/**
 * Execute the appropriate block action
 * Main entry point for action execution
 *
 * @param {string} action - Action type (from Action enum)
 * @param {ActionContext} context - Action context
 * @returns {ActionResult}
 */
export function executeBlockAction(action, context) {
  switch (action) {
    case Action.redirectToUrl:
      return executeRedirectToUrlAction(context);

    case Action.closeTab:
      return executeCloseTabAction(context);

    case Action.blockTab:
    default:
      return executeBlockTabAction(context);
  }
}

/**
 * Close a tab by ID
 * Uses nativeAPI for Chrome compatibility (avoids browser-polyfill issues)
 *
 * @param {number} tabId - Tab ID to close
 * @param {Object} nativeAPI - Native browser API (chrome or browser)
 * @returns {Promise<void>}
 */
export async function closeTab(tabId, nativeAPI) {
  try {
    // nativeAPI is used to fix weird errors on chrome due to browser-polyfill
    // See Background component line 674 comment
    if (nativeAPI && nativeAPI.tabs && nativeAPI.tabs.remove) {
      await nativeAPI.tabs.remove(tabId);
    }
  } catch (error) {
    console.error('Error closing tab:', tabId, error);
  }
}

/**
 * Redirect a tab to a URL
 * @param {number} tabId - Tab ID to redirect
 * @param {string} redirectUrl - URL to redirect to
 * @param {Object} nativeAPI - Native browser API
 * @returns {Promise<void>}
 */
export async function redirectTab(tabId, redirectUrl, nativeAPI) {
  try {
    if (nativeAPI && nativeAPI.tabs && nativeAPI.tabs.update) {
      await nativeAPI.tabs.update(tabId, { url: redirectUrl });
    }
  } catch (error) {
    console.error('Error redirecting tab:', tabId, error);
  }
}

/**
 * Process block action result
 * Handles the actual tab manipulation based on action result
 *
 * @param {ActionResult} result - Action result
 * @param {number} tabId - Tab ID
 * @param {Object} nativeAPI - Native browser API
 * @returns {Promise<void>}
 */
export async function processActionResult(result, tabId, nativeAPI) {
  if (result.shouldCloseTab) {
    await closeTab(tabId, nativeAPI);
  } else if (result.redirectUrl) {
    await redirectTab(tabId, result.redirectUrl, nativeAPI);
  }
}

/**
 * Get the index URL for the extension
 * Works in both Chrome (service worker) and Firefox (background page) contexts
 *
 * @param {Object} runtime - browser.runtime or chrome.runtime
 * @returns {string} - Extension's index.html URL
 */
export function getExtensionIndexUrl(runtime) {
  try {
    if (runtime && runtime.getURL) {
      return runtime.getURL('index.html');
    }
    // Fallback for unusual contexts
    return 'index.html';
  } catch (error) {
    console.error('Error getting extension index URL:', error);
    return 'index.html';
  }
}
