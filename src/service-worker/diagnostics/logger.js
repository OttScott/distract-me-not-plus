/**
 * Logger Module for Service Worker
 *
 * Wraps helpers/logger.js and adds service worker context.
 */

import { logger as helperLogger, defaultLogsSettings } from '../../helpers/logger';

// Re-export from helpers
export { defaultLogsSettings };

/**
 * Service worker logging context
 */
const SW_CONTEXT = '[ServiceWorker]';

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {any} data - Optional data
 */
export function logInfo(message, data = null) {
  if (data !== null) {
    console.log(`${SW_CONTEXT} ${message}`, data);
  } else {
    console.log(`${SW_CONTEXT} ${message}`);
  }
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {any} data - Optional data
 */
export function logWarning(message, data = null) {
  if (data !== null) {
    console.warn(`${SW_CONTEXT} ${message}`, data);
  } else {
    console.warn(`${SW_CONTEXT} ${message}`);
  }
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {Error|any} error - Error or data
 */
export function logError(message, error = null) {
  if (error !== null) {
    console.error(`${SW_CONTEXT} ${message}`, error);
  } else {
    console.error(`${SW_CONTEXT} ${message}`);
  }
}

/**
 * Log a debug message (only when debug is enabled)
 * @param {string} message - Log message
 * @param {any} data - Optional data
 * @param {boolean} debugEnabled - Whether debug logging is enabled
 */
export function logDebug(message, data = null, debugEnabled = false) {
  if (!debugEnabled) return;

  if (data !== null) {
    console.log(`${SW_CONTEXT} [DEBUG] ${message}`, data);
  } else {
    console.log(`${SW_CONTEXT} [DEBUG] ${message}`);
  }
}

/**
 * Add a log entry to persistent storage
 * Wraps helperLogger.add()
 *
 * @param {Object} data - Log entry data
 * @param {string} data.url - URL that was checked
 * @param {boolean} data.blocked - Whether it was blocked
 * @param {number} data.date - Timestamp
 * @returns {Promise<void>}
 */
export async function addLogEntry(data) {
  return helperLogger.add(data);
}

/**
 * Get log entries from storage
 * @returns {Promise<Object[]>}
 */
export async function getLogEntries() {
  return helperLogger.get();
}

/**
 * Clear all log entries
 * @returns {Promise<void>}
 */
export async function clearLogs() {
  return helperLogger.clear();
}

/**
 * Set max log length
 * @param {number} maxLength - Maximum number of entries
 */
export function setMaxLogLength(maxLength) {
  helperLogger.maxLength = maxLength;
}

/**
 * Create a scoped logger with a prefix
 * @param {string} scope - Logger scope/module name
 * @returns {Object} - Scoped logger
 */
export function createScopedLogger(scope) {
  const prefix = `${SW_CONTEXT} [${scope}]`;

  return {
    info: (message, data = null) => {
      if (data !== null) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    },
    warn: (message, data = null) => {
      if (data !== null) {
        console.warn(`${prefix} ${message}`, data);
      } else {
        console.warn(`${prefix} ${message}`);
      }
    },
    error: (message, error = null) => {
      if (error !== null) {
        console.error(`${prefix} ${message}`, error);
      } else {
        console.error(`${prefix} ${message}`);
      }
    },
    debug: (message, data = null, debugEnabled = false) => {
      if (!debugEnabled) return;
      if (data !== null) {
        console.log(`${prefix} [DEBUG] ${message}`, data);
      } else {
        console.log(`${prefix} [DEBUG] ${message}`);
      }
    },
  };
}

// Export as default object
const loggerModule = {
  logInfo,
  logWarning,
  logError,
  logDebug,
  addLogEntry,
  getLogEntries,
  clearLogs,
  setMaxLogLength,
  createScopedLogger,
  LogLevel,
  defaultLogsSettings,
};
export default loggerModule;
