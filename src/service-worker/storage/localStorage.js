/**
 * Local Storage Module
 *
 * Wraps chrome.storage.local operations.
 * Provides a consistent interface for local storage access.
 */

/**
 * Get data from local storage
 * @param {string|string[]|Object} keys - Keys to get (or defaults object)
 * @returns {Promise<Object>}
 */
export async function get(keys) {
  try {
    return await new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(chrome.runtime.lastError.message || 'Local storage get error'),
          );
        } else {
          resolve(result || {});
        }
      });
    });
  } catch (error) {
    console.error('[LocalStorage] Error getting data:', error);
    return typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
  }
}

/**
 * Set data to local storage
 * @param {Object} data - Data to set
 * @returns {Promise<boolean>}
 */
export async function set(data) {
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(chrome.runtime.lastError.message || 'Local storage set error'),
          );
        } else {
          resolve();
        }
      });
    });
    return true;
  } catch (error) {
    console.error('[LocalStorage] Error setting data:', error);
    return false;
  }
}

/**
 * Remove keys from local storage
 * @param {string|string[]} keys - Keys to remove
 * @returns {Promise<boolean>}
 */
export async function remove(keys) {
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(chrome.runtime.lastError.message || 'Local storage remove error'),
          );
        } else {
          resolve();
        }
      });
    });
    return true;
  } catch (error) {
    console.error('[LocalStorage] Error removing data:', error);
    return false;
  }
}

/**
 * Clear all local storage
 * @returns {Promise<boolean>}
 */
export async function clear() {
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(chrome.runtime.lastError.message || 'Local storage clear error'),
          );
        } else {
          resolve();
        }
      });
    });
    return true;
  } catch (error) {
    console.error('[LocalStorage] Error clearing storage:', error);
    return false;
  }
}

/**
 * Get bytes in use by local storage
 * @param {string|string[]|null} keys - Keys to check (null for all)
 * @returns {Promise<number>}
 */
export async function getBytesInUse(keys = null) {
  try {
    return await new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(keys, (bytes) => {
        resolve(bytes || 0);
      });
    });
  } catch (error) {
    console.error('[LocalStorage] Error getting bytes in use:', error);
    return 0;
  }
}

/**
 * Check if a key exists in local storage
 * @param {string} key - Key to check
 * @returns {Promise<boolean>}
 */
export async function has(key) {
  try {
    const result = await get([key]);
    return key in result;
  } catch (error) {
    return false;
  }
}

/**
 * Get a single value with optional default
 * @param {string} key - Key to get
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {Promise<any>}
 */
export async function getValue(key, defaultValue = undefined) {
  try {
    const result = await get({ [key]: defaultValue });
    return result[key];
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Set a single value
 * @param {string} key - Key to set
 * @param {any} value - Value to set
 * @returns {Promise<boolean>}
 */
export async function setValue(key, value) {
  return set({ [key]: value });
}

/**
 * Add listener for local storage changes
 * @param {Function} callback - Callback function (changes, areaName)
 * @returns {Function} - Remove listener function
 */
export function addChangeListener(callback) {
  const listener = (changes, areaName) => {
    if (areaName === 'local') {
      callback(changes, areaName);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Return function to remove listener
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Get multiple values with defaults
 * @param {Object} defaults - Object with keys and default values
 * @returns {Promise<Object>}
 */
export async function getWithDefaults(defaults) {
  return get(defaults);
}

// Export as default object for convenience
const localStorageModule = {
  get,
  set,
  remove,
  clear,
  getBytesInUse,
  has,
  getValue,
  setValue,
  addChangeListener,
  getWithDefaults,
};
export default localStorageModule;
