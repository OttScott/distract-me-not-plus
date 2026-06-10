/**
 * Context Menus Module
 *
 * Handles context menu creation and click handling.
 * Extracted from Background component:
 * - initContextMenus (line 405)
 * - updateContextMenus (line 456)
 * - handleContextMenusClick (line 469)
 * - Context menu definitions (lines 34-62)
 *
 * Converted from class methods to standalone functions.
 */

import { translate } from '../../helpers/i18n';
import { isAccessible, addCurrentWebsite } from '../../helpers/block';
import { openExtensionPage } from '../../helpers/webext';
import { ContextMenuIds } from '../constants';

/**
 * @typedef {Object} ContextMenu
 * @property {string} title - Menu item title
 * @property {string} id - Menu item ID
 * @property {boolean} enabled - Whether menu item is enabled
 * @property {string[]} contexts - Contexts where menu appears
 */

/**
 * Get context menu definitions
 * Uses translate() for localization
 * @returns {ContextMenu[]}
 */
export function getContextMenuDefinitions() {
  return [
    {
      title: translate('blockCurrentDomain'),
      id: ContextMenuIds.BLOCK_CURRENT_DOMAIN,
      enabled: false,
      contexts: ['page'],
    },
    {
      title: translate('blockCurrentUrl'),
      id: ContextMenuIds.BLOCK_CURRENT_URL,
      enabled: false,
      contexts: ['page'],
    },
    {
      title: translate('settings'),
      id: ContextMenuIds.SETTINGS,
      enabled: true,
      contexts: ['page'],
    },
    {
      title: translate('blacklistSettings'), // Uses existing translation key
      id: ContextMenuIds.DENYLIST_SETTINGS,
      enabled: true,
      contexts: ['page'],
    },
    {
      title: translate('whitelistSettings'), // Uses existing translation key
      id: ContextMenuIds.ALLOWLIST_SETTINGS,
      enabled: true,
      contexts: ['page'],
    },
  ];
}

/**
 * Check if a context menu item should be enabled
 * @param {ContextMenu} menu - Menu item configuration
 * @param {Object} tab - Current tab
 * @returns {boolean}
 */
export function isContextMenuEnableable(menu, tab) {
  switch (menu.id) {
    case ContextMenuIds.BLOCK_CURRENT_DOMAIN:
    case ContextMenuIds.BLOCK_CURRENT_URL:
      // Only enable for accessible URLs
      return tab ? isAccessible(tab.url) : false;
    default:
      return true;
  }
}

/**
 * Initialize context menus
 * Creates all menu items and sets up listeners
 *
 * @param {Object} browserAPI - Browser API (browser or chrome)
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.getActiveTab - Get active tab function
 * @returns {Promise<void>}
 */
export async function initContextMenus(browserAPI, callbacks = {}) {
  const { getActiveTab } = callbacks;

  // Get active tab for initial state
  let activeTab = null;
  if (getActiveTab) {
    try {
      activeTab = await getActiveTab();
    } catch (e) {
      console.error('[ContextMenus] Error getting active tab:', e);
    }
  }

  // Create all menu items
  const menuDefinitions = getContextMenuDefinitions();
  for (const menu of menuDefinitions) {
    try {
      browserAPI.contextMenus.create({
        ...menu,
        enabled: isContextMenuEnableable(menu, activeTab),
      });
    } catch (error) {
      console.error('[ContextMenus] Error creating menu:', menu.id, error);
    }
  }
}

/**
 * Update context menu states based on current tab
 * @param {Object} tab - Current tab
 * @param {Object} browserAPI - Browser API
 */
export function updateContextMenus(tab, browserAPI) {
  const menuDefinitions = getContextMenuDefinitions();

  for (const menu of menuDefinitions) {
    try {
      browserAPI.contextMenus.update(menu.id, {
        enabled: isContextMenuEnableable(menu, tab),
      });
    } catch (error) {
      // Menu may not exist yet - ignore
      console.debug('[ContextMenus] Error updating menu:', menu.id, error);
    }
  }
}

/**
 * Handle context menu click
 * @param {Object} info - Click info from browser
 * @param {Object} tab - Tab where click occurred
 * @param {string} mode - Current blocking mode
 * @returns {boolean} - True if handled
 */
export function handleContextMenusClick(info, tab, mode) {
  switch (info.menuItemId) {
    case ContextMenuIds.BLOCK_CURRENT_DOMAIN:
      // Block the domain
      addCurrentWebsite(mode, true, false);
      return true;

    case ContextMenuIds.BLOCK_CURRENT_URL:
      // Block the specific URL
      addCurrentWebsite(mode, true, true);
      return true;

    case ContextMenuIds.SETTINGS:
      openExtensionPage('/settings');
      return true;

    case ContextMenuIds.DENYLIST_SETTINGS:
      openExtensionPage('/settings?tab=blacklist');
      return true;

    case ContextMenuIds.ALLOWLIST_SETTINGS:
      openExtensionPage('/settings?tab=whitelist');
      return true;

    default:
      console.debug('[ContextMenus] Unknown context menu action:', {
        info,
        tab,
      });
      return false;
  }
}

/**
 * Set up context menu listeners
 * @param {Object} browserAPI - Browser API
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.getTab - Get tab by ID
 * @param {Function} callbacks.getActiveTab - Get active tab
 * @param {Function} callbacks.getMode - Get current blocking mode
 */
export function setupContextMenuListeners(browserAPI, callbacks) {
  const { getTab, getActiveTab, getMode } = callbacks;

  // Click handler
  browserAPI.contextMenus.onClicked.addListener((info, tab) => {
    const mode = getMode ? getMode() : 'combined';
    handleContextMenusClick(info, tab, mode);
  });

  // Update menus on tab events
  browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      updateContextMenus(tab, browserAPI);
    }
  });

  browserAPI.tabs.onReplaced.addListener(async (addedTabId, _removedTabId) => {
    if (getTab) {
      const tab = await getTab(addedTabId);
      if (tab) {
        updateContextMenus(tab, browserAPI);
      }
    }
  });

  browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
    if (getTab) {
      const tab = await getTab(activeInfo.tabId);
      if (tab) {
        updateContextMenus(tab, browserAPI);
      }
    }
  });

  browserAPI.tabs.onRemoved.addListener((_tabId, _removeInfo) => {
    // Wait a bit then update menus for new active tab
    setTimeout(async () => {
      if (getActiveTab) {
        const tab = await getActiveTab();
        if (tab) {
          updateContextMenus(tab, browserAPI);
        }
      }
    }, 100);
  });
}

/**
 * Remove all context menus
 * @param {Object} browserAPI - Browser API
 * @returns {Promise<void>}
 */
export async function removeAllContextMenus(browserAPI) {
  try {
    await browserAPI.contextMenus.removeAll();
  } catch (error) {
    console.error('[ContextMenus] Error removing menus:', error);
  }
}

// Export as default object
const contextMenusModule = {
  getContextMenuDefinitions,
  isContextMenuEnableable,
  initContextMenus,
  updateContextMenus,
  handleContextMenusClick,
  setupContextMenuListeners,
  removeAllContextMenus,
};
export default contextMenusModule;
