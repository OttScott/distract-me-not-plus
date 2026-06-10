/**
 * Navigation Listener Module
 *
 * Handles webNavigation.onBeforeNavigate events.
 * Extracted from service-worker.js navigationHandler (line 875).
 */

/**
 * @typedef {Object} NavigationDetails
 * @property {number} tabId - Tab ID
 * @property {string} url - URL being navigated to
 * @property {number} frameId - Frame ID (0 = main frame)
 * @property {number} parentFrameId - Parent frame ID
 * @property {number} processId - Process ID
 * @property {number} timeStamp - Event timestamp
 */

/**
 * @typedef {Object} NavigationContext
 * @property {Function} isEnabled - Check if blocking is enabled
 * @property {Function} checkUrl - Function to check if URL should be blocked
 * @property {Function} redirectToBlockedPage - Function to redirect to blocked page
 * @property {string} indexUrl - Extension's index.html URL
 */

/**
 * Create a navigation handler
 * @param {NavigationContext} context - Handler context
 * @returns {Function} - Navigation event handler
 */
export function createNavigationHandler(context) {
  const { isEnabled, checkUrl, redirectToBlockedPage, indexUrl } = context;

  /**
   * Handle webNavigation.onBeforeNavigate events
   * @param {NavigationDetails} details - Navigation details
   */
  return function navigationHandler(details) {
    // Only block main frame navigations
    if (details.frameId !== 0) {
      return;
    }

    const { url, tabId } = details;

    // Skip extension's own pages
    if (indexUrl && url.startsWith(indexUrl)) {
      console.log(`[NavigationListener] Skipping extension page: ${url}`);
      return;
    }

    // Check if extension is enabled
    if (!isEnabled()) {
      console.log(`[NavigationListener] Extension disabled, allowing: ${url}`);
      return;
    }

    // Check if URL should be blocked
    const blockDetails = checkUrl(url);

    if (blockDetails && blockDetails.blocked) {
      const reason = blockDetails.reason || 'Matched block rule';
      console.log(`[NavigationListener] BLOCKING: ${url}, Reason: ${reason}`);
      redirectToBlockedPage(tabId, url, reason);
    } else {
      const reason = blockDetails?.reason || 'No matching block rules';
      console.log(`[NavigationListener] ALLOWING: ${url}, Reason: ${reason}`);
    }
  };
}

/**
 * Register the navigation listener
 * @param {Function} handler - Navigation handler function
 * @returns {Function} - Cleanup function
 */
export function registerNavigationListener(handler) {
  try {
    // Remove existing listener first to avoid duplicates
    chrome.webNavigation.onBeforeNavigate.removeListener(handler);
  } catch (e) {
    // Ignore if listener doesn't exist
  }

  // Add the listener
  chrome.webNavigation.onBeforeNavigate.addListener(handler);
  console.log('[NavigationListener] Registered webNavigation.onBeforeNavigate listener');

  // Return cleanup function
  return () => {
    try {
      chrome.webNavigation.onBeforeNavigate.removeListener(handler);
      console.log('[NavigationListener] Removed webNavigation.onBeforeNavigate listener');
    } catch (e) {
      // Ignore
    }
  };
}

/**
 * Check if webNavigation API is available
 * @returns {boolean}
 */
export function isNavigationApiAvailable() {
  return !!(chrome.webNavigation && chrome.webNavigation.onBeforeNavigate);
}

// Export default
const navigationListenerModule = {
  createNavigationHandler,
  registerNavigationListener,
  isNavigationApiAvailable,
};
export default navigationListenerModule;
