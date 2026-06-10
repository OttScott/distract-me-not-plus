/**
 * Sync Protection Module
 *
 * Handles fresh install detection and sync data protection.
 * Prevents overwriting existing cloud data on fresh installs.
 *
 * Extracted from service-worker.js (NOT Background component - it doesn't have this).
 * Lines 236-370 contain the sync protection logic.
 */

import {
  syncSettings,
  defaultMode,
  defaultFramesType,
  defaultSchedule,
  CHUNKABLE_KEYS,
} from '../constants';
import * as syncStorage from './syncStorage';
import * as localStorage from './localStorage';

/**
 * @typedef {Object} SyncState
 * @property {string[]} blacklist - Deny list patterns
 * @property {string[]} whitelist - Allow list patterns
 * @property {string[]} blacklistKeywords - Deny keywords
 * @property {string[]} whitelistKeywords - Allow keywords
 * @property {boolean} isInitialInstall - Whether this is a fresh install
 */

/**
 * Check if this appears to be a fresh install with no user data
 * @param {SyncState} state - Current state
 * @returns {boolean}
 */
export function isLikelyFreshInstall(state) {
  // Check if we have any user-defined rules yet
  const hasNoRules =
    (!state.blacklist || state.blacklist.length === 0) &&
    (!state.whitelist || state.whitelist.length === 0) &&
    (!state.blacklistKeywords || state.blacklistKeywords.length === 0) &&
    (!state.whitelistKeywords || state.whitelistKeywords.length === 0);

  // Only true for first run after installation
  return state.isInitialInstall && hasNoRules;
}

/**
 * Force pull the latest data from sync storage and update local storage and memory
 * This is especially important for fresh installs
 *
 * @returns {Promise<{ success: boolean, data: Object|null }>}
 */
export async function forcePullFromSyncStorage() {
  try {
    console.log('[SyncProtection] Force-pulling data from sync storage');

    // Check sync storage bytes in use first
    let bytesInUse = 0;
    try {
      bytesInUse = await syncStorage.getSyncBytesInUse();
      console.log(`[SyncProtection] Sync storage contains ${bytesInUse} bytes of data`);
    } catch (bytesError) {
      console.error('[SyncProtection] Error checking sync storage size:', bytesError);
    }

    // Get sync data
    console.log('[SyncProtection] Requesting data from sync storage...');
    const syncData = await chrome.storage.sync.get(syncSettings);

    // Check for chunked arrays and dechunk them
    for (const key of CHUNKABLE_KEYS) {
      const dechunked = await syncStorage.loadArrayFromSync(key);
      if (dechunked !== undefined) {
        syncData[key] = dechunked;
      }
    }

    // Validate sync data
    const hasValidRules =
      (Array.isArray(syncData.blacklist) && syncData.blacklist.length > 0) ||
      (Array.isArray(syncData.whitelist) && syncData.whitelist.length > 0);

    console.log(
      `[SyncProtection] Sync data received - blacklist: ${syncData.blacklist?.length || 0}, whitelist: ${syncData.whitelist?.length || 0}`,
    );

    // If we have valid rules in sync, update local data
    if (hasValidRules) {
      console.log(
        '[SyncProtection] Valid rules found in sync storage, updating local data',
      );

      // Create safe versions of the data with defaults
      const safeData = {
        blacklist: Array.isArray(syncData.blacklist) ? syncData.blacklist : [],
        whitelist: Array.isArray(syncData.whitelist) ? syncData.whitelist : [],
        blacklistKeywords: Array.isArray(syncData.blacklistKeywords)
          ? syncData.blacklistKeywords
          : [],
        whitelistKeywords: Array.isArray(syncData.whitelistKeywords)
          ? syncData.whitelistKeywords
          : [],
        mode: syncData.mode || defaultMode,
        framesType: syncData.framesType || defaultFramesType,
      };

      // Update local storage
      await localStorage.set(safeData);

      console.log('[SyncProtection] Successfully updated local storage with sync data');
      return { success: true, data: safeData };
    } else {
      // Troubleshooting info
      if (bytesInUse > 0 && !hasValidRules) {
        console.warn(
          '[SyncProtection] SYNC ANOMALY: Sync storage reports data exists, but no valid rules were returned',
        );

        // Try a more explicit request for blacklist and whitelist directly
        try {
          const directSyncData = await chrome.storage.sync.get([
            'blacklist',
            'whitelist',
          ]);
          console.log('[SyncProtection] Direct sync query results:', {
            hasBlacklist: !!directSyncData.blacklist,
            blacklistLength: Array.isArray(directSyncData.blacklist)
              ? directSyncData.blacklist.length
              : 'not array',
            hasWhitelist: !!directSyncData.whitelist,
            whitelistLength: Array.isArray(directSyncData.whitelist)
              ? directSyncData.whitelist.length
              : 'not array',
          });
        } catch (directError) {
          console.error('[SyncProtection] Error in direct sync query:', directError);
        }
      } else {
        console.log('[SyncProtection] No valid rules found in sync storage');
      }
      return { success: false, data: null };
    }
  } catch (error) {
    console.error('[SyncProtection] Error force-pulling from sync storage:', error);
    return { success: false, data: null };
  }
}

/**
 * Get default sync values for fresh install
 * @returns {Object}
 */
export function getDefaultSyncValues() {
  return {
    blacklist: [],
    whitelist: [],
    blacklistKeywords: [],
    whitelistKeywords: [],
    mode: defaultMode,
    framesType: defaultFramesType,
    message: '',
    redirectUrl: '',
    schedule: defaultSchedule,
  };
}

/**
 * Check if we should skip writing to sync storage
 * Used to prevent overwriting cloud data on fresh install
 *
 * @param {boolean} isInitialInstall - Whether this is a fresh install
 * @param {any[]} data - Data being written
 * @returns {boolean} - True if write should be skipped
 */
export function shouldSkipSyncWrite(isInitialInstall, data) {
  // Skip if fresh install and data is empty
  if (isInitialInstall && (!data || data.length === 0)) {
    console.log('[SyncProtection] Skipping sync write on fresh install with empty data');
    return true;
  }
  return false;
}

/**
 * Safe save to sync - respects fresh install protection
 * @param {string} key - Storage key
 * @param {any[]} data - Data to save
 * @param {boolean} isInitialInstall - Whether this is a fresh install
 * @returns {Promise<boolean>}
 */
export async function safeSaveToSync(key, data, isInitialInstall) {
  if (shouldSkipSyncWrite(isInitialInstall, data)) {
    // Save to local only
    await localStorage.set({ [key]: data });
    console.log(
      `[SyncProtection] Saved ${key} to local storage only (fresh install protection)`,
    );
    return true;
  }

  // Normal sync save
  return syncStorage.saveArrayToSync(key, data);
}

/**
 * Initialize sync protection for fresh install
 * Should be called during service worker initialization
 *
 * @param {boolean} isInitialInstall - Whether this is a fresh install
 * @returns {Promise<Object|null>} - Sync data if pulled, null otherwise
 */
export async function initializeSyncProtection(isInitialInstall) {
  if (!isInitialInstall) {
    return null;
  }

  console.log(
    '[SyncProtection] Fresh install detected - checking for existing cloud data',
  );

  // Wait a moment for sync to potentially catch up
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Try to pull from sync
  const result = await forcePullFromSyncStorage();

  if (result.success && result.data) {
    console.log('[SyncProtection] Loaded existing cloud data for fresh install');
    return result.data;
  }

  console.log('[SyncProtection] No existing cloud data found, using defaults');
  return null;
}

/**
 * Periodic sync check configuration
 */
export const SYNC_CHECK_INTERVAL = 60000; // 60 seconds

/**
 * Setup periodic sync check (stub - can be enhanced)
 * In the original service worker, this is a no-op function
 *
 * @param {Function} onSyncUpdate - Callback when sync data changes
 * @returns {number|null} - Interval ID or null
 */
export function setupPeriodicSyncCheck(_onSyncUpdate) {
  // The original service worker has this as a stub/no-op
  // Can be implemented if periodic sync checking is needed
  console.log(
    '[SyncProtection] Periodic sync check not implemented (matches original behavior)',
  );
  return null;
}

/**
 * Diagnose sync status for debugging
 * @returns {Promise<Object>}
 */
export async function diagnoseSyncStatus() {
  try {
    const quota = await syncStorage.getSyncQuota();
    const allSyncData = await chrome.storage.sync.get(null);
    const allLocalData = await localStorage.get(null);

    const status = {
      timestamp: new Date().toISOString(),
      syncQuota: quota,
      syncKeys: Object.keys(allSyncData),
      localKeys: Object.keys(allLocalData),
      syncRuleCounts: {
        blacklist: Array.isArray(allSyncData.blacklist)
          ? allSyncData.blacklist.length
          : 0,
        whitelist: Array.isArray(allSyncData.whitelist)
          ? allSyncData.whitelist.length
          : 0,
        blacklistKeywords: Array.isArray(allSyncData.blacklistKeywords)
          ? allSyncData.blacklistKeywords.length
          : 0,
        whitelistKeywords: Array.isArray(allSyncData.whitelistKeywords)
          ? allSyncData.whitelistKeywords.length
          : 0,
      },
      localRuleCounts: {
        blacklist: Array.isArray(allLocalData.blacklist)
          ? allLocalData.blacklist.length
          : 0,
        whitelist: Array.isArray(allLocalData.whitelist)
          ? allLocalData.whitelist.length
          : 0,
        blacklistKeywords: Array.isArray(allLocalData.blacklistKeywords)
          ? allLocalData.blacklistKeywords.length
          : 0,
        whitelistKeywords: Array.isArray(allLocalData.whitelistKeywords)
          ? allLocalData.whitelistKeywords.length
          : 0,
      },
      chunkedKeys: [],
    };

    // Check for chunked data
    for (const key of CHUNKABLE_KEYS) {
      const isChunked = await syncStorage.isChunked(key);
      if (isChunked) {
        status.chunkedKeys.push(key);
      }
    }

    console.log('[SyncProtection] Sync status:', status);
    return status;
  } catch (error) {
    console.error('[SyncProtection] Error diagnosing sync status:', error);
    return { error: error.message };
  }
}

// Export as default object
const syncProtectionModule = {
  isLikelyFreshInstall,
  forcePullFromSyncStorage,
  getDefaultSyncValues,
  shouldSkipSyncWrite,
  safeSaveToSync,
  initializeSyncProtection,
  setupPeriodicSyncCheck,
  diagnoseSyncStatus,
  SYNC_CHECK_INTERVAL,
};
export default syncProtectionModule;
