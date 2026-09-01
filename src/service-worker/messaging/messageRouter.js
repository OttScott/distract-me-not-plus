/**
 * Message Router Module
 *
 * Unified message handler covering ALL messages from BOTH implementations.
 * Routes messages to the appropriate module function.
 *
 * From service-worker.js switch statement (line 1506-1860)
 * From Background component dynamic dispatch (line 484)
 */

import { MessageTypes } from './messageTypes';
import { UnblockOptions } from '../../helpers/block';
import { isFirefox, indexUrl } from '../../helpers/webext';

/**
 * @typedef {Object} MessageContext
 * @property {Object} state - Current extension state
 * @property {Object} handlers - Handler functions for each operation
 * @property {Object} nativeAPI - Native browser API
 */

/**
 * Create a message router with the given context
 * @param {MessageContext} context - Router context
 * @returns {Function} - Message handler function
 */
export function createMessageRouter(context) {
  const { state, handlers, nativeAPI, waitForReady } = context;

  /**
   * Handle incoming runtime messages
   * @param {Object} request - Message request
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @returns {Promise<Object>} - Response
   */
  return async function handleMessage(request, sender, _sendResponse) {
    console.log('[MessageRouter] Message received:', request.message);

    // The worker may have just been woken by this message. Make sure state has
    // been loaded before answering so responses reflect real settings.
    if (waitForReady) {
      try {
        await waitForReady();
      } catch (error) {
        console.error('[MessageRouter] Initialization failed:', error);
      }
    }

    try {
      let response = null;

      switch (request.message) {
        // ============ Enable/Disable ============
        case MessageTypes.GET_IS_ENABLED:
          response = handlers.getIsEnabled ? handlers.getIsEnabled() : state.isEnabled;
          break;

        case MessageTypes.SET_IS_ENABLED:
          response = handlers.setIsEnabled
            ? handlers.setIsEnabled(request.params?.[0])
            : (state.isEnabled = request.params?.[0]);
          break;

        // ============ Mode ============
        case MessageTypes.GET_MODE:
          response = handlers.getMode ? handlers.getMode() : state.mode;
          break;

        case MessageTypes.SET_MODE:
          response = handlers.setMode
            ? handlers.setMode(request.params?.[0])
            : (state.mode = request.params?.[0]);
          break;

        // ============ Deny List (Blacklist) ============
        case MessageTypes.GET_BLACKLIST:
          response = handlers.getBlacklist ? handlers.getBlacklist() : state.blacklist;
          break;

        case MessageTypes.SET_BLACKLIST:
          response = handlers.setBlacklist
            ? await handlers.setBlacklist(request.params?.[0])
            : true;
          break;

        case MessageTypes.GET_BLACKLIST_KEYWORDS:
          response = handlers.getBlacklistKeywords
            ? handlers.getBlacklistKeywords()
            : state.blacklistKeywords;
          break;

        case MessageTypes.SET_BLACKLIST_KEYWORDS:
          response = handlers.setBlacklistKeywords
            ? await handlers.setBlacklistKeywords(request.params?.[0])
            : true;
          break;

        // ============ Allow List (Whitelist) ============
        case MessageTypes.GET_WHITELIST:
          response = handlers.getWhitelist ? handlers.getWhitelist() : state.whitelist;
          break;

        case MessageTypes.SET_WHITELIST:
          response = handlers.setWhitelist
            ? await handlers.setWhitelist(request.params?.[0])
            : true;
          break;

        case MessageTypes.GET_WHITELIST_KEYWORDS:
          response = handlers.getWhitelistKeywords
            ? handlers.getWhitelistKeywords()
            : state.whitelistKeywords;
          break;

        case MessageTypes.SET_WHITELIST_KEYWORDS:
          response = handlers.setWhitelistKeywords
            ? await handlers.setWhitelistKeywords(request.params?.[0])
            : true;
          break;

        // ============ Timer ============
        case MessageTypes.GET_TIMER_SETTINGS:
          response = handlers.getTimerSettings
            ? handlers.getTimerSettings()
            : state.timer;
          break;

        case MessageTypes.SET_TIMER_SETTINGS:
          response = handlers.setTimerSettings
            ? handlers.setTimerSettings(request.params?.[0])
            : true;
          break;

        case MessageTypes.START_TIMER:
          response = handlers.startTimer
            ? handlers.startTimer(request.params?.[0])
            : true;
          break;

        case MessageTypes.STOP_TIMER:
          response = handlers.stopTimer ? handlers.stopTimer() : true;
          break;

        case MessageTypes.IS_TIMER_ACTIVE:
          response = handlers.isTimerActive ? handlers.isTimerActive() : false;
          break;

        // ============ Schedule ============
        case MessageTypes.GET_SCHEDULE:
          response = handlers.getSchedule
            ? handlers.getSchedule()
            : state.schedule || { isEnabled: false, days: {} };
          break;

        case MessageTypes.SET_SCHEDULE:
          response = handlers.setSchedule
            ? handlers.setSchedule(request.params?.[0])
            : true;
          break;

        // ============ Action ============
        case MessageTypes.GET_ACTION:
          response = handlers.getAction ? handlers.getAction() : state.action;
          break;

        case MessageTypes.SET_ACTION:
          response = handlers.setAction ? handlers.setAction(request.params?.[0]) : true;
          break;

        // ============ Redirect URL ============
        case MessageTypes.GET_REDIRECT_URL:
          response = handlers.getRedirectUrl
            ? handlers.getRedirectUrl()
            : state.redirectUrl;
          break;

        case MessageTypes.SET_REDIRECT_URL:
          response = handlers.setRedirectUrl
            ? handlers.setRedirectUrl(request.params?.[0])
            : true;
          break;

        // ============ Unblock ============
        case MessageTypes.GET_UNBLOCK_SETTINGS:
          response = handlers.getUnblockSettings
            ? handlers.getUnblockSettings()
            : state.unblock || {
                isEnabled: false,
                unblockOnceTimeout: 30,
                displayNotificationOnTimeout: true,
                autoReblockOnTimeout: false,
                requirePassword: false,
              };
          break;

        case MessageTypes.SET_UNBLOCK_SETTINGS:
          response = handlers.setUnblockSettings
            ? handlers.setUnblockSettings(request.params?.[0])
            : true;
          break;

        case MessageTypes.UNBLOCK_SENDER_TAB:
          response = handleUnblockSenderTab(request, sender, handlers, state);
          break;

        case MessageTypes.ALLOW_ACCESS_WITH_TOKEN:
          response = handleAllowAccessWithToken(request, sender, handlers, nativeAPI);
          break;

        case MessageTypes.REDIRECT_SENDER_TAB:
          response = handleRedirectSenderTab(request, sender, handlers);
          break;

        // ============ Frame Types ============
        case MessageTypes.GET_FRAMES_TYPE:
          response = handlers.getFramesType ? handlers.getFramesType() : state.framesType;
          break;

        case MessageTypes.SET_FRAMES_TYPE:
          response = handlers.setFramesType
            ? handlers.setFramesType(request.params?.[0])
            : true;
          break;

        // ============ Password ============
        case MessageTypes.GET_IS_PASSWORD_ENABLED:
          response = handlers.getIsPasswordEnabled
            ? handlers.getIsPasswordEnabled()
            : state.isPasswordEnabled;
          break;

        case MessageTypes.SET_IS_PASSWORD_ENABLED:
          response = handlers.setIsPasswordEnabled
            ? handlers.setIsPasswordEnabled(request.params?.[0])
            : true;
          break;

        case MessageTypes.GET_BLOCK_ACCESS_TO_EXTENSIONS_PAGE:
          response = handlers.getBlockAccessToExtensionsPage
            ? handlers.getBlockAccessToExtensionsPage()
            : state.blockAccessToExtensionsPage;
          break;

        case MessageTypes.SET_BLOCK_ACCESS_TO_EXTENSIONS_PAGE:
          response = handlers.setBlockAccessToExtensionsPage
            ? handlers.setBlockAccessToExtensionsPage(request.params?.[0])
            : true;
          break;

        // ============ Logs ============
        case MessageTypes.GET_LOGS_SETTINGS:
          response = handlers.getLogsSettings
            ? handlers.getLogsSettings()
            : { isEnabled: false, maxLength: 100 };
          break;

        case MessageTypes.SET_LOGS_SETTINGS:
          response = handlers.setLogsSettings
            ? handlers.setLogsSettings(request.params?.[0])
            : true;
          break;

        // ============ Temp Allowed ============
        case MessageTypes.GET_TMP_ALLOWED:
          response = handlers.getTmpAllowed
            ? handlers.getTmpAllowed()
            : state.tmpAllowed || [];
          break;

        // ============ URL Checking ============
        case MessageTypes.IS_URL_STILL_BLOCKED:
          response = handlers.isUrlStillBlocked
            ? handlers.isUrlStillBlocked(request.params?.[0])
            : false;
          break;

        // ============ Diagnostics ============
        case MessageTypes.PING:
          response = {
            timestamp: Date.now(),
            status: 'alive',
            version: chrome.runtime?.getManifest?.()?.version || 'unknown',
          };
          break;

        case MessageTypes.GET_CURRENT_SETTINGS:
          response = handlers.getCurrentSettings ? handlers.getCurrentSettings() : state;
          break;

        case MessageTypes.FORCE_UPDATE_RULES:
          response = handlers.forceUpdateRules
            ? await handlers.forceUpdateRules()
            : { success: true };
          break;

        case MessageTypes.UPDATE_RULES:
          response = handlers.updateRules
            ? await handlers.updateRules()
            : { success: true };
          break;

        case MessageTypes.FORCE_PULL_FROM_SYNC:
          response = handlers.forcePullFromSync
            ? await handlers.forcePullFromSync()
            : { success: true };
          break;

        case MessageTypes.DIAGNOSE_SYNC_STATUS:
          response = handlers.diagnoseSyncStatus
            ? await handlers.diagnoseSyncStatus()
            : { success: true };
          break;

        case MessageTypes.GET_SYNC_DIAGNOSTICS:
          response = handlers.getSyncDiagnostics
            ? await handlers.getSyncDiagnostics()
            : { success: true };
          break;

        case MessageTypes.REINITIALIZE:
          response = handlers.reinitialize
            ? await handlers.reinitialize()
            : { success: true };
          break;

        case MessageTypes.CLEAR_BLOCKED_CACHE:
          response = handlers.clearBlockedCache ? handlers.clearBlockedCache() : true;
          break;

        // ============ Debug/Test ============
        case MessageTypes.TEST_URL:
          response = handlers.testUrl
            ? handlers.testUrl(request)
            : { result: 'NOT_IMPLEMENTED' };
          break;

        case MessageTypes.DEBUG_URL_MATCHING:
          response = handlers.debugUrlMatching
            ? handlers.debugUrlMatching(request.params?.[0])
            : null;
          break;

        // ============ Default: Dynamic dispatch ============
        default:
          // Try dynamic dispatch (Background component pattern)
          if (
            handlers[request.message] &&
            typeof handlers[request.message] === 'function'
          ) {
            response = handlers[request.message](...(request.params || []));
          } else if (state[request.message] !== undefined) {
            // Direct property access
            response = state[request.message];
          } else {
            console.warn('[MessageRouter] Unknown message type:', request.message);
            response = null;
          }
          break;
      }

      console.log('[MessageRouter] Response:', response);
      return { response };
    } catch (error) {
      console.error('[MessageRouter] Error handling message:', error);
      return { response: null, error: error.message };
    }
  };
}

/**
 * Handle unblockSenderTab message
 */
function handleUnblockSenderTab(request, sender, handlers, state) {
  const { url, option, time = 0 } = request.params?.[0] || {};
  let timeout = 0;

  switch (option) {
    case UnblockOptions.unblockForWhile:
      // Convert minutes to ms
      timeout = time * 60000;
      break;
    case UnblockOptions.unblockOnce:
    default:
      // Convert seconds to ms
      timeout = (state.unblock?.unblockOnceTimeout || 10) * 1000;
      break;
  }

  if (handlers.unblockTab) {
    handlers.unblockTab(sender.tab?.id, url, timeout);
  }

  if (handlers.redirectTab) {
    handlers.redirectTab(sender.tab?.id, url);
  }

  return true;
}

/**
 * Handle allowAccessWithToken message
 */
function handleAllowAccessWithToken(request, sender, handlers, _nativeAPI) {
  const { url: initialUrl, token, timeout = 60000 } = request.params?.[0] || {};

  if (handlers.addAccessToken) {
    handlers.addAccessToken(token, timeout);
  }

  const urlParser = new URL(initialUrl);
  urlParser.searchParams.set('token', token);
  const url = urlParser.toString();

  if (isFirefox && /^about:/i.test(url)) {
    // Firefox: Can't navigate to about: pages directly
    if (handlers.redirectTab) {
      handlers.redirectTab(
        sender.tab?.id,
        `${indexUrl}#pastebin?url=${encodeURIComponent(url)}`,
      );
    }
  } else {
    if (handlers.redirectTab) {
      handlers.redirectTab(sender.tab?.id, url);
    }
  }

  return true;
}

/**
 * Handle redirectSenderTab message
 */
function handleRedirectSenderTab(request, sender, handlers) {
  if (handlers.redirectTab) {
    handlers.redirectTab(sender.tab?.id, ...request.params);
  }
  return true;
}

/**
 * Register the message handler with the runtime
 * @param {Function} messageHandler - Handler function
 * @returns {Function} - Cleanup function
 */
export function registerMessageHandler(messageHandler) {
  // Wrapper that returns a promise for the response
  const listener = (request, sender, sendResponse) => {
    // Handle async message handling
    messageHandler(request, sender, sendResponse)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error('[MessageRouter] Async error:', error);
        sendResponse({ response: null, error: error.message });
      });

    // Return true to indicate async response
    return true;
  };

  chrome.runtime.onMessage.addListener(listener);

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}

// Export default
const messageRouterModule = {
  createMessageRouter,
  registerMessageHandler,
};
export default messageRouterModule;
