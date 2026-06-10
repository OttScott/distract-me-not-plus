/**
 * Unified constants for the service worker
 *
 * This module consolidates constants from both Chrome service-worker.js and
 * Firefox Background component into a single source of truth.
 *
 * IMPORTANT: Storage keys remain 'blacklist'/'whitelist' for backward compatibility.
 * Internal code uses denylist/allowlist terminology.
 */

// Re-export from existing helpers where available
import { defaultTimerSettings, unactiveTimerRuntimeSettings } from '../helpers/timer';
import { defaultSchedule } from '../helpers/schedule';
import { defaultLogsSettings } from '../helpers/logger';
import {
  Mode,
  Action,
  FramesType,
  UnblockOptions,
  defaultIsEnabled,
  defaultAction,
  defaultMode,
  defaultFramesType,
  defaultBlacklist,
  defaultWhitelist,
  defaultBlockSettings,
  defaultUnblockSettings,
  defaultPasswordSettings,
} from '../helpers/block';
import {
  SYNC_STORAGE_MAX_SIZE,
  SYNC_STORAGE_MAX_ITEM_SIZE,
  SYNC_CHUNK_SIZE,
  SYNC_VERSION_KEY,
  MAX_REGEX_LENGTH,
  SYNC_POLL_MAX_ATTEMPTS,
  SYNC_POLL_INTERVAL_MS,
  SYNC_POLL_TIMEOUT_MS,
} from '../helpers/constants';

// Re-export helper constants
export {
  // Timer
  defaultTimerSettings,
  unactiveTimerRuntimeSettings,
  // Schedule
  defaultSchedule,
  // Logging
  defaultLogsSettings,
  // Blocking
  Mode,
  Action,
  FramesType,
  UnblockOptions,
  defaultIsEnabled,
  defaultAction,
  defaultMode,
  defaultFramesType,
  defaultBlacklist,
  defaultWhitelist,
  defaultBlockSettings,
  defaultUnblockSettings,
  defaultPasswordSettings,
  // Storage
  SYNC_STORAGE_MAX_SIZE,
  SYNC_STORAGE_MAX_ITEM_SIZE,
  SYNC_CHUNK_SIZE,
  SYNC_VERSION_KEY,
  MAX_REGEX_LENGTH,
  SYNC_POLL_MAX_ATTEMPTS,
  SYNC_POLL_INTERVAL_MS,
  SYNC_POLL_TIMEOUT_MS,
};

// ============================================================================
// Service Worker Specific Constants
// ============================================================================

/**
 * Default timer runtime state
 */
export const defaultTimerRuntime = {
  duration: 0,
  endDate: 0,
  remainingDuration: 0,
};

/**
 * declarativeNetRequest constants (Chrome only)
 */
export const MAX_RULES = 5000; // Chrome has a limit of 5000 dynamic rules
export const BASE_RULE_ID = 1000; // Starting rule ID

/**
 * Debug logging control flag
 */
export const ENABLE_DEEP_DEBUGGING = false;

// ============================================================================
// Storage Key Configuration
// ============================================================================

/**
 * Settings stored in chrome.storage.sync
 * These sync across user's devices
 */
export const syncSettings = [
  'blacklist',
  'whitelist',
  'blacklistKeywords',
  'whitelistKeywords',
  'mode',
  'framesType',
  'message',
  'redirectUrl',
  'schedule',
];

/**
 * Settings stored in chrome.storage.local
 * These are device-specific
 */
export const localSettings = ['isEnabled', 'enableLogs', 'timer', 'password', 'logs'];

/**
 * Storage key mapping for internal denylist/allowlist terminology
 * Maps internal names to storage keys for backward compatibility
 *
 * Internal code uses: denylist, allowlist, denylistKeywords, allowlistKeywords
 * Storage uses: blacklist, whitelist, blacklistKeywords, whitelistKeywords
 */
export const STORAGE_KEY_MAP = {
  denylist: 'blacklist',
  allowlist: 'whitelist',
  denylistKeywords: 'blacklistKeywords',
  allowlistKeywords: 'whitelistKeywords',
};

/**
 * Reverse mapping: storage key → internal name
 */
export const INTERNAL_NAME_MAP = {
  blacklist: 'denylist',
  whitelist: 'allowlist',
  blacklistKeywords: 'denylistKeywords',
  whitelistKeywords: 'allowlistKeywords',
};

/**
 * Keys that may need chunking for sync storage (large arrays)
 */
export const CHUNKABLE_KEYS = [
  'blacklist',
  'whitelist',
  'blacklistKeywords',
  'whitelistKeywords',
];

// ============================================================================
// Mode Aliases (for terminology migration)
// ============================================================================

/**
 * Mode value mapping (internal terminology → storage value)
 * The Mode enum in helpers/block.js already handles this:
 * - Mode.denylist = 'denylist'
 * - Mode.allowlist = 'allowlist'
 * - Mode.blacklist = 'denylist' (alias)
 * - Mode.whitelist = 'allowlist' (alias)
 */
export const ModeValues = {
  DENYLIST: 'denylist',
  ALLOWLIST: 'allowlist',
  COMBINED: 'combined',
  // Legacy aliases
  BLACKLIST: 'denylist',
  WHITELIST: 'allowlist',
};

// ============================================================================
// Default State
// ============================================================================

/**
 * Default state for the service worker
 */
export const defaultState = {
  isEnabled: defaultIsEnabled,
  mode: defaultMode,
  action: defaultAction,
  framesType: defaultFramesType,
  denylist: [],
  allowlist: [],
  denylistKeywords: [],
  allowlistKeywords: [],
  timer: defaultTimerSettings,
  schedule: defaultSchedule,
  unblock: defaultUnblockSettings,
  redirectUrl: '',
  enableLogs: false,
  blockAccessToExtensionsPage: false,
  isPasswordEnabled: false,
  tmpAllowed: [],
  accessTokens: [],
};

/**
 * Default sync storage values (used for fallback)
 */
export const defaultSyncValues = {
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

/**
 * Context menu IDs
 */
export const ContextMenuIds = {
  BLOCK_CURRENT_DOMAIN: 'block_current_domain',
  BLOCK_CURRENT_URL: 'block_current_url',
  SETTINGS: 'settings',
  DENYLIST_SETTINGS: 'blacklist_settings', // Storage key kept for compatibility
  ALLOWLIST_SETTINGS: 'whitelist_settings', // Storage key kept for compatibility
};
