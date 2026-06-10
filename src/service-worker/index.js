/**
 * Service Worker Entry Point
 *
 * Main entry point for the unified service worker.
 * Imports all modules and initializes the service worker.
 *
 * This file gets bundled for both:
 * - Chrome (service worker)
 * - Firefox (event page / background script)
 */

// ============================================================================
// Module Imports
// ============================================================================

// Constants
import {
  defaultState as _defaultState,
  defaultSyncValues,
  defaultTimerSettings,
  defaultMode,
  defaultFramesType,
  defaultIsEnabled,
  syncSettings,
  localSettings as _localSettings,
  CHUNKABLE_KEYS,
  ENABLE_DEEP_DEBUGGING,
  Mode as _Mode,
  Action,
} from './constants';

// Rules
import { compileRules, getRulesSummary } from './rules/ruleCompiler';

// Engine
import {
  checkUrlShouldBeBlocked,
  isUrlStillBlocked as _isUrlStillBlocked,
} from './engine/decisionEngine';
import { evaluateUrlForMode as _evaluateUrlForMode } from './engine/blockingModes';
import {
  executeBlockAction as _executeBlockAction,
  buildBlockedPageUrl,
  getExtensionIndexUrl,
} from './engine/blockActions';
import {
  addToCache,
  isInCache,
  clearCache as clearBlockedCache,
  addUrlPair as _addUrlPair,
} from './engine/dedupe';

// Storage
import * as syncStorage from './storage/syncStorage';
import * as localStorage from './storage/localStorage';
import * as settingsRepository from './storage/settingsRepository';
import {
  isLikelyFreshInstall,
  forcePullFromSyncStorage,
  initializeSyncProtection,
  safeSaveToSync as _safeSaveToSync,
} from './storage/syncProtection';

// Features
import {
  isTimerActive,
  getTimerSettings,
  startTimer,
  stopTimer,
  resumeTimer,
} from './features/timer';
import {
  parseTodaySchedule as _parseTodaySchedule,
  isBlockingScheduleActive as _isBlockingScheduleActive,
} from './features/schedule';
import {
  isTmpAllowed as _isTmpAllowed,
  removeOutdatedTmpAllowed as _removeOutdatedTmpAllowed,
  unblockTab,
} from './features/tempAllow';
import {
  initContextMenus as _initContextMenus,
  setupContextMenuListeners as _setupContextMenuListeners,
  handleContextMenusClick as _handleContextMenusClick,
} from './features/contextMenus';

// Listeners
import {
  registerAllListeners,
  unregisterAllListeners as _unregisterAllListeners,
  setupStorageChangeListener,
} from './listeners/registerListeners';

// Messaging
import { createMessageRouter, registerMessageHandler } from './messaging/messageRouter';

// Diagnostics
import {
  logInfo,
  logWarning as _logWarning,
  logError,
  logDebug,
} from './diagnostics/logger';
import {
  syncDebug as _syncDebug,
  getSyncStorageQuota,
  diagnoseSyncStatus as diagnoseSyncStatusFn,
} from './diagnostics/syncLogger';
import {
  debugUrlMatching,
  testUrlMatch,
  getBlockingConfigSummary,
} from './diagnostics/blockingDiagnostics';

// Helpers (for schedule functions)
import { getTodaySchedule, isScheduleAllowed } from '../helpers/schedule';
import { nativeAPI, isFirefox, indexUrl as _helperIndexUrl } from '../helpers/webext';
import {
  sendNotification,
  getTab,
  getActiveTab as _getActiveTab,
} from '../helpers/webext';

// ============================================================================
// State
// ============================================================================

/**
 * Global extension state
 */
const state = {
  // From defaultState
  isEnabled: defaultIsEnabled,
  mode: defaultMode,
  action: Action.blockTab,
  framesType: defaultFramesType,

  // Lists (raw patterns for storage)
  blacklist: [],
  whitelist: [],
  blacklistKeywords: [],
  whitelistKeywords: [],

  // Compiled patterns (for matching)
  denyPatterns: [],
  allowPatterns: [],
  denyKeywords: [],
  allowKeywords: [],

  // Original patterns (for reason reporting)
  originalDenyPatterns: [],
  originalAllowPatterns: [],
  originalDenyKeywords: [],
  originalAllowKeywords: [],

  // Timer
  timer: { ...defaultTimerSettings },
  timerTimeoutId: null,

  // Schedule
  schedule: { isEnabled: false, days: {} },

  // Unblock
  unblock: {
    isEnabled: false,
    unblockOnceTimeout: 30,
    displayNotificationOnTimeout: true,
    autoReblockOnTimeout: false,
    requirePassword: false,
  },

  // Other settings
  redirectUrl: '',
  message: '',
  enableLogs: false,
  blockAccessToExtensionsPage: false,
  isPasswordEnabled: false,

  // Runtime state
  tmpAllowed: [],
  accessTokens: [],
  isInitialInstall: false,

  // Listener cleanups
  listenerCleanups: null,
  messageCleanup: null,
  storageListenerCleanup: null,
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the service worker
 */
async function init() {
  try {
    logInfo('Initializing service worker...');

    // Handle Firefox urgent initialization
    const _isFirefoxBrowser =
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');

    // If fresh install, handle sync protection
    if (state.isInitialInstall) {
      logInfo('Fresh install detected - checking for existing cloud data');
      const syncData = await initializeSyncProtection(true);
      if (syncData) {
        applyStateFromStorage(syncData, {});
      } else {
        // Use defaults
        logInfo('Using defaults for fresh install');
        applyStateFromStorage(defaultSyncValues, { isEnabled: defaultIsEnabled });
      }
    } else {
      // Normal initialization - load settings
      await loadSettingsFromStorage();
    }

    // Compile rules
    recompileRules();

    // Setup listeners
    setupListeners();

    // Setup message handler
    setupMessageHandler();

    // Setup storage change listener
    state.storageListenerCleanup = setupStorageChangeListener(handleStorageChanges);

    // Update icon
    updateIcon();

    // Resume timer if active
    if (state.timer.isEnabled) {
      const result = resumeTimer(
        state.timer,
        getTimerCallbacks(),
        'Timer resumed on init',
      );
      if (result.timeoutId) {
        state.timerTimeoutId = result.timeoutId;
      }
    }

    // Check all tabs if enabled
    if (state.isEnabled) {
      logInfo('Checking all open tabs against blocking rules');
      checkAllTabs();
    }

    logInfo('Service worker initialization complete');
  } catch (error) {
    logError('Error initializing service worker:', error);
  }
}

/**
 * Load settings from storage
 */
async function loadSettingsFromStorage() {
  try {
    logInfo('Loading settings from storage...');

    // Try sync storage first
    const syncData = await chrome.storage.sync.get(syncSettings);

    // Check for chunked data
    for (const key of CHUNKABLE_KEYS) {
      if (
        !syncData[key] ||
        (Array.isArray(syncData[key]) && syncData[key].length === 0)
      ) {
        const dechunked = await syncStorage.loadArrayFromSync(key);
        if (dechunked && dechunked.length > 0) {
          syncData[key] = dechunked;
        }
      }
    }

    // Load local settings
    const localData = await localStorage.get({
      isEnabled: defaultIsEnabled,
      enableLogs: false,
      timer: defaultTimerSettings,
      password: {},
    });

    applyStateFromStorage(syncData, localData);

    logInfo('Settings loaded:', {
      denyPatterns: state.blacklist.length,
      allowPatterns: state.whitelist.length,
      mode: state.mode,
      isEnabled: state.isEnabled,
    });
  } catch (error) {
    logError('Error loading settings:', error);
    // Use defaults
    applyStateFromStorage(defaultSyncValues, { isEnabled: defaultIsEnabled });
  }
}

/**
 * Apply loaded storage data to state
 */
function applyStateFromStorage(syncData, localData) {
  // Sync settings
  state.blacklist = Array.isArray(syncData.blacklist) ? syncData.blacklist : [];
  state.whitelist = Array.isArray(syncData.whitelist) ? syncData.whitelist : [];
  state.blacklistKeywords = Array.isArray(syncData.blacklistKeywords)
    ? syncData.blacklistKeywords
    : [];
  state.whitelistKeywords = Array.isArray(syncData.whitelistKeywords)
    ? syncData.whitelistKeywords
    : [];
  state.mode = syncData.mode || defaultMode;
  state.framesType = Array.isArray(syncData.framesType)
    ? syncData.framesType
    : defaultFramesType;
  state.message = syncData.message || '';
  state.redirectUrl = syncData.redirectUrl || '';
  state.schedule = syncData.schedule || { isEnabled: false, days: {} };

  // Local settings
  state.isEnabled = localData.isEnabled ?? defaultIsEnabled;
  state.enableLogs = localData.enableLogs ?? false;
  state.timer = { ...defaultTimerSettings, ...localData.timer };
  state.blockAccessToExtensionsPage =
    localData.password?.blockAccessToExtensionsPage ?? false;
  state.isPasswordEnabled = localData.password?.isEnabled ?? false;
}

/**
 * Recompile rules from raw patterns
 */
function recompileRules() {
  const compiled = compileRules({
    blacklist: state.blacklist,
    whitelist: state.whitelist,
    blacklistKeywords: state.blacklistKeywords,
    whitelistKeywords: state.whitelistKeywords,
  });

  state.denyPatterns = compiled.denyPatterns;
  state.allowPatterns = compiled.allowPatterns;
  state.denyKeywords = compiled.denyKeywords;
  state.allowKeywords = compiled.allowKeywords;
  state.originalDenyPatterns = compiled.originalDenyPatterns;
  state.originalAllowPatterns = compiled.originalAllowPatterns;
  state.originalDenyKeywords = compiled.originalDenyKeywords;
  state.originalAllowKeywords = compiled.originalAllowKeywords;

  logDebug('Rules recompiled:', getRulesSummary(compiled), ENABLE_DEEP_DEBUGGING);
}

// ============================================================================
// Listeners Setup
// ============================================================================

/**
 * Setup all event listeners
 */
function setupListeners() {
  const indexUrl = getExtensionIndexUrl(chrome.runtime);

  state.listenerCleanups = registerAllListeners({
    isEnabled: () => state.isEnabled,
    checkUrl: (url) => checkUrlLocal(url),
    handleUrl: handleUrl,
    redirectToBlockedPage: redirectToBlockedPage,
    getTab: getTab,
    indexUrl,
    framesType: state.framesType,
    isFirefox: isFirefox,
  });
}

/**
 * Setup message handler
 */
function setupMessageHandler() {
  const messageHandler = createMessageRouter({
    state,
    handlers: createMessageHandlers(),
    nativeAPI,
  });

  state.messageCleanup = registerMessageHandler(messageHandler);
}

/**
 * Create message handlers
 */
function createMessageHandlers() {
  return {
    // Enable/disable
    getIsEnabled: () => state.isEnabled,
    setIsEnabled: (value) => setIsEnabled(value),

    // Mode
    getMode: () => state.mode,
    setMode: (value) => setMode(value),

    // Lists
    getBlacklist: () => state.blacklist,
    setBlacklist: (value) => setBlacklist(value),
    getWhitelist: () => state.whitelist,
    setWhitelist: (value) => setWhitelist(value),
    getBlacklistKeywords: () => state.blacklistKeywords,
    setBlacklistKeywords: (value) => setBlacklistKeywords(value),
    getWhitelistKeywords: () => state.whitelistKeywords,
    setWhitelistKeywords: (value) => setWhitelistKeywords(value),

    // Timer
    getTimerSettings: () => getTimerSettings(state.timer),
    setTimerSettings: (value) => {
      state.timer = { ...state.timer, ...value };
      return true;
    },
    startTimer: (duration) => handleStartTimer(duration),
    stopTimer: () => handleStopTimer(),
    isTimerActive: () => isTimerActive(state.timer),

    // Schedule
    getSchedule: () => state.schedule,
    setSchedule: (value) => {
      state.schedule = value;
      settingsRepository.saveSchedule(value);
      return true;
    },

    // Unblock
    getUnblockSettings: () => state.unblock,
    setUnblockSettings: (value) => {
      state.unblock = { ...state.unblock, ...value };
      return true;
    },
    unblockTab: (tabId, url, timeout) => handleUnblockTab(tabId, url, timeout),
    redirectTab: (tabId, url) => redirectTab(tabId, url),

    // Temp allowed
    getTmpAllowed: () => state.tmpAllowed,

    // URL checking
    isUrlStillBlocked: (url) => checkUrlLocal(url),

    // Diagnostics
    getCurrentSettings: () => getBlockingConfigSummary(state),
    forceUpdateRules: () => {
      recompileRules();
      clearBlockedCache();
      if (state.isEnabled) checkAllTabs();
      return { success: true };
    },
    forcePullFromSync: async () => {
      const result = await forcePullFromSyncStorage();
      if (result.success && result.data) {
        applyStateFromStorage(result.data, {});
        recompileRules();
        clearBlockedCache();
        if (state.isEnabled) checkAllTabs();
      }
      return result;
    },
    diagnoseSyncStatus: () => diagnoseSyncStatusFn(),
    getSyncDiagnostics: () => getSyncStorageQuota(),
    reinitialize: () => init(),
    clearBlockedCache: () => {
      clearBlockedCache();
      return true;
    },
    debugUrlMatching: (url) => debugUrlMatching(url, state),
  };
}

// ============================================================================
// URL Handling
// ============================================================================

/**
 * Check URL against blocking rules
 */
function checkUrlLocal(url) {
  const indexUrl = getExtensionIndexUrl(chrome.runtime);

  return checkUrlShouldBeBlocked(url, state, {
    getTodaySchedule,
    isScheduleAllowed,
    indexUrl,
  });
}

/**
 * Handle URL - main entry point for URL checks
 */
function handleUrl(url, tabId, _source) {
  const indexUrl = getExtensionIndexUrl(chrome.runtime);

  // Skip extension pages
  if (url.startsWith(indexUrl)) {
    return;
  }

  // Check cache
  if (isInCache(url)) {
    const result = checkUrlLocal(url);
    if (result.blocked) {
      redirectToBlockedPage(tabId, url, result.reason);
    }
    return;
  }

  // Check if enabled
  if (!state.isEnabled) {
    return;
  }

  // Check URL
  const result = checkUrlLocal(url);

  if (result.blocked) {
    logInfo(`BLOCKING: ${url} - ${result.reason}`);
    addToCache(url);
    redirectToBlockedPage(tabId, url, result.reason);
  } else {
    logDebug(`ALLOWING: ${url} - ${result.reason}`, null, ENABLE_DEEP_DEBUGGING);
  }
}

/**
 * Redirect to blocked page
 */
function redirectToBlockedPage(tabId, url, reason) {
  const indexUrl = getExtensionIndexUrl(chrome.runtime);
  const effectiveReason = reason || 'Blocked';

  // Get custom message
  chrome.storage.sync.get({ message: '' }, (items) => {
    const redirectUrl = buildBlockedPageUrl(
      indexUrl,
      url,
      effectiveReason,
      items.message,
    );

    chrome.tabs.update(tabId, { url: redirectUrl }).catch((error) => {
      logError('Failed to redirect tab:', error);
    });
  });
}

/**
 * Redirect a tab
 */
function redirectTab(tabId, url) {
  nativeAPI.tabs.update(tabId, { url });
}

// ============================================================================
// State Setters
// ============================================================================

function setIsEnabled(value) {
  const wasEnabled = state.isEnabled;
  state.isEnabled = !!value;

  updateIcon();

  if (wasEnabled !== state.isEnabled) {
    if (!state.isEnabled) {
      clearBlockedCache();
    }
    checkAllTabs();
  }

  localStorage.set({ isEnabled: state.isEnabled });
  return state.isEnabled;
}

function setMode(value) {
  state.mode = value;
  clearBlockedCache();
  chrome.storage.sync.set({ mode: value });
  return true;
}

async function setBlacklist(value) {
  state.blacklist = value || [];
  recompileRules();
  clearBlockedCache();

  if (!isLikelyFreshInstall(state) || state.blacklist.length > 0) {
    await syncStorage.saveArrayToSync('blacklist', state.blacklist);
  }

  return true;
}

async function setWhitelist(value) {
  state.whitelist = value || [];
  recompileRules();
  clearBlockedCache();

  if (!isLikelyFreshInstall(state) || state.whitelist.length > 0) {
    await syncStorage.saveArrayToSync('whitelist', state.whitelist);
  }

  return true;
}

async function setBlacklistKeywords(value) {
  state.blacklistKeywords = value || [];
  recompileRules();
  clearBlockedCache();
  await localStorage.set({ blacklistKeywords: state.blacklistKeywords });
  return true;
}

async function setWhitelistKeywords(value) {
  state.whitelistKeywords = value || [];
  recompileRules();
  clearBlockedCache();
  await localStorage.set({ whitelistKeywords: state.whitelistKeywords });
  return true;
}

// ============================================================================
// Timer Handlers
// ============================================================================

function getTimerCallbacks() {
  return {
    enable: (_msg) => {
      if (!state.isEnabled) {
        setIsEnabled(true);
      }
    },
    disable: (_msg) => {
      if (state.isEnabled) {
        setIsEnabled(false);
      }
    },
    saveTimer: (timer) => {
      state.timer = timer;
      localStorage.set({ timer });
    },
    sendNotification: (message, title) => {
      sendNotification(message, title);
    },
  };
}

function handleStartTimer(duration) {
  const result = startTimer(duration, state.timer, getTimerCallbacks());
  state.timer = result.timer;
  state.timerTimeoutId = result.timeoutId;
  return true;
}

function handleStopTimer() {
  state.timer = stopTimer(state.timer, state.timerTimeoutId, getTimerCallbacks());
  state.timerTimeoutId = null;
  return true;
}

// ============================================================================
// Unblock Handler
// ============================================================================

function handleUnblockTab(tabId, url, timeout) {
  const result = unblockTab(tabId, url, timeout, state.tmpAllowed, state.unblock, {
    sendNotification,
    checkAllTabs,
    redirectTab,
  });
  state.tmpAllowed = result.tmpAllowed;
  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

function updateIcon() {
  try {
    const iconApi = chrome.action || chrome.browserAction;
    if (iconApi && iconApi.setIcon) {
      iconApi.setIcon({
        path: state.isEnabled
          ? {
              16: 'icons/magnet-16.png',
              32: 'icons/magnet-32.png',
              48: 'icons/magnet-48.png',
              64: 'icons/magnet-64.png',
              128: 'icons/magnet-128.png',
            }
          : {
              16: 'icons/magnet-grayscale-16.png',
              32: 'icons/magnet-grayscale-32.png',
              48: 'icons/magnet-grayscale-48.png',
              64: 'icons/magnet-grayscale-64.png',
              128: 'icons/magnet-grayscale-128.png',
            },
      });
    }
  } catch (error) {
    logError('Failed to update icon:', error);
  }
}

function checkAllTabs() {
  chrome.tabs
    .query({})
    .then((tabs) => {
      for (const tab of tabs) {
        if (state.isEnabled) {
          if (tab.url && tab.url.startsWith('http')) {
            handleUrl(tab.url, tab.id, 'checkAllTabs');
          }
        } else {
          // Unblock blocked pages when disabled
          if (
            tab.url &&
            (tab.url.includes('#blocked?url=') || tab.url.includes('#/blocked?url='))
          ) {
            try {
              const hash = new URL(tab.url).hash;
              const urlParam = hash.split('url=')[1]?.split('&')[0];
              if (urlParam) {
                chrome.tabs.update(tab.id, { url: decodeURIComponent(urlParam) });
              }
            } catch (e) {
              chrome.tabs.reload(tab.id);
            }
          }
        }
      }
    })
    .catch((error) => {
      logError('Error checking tabs:', error);
    });
}

function handleStorageChanges(changes, areaName) {
  if (areaName !== 'sync') return;

  let shouldRecompile = false;

  if (changes.blacklist) {
    state.blacklist = changes.blacklist.newValue || [];
    shouldRecompile = true;
  }
  if (changes.whitelist) {
    state.whitelist = changes.whitelist.newValue || [];
    shouldRecompile = true;
  }
  if (changes.blacklistKeywords) {
    state.blacklistKeywords = changes.blacklistKeywords.newValue || [];
    shouldRecompile = true;
  }
  if (changes.whitelistKeywords) {
    state.whitelistKeywords = changes.whitelistKeywords.newValue || [];
    shouldRecompile = true;
  }
  if (changes.mode) {
    state.mode = changes.mode.newValue || defaultMode;
  }
  if (changes.framesType) {
    state.framesType = changes.framesType.newValue || defaultFramesType;
  }

  if (shouldRecompile) {
    recompileRules();
    clearBlockedCache();
    if (state.isEnabled) {
      checkAllTabs();
    }
  }
}

// ============================================================================
// Lifecycle Events
// ============================================================================

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  logInfo('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    state.isInitialInstall = true;
    logInfo('Fresh install detected');
  }

  init();
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
  logInfo('Browser startup');
  init();
});

// Initialize immediately for Firefox urgent initialization
if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')) {
  logInfo('Firefox detected - initializing immediately');
  init();
}

// ============================================================================
// Global Exports (for diagnostics)
// ============================================================================

/* eslint-disable no-restricted-globals */
if (typeof self !== 'undefined') {
  self.getState = () => state;
  self.checkUrlShouldBeBlocked = (url, _allow, _deny) => checkUrlLocal(url);
  self.debugUrlMatching = (url) => debugUrlMatching(url, state);
  self.testUrlMatch = testUrlMatch;
}
/* eslint-enable no-restricted-globals */
