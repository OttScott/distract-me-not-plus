/**
 * Settings Repository Module
 *
 * Unified settings read/write with denylist↔blacklist alias layer.
 * Internal code uses denylist/allowlist terminology.
 * Storage keys remain blacklist/whitelist for backward compatibility.
 */

import {
  STORAGE_KEY_MAP,
  INTERNAL_NAME_MAP,
  syncSettings,
  defaultSyncValues,
  defaultTimerSettings,
  defaultIsEnabled,
  defaultMode,
  defaultFramesType,
  defaultSchedule,
  defaultUnblockSettings,
  defaultLogsSettings,
} from '../constants';
import * as syncStorage from './syncStorage';
import * as localStorage from './localStorage';

/**
 * @typedef {Object} AllSettings
 * @property {boolean} isEnabled - Whether blocking is enabled
 * @property {string} mode - Blocking mode
 * @property {string[]} denylist - Deny list patterns (internal name)
 * @property {string[]} allowlist - Allow list patterns (internal name)
 * @property {string[]} denylistKeywords - Deny keywords (internal name)
 * @property {string[]} allowlistKeywords - Allow keywords (internal name)
 * @property {string[]} framesType - Frame types to block
 * @property {Object} timer - Timer settings
 * @property {Object} schedule - Schedule settings
 * @property {Object} unblock - Unblock settings
 * @property {string} redirectUrl - Custom redirect URL
 * @property {string} message - Custom block message
 * @property {boolean} enableLogs - Whether logging is enabled
 * @property {Object} password - Password settings
 */

/**
 * Convert internal key name to storage key
 * @param {string} internalKey - Internal key (denylist, allowlist, etc.)
 * @returns {string} - Storage key (blacklist, whitelist, etc.)
 */
export function toStorageKey(internalKey) {
  return STORAGE_KEY_MAP[internalKey] || internalKey;
}

/**
 * Convert storage key to internal name
 * @param {string} storageKey - Storage key (blacklist, whitelist, etc.)
 * @returns {string} - Internal name (denylist, allowlist, etc.)
 */
export function toInternalName(storageKey) {
  return INTERNAL_NAME_MAP[storageKey] || storageKey;
}

/**
 * Transform settings object from storage keys to internal names
 * @param {Object} storageSettings - Settings with storage keys
 * @returns {Object} - Settings with internal names
 */
export function toInternalSettings(storageSettings) {
  const result = {};

  for (const [key, value] of Object.entries(storageSettings)) {
    const internalKey = toInternalName(key);
    result[internalKey] = value;
  }

  return result;
}

/**
 * Transform settings object from internal names to storage keys
 * @param {Object} internalSettings - Settings with internal names
 * @returns {Object} - Settings with storage keys
 */
export function toStorageSettings(internalSettings) {
  const result = {};

  for (const [key, value] of Object.entries(internalSettings)) {
    const storageKey = toStorageKey(key);
    result[storageKey] = value;
  }

  return result;
}

/**
 * Load all settings from sync + local storage
 * @returns {Promise<AllSettings>}
 */
export async function loadSettings() {
  try {
    // Load sync settings (with chunking support for large arrays)
    const syncData = await syncStorage.getMultiple(syncSettings);

    // Load local settings
    const localData = await localStorage.get({
      isEnabled: defaultIsEnabled,
      enableLogs: defaultLogsSettings.isEnabled,
      timer: defaultTimerSettings,
      password: {},
      logs: [],
    });

    // Apply defaults for missing sync values
    const mergedSyncData = {
      blacklist: syncData.blacklist || defaultSyncValues.blacklist,
      whitelist: syncData.whitelist || defaultSyncValues.whitelist,
      blacklistKeywords:
        syncData.blacklistKeywords || defaultSyncValues.blacklistKeywords,
      whitelistKeywords:
        syncData.whitelistKeywords || defaultSyncValues.whitelistKeywords,
      mode: syncData.mode || defaultSyncValues.mode,
      framesType: syncData.framesType || defaultSyncValues.framesType,
      message: syncData.message || defaultSyncValues.message,
      redirectUrl: syncData.redirectUrl || defaultSyncValues.redirectUrl,
      schedule: syncData.schedule || defaultSyncValues.schedule,
    };

    // Combine and convert to internal names
    const combined = {
      ...mergedSyncData,
      ...localData,
    };

    return toInternalSettings(combined);
  } catch (error) {
    console.error('[SettingsRepository] Error loading settings:', error);

    // Return defaults on error
    return {
      isEnabled: defaultIsEnabled,
      mode: defaultMode,
      denylist: [],
      allowlist: [],
      denylistKeywords: [],
      allowlistKeywords: [],
      framesType: defaultFramesType,
      timer: defaultTimerSettings,
      schedule: defaultSchedule,
      unblock: defaultUnblockSettings,
      redirectUrl: '',
      message: '',
      enableLogs: false,
      password: {},
    };
  }
}

/**
 * Save deny list patterns
 * @param {string[]} patterns - Patterns to save
 * @returns {Promise<boolean>}
 */
export async function saveDenylist(patterns) {
  const storageKey = STORAGE_KEY_MAP.denylist; // 'blacklist'
  return syncStorage.saveArrayToSync(storageKey, patterns || []);
}

/**
 * Save allow list patterns
 * @param {string[]} patterns - Patterns to save
 * @returns {Promise<boolean>}
 */
export async function saveAllowlist(patterns) {
  const storageKey = STORAGE_KEY_MAP.allowlist; // 'whitelist'
  return syncStorage.saveArrayToSync(storageKey, patterns || []);
}

/**
 * Save deny list keywords
 * @param {string[]} keywords - Keywords to save
 * @returns {Promise<boolean>}
 */
export async function saveDenylistKeywords(keywords) {
  const storageKey = STORAGE_KEY_MAP.denylistKeywords; // 'blacklistKeywords'
  return syncStorage.saveArrayToSync(storageKey, keywords || []);
}

/**
 * Save allow list keywords
 * @param {string[]} keywords - Keywords to save
 * @returns {Promise<boolean>}
 */
export async function saveAllowlistKeywords(keywords) {
  const storageKey = STORAGE_KEY_MAP.allowlistKeywords; // 'whitelistKeywords'
  return syncStorage.saveArrayToSync(storageKey, keywords || []);
}

/**
 * Save mode setting
 * @param {string} mode - Mode to save
 * @returns {Promise<boolean>}
 */
export async function saveMode(mode) {
  try {
    await chrome.storage.sync.set({ mode });
    return true;
  } catch (error) {
    console.error('[SettingsRepository] Error saving mode:', error);
    return false;
  }
}

/**
 * Save enabled state
 * @param {boolean} isEnabled - Enabled state
 * @returns {Promise<boolean>}
 */
export async function saveIsEnabled(isEnabled) {
  return localStorage.set({ isEnabled });
}

/**
 * Save timer settings
 * @param {Object} timer - Timer settings
 * @returns {Promise<boolean>}
 */
export async function saveTimer(timer) {
  return localStorage.set({ timer });
}

/**
 * Save schedule settings
 * @param {Object} schedule - Schedule settings
 * @returns {Promise<boolean>}
 */
export async function saveSchedule(schedule) {
  try {
    await chrome.storage.sync.set({ schedule });
    return true;
  } catch (error) {
    console.error('[SettingsRepository] Error saving schedule:', error);
    return false;
  }
}

/**
 * Save unblock settings
 * @param {Object} unblock - Unblock settings
 * @returns {Promise<boolean>}
 */
export async function saveUnblock(unblock) {
  try {
    await chrome.storage.sync.set({ unblock });
    return true;
  } catch (error) {
    console.error('[SettingsRepository] Error saving unblock settings:', error);
    return false;
  }
}

/**
 * Save logging settings
 * @param {boolean} enableLogs - Whether to enable logs
 * @returns {Promise<boolean>}
 */
export async function saveLogsSettings(enableLogs) {
  return localStorage.set({ enableLogs });
}

/**
 * Get deny list patterns (using internal name)
 * @returns {Promise<string[]>}
 */
export async function getDenylist() {
  const storageKey = STORAGE_KEY_MAP.denylist;
  const data = await syncStorage.loadArrayFromSync(storageKey);
  return data || [];
}

/**
 * Get allow list patterns (using internal name)
 * @returns {Promise<string[]>}
 */
export async function getAllowlist() {
  const storageKey = STORAGE_KEY_MAP.allowlist;
  const data = await syncStorage.loadArrayFromSync(storageKey);
  return data || [];
}

/**
 * Get deny list keywords
 * @returns {Promise<string[]>}
 */
export async function getDenylistKeywords() {
  const storageKey = STORAGE_KEY_MAP.denylistKeywords;
  const data = await syncStorage.loadArrayFromSync(storageKey);
  return data || [];
}

/**
 * Get allow list keywords
 * @returns {Promise<string[]>}
 */
export async function getAllowlistKeywords() {
  const storageKey = STORAGE_KEY_MAP.allowlistKeywords;
  const data = await syncStorage.loadArrayFromSync(storageKey);
  return data || [];
}

/**
 * Get enabled state
 * @returns {Promise<boolean>}
 */
export async function getIsEnabled() {
  const data = await localStorage.get({ isEnabled: defaultIsEnabled });
  return data.isEnabled;
}

/**
 * Get current mode
 * @returns {Promise<string>}
 */
export async function getMode() {
  try {
    const data = await chrome.storage.sync.get({ mode: defaultMode });
    return data.mode || defaultMode;
  } catch (error) {
    return defaultMode;
  }
}

/**
 * Batch save multiple settings
 * @param {Object} settings - Settings to save (with internal names)
 * @returns {Promise<Object>} - Results for each setting
 */
export async function saveMultiple(settings) {
  const results = {};

  for (const [key, value] of Object.entries(settings)) {
    switch (key) {
      case 'denylist':
        results.denylist = await saveDenylist(value);
        break;
      case 'allowlist':
        results.allowlist = await saveAllowlist(value);
        break;
      case 'denylistKeywords':
        results.denylistKeywords = await saveDenylistKeywords(value);
        break;
      case 'allowlistKeywords':
        results.allowlistKeywords = await saveAllowlistKeywords(value);
        break;
      case 'mode':
        results.mode = await saveMode(value);
        break;
      case 'isEnabled':
        results.isEnabled = await saveIsEnabled(value);
        break;
      case 'timer':
        results.timer = await saveTimer(value);
        break;
      case 'schedule':
        results.schedule = await saveSchedule(value);
        break;
      default:
        console.warn(`[SettingsRepository] Unknown setting: ${key}`);
    }
  }

  return results;
}

// Export default object
const settingsRepositoryModule = {
  loadSettings,
  saveDenylist,
  saveAllowlist,
  saveDenylistKeywords,
  saveAllowlistKeywords,
  saveMode,
  saveIsEnabled,
  saveTimer,
  saveSchedule,
  saveUnblock,
  saveLogsSettings,
  getDenylist,
  getAllowlist,
  getDenylistKeywords,
  getAllowlistKeywords,
  getIsEnabled,
  getMode,
  saveMultiple,
  toStorageKey,
  toInternalName,
  toInternalSettings,
  toStorageSettings,
};
export default settingsRepositoryModule;
