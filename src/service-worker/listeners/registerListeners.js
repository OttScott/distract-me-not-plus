/**
 * Listener Registration Module
 *
 * Sets up all event listeners for the service worker.
 * Consolidates listener setup from both implementations.
 */

import {
  createNavigationHandler,
  registerNavigationListener,
  isNavigationApiAvailable,
} from './navigationListener';
import {
  createTabUpdateHandler,
  registerTabUpdateListener,
  createTabReplacedHandler,
  registerTabReplacedListener,
  isTabsApiAvailable,
} from './tabUpdateListener';
import {
  createWebRequestHandler,
  registerWebRequestListener,
  isWebRequestApiAvailable,
  supportsBlocking,
} from './webRequestListener';

/**
 * @typedef {Object} ListenerContext
 * @property {Function} isEnabled - Check if blocking is enabled
 * @property {Function} checkUrl - Check if URL should be blocked
 * @property {Function} handleUrl - Handle URL blocking
 * @property {Function} redirectToBlockedPage - Redirect to blocked page
 * @property {Function} getTab - Get tab by ID
 * @property {string} indexUrl - Extension index URL
 * @property {string[]} framesType - Frame types to monitor
 * @property {boolean} isFirefox - Whether running in Firefox
 */

/**
 * @typedef {Object} RegisteredListeners
 * @property {Function|null} navigationCleanup - Navigation listener cleanup
 * @property {Function|null} tabUpdateCleanup - Tab update listener cleanup
 * @property {Function|null} tabReplacedCleanup - Tab replaced listener cleanup
 * @property {Function|null} webRequestCleanup - Web request listener cleanup
 */

/**
 * Register all event listeners
 * @param {ListenerContext} context - Listener context
 * @returns {RegisteredListeners} - Cleanup functions for all listeners
 */
export function registerAllListeners(context) {
  const {
    isEnabled,
    checkUrl,
    handleUrl,
    redirectToBlockedPage,
    getTab,
    indexUrl,
    framesType = ['main_frame'],
    isFirefox = false,
  } = context;

  const cleanups = {
    navigationCleanup: null,
    tabUpdateCleanup: null,
    tabReplacedCleanup: null,
    webRequestCleanup: null,
  };

  // 1. Navigation listener (primary for address bar navigations)
  if (isNavigationApiAvailable()) {
    const navigationHandler = createNavigationHandler({
      isEnabled,
      checkUrl,
      redirectToBlockedPage,
      indexUrl,
    });
    cleanups.navigationCleanup = registerNavigationListener(navigationHandler);
  } else {
    console.warn('[RegisterListeners] webNavigation API not available');
  }

  // 2. Tab update listener (catches page loads)
  if (isTabsApiAvailable()) {
    const tabUpdateHandler = createTabUpdateHandler({
      isEnabled,
      handleUrl,
      isFirefox,
    });
    cleanups.tabUpdateCleanup = registerTabUpdateListener(tabUpdateHandler);

    // Tab replaced listener (for prerendered pages)
    if (getTab) {
      const tabReplacedHandler = createTabReplacedHandler({
        getTab,
        handleUrl,
      });
      cleanups.tabReplacedCleanup = registerTabReplacedListener(tabReplacedHandler);
    }
  } else {
    console.warn('[RegisterListeners] tabs API not available');
  }

  // 3. Web request listener (extra coverage, primarily for Firefox)
  if (isWebRequestApiAvailable()) {
    const webRequestHandler = createWebRequestHandler({
      isEnabled,
      checkUrl,
      redirectToBlockedPage,
      framesType,
    });
    cleanups.webRequestCleanup = registerWebRequestListener(
      webRequestHandler,
      framesType,
    );
  } else {
    console.log('[RegisterListeners] webRequest API not available');
  }

  console.log('[RegisterListeners] All listeners registered');
  return cleanups;
}

/**
 * Unregister all event listeners
 * @param {RegisteredListeners} cleanups - Cleanup functions
 */
export function unregisterAllListeners(cleanups) {
  if (cleanups.navigationCleanup) {
    cleanups.navigationCleanup();
  }
  if (cleanups.tabUpdateCleanup) {
    cleanups.tabUpdateCleanup();
  }
  if (cleanups.tabReplacedCleanup) {
    cleanups.tabReplacedCleanup();
  }
  if (cleanups.webRequestCleanup) {
    cleanups.webRequestCleanup();
  }
  console.log('[RegisterListeners] All listeners unregistered');
}

/**
 * Setup storage change listener
 * @param {Function} onStorageChange - Callback for storage changes
 * @returns {Function} - Cleanup function
 */
export function setupStorageChangeListener(onStorageChange) {
  const listener = (changes, areaName) => {
    onStorageChange(changes, areaName);
  };

  try {
    chrome.storage.onChanged.removeListener(listener);
  } catch (e) {
    // Ignore
  }

  chrome.storage.onChanged.addListener(listener);
  console.log('[RegisterListeners] Storage change listener registered');

  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener);
    } catch (e) {
      // Ignore
    }
  };
}

/**
 * Get listener capabilities for current browser
 * @returns {Object}
 */
export function getListenerCapabilities() {
  return {
    webNavigation: isNavigationApiAvailable(),
    tabsApi: isTabsApiAvailable(),
    webRequest: isWebRequestApiAvailable(),
    webRequestBlocking: supportsBlocking(),
  };
}

// Export individual modules for direct use
export {
  createNavigationHandler,
  registerNavigationListener,
  createTabUpdateHandler,
  registerTabUpdateListener,
  createWebRequestHandler,
  registerWebRequestListener,
};

// Export default
const registerListenersModule = {
  registerAllListeners,
  unregisterAllListeners,
  setupStorageChangeListener,
  getListenerCapabilities,
};
export default registerListenersModule;
