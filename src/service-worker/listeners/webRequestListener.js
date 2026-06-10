/**
 * Web Request Listener Module
 *
 * Handles webRequest.onBeforeRequest events.
 * From service-worker.js webRequestHandler with Firefox blocking support.
 *
 * Note: In Chrome MV3, webRequest doesn't support blocking.
 * This is primarily for Firefox compatibility.
 */

/**
 * @typedef {Object} WebRequestDetails
 * @property {number} tabId - Tab ID
 * @property {string} url - Request URL
 * @property {string} type - Request type (main_frame, sub_frame, etc.)
 * @property {number} requestId - Request ID
 * @property {number} timeStamp - Event timestamp
 */

/**
 * @typedef {Object} WebRequestContext
 * @property {Function} isEnabled - Check if blocking is enabled
 * @property {Function} checkUrl - Function to check if URL should be blocked
 * @property {Function} redirectToBlockedPage - Function to redirect to blocked page
 * @property {string[]} framesType - Frame types to monitor
 */

/**
 * Create a web request handler
 * @param {WebRequestContext} context - Handler context
 * @returns {Function} - Web request event handler
 */
export function createWebRequestHandler(context) {
  const { isEnabled, checkUrl, redirectToBlockedPage } = context;

  /**
   * Handle webRequest.onBeforeRequest events
   * @param {WebRequestDetails} details - Request details
   * @returns {Object|undefined} - Blocking response or undefined
   */
  return function webRequestHandler(details) {
    // Only handle main frame requests
    if (details.type !== 'main_frame') {
      return;
    }

    const { url, tabId } = details;

    console.log(`[WebRequestListener] Request to: ${url}`);

    // Check if extension is enabled
    if (!isEnabled()) {
      return;
    }

    // Check if URL should be blocked
    const blockDetails = checkUrl(url);

    if (blockDetails && blockDetails.blocked) {
      const reason = blockDetails.reason || 'Matched block rule';
      console.log(`[WebRequestListener] BLOCKING: ${url}, Reason: ${reason}`);

      // Redirect to blocked page
      redirectToBlockedPage(tabId, url, reason);

      // Return blocking response if API supports it
      // Chrome MV3 doesn't support blocking, but Firefox does
      if (supportsBlocking()) {
        return { cancel: true };
      }
    }

    // Don't return anything for non-blocking listeners
    // This prevents "Function returned a value that is not convertible to Dictionary" errors
    if (supportsBlocking()) {
      return { cancel: false };
    }
  };
}

/**
 * Check if webRequest API supports blocking
 * @returns {boolean}
 */
export function supportsBlocking() {
  try {
    // Check if we can add a blocking listener
    // This is browser-specific
    return !!(
      chrome.webRequest &&
      chrome.webRequest.onBeforeRequest &&
      // Firefox and Chrome MV2 support 'blocking'
      // Chrome MV3 does not
      typeof browser !== 'undefined'
    );
  } catch (e) {
    return false;
  }
}

/**
 * Register the web request listener
 * @param {Function} handler - Web request handler function
 * @param {string[]} framesType - Frame types to monitor
 * @returns {Function|null} - Cleanup function or null if not supported
 */
export function registerWebRequestListener(handler, framesType = ['main_frame']) {
  if (!chrome.webRequest) {
    console.log('[WebRequestListener] webRequest API not available');
    return null;
  }

  try {
    // Remove existing listener first
    try {
      chrome.webRequest.onBeforeRequest.removeListener(handler);
    } catch (e) {
      // Ignore
    }

    // Try with blocking option first (works in Firefox)
    try {
      chrome.webRequest.onBeforeRequest.addListener(
        handler,
        { urls: ['<all_urls>'], types: framesType },
        ['blocking'],
      );
      console.log('[WebRequestListener] Registered blocking webRequest listener');
    } catch (e) {
      console.log('[WebRequestListener] Blocking not supported, trying non-blocking');

      // Fall back to non-blocking
      try {
        chrome.webRequest.onBeforeRequest.addListener(handler, {
          urls: ['<all_urls>'],
          types: framesType,
        });
        console.log('[WebRequestListener] Registered non-blocking webRequest listener');
      } catch (err) {
        console.error('[WebRequestListener] Failed to register listener:', err);
        return null;
      }
    }

    // Return cleanup function
    return () => {
      try {
        chrome.webRequest.onBeforeRequest.removeListener(handler);
        console.log('[WebRequestListener] Removed webRequest listener');
      } catch (e) {
        // Ignore
      }
    };
  } catch (error) {
    console.error('[WebRequestListener] Error registering listener:', error);
    return null;
  }
}

/**
 * Check if webRequest API is available
 * @returns {boolean}
 */
export function isWebRequestApiAvailable() {
  return !!(chrome.webRequest && chrome.webRequest.onBeforeRequest);
}

/**
 * Get webRequest capabilities for current browser
 * @returns {Object}
 */
export function getWebRequestCapabilities() {
  return {
    available: isWebRequestApiAvailable(),
    supportsBlocking: supportsBlocking(),
    // Chrome MV3 requires declarativeNetRequest instead
    requiresDeclarativeNetRequest: !supportsBlocking() && isWebRequestApiAvailable(),
  };
}

// Export default
const webRequestListenerModule = {
  createWebRequestHandler,
  registerWebRequestListener,
  supportsBlocking,
  isWebRequestApiAvailable,
  getWebRequestCapabilities,
};
export default webRequestListenerModule;
