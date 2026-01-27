/**
 * Enhanced storage helper that supports syncing settings across devices
 * with intelligent fallbacks to local storage when needed.
 *
 * Implements chunking for large arrays to work within Chrome's sync storage limits:
 * - Per-item limit: 8KB (8,192 bytes)
 * - Total quota: 100KB (102,400 bytes)
 */

import { debug, logInfo } from './debug';
import { SYNC_STORAGE_MAX_ITEM_SIZE, SYNC_CHUNK_SIZE, SYNC_VERSION_KEY } from './constants';

// Settings that should be chunked if they exceed size limits
const chunkableSettings = [
  'blacklist',
  'whitelist',
  'blacklistKeywords',
  'whitelistKeywords',
];

/**
 * Chunking utilities for handling large arrays in sync storage
 */

// Calculate size of data in bytes
const getDataSize = (data) => {
  return new Blob([JSON.stringify(data)]).size;
};

// Check if array needs chunking
const needsChunking = (array) => {
  if (!Array.isArray(array)) return false;
  // Conservative estimate: leave room for key name + JSON overhead
  return getDataSize(array) > SYNC_STORAGE_MAX_ITEM_SIZE - 500;
};

// Split array into chunks that fit within size limit
const chunkArray = (array, key) => {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return { chunks: [], metadata: { totalChunks: 0, totalCount: 0, key } };
  }

  const chunks = [];
  let currentChunk = [];

  // Account for storage key overhead (e.g., "whitelist_chunk_99" = ~20 bytes)
  const keyOverhead = key.length + 20; // "_chunk_" + chunk number
  const maxChunkDataSize = SYNC_STORAGE_MAX_ITEM_SIZE - keyOverhead - 100; // Extra buffer for JSON

  for (const item of array) {
    // Test if adding this item would exceed the limit
    const testChunk = [...currentChunk, item];
    const testSize = getDataSize(testChunk);

    // If test chunk exceeds limit, save current and start new
    if (testSize > maxChunkDataSize && currentChunk.length > 0) {
      chunks.push([...currentChunk]);
      currentChunk = [item];
    } else {
      currentChunk.push(item);
    }
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const metadata = {
    totalChunks: chunks.length,
    totalCount: array.length,
    key,
    lastUpdated: new Date().toISOString(),
  };

  logInfo(`Chunked ${key}: ${array.length} items into ${chunks.length} chunks`);

  // Verify chunk sizes
  chunks.forEach((chunk, i) => {
    const chunkSize = getDataSize(chunk);
    logInfo(`  Chunk ${i}: ${chunk.length} items, ${chunkSize} bytes`);
    if (chunkSize > maxChunkDataSize) {
      debug.error(
        `WARNING: Chunk ${i} size ${chunkSize} exceeds limit ${maxChunkDataSize}!`,
      );
    }
  });

  return { chunks, metadata };
};

// Reconstruct array from chunks
const dechunkArray = async (key, storage) => {
  try {
    // Get metadata first
    const metadataKey = `${key}_metadata`;
    const metadataResult = await storage.get(metadataKey);
    const metadata = metadataResult?.[metadataKey];

    if (!metadata || metadata.totalChunks === 0) {
      // No chunks, return empty array
      return [];
    }

    // Get all chunks
    const chunkKeys = Array.from(
      { length: metadata.totalChunks },
      (_, i) => `${key}_chunk_${i}`,
    );
    const chunksData = await storage.get(chunkKeys);

    // Reconstruct array
    const result = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkKey = `${key}_chunk_${i}`;
      const chunk = chunksData[chunkKey];
      if (chunk && Array.isArray(chunk)) {
        result.push(...chunk);
      }
    }

    logInfo(
      `Dechunked ${key}: ${result.length} items from ${metadata.totalChunks} chunks`,
    );
    return result;
  } catch (error) {
    debug.error(`Failed to dechunk ${key}:`, error);
    return [];
  }
};

// Clean up old chunks for a key
// eslint-disable-next-line no-unused-vars
const cleanupChunks = async (key, storage) => {
  try {
    // Get all storage items
    const allItems = await storage.get(null);
    const keysToRemove = [];

    // Find all chunk-related keys
    Object.keys(allItems).forEach((itemKey) => {
      if (itemKey.startsWith(`${key}_chunk_`) || itemKey === `${key}_metadata`) {
        keysToRemove.push(itemKey);
      }
    });

    if (keysToRemove.length > 0) {
      await storage.remove(keysToRemove);
      logInfo(`Cleaned up ${keysToRemove.length} chunk keys for ${key}`);
    }
  } catch (error) {
    debug.error(`Failed to cleanup chunks for ${key}:`, error);
  }
};

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

        // Build list of keys to request, including metadata keys for chunkable settings
        const keysToRequest = { ...syncItems };
        const chunkableKeysRequested = Object.keys(syncItems).filter((key) =>
          chunkableSettings.includes(key),
        );

        // Also request metadata keys for any chunkable settings
        for (const key of chunkableKeysRequested) {
          keysToRequest[`${key}_metadata`] = null;
        }

        const syncResults = await chrome.storage.sync.get(keysToRequest);

        // Check for chunked data and dechunk if needed
        for (const key of chunkableKeysRequested) {
          const metadataKey = `${key}_metadata`;
          const metadata = syncResults[metadataKey];

          logInfo(`Checking ${key} for chunked data. Metadata:`, metadata);

          if (metadata && metadata.totalChunks > 0) {
            // Dechunk the array
            logInfo(`Dechunking ${key} with ${metadata.totalChunks} chunks`);
            const dechunked = await dechunkArray(key, chrome.storage.sync);
            syncResults[key] = dechunked;
            logInfo(`Dechunked ${key}: ${dechunked.length} items`);
          } else if (
            !syncResults[key] ||
            (Array.isArray(syncResults[key]) && syncResults[key].length === 0)
          ) {
            // No metadata and no direct value - might have old chunks, try to dechunk anyway
            logInfo(`No metadata for ${key}, checking if chunks exist anyway`);
            const dechunked = await dechunkArray(key, chrome.storage.sync);
            if (dechunked.length > 0) {
              syncResults[key] = dechunked;
              logInfo(`Found orphaned chunks for ${key}: ${dechunked.length} items`);
            }
          }

          // Clean up metadata from results (don't expose to caller)
          delete syncResults[metadataKey];
        }

        Object.assign(results, syncResults);

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

        // Prepare items for sync storage with chunking
        const itemsToLocal = {}; // Also save to local as fallback

        for (const [key, value] of Object.entries(syncItems)) {
          // CRITICAL SAFETY CHECK: Prevent overwriting existing data with empty arrays
          if (
            chunkableSettings.includes(key) &&
            Array.isArray(value) &&
            value.length === 0
          ) {
            debug.log(`Attempting to write empty ${key} to sync - checking for existing data`);
            
            // Check if there's existing data in sync storage (direct or chunked)
            try {
              // First check for metadata which has timestamp
              const metadataKey = `${key}_metadata`;
              const metadataResult = await chrome.storage.sync.get(metadataKey);
              const existingMetadata = metadataResult?.[metadataKey];
              
              if (existingMetadata) {
                const ageMinutes = (Date.now() - new Date(existingMetadata.lastUpdated).getTime()) / 60000;
                debug.error(
                  `PREVENTED DATA LOSS: Found existing ${key} metadata (${existingMetadata.totalCount} items, last updated ${ageMinutes.toFixed(1)} minutes ago)`,
                );
                debug.error(`Refusing to overwrite with empty array! Saving to local storage only.`);
                await chrome.storage.local.set({ [key]: value });
                continue; // Skip sync write for this key
              }
              
              // If no metadata, check for direct value
              const existingData = await this.get({ [key]: [] });
              if (existingData[key] && existingData[key].length > 0) {
                debug.error(
                  `PREVENTED DATA LOSS: Found existing ${key} data (${existingData[key].length} items, no metadata)`,
                );
                debug.error(`Refusing to overwrite with empty array! Saving to local storage only.`);
                await chrome.storage.local.set({ [key]: value });
                continue; // Skip sync write for this key
              }
              
              debug.log(`No existing ${key} data found in sync, allowing empty array write`);
            } catch (checkError) {
              debug.error(`Error checking existing ${key} data:`, checkError);
              // On error, be conservative and skip sync write
              debug.error(`Being conservative: skipping sync write due to check error`);
              await chrome.storage.local.set({ [key]: value });
              continue;
            }
          }

          if (
            chunkableSettings.includes(key) &&
            Array.isArray(value) &&
            needsChunking(value)
          ) {
            // This array needs chunking
            logInfo(
              `Chunking ${key} before sync (${value.length} items, ${getDataSize(value)} bytes)`,
            );

            const { chunks, metadata } = chunkArray(value, key);

            // Store chunks to sync ONE AT A TIME
            for (let i = 0; i < chunks.length; i++) {
              const chunkKey = `${key}_chunk_${i}`;
              const chunkData = { [chunkKey]: chunks[i] };
              logInfo(
                `Writing chunk ${i}/${chunks.length - 1}: ${chunkKey} (${getDataSize(chunks[i])} bytes)`,
              );
              await chrome.storage.sync.set(chunkData);
            }

            // Store metadata to sync
            const metadataKey = `${key}_metadata`;
            logInfo(`Writing metadata: ${metadataKey}`);
            await chrome.storage.sync.set({ [metadataKey]: metadata });

            // Store original data to local storage
            itemsToLocal[key] = value;

            // Clean up old monolithic key from sync if it exists
            try {
              await chrome.storage.sync.remove([key]);
              logInfo(`Removed old monolithic key: ${key}`);
            } catch (e) {
              // Ignore errors, key might not exist
            }
          } else {
            // Store normally to sync
            logInfo(`Writing ${key} to sync (${getDataSize(value)} bytes)`);
            await chrome.storage.sync.set({ [key]: value });
            // Also store to local as fallback
            itemsToLocal[key] = value;
          }
        }

        logInfo('Successfully saved all items to sync storage');

        // Update global sync version timestamp
        const syncVersion = {
          lastUpdated: new Date().toISOString(),
          keys: Object.keys(syncItems),
        };
        await chrome.storage.sync.set({ [SYNC_VERSION_KEY]: syncVersion });
        logInfo(`Updated sync version: ${syncVersion.lastUpdated}`);

        // Also save to local storage as fallback
        if (Object.keys(itemsToLocal).length > 0) {
          await chrome.storage.local.set(itemsToLocal);
          logInfo('Also saved to local storage as fallback:', Object.keys(itemsToLocal));
        }

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

  /**
   * Migrate existing large arrays from local/monolithic sync to chunked sync storage
   * This fixes the quota exceeded issue for users with large lists
   */
  async migrateToChunkedStorage() {
    const results = {
      migrated: [],
      skipped: [],
      errors: [],
    };

    try {
      // Check both local and sync storage for chunkable settings
      const localData = await chrome.storage.local.get(chunkableSettings);
      const syncData = await chrome.storage.sync.get(chunkableSettings);

      for (const key of chunkableSettings) {
        try {
          // Check if data exists in local storage (incorrectly stored)
          const localValue = localData[key];
          const syncValue = syncData[key];

          // If we have data in local storage and it's large, migrate it
          if (localValue && Array.isArray(localValue) && localValue.length > 0) {
            const dataSize = getDataSize(localValue);

            if (dataSize > SYNC_CHUNK_SIZE) {
              logInfo(
                `Migrating ${key} from local storage (${localValue.length} items, ${dataSize} bytes)`,
              );

              // Use set() which will handle chunking
              await this.set({ [key]: localValue });

              // Remove from local storage after successful sync
              await chrome.storage.local.remove([key]);

              results.migrated.push({
                key,
                itemCount: localValue.length,
                size: dataSize,
              });
            } else {
              results.skipped.push({
                key,
                reason: 'Already small enough',
                itemCount: localValue.length,
              });
            }
          }
          // If we have monolithic data in sync (shouldn't happen after quota error, but check anyway)
          else if (syncValue && Array.isArray(syncValue) && needsChunking(syncValue)) {
            logInfo(`Re-chunking ${key} in sync storage (${syncValue.length} items)`);

            // Remove old monolithic key
            await chrome.storage.sync.remove([key]);

            // Re-save with chunking
            await this.set({ [key]: syncValue });

            results.migrated.push({
              key,
              itemCount: syncValue.length,
              size: getDataSize(syncValue),
            });
          } else {
            results.skipped.push({
              key,
              reason: 'No data or already chunked',
            });
          }
        } catch (error) {
          debug.error(`Failed to migrate ${key}:`, error);
          results.errors.push({ key, error: error.message });
        }
      }

      logInfo('Migration complete:', results);
      return results;
    } catch (error) {
      debug.error('Migration failed:', error);
      results.errors.push({ error: error.message });
      return results;
    }
  },
};

// For backward compatibility
export const storage = syncStorage;
export default syncStorage;
