/**
 * Temporary Allow Module
 *
 * Handles unblock once/for-a-while and temp-allow functionality.
 * Extracted from Background component:
 * - unblockTab (line 599)
 * - isTmpAllowed (line 691)
 * - removeOutdatedTmpAllowed (line 683)
 *
 * Converted from class methods to pure functions with explicit state.
 */

import { getHostname } from '../../helpers/url';
import { UnblockOptions } from '../../helpers/block';
import { translate } from '../../helpers/i18n';

/**
 * @typedef {Object} TmpAllowedEntry
 * @property {number} time - Duration in milliseconds
 * @property {number} startedAt - Timestamp when temp allow started
 * @property {string} hostname - Hostname that is allowed
 */

/**
 * @typedef {Object} UnblockSettings
 * @property {boolean} isEnabled - Whether unblock feature is enabled
 * @property {boolean} requirePassword - Require password to unblock
 * @property {number} unblockOnceTimeout - Timeout for unblock-once in seconds
 * @property {boolean} displayNotificationOnTimeout - Show notification when timeout
 * @property {boolean} autoReblockOnTimeout - Re-check tabs when timeout expires
 */

/**
 * @typedef {Object} TempAllowCallbacks
 * @property {Function} sendNotification - Function to send notifications
 * @property {Function} checkAllTabs - Function to re-check all tabs
 * @property {Function} redirectTab - Function to redirect a tab
 */

/**
 * Remove outdated entries from temp allowed list
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @returns {TmpAllowedEntry[]} - Filtered list with only valid entries
 */
export function removeOutdatedTmpAllowed(tmpAllowed) {
  if (!Array.isArray(tmpAllowed) || tmpAllowed.length === 0) {
    return [];
  }

  const now = Date.now();
  return tmpAllowed.filter((allowed) => {
    const expiresAt = allowed.startedAt + allowed.time;
    return now < expiresAt;
  });
}

/**
 * Check if a URL is temporarily allowed
 * @param {string} url - URL to check
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @returns {boolean}
 */
export function isTmpAllowed(url, tmpAllowed) {
  if (!Array.isArray(tmpAllowed) || tmpAllowed.length === 0) {
    return false;
  }

  // Clean up outdated entries first
  const validEntries = removeOutdatedTmpAllowed(tmpAllowed);

  if (validEntries.length === 0) {
    return false;
  }

  // Extract hostname from URL
  const hostname = getHostname(url);

  // Check if hostname is in temp allowed list
  const isAllowed = validEntries.some((allowed) => allowed.hostname === hostname);

  return isAllowed;
}

/**
 * Add a URL to temp allowed list
 * @param {number} tabId - Tab ID
 * @param {string} url - URL to allow
 * @param {number} timeout - Timeout in milliseconds
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @param {UnblockSettings} unblockSettings - Unblock settings
 * @param {TempAllowCallbacks} callbacks - Callback functions
 * @returns {{ tmpAllowed: TmpAllowedEntry[], timeoutId: number|null }}
 */
export function unblockTab(tabId, url, timeout, tmpAllowed, unblockSettings, callbacks) {
  // Clean up outdated entries
  const cleanedList = removeOutdatedTmpAllowed(tmpAllowed);

  // Create new entry
  const hostname = getHostname(url);
  const newEntry = {
    time: timeout,
    startedAt: Date.now(),
    hostname,
  };

  // Add to list
  const newTmpAllowed = [...cleanedList, newEntry];

  let timeoutId = null;

  // Set up timeout callbacks if needed
  if (timeout > 0) {
    const shouldNotify = unblockSettings?.displayNotificationOnTimeout;
    const shouldReblock = unblockSettings?.autoReblockOnTimeout;

    if (shouldNotify || shouldReblock) {
      timeoutId = setTimeout(() => {
        // Show notification
        if (shouldNotify && callbacks.sendNotification) {
          const title = translate('appName');
          const message = translate('timeOverFor', url);
          callbacks.sendNotification(message, title);
        }

        // Re-check all tabs to reblock
        if (shouldReblock && callbacks.checkAllTabs) {
          callbacks.checkAllTabs();
        }
      }, timeout);
    }
  }

  return { tmpAllowed: newTmpAllowed, timeoutId };
}

/**
 * Calculate timeout based on unblock option
 * @param {string} option - Unblock option (UnblockOptions.unblockOnce or unblockForWhile)
 * @param {number} time - Time value (minutes for unblockForWhile)
 * @param {UnblockSettings} unblockSettings - Unblock settings
 * @returns {number} - Timeout in milliseconds
 */
export function calculateUnblockTimeout(option, time, unblockSettings) {
  switch (option) {
    case UnblockOptions.unblockForWhile:
      // Convert minutes to milliseconds
      return (time || 0) * 60000;

    case UnblockOptions.unblockOnce:
    default:
      // Use configured unblock once timeout (in seconds -> ms)
      return (unblockSettings?.unblockOnceTimeout || 10) * 1000;
  }
}

/**
 * Process unblock request from blocked page
 * @param {number} tabId - Tab ID
 * @param {string} url - URL to unblock
 * @param {string} option - Unblock option
 * @param {number} time - Time value (for unblockForWhile)
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @param {UnblockSettings} unblockSettings - Unblock settings
 * @param {TempAllowCallbacks} callbacks - Callback functions
 * @returns {{ tmpAllowed: TmpAllowedEntry[], timeoutId: number|null }}
 */
export function processUnblockRequest(
  tabId,
  url,
  option,
  time,
  tmpAllowed,
  unblockSettings,
  callbacks,
) {
  const timeout = calculateUnblockTimeout(option, time, unblockSettings);

  const result = unblockTab(tabId, url, timeout, tmpAllowed, unblockSettings, callbacks);

  // Redirect tab to the unblocked URL
  if (callbacks.redirectTab) {
    callbacks.redirectTab(tabId, url);
  }

  return result;
}

/**
 * Get remaining time for a temp allowed URL
 * @param {string} url - URL to check
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @returns {number} - Remaining time in ms, or 0 if not found/expired
 */
export function getTmpAllowedRemainingTime(url, tmpAllowed) {
  if (!Array.isArray(tmpAllowed) || tmpAllowed.length === 0) {
    return 0;
  }

  const hostname = getHostname(url);
  const entry = tmpAllowed.find((allowed) => allowed.hostname === hostname);

  if (!entry) {
    return 0;
  }

  const expiresAt = entry.startedAt + entry.time;
  const remaining = expiresAt - Date.now();

  return remaining > 0 ? remaining : 0;
}

/**
 * Remove a specific URL from temp allowed list
 * @param {string} url - URL to remove
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @returns {TmpAllowedEntry[]} - Updated list
 */
export function removeTmpAllowed(url, tmpAllowed) {
  if (!Array.isArray(tmpAllowed) || tmpAllowed.length === 0) {
    return [];
  }

  const hostname = getHostname(url);
  return tmpAllowed.filter((allowed) => allowed.hostname !== hostname);
}

/**
 * Clear all temp allowed entries
 * @returns {TmpAllowedEntry[]} - Empty list
 */
export function clearAllTmpAllowed() {
  return [];
}

/**
 * Get all currently valid temp allowed hostnames
 * @param {TmpAllowedEntry[]} tmpAllowed - Current temp allowed list
 * @returns {string[]} - List of allowed hostnames
 */
export function getValidTmpAllowedHostnames(tmpAllowed) {
  const validEntries = removeOutdatedTmpAllowed(tmpAllowed);
  return validEntries.map((entry) => entry.hostname);
}

// Export as default object
const tempAllowModule = {
  removeOutdatedTmpAllowed,
  isTmpAllowed,
  unblockTab,
  calculateUnblockTimeout,
  processUnblockRequest,
  getTmpAllowedRemainingTime,
  removeTmpAllowed,
  clearAllTmpAllowed,
  getValidTmpAllowedHostnames,
};
export default tempAllowModule;
