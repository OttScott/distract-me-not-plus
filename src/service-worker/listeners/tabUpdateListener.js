/**
 * Tab Update Listener Module
 *
 * Handles tabs.onUpdated events.
 * Unified from both service-worker.js tabsUpdatedHandler and
 * Background component onUpdatedHandler.
 */

import { hasValidProtocol } from '../../helpers/url';

/**
 * @typedef {Object} TabUpdateContext
 * @property {Function} isEnabled - Check if blocking is enabled
 * @property {Function} handleUrl - Function to handle URL check/block
 * @property {boolean} isFirefox - Whether running in Firefox
 */

/**
 * Create a tab update handler
 * @param {TabUpdateContext} context - Handler context
 * @returns {Function} - Tab update event handler
 */
export function createTabUpdateHandler(context) {
  const { isEnabled, handleUrl, isFirefox } = context;

  /**
   * Handle tabs.onUpdated events
   * @param {number} tabId - Tab ID
   * @param {Object} changeInfo - Change information
   * @param {Object} tab - Tab object
   */
  return function tabUpdateHandler(tabId, changeInfo, tab) {
    // Only handle URL changes in loading phase
    if (changeInfo.status !== 'loading') {
      return;
    }

    // Get URL - Firefox behavior differs from Chrome
    // In Firefox, changeInfo.url is more reliable
    // In Chrome, may need to fall back to tab.url
    const url = isFirefox ? changeInfo.url : changeInfo.url || tab.url;

    // Skip if no URL
    if (!url) {
      return;
    }

    // Validate protocol
    if (!hasValidProtocol(url)) {
      return;
    }

    console.log(`[TabUpdateListener] Tab ${tabId} navigating to: ${url}`);

    // Check if extension is enabled
    if (!isEnabled()) {
      console.log(`[TabUpdateListener] Extension disabled, allowing: ${url}`);
      return;
    }

    // Handle the URL
    handleUrl(url, tabId, 'tabs.onUpdated');
  };
}

/**
 * Register the tab update listener
 * @param {Function} handler - Tab update handler function
 * @returns {Function} - Cleanup function
 */
export function registerTabUpdateListener(handler) {
  try {
    // Remove existing listener first to avoid duplicates
    chrome.tabs.onUpdated.removeListener(handler);
  } catch (e) {
    // Ignore if listener doesn't exist
  }

  // Add the listener
  chrome.tabs.onUpdated.addListener(handler);
  console.log('[TabUpdateListener] Registered tabs.onUpdated listener');

  // Return cleanup function
  return () => {
    try {
      chrome.tabs.onUpdated.removeListener(handler);
      console.log('[TabUpdateListener] Removed tabs.onUpdated listener');
    } catch (e) {
      // Ignore
    }
  };
}

/**
 * @typedef {Object} TabReplacedContext
 * @property {Function} getTab - Function to get tab by ID
 * @property {Function} handleUrl - Function to handle URL check/block
 */

/**
 * Create a tab replaced handler
 * Background component has onReplacedHandler (line 1105)
 *
 * @param {TabReplacedContext} context - Handler context
 * @returns {Function} - Tab replaced event handler
 */
export function createTabReplacedHandler(context) {
  const { getTab, handleUrl } = context;

  /**
   * Handle tabs.onReplaced events
   * @param {number} addedTabId - New tab ID
   * @param {number} removedTabId - Old tab ID
   */
  return async function tabReplacedHandler(addedTabId, _removedTabId) {
    try {
      const tab = await getTab(addedTabId);
      if (tab && tab.url) {
        console.log(`[TabUpdateListener] Tab replaced, checking: ${tab.url}`);
        handleUrl(tab.url, tab.id, 'tabs.onReplaced');
      }
    } catch (error) {
      console.error('[TabUpdateListener] Error handling tab replaced:', error);
    }
  };
}

/**
 * Register the tab replaced listener
 * @param {Function} handler - Tab replaced handler function
 * @returns {Function} - Cleanup function
 */
export function registerTabReplacedListener(handler) {
  try {
    chrome.tabs.onReplaced.removeListener(handler);
  } catch (e) {
    // Ignore
  }

  chrome.tabs.onReplaced.addListener(handler);
  console.log('[TabUpdateListener] Registered tabs.onReplaced listener');

  return () => {
    try {
      chrome.tabs.onReplaced.removeListener(handler);
    } catch (e) {
      // Ignore
    }
  };
}

/**
 * Check if tabs API is available
 * @returns {boolean}
 */
export function isTabsApiAvailable() {
  return !!(chrome.tabs && chrome.tabs.onUpdated);
}

// Export default
const tabUpdateListenerModule = {
  createTabUpdateHandler,
  registerTabUpdateListener,
  createTabReplacedHandler,
  registerTabReplacedListener,
  isTabsApiAvailable,
};
export default tabUpdateListenerModule;
