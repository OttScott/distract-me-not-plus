/**
 * Sync Logger Module
 *
 * Sync-specific logging from service-worker-sync-logging.js.
 * Provides detailed sync operation logging for debugging.
 */

/**
 * Sync debug logger
 * Similar to service-worker-sync-logging.js structure
 */
export const syncDebug = {
  enabled: true,

  /**
   * Log a sync operation
   * @param {string} message - Log message
   * @param {any} data - Optional data
   */
  log: (message, data = null) => {
    if (!syncDebug.enabled) return;

    const timestamp = new Date().toISOString();
    if (data !== null) {
      console.log(`[SyncDebug ${timestamp}] ${message}`, data);
    } else {
      console.log(`[SyncDebug ${timestamp}] ${message}`);
    }
  },

  /**
   * Log a sync warning
   * @param {string} message - Warning message
   * @param {any} data - Optional data
   */
  warn: (message, data = null) => {
    if (!syncDebug.enabled) return;

    const timestamp = new Date().toISOString();
    if (data !== null) {
      console.warn(`[SyncDebug ${timestamp}] ${message}`, data);
    } else {
      console.warn(`[SyncDebug ${timestamp}] ${message}`);
    }
  },

  /**
   * Log a sync error
   * @param {string} message - Error message
   * @param {Error|any} error - Error
   */
  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    if (error !== null) {
      console.error(`[SyncDebug ${timestamp}] ${message}`, error);
    } else {
      console.error(`[SyncDebug ${timestamp}] ${message}`);
    }
  },

  /**
   * Enable/disable sync debug logging
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled: (enabled) => {
    syncDebug.enabled = enabled;
  },
};

/**
 * Log sync storage read operation
 * @param {string[]} keys - Keys being read
 */
export function logSyncRead(keys) {
  syncDebug.log('Reading from sync storage', { keys });
}

/**
 * Log sync storage read result
 * @param {Object} data - Data read from sync
 */
export function logSyncReadResult(data) {
  const summary = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      summary[key] = `${value.length} items`;
    } else if (typeof value === 'object') {
      summary[key] = 'object';
    } else {
      summary[key] = typeof value;
    }
  }
  syncDebug.log('Sync storage read result', summary);
}

/**
 * Log sync storage write operation
 * @param {string} key - Key being written
 * @param {any} value - Value being written
 */
export function logSyncWrite(key, value) {
  const size = Array.isArray(value) ? `${value.length} items` : typeof value;
  syncDebug.log(`Writing to sync storage: ${key}`, { size });
}

/**
 * Log chunking operation
 * @param {string} key - Key being chunked
 * @param {number} totalItems - Total items
 * @param {number} chunks - Number of chunks
 */
export function logChunking(key, totalItems, chunks) {
  syncDebug.log(`Chunking ${key}`, { totalItems, chunks });
}

/**
 * Log dechunking operation
 * @param {string} key - Key being dechunked
 * @param {number} chunks - Number of chunks
 * @param {number} totalItems - Total items recovered
 */
export function logDechunking(key, chunks, totalItems) {
  syncDebug.log(`Dechunking ${key}`, { chunks, totalItems });
}

/**
 * Log sync error
 * @param {string} operation - Operation that failed
 * @param {Error} error - Error that occurred
 */
export function logSyncError(operation, error) {
  syncDebug.error(`Sync error during ${operation}`, error);
}

/**
 * Log sync quota status
 * @param {Object} quota - Quota info
 */
export function logQuotaStatus(quota) {
  syncDebug.log('Sync storage quota', quota);
}

/**
 * Get sync storage quota information
 * @returns {Promise<Object>}
 */
export async function getSyncStorageQuota() {
  try {
    const bytesInUse = await new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(null, (bytes) => {
        resolve(bytes || 0);
      });
    });

    const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
    const maxBytesPerItem = chrome.storage.sync.QUOTA_BYTES_PER_ITEM || 8192;
    const maxItems = chrome.storage.sync.MAX_ITEMS || 512;

    const quota = {
      bytesInUse,
      maxBytes,
      maxBytesPerItem,
      maxItems,
      percentUsed: ((bytesInUse / maxBytes) * 100).toFixed(2),
      bytesRemaining: maxBytes - bytesInUse,
    };

    logQuotaStatus(quota);
    return quota;
  } catch (error) {
    logSyncError('getSyncStorageQuota', error);
    return {
      error: error.message,
      bytesInUse: 0,
      maxBytes: 102400,
    };
  }
}

/**
 * Diagnose sync status
 * @returns {Promise<Object>}
 */
export async function diagnoseSyncStatus() {
  syncDebug.log('Starting sync status diagnosis');

  try {
    // Get quota
    const quota = await getSyncStorageQuota();

    // Get all sync data
    const allSyncData = await chrome.storage.sync.get(null);
    const syncKeys = Object.keys(allSyncData);

    // Get all local data
    const allLocalData = await chrome.storage.local.get(null);
    const localKeys = Object.keys(allLocalData);

    // Count items
    const counts = {
      sync: {
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
      local: {
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
    };

    // Check for chunks
    const chunkedKeys = syncKeys.filter(
      (k) => k.includes('_chunk_') || k.includes('_metadata'),
    );

    const status = {
      timestamp: new Date().toISOString(),
      quota,
      syncKeys,
      localKeys,
      counts,
      chunkedKeys,
      hasSyncData: syncKeys.length > 0,
      hasLocalData: localKeys.length > 0,
    };

    syncDebug.log('Sync status diagnosis complete', status);
    return status;
  } catch (error) {
    syncDebug.error('Sync status diagnosis failed', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Make available globally for service worker context
/* eslint-disable no-restricted-globals */
if (typeof self !== 'undefined') {
  self.syncDebug = syncDebug;
  self.getSyncStorageQuota = getSyncStorageQuota;
  self.diagnoseSyncStatus = diagnoseSyncStatus;
}
/* eslint-enable no-restricted-globals */

// Export as default
const syncLoggerModule = {
  syncDebug,
  logSyncRead,
  logSyncReadResult,
  logSyncWrite,
  logChunking,
  logDechunking,
  logSyncError,
  logQuotaStatus,
  getSyncStorageQuota,
  diagnoseSyncStatus,
};
export default syncLoggerModule;
