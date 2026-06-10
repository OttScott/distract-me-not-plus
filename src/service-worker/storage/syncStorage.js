/**
 * Sync Storage Module
 *
 * Wraps chrome.storage.sync with chunking support for large arrays.
 * Extracted from service-worker.js chunking logic (lines 93-200).
 */

import { SYNC_STORAGE_MAX_ITEM_SIZE, CHUNKABLE_KEYS } from '../constants';

/**
 * Calculate the byte size of data when serialized to JSON
 * @param {any} data - Data to measure
 * @returns {number} - Size in bytes
 */
export function getDataSize(data) {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch (e) {
    // Fallback for environments without Blob
    return JSON.stringify(data).length * 2; // Approximate UTF-16
  }
}

/**
 * Split an array into chunks that fit within sync storage limits
 * @param {any[]} array - Array to chunk
 * @param {string} key - Storage key (used for overhead calculation)
 * @returns {{ chunks: any[][], metadata: Object }}
 */
export function chunkArray(array, key) {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return {
      chunks: [],
      metadata: {
        totalChunks: 0,
        totalCount: 0,
        key,
      },
    };
  }

  const chunks = [];
  let currentChunk = [];
  const keyOverhead = (key?.length || 0) + 20;
  const maxChunkDataSize = SYNC_STORAGE_MAX_ITEM_SIZE - keyOverhead - 100;

  for (const item of array) {
    const testChunk = [...currentChunk, item];
    const testSize = getDataSize(testChunk);

    if (testSize > maxChunkDataSize && currentChunk.length > 0) {
      chunks.push([...currentChunk]);
      currentChunk = [item];
    } else {
      currentChunk.push(item);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return {
    chunks,
    metadata: {
      totalChunks: chunks.length,
      totalCount: array.length,
      key,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Save an array to sync storage, chunking if necessary
 * @param {string} key - Storage key
 * @param {any[]} array - Array to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveArrayToSync(key, array) {
  const dataSize = getDataSize(array);

  try {
    // Check if chunking is needed
    if (dataSize > SYNC_STORAGE_MAX_ITEM_SIZE - 500) {
      console.log(
        `[SyncStorage] Chunking ${key} before sync (${array.length} items, ${dataSize} bytes)`,
      );
      const { chunks, metadata } = chunkArray(array, key);

      // Write chunks one at a time
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        await chrome.storage.sync.set({ [chunkKey]: chunks[i] });
        console.log(
          `[SyncStorage] Wrote chunk ${i}/${chunks.length - 1}: ${chunks[i].length} items`,
        );
      }

      // Write metadata
      await chrome.storage.sync.set({ [`${key}_metadata`]: metadata });

      // Clean up old monolithic key
      try {
        await chrome.storage.sync.remove([key]);
      } catch (e) {
        // Ignore
      }

      // Also save to local storage as fallback
      await chrome.storage.local.set({ [key]: array });
      console.log(`[SyncStorage] Successfully chunked and saved ${key} to sync storage`);

      return true;
    } else {
      // Small enough - save normally
      await chrome.storage.sync.set({ [key]: array });
      await chrome.storage.local.set({ [key]: array });
      console.log(
        `[SyncStorage] Saved ${key} to sync storage (${dataSize} bytes, no chunking needed)`,
      );

      return true;
    }
  } catch (error) {
    console.error(`[SyncStorage] Error saving ${key}:`, error);

    // Try local storage as fallback
    try {
      await chrome.storage.local.set({ [key]: array });
      console.log(`[SyncStorage] Saved ${key} to local storage as fallback`);
    } catch (localError) {
      console.error(`[SyncStorage] Local storage fallback also failed:`, localError);
    }

    return false;
  }
}

/**
 * Load an array from sync storage, handling chunked data
 * @param {string} key - Storage key
 * @returns {Promise<any[]|undefined>}
 */
export async function loadArrayFromSync(key) {
  try {
    // Check if there's chunked data
    const metadataKey = `${key}_metadata`;
    const metadataResult = await chrome.storage.sync.get(metadataKey);
    const metadata = metadataResult?.[metadataKey];

    if (metadata && metadata.totalChunks > 0) {
      console.log(
        `[SyncStorage] Dechunking ${key} (${metadata.totalChunks} chunks, ${metadata.totalCount} items)`,
      );

      // Load all chunks
      const chunkKeys = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        chunkKeys.push(`${key}_chunk_${i}`);
      }

      const chunksData = await chrome.storage.sync.get(chunkKeys);

      // Reconstruct array
      const result = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        const chunk = chunksData[chunkKey];
        if (chunk && Array.isArray(chunk)) {
          result.push(...chunk);
        }
      }

      console.log(`[SyncStorage] Dechunked ${key}: ${result.length} items`);
      return result;
    } else {
      // Not chunked - load normally
      const result = await chrome.storage.sync.get(key);
      return result[key];
    }
  } catch (error) {
    console.error(`[SyncStorage] Error loading ${key}:`, error);
    return undefined;
  }
}

/**
 * Get sync storage bytes in use
 * @returns {Promise<number>}
 */
export async function getSyncBytesInUse() {
  try {
    return await new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(null, (bytes) => {
        resolve(bytes || 0);
      });
    });
  } catch (error) {
    console.error('[SyncStorage] Error getting bytes in use:', error);
    return 0;
  }
}

/**
 * Get sync storage quota information
 * @returns {Promise<Object>}
 */
export async function getSyncQuota() {
  try {
    const bytesInUse = await getSyncBytesInUse();
    const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400;

    return {
      bytesInUse,
      maxBytes,
      percentUsed: ((bytesInUse / maxBytes) * 100).toFixed(2),
      bytesRemaining: maxBytes - bytesInUse,
    };
  } catch (error) {
    console.error('[SyncStorage] Error getting quota:', error);
    return {
      bytesInUse: 0,
      maxBytes: 102400,
      percentUsed: '0',
      bytesRemaining: 102400,
      error: error.message,
    };
  }
}

/**
 * Clean up orphaned chunks for a key
 * @param {string} key - Base key
 * @returns {Promise<void>}
 */
export async function cleanupOrphanedChunks(key) {
  try {
    // Get all sync storage keys
    const allData = await chrome.storage.sync.get(null);
    const allKeys = Object.keys(allData);

    // Find chunk keys for this key
    const chunkPattern = new RegExp(`^${key}_chunk_\\d+$`);
    const chunkKeys = allKeys.filter((k) => chunkPattern.test(k));

    // Remove chunks and metadata
    const keysToRemove = [...chunkKeys, `${key}_metadata`];
    if (keysToRemove.length > 0) {
      await chrome.storage.sync.remove(keysToRemove);
      console.log(
        `[SyncStorage] Cleaned up ${keysToRemove.length} orphaned keys for ${key}`,
      );
    }
  } catch (error) {
    console.error(`[SyncStorage] Error cleaning up chunks for ${key}:`, error);
  }
}

/**
 * Check if a key is stored as chunks
 * @param {string} key - Storage key
 * @returns {Promise<boolean>}
 */
export async function isChunked(key) {
  try {
    const metadataKey = `${key}_metadata`;
    const result = await chrome.storage.sync.get(metadataKey);
    const metadata = result?.[metadataKey];
    return metadata && metadata.totalChunks > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get data for multiple keys, handling chunked arrays
 * @param {string[]} keys - Keys to get
 * @returns {Promise<Object>}
 */
export async function getMultiple(keys) {
  const result = {};

  for (const key of keys) {
    if (CHUNKABLE_KEYS.includes(key)) {
      // May be chunked - use special loader
      const value = await loadArrayFromSync(key);
      if (value !== undefined) {
        result[key] = value;
      } else {
        // Try direct get as fallback
        const direct = await chrome.storage.sync.get(key);
        result[key] = direct[key];
      }
    } else {
      // Regular key - direct get
      const direct = await chrome.storage.sync.get(key);
      result[key] = direct[key];
    }
  }

  return result;
}
