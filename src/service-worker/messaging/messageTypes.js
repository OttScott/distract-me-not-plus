/**
 * Message Types Module
 *
 * Constants for all message type strings.
 * Consolidates message types from both implementations.
 */

/**
 * Message types for runtime message handling
 */
export const MessageTypes = {
  // Enable/disable
  GET_IS_ENABLED: 'getIsEnabled',
  SET_IS_ENABLED: 'setIsEnabled',

  // Mode
  GET_MODE: 'getMode',
  SET_MODE: 'setMode',

  // Deny list (blacklist storage key)
  GET_BLACKLIST: 'getBlacklist',
  SET_BLACKLIST: 'setBlacklist',
  GET_BLACKLIST_KEYWORDS: 'getBlacklistKeywords',
  SET_BLACKLIST_KEYWORDS: 'setBlacklistKeywords',

  // Allow list (whitelist storage key)
  GET_WHITELIST: 'getWhitelist',
  SET_WHITELIST: 'setWhitelist',
  GET_WHITELIST_KEYWORDS: 'getWhitelistKeywords',
  SET_WHITELIST_KEYWORDS: 'setWhitelistKeywords',

  // Timer
  GET_TIMER_SETTINGS: 'getTimerSettings',
  SET_TIMER_SETTINGS: 'setTimerSettings',
  START_TIMER: 'startTimer',
  STOP_TIMER: 'stopTimer',
  IS_TIMER_ACTIVE: 'isTimerActive',

  // Schedule
  GET_SCHEDULE: 'getSchedule',
  SET_SCHEDULE: 'setSchedule',

  // Action
  GET_ACTION: 'getAction',
  SET_ACTION: 'setAction',

  // Redirect URL
  GET_REDIRECT_URL: 'getRedirectUrl',
  SET_REDIRECT_URL: 'setRedirectUrl',

  // Unblock settings
  GET_UNBLOCK_SETTINGS: 'getUnblockSettings',
  SET_UNBLOCK_SETTINGS: 'setUnblockSettings',

  // Unblock actions
  UNBLOCK_SENDER_TAB: 'unblockSenderTab',
  ALLOW_ACCESS_WITH_TOKEN: 'allowAccessWithToken',
  REDIRECT_SENDER_TAB: 'redirectSenderTab',

  // Frame types
  GET_FRAMES_TYPE: 'getFramesType',
  SET_FRAMES_TYPE: 'setFramesType',

  // Password
  GET_IS_PASSWORD_ENABLED: 'getIsPasswordEnabled',
  SET_IS_PASSWORD_ENABLED: 'setIsPasswordEnabled',
  GET_BLOCK_ACCESS_TO_EXTENSIONS_PAGE: 'getBlockAccessToExtensionsPage',
  SET_BLOCK_ACCESS_TO_EXTENSIONS_PAGE: 'setBlockAccessToExtensionsPage',

  // Logs
  GET_LOGS_SETTINGS: 'getLogsSettings',
  SET_LOGS_SETTINGS: 'setLogsSettings',

  // Temp allowed
  GET_TMP_ALLOWED: 'getTmpAllowed',

  // URL checking
  IS_URL_STILL_BLOCKED: 'isUrlStillBlocked',

  // Diagnostics
  PING: 'ping',
  GET_CURRENT_SETTINGS: 'getCurrentSettings',
  FORCE_UPDATE_RULES: 'forceUpdateRules',
  UPDATE_RULES: 'updateRules',
  FORCE_PULL_FROM_SYNC: 'forcePullFromSync',
  DIAGNOSE_SYNC_STATUS: 'diagnoseSyncStatus',
  GET_SYNC_DIAGNOSTICS: 'getSyncDiagnostics',
  REINITIALIZE: 'reinitialize',
  TEST_URL: 'testUrl',
  DEBUG_URL_MATCHING: 'debugUrlMatching',
  TEST_PROBLEMATIC_URL: 'testProblematicUrl',
  TEST_WHITELIST_PATTERN_MATCHING: 'testWhitelistPatternMatching',
  CLEAR_BLOCKED_CACHE: 'clearBlockedCache',
  TEST_URL_MATCHING: 'testUrlMatching',
};

/**
 * Response message types (sent from service worker)
 */
export const ResponseTypes = {
  SYNC_RULES_UPDATED: 'syncRulesUpdated',
  SYNC_RULES_UPDATE_FAILED: 'syncRulesUpdateFailed',
  FORCE_PULL_COMPLETE: 'forcePullComplete',
  FORCE_PULL_FAILED: 'forcePullFailed',
  SYNC_DIAGNOSTICS_COMPLETE: 'syncDiagnosticsComplete',
  SYNC_DIAGNOSTICS_RESULT: 'syncDiagnosticsResult',
};

/**
 * Check if a message type is a getter (returns current value)
 * @param {string} messageType - Message type
 * @returns {boolean}
 */
export function isGetterMessage(messageType) {
  return messageType?.startsWith('get') || messageType?.startsWith('is');
}

/**
 * Check if a message type is a setter (modifies state)
 * @param {string} messageType - Message type
 * @returns {boolean}
 */
export function isSetterMessage(messageType) {
  return messageType?.startsWith('set');
}

/**
 * Get the corresponding getter for a setter message type
 * @param {string} setterType - Setter message type
 * @returns {string|null} - Getter type or null
 */
export function getterForSetter(setterType) {
  if (!setterType?.startsWith('set')) {
    return null;
  }
  return 'get' + setterType.substring(3);
}

/**
 * Get the corresponding setter for a getter message type
 * @param {string} getterType - Getter message type
 * @returns {string|null} - Setter type or null
 */
export function setterForGetter(getterType) {
  if (!getterType?.startsWith('get')) {
    return null;
  }
  return 'set' + getterType.substring(3);
}

// Export all types
export default MessageTypes;
