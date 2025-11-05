/**
 * Enhanced storage helper that supports syncing settings across devices
 * with intelligent fallbacks to local storage when needed.
 * Includes chunking support for large arrays to avoid quota limits.
 */

import { debug, logInfo } from './debug';

// Chrome sync storage limits
const BYTES_PER_CHUNK = 7000; // Leave some headroom for JSON overhead (8KB max per item)

// Settings that should be stored in local storage only (everything else syncs)
const localOnlySettings = [
  // Extension state (typically device-specific)
  'isEnabled',
  'enableOnBrowserStartup',

  // Security settings
  'password',

  // Session-specific features
  'timer',
  'logs',
  'logsLength',
  'enableLogs',
  'enableTimer',
];

// Helper to determine if a setting should use local storage
const shouldUseLocalStorage = (key) => {
  return (
    localOnlySettings.includes(key) ||
    // Also check if the key is a property of a local-only object
    localOnlySettings.some((localKey) => key.startsWith(`${localKey}.`))
  );
};

// Helper to estimate byte size of data
const estimateByteSize = (data) => {
  return new Blob([JSON.stringify(data)]).size;
};

// Helper to chunk large arrays
const chunkArray = (array, maxBytesPerChunk) => {
  if (!Array.isArray(array) || array.length === 0) {
    return [array];
  }

  const chunks = [];
  let currentChunk = [];
  let currentSize = 2; // Start with array brackets []

  for (const item of array) {
    const itemSize = estimateByteSize(item) + 1; // +1 for comma
    
    if (currentSize + itemSize > maxBytesPerChunk && currentChunk.length > 0) {
      // Current chunk would exceed limit, save it and start new one
      chunks.push(currentChunk);
      currentChunk = [item];
      currentSize = 2 + itemSize;
    } else {
      currentChunk.push(item);
      currentSize += itemSize;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [[]];
};

// Helper to reconstruct chunked array
const reconstructChunkedArray = (chunkData, keyPrefix) => {
  if (!chunkData || typeof chunkData !== 'object') {
    return [];
  }

  // Check if data is chunked (has _count property)
  const countKey = `${keyPrefix}Count`;
  if (!(countKey in chunkData)) {
    // Not chunked, return as-is
    return chunkData[keyPrefix] || [];
  }

  const chunkCount = chunkData[countKey];
  if (chunkCount === 0) {
    return [];
  }

  // Reconstruct from chunks
  const result = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunkKey = `${keyPrefix}_chunk_${i}`;
    const chunk = chunkData[chunkKey];
    if (Array.isArray(chunk)) {
      result.push(...chunk);
    }
  }

  return result;
};

// Helper to check if this is likely a fresh install
const checkIfFreshInstall = async () => {
  try {
    // Get the current blacklist and whitelist from local storage
    const data = await chrome.storage.local.get([
      'blacklist',
      'whitelist',
      'blacklistKeywords',
      'whitelistKeywords',
    ]);

    // If all lists are empty or don't exist, this might be a fresh install
    const hasNoRules =
      (!data?.blacklist || data.blacklist.length === 0) &&
      (!data?.whitelist || data.whitelist.length === 0) &&
      (!data?.blacklistKeywords || data.blacklistKeywords.length === 0) &&
      (!data?.whitelistKeywords || data.whitelistKeywords.length === 0);
    // Also check if this was recently installed (within last 5 minutes)
    const installTime = await chrome.storage.local.get(['installTime']);
    const isRecentInstall =
      installTime?.installTime && Date.now() - installTime.installTime < 5 * 60 * 1000;

    return hasNoRules && isRecentInstall;
  } catch (error) {
    debug.error('Error checking fresh install state:', error);
    return false; // Assume not fresh install on error
  }
};

export const syncStorage = {
  /**
   * Get settings from storage, selecting sync or local as appropriate
   */
  async get(items) {
    const localItems = {};
    const syncItems = {};

    // Split the items into local and sync
    Object.keys(items).forEach((key) => {
      if (shouldUseLocalStorage(key)) {
        localItems[key] = items[key];
      } else {
        syncItems[key] = items[key];
      }
    });

    const results = {};

    // Get sync items if any
    if (Object.keys(syncItems).length > 0) {
      try {
        logInfo('Getting from sync storage:', Object.keys(syncItems));
        
        // First, get the requested keys plus potential chunk metadata
        const keysToGet = {};
        Object.keys(syncItems).forEach(key => {
          keysToGet[key] = syncItems[key];
          keysToGet[`${key}Count`] = 0; // Also get chunk count if it exists
        });
        
        const syncResults = await chrome.storage.sync.get(keysToGet);
        
        // Reconstruct any chunked arrays
        for (const key of Object.keys(syncItems)) {
          if (key === 'blacklist' || key === 'whitelist' || key === 'blacklistKeywords' || key === 'whitelistKeywords') {
            const countKey = `${key}Count`;
            if (countKey in syncResults && syncResults[countKey] > 0) {
              // This is chunked data, need to get all chunks
              logInfo(`Reconstructing chunked ${key} data (${syncResults[countKey]} chunks)`);
              
              const chunkKeys = {};
              for (let i = 0; i < syncResults[countKey]; i++) {
                chunkKeys[`${key}_chunk_${i}`] = [];
              }
              
              const chunkData = await chrome.storage.sync.get(chunkKeys);
              results[key] = reconstructChunkedArray({ ...syncResults, ...chunkData }, key);
              
              logInfo(`Reconstructed ${key} with ${results[key].length} items`);
            } else if (key in syncResults) {
              // Not chunked, use as-is
              results[key] = syncResults[key];
            } else {
              // Use default
              results[key] = syncItems[key];
            }
          } else {
            // Not an array that gets chunked
            results[key] = syncResults[key] !== undefined ? syncResults[key] : syncItems[key];
          }
        }

        // Record successful sync operation
        try {
          const { syncStatusTracker } = await import('./syncDiagnostics');
          await syncStatusTracker.recordSyncSuccess('load');
        } catch (error) {
          debug.error('Failed to record sync success:', error);
        }
      } catch (error) {
        debug.error('Failed to get from sync storage, falling back to local:', error);

        // Record sync error
        try {
          const { syncStatusTracker } = await import('./syncDiagnostics');
          await syncStatusTracker.recordSyncError(error, 'load');
        } catch (syncError) {
          debug.error('Failed to record sync error:', syncError);
        }

        try {
          const localFallback = await chrome.storage.local.get(syncItems);
          Object.assign(results, localFallback);
        } catch (fallbackError) {
          debug.error('Failed to get from local storage fallback:', fallbackError);
        }
      }
    }

    // Get local items if any
    if (Object.keys(localItems).length > 0) {
      try {
        logInfo('Getting from local storage:', Object.keys(localItems));
        const localResults = await chrome.storage.local.get(localItems);
        Object.assign(results, localResults);
      } catch (error) {
        debug.error('Failed to get from local storage:', error);
      }
    }

    return results;
  },
  /**
   * Save settings to storage, selecting sync or local as appropriate
   */
  async set(items) {
    const localItems = {};
    const syncItems = {};

    // Split the items into local and sync
    Object.keys(items).forEach((key) => {
      if (shouldUseLocalStorage(key)) {
        localItems[key] = items[key];
      } else {
        syncItems[key] = items[key];
      }
    });

    // Check if this might be a fresh install to avoid overwriting cloud data
    const isLikelyFreshInstall = await checkIfFreshInstall();

    let syncSuccess = true;
    let localSuccess = true;

    // Save sync items if any
    if (Object.keys(syncItems).length > 0) {
      try {
        // For fresh installs, avoid writing empty lists to sync storage
        if (isLikelyFreshInstall) {
          const hasEmptyLists =
            (syncItems.blacklist &&
              Array.isArray(syncItems.blacklist) &&
              syncItems.blacklist.length === 0) ||
            (syncItems.whitelist &&
              Array.isArray(syncItems.whitelist) &&
              syncItems.whitelist.length === 0);

          if (hasEmptyLists) {
            logInfo(
              'Fresh install detected - skipping sync storage write for empty lists to avoid overwriting cloud data',
            );
            // Save to local storage instead
            await chrome.storage.local.set(syncItems);
            logInfo('Saved to local storage instead during fresh install');
            return true;
          }
        }

        // Handle chunking for large arrays to avoid quota errors
        const dataToStore = {};
        const keysToRemove = []; // Track old chunk keys to clean up

        for (const [key, value] of Object.entries(syncItems)) {
          // Check if this is a large array that needs chunking
          const isLargeArray = Array.isArray(value) && estimateByteSize(value) > BYTES_PER_CHUNK;
          
          if (isLargeArray && (key === 'blacklist' || key === 'whitelist' || key === 'blacklistKeywords' || key === 'whitelistKeywords')) {
            logInfo(`Chunking ${key} array (${value.length} items) to avoid quota limits`);
            
            const chunks = chunkArray(value, BYTES_PER_CHUNK);
            dataToStore[`${key}Count`] = chunks.length;
            
            chunks.forEach((chunk, index) => {
              dataToStore[`${key}_chunk_${index}`] = chunk;
            });

            // Mark the non-chunked key for removal if it exists
            keysToRemove.push(key);
            
            logInfo(`Split ${key} into ${chunks.length} chunks`);
          } else {
            // Not chunked or doesn't need chunking
            dataToStore[key] = value;
            // Clean up any old chunks if this was previously chunked
            keysToRemove.push(`${key}Count`);
          }
        }

        logInfo('Setting to sync storage:', Object.keys(dataToStore));
        await chrome.storage.sync.set(dataToStore);
        
        // Clean up old chunk keys if needed
        if (keysToRemove.length > 0) {
          try {
            await chrome.storage.sync.remove(keysToRemove);
          } catch (removeError) {
            // Non-critical error, just log it
            debug.error('Failed to remove old chunk keys:', removeError);
          }
        }
        
        logInfo('Successfully saved to sync storage');

        // Record successful sync operation
        try {
          const { syncStatusTracker } = await import('./syncDiagnostics');
          await syncStatusTracker.recordSyncSuccess('save');
        } catch (error) {
          debug.error('Failed to record sync success:', error);
        }
      } catch (error) {
        syncSuccess = false;
        debug.error('Failed to save to sync storage, falling back to local:', error);

        // Record sync error
        try {
          const { syncStatusTracker } = await import('./syncDiagnostics');
          await syncStatusTracker.recordSyncError(error, 'save');
        } catch (syncError) {
          debug.error('Failed to record sync error:', syncError);
        }

        try {
          await chrome.storage.local.set(syncItems);
          logInfo('Successfully saved to local storage (fallback)');
        } catch (fallbackError) {
          debug.error('Failed to save to local storage fallback:', fallbackError);
        }
      }
    }

    // Save local items if any
    if (Object.keys(localItems).length > 0) {
      try {
        logInfo('Setting to local storage:', Object.keys(localItems));
        await chrome.storage.local.set(localItems);
        logInfo('Successfully saved to local storage');
      } catch (error) {
        localSuccess = false;
        debug.error('Failed to save to local storage:', error);
      }
    }

    return syncSuccess && localSuccess;
  },

  async remove(keys) {
    if (typeof keys === 'string') {
      keys = [keys];
    }

    const localKeys = [];
    const syncKeys = [];

    // Split the keys into local and sync
    keys.forEach((key) => {
      if (shouldUseLocalStorage(key)) {
        localKeys.push(key);
      } else {
        syncKeys.push(key);
      }
    });

    let success = true;

    // Remove from sync storage
    if (syncKeys.length > 0) {
      try {
        logInfo('Removing from sync storage:', syncKeys);
        await chrome.storage.sync.remove(syncKeys);
      } catch (error) {
        success = false;
        debug.error('Failed to remove from sync storage:', error);
      }
    }

    // Remove from local storage
    if (localKeys.length > 0) {
      try {
        logInfo('Removing from local storage:', localKeys);
        await chrome.storage.local.remove(localKeys);
      } catch (error) {
        success = false;
        debug.error('Failed to remove from local storage:', error);
      }
    }

    return success;
  },

  /**
   * Clean up duplicate settings by removing them from inappropriate storage
   * Follows Single Responsibility Principle - only handles duplicate cleanup
   * Ensures each setting exists only in its designated storage location
   *
   * @returns {Object} Results of the cleanup operation
   */
  async cleanupDuplicateSettings() {
    const results = {
      cleanedUp: [],
      errors: [],
      success: true,
    };

    try {
      // Get all settings from both storages
      const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(null),
        chrome.storage.sync.get(null),
      ]);

      // Find duplicates - settings that exist in both storages
      const duplicates = Object.keys(localData).filter((key) =>
        syncData.hasOwnProperty(key),
      );

      for (const key of duplicates) {
        try {
          if (shouldUseLocalStorage(key)) {
            // This should be local-only, remove from sync
            await chrome.storage.sync.remove(key);
            results.cleanedUp.push(
              `Removed '${key}' from sync storage (should be local-only)`,
            );
            logInfo(`Cleaned up: removed '${key}' from sync storage`);
          } else {
            // This should be synced, remove from local
            await chrome.storage.local.remove(key);
            results.cleanedUp.push(
              `Removed '${key}' from local storage (should be synced)`,
            );
            logInfo(`Cleaned up: removed '${key}' from local storage`);
          }
        } catch (error) {
          const errorMsg = `Failed to clean up duplicate '${key}': ${error.message}`;
          results.errors.push(errorMsg);
          debug.error(errorMsg, error);
          results.success = false;
        }
      }

      if (results.cleanedUp.length === 0) {
        results.cleanedUp.push('No duplicate settings found - storage is clean');
      }
    } catch (error) {
      const errorMsg = `Failed to clean up duplicates: ${error.message}`;
      results.errors.push(errorMsg);
      debug.error(errorMsg, error);
      results.success = false;
    }

    return results;
  },

  /**
   * Migrate settings from one storage to another when storage strategy changes
   * Follows Single Responsibility Principle - only handles storage migration
   *
   * @param {Array} settingsToMigrate - Array of setting keys to migrate
   * @param {string} direction - 'toSync' or 'toLocal'
   * @returns {Object} Results of the migration
   */
  async migrateSettings(settingsToMigrate, direction) {
    const results = {
      migrated: [],
      errors: [],
      success: true,
    };

    const isToSync = direction === 'toSync';
    const sourceStorage = isToSync ? chrome.storage.local : chrome.storage.sync;
    const targetStorage = isToSync ? chrome.storage.sync : chrome.storage.local;

    try {
      // Get settings from source storage
      const sourceData = await sourceStorage.get(settingsToMigrate);
      const settingsFound = Object.keys(sourceData);

      if (settingsFound.length === 0) {
        results.migrated.push('No settings found to migrate');
        return results;
      }

      // Save to target storage
      await targetStorage.set(sourceData);

      // Remove from source storage
      await sourceStorage.remove(settingsFound);

      results.migrated = settingsFound.map(
        (key) => `Migrated '${key}' ${isToSync ? 'to sync' : 'to local'} storage`,
      );

      logInfo(`Successfully migrated ${settingsFound.length} settings ${direction}`);
    } catch (error) {
      const errorMsg = `Failed to migrate settings ${direction}: ${error.message}`;
      results.errors.push(errorMsg);
      debug.error(errorMsg, error);
      results.success = false;
    }

    return results;
  },
};

// For backward compatibility
export const storage = syncStorage;
export default syncStorage;
