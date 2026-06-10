/**
 * Timer Module
 *
 * Handles timer start/stop/resume functionality.
 * Extracted from Background component (NOT service-worker.js which has stubs).
 * Lines 1013-1045 contain the timer logic.
 *
 * Converted from class methods to pure functions with explicit state parameter.
 */

import { defaultTimerSettings, unactiveTimerRuntimeSettings } from '../../helpers/timer';
import { translate } from '../../helpers/i18n';
import { now } from '../../helpers/date';

/**
 * @typedef {Object} TimerState
 * @property {boolean} isEnabled - Whether timer feature is enabled
 * @property {string} defaultValue - Default timer value (hh:mm)
 * @property {boolean} allowStoppingTimer - Whether user can stop timer early
 * @property {boolean} displayNotificationOnComplete - Show notification when complete
 * @property {boolean} allowUsingTimerWithoutPassword - Allow timer without password
 * @property {Object} runtime - Runtime state
 * @property {number} runtime.duration - Timer duration in seconds
 * @property {number} runtime.endDate - Timestamp when timer ends
 * @property {number} runtime.remainingDuration - Remaining time in seconds
 */

/**
 * @typedef {Object} TimerCallbacks
 * @property {Function} enable - Function to enable blocking
 * @property {Function} disable - Function to disable blocking
 * @property {Function} saveTimer - Function to save timer state to storage
 * @property {Function} sendNotification - Function to send notifications
 */

/**
 * Get remaining time in milliseconds
 * @param {TimerState} timer - Timer state
 * @returns {number} - Remaining time in ms (0 if expired)
 */
export function getTimerRemainingTime(timer) {
  if (!timer || !timer.runtime || !timer.runtime.endDate) {
    return 0;
  }
  const remaining = timer.runtime.endDate - now(true);
  return remaining > 0 ? remaining : 0;
}

/**
 * Check if timer is currently active
 * @param {TimerState} timer - Timer state
 * @returns {boolean}
 */
export function isTimerActive(timer) {
  if (!timer || !timer.isEnabled) {
    return false;
  }
  return getTimerRemainingTime(timer) > 0;
}

/**
 * Get timer settings with current remaining duration
 * @param {TimerState} timer - Timer state
 * @returns {TimerState} - Timer settings with updated remainingDuration
 */
export function getTimerSettings(timer) {
  const ms = getTimerRemainingTime(timer);
  return {
    ...timer,
    runtime: {
      ...timer.runtime,
      remainingDuration: ms > 0 ? ms / 1000 : 0,
    },
  };
}

/**
 * Start a timer
 * @param {number} duration - Duration in seconds
 * @param {TimerState} timer - Current timer state
 * @param {TimerCallbacks} callbacks - Callback functions
 * @returns {{ timer: TimerState, timeoutId: number }} - New timer state and timeout ID
 */
export function startTimer(duration, timer, callbacks) {
  const newTimer = {
    ...timer,
    runtime: {
      duration,
      endDate: now(true) + duration * 1000,
      remainingDuration: duration,
    },
  };

  // Save timer state
  if (callbacks.saveTimer) {
    callbacks.saveTimer(newTimer);
  }

  // Enable blocking and set up completion callback
  const { timeoutId } = resumeTimerInternal(newTimer, callbacks, 'Timer started');

  return { timer: newTimer, timeoutId };
}

/**
 * Stop a running timer
 * @param {TimerState} timer - Current timer state
 * @param {number} timeoutId - Timeout ID to clear
 * @param {TimerCallbacks} callbacks - Callback functions
 * @returns {TimerState} - Reset timer state
 */
export function stopTimer(timer, timeoutId, callbacks) {
  // Clear the timeout
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  // Disable blocking
  if (callbacks.disable) {
    callbacks.disable('Timer stopped');
  }

  // Reset timer runtime
  const newTimer = {
    ...timer,
    runtime: unactiveTimerRuntimeSettings,
  };

  // Save timer state
  if (callbacks.saveTimer) {
    callbacks.saveTimer(newTimer);
  }

  return newTimer;
}

/**
 * Internal resume implementation
 * @param {TimerState} timer - Timer state
 * @param {TimerCallbacks} callbacks - Callback functions
 * @param {string} debugMessage - Debug message
 * @returns {{ timeoutId: number|null }}
 */
function resumeTimerInternal(timer, callbacks, debugMessage = 'Timer resumed') {
  const ms = getTimerRemainingTime(timer);

  if (ms <= 0) {
    return { timeoutId: null };
  }

  // Enable blocking
  if (callbacks.enable) {
    callbacks.enable(debugMessage);
  }

  // Set up completion callback
  const timeoutId = setTimeout(() => {
    // Disable blocking on completion
    if (callbacks.disable) {
      callbacks.disable('Timer completed');
    }

    // Show notification if enabled
    if (timer.displayNotificationOnComplete && callbacks.sendNotification) {
      const title = translate('appName');
      const message = translate('timerCompleted');
      callbacks.sendNotification(message, title);
    }
  }, ms);

  return { timeoutId };
}

/**
 * Resume a timer (e.g., after browser restart)
 * @param {TimerState} timer - Current timer state
 * @param {TimerCallbacks} callbacks - Callback functions
 * @param {string} debugMessage - Optional debug message
 * @returns {{ timeoutId: number|null }} - Timeout ID if resumed
 */
export function resumeTimer(timer, callbacks, debugMessage = 'Timer resumed') {
  return resumeTimerInternal(timer, callbacks, debugMessage);
}

/**
 * Create default timer state
 * @returns {TimerState}
 */
export function createDefaultTimerState() {
  return { ...defaultTimerSettings };
}

/**
 * Parse timer value string to seconds
 * @param {string} value - Timer value in hh:mm or hh:mm:ss format
 * @returns {number} - Duration in seconds
 */
export function parseTimerValue(value) {
  if (!value || typeof value !== 'string') {
    return 0;
  }

  const parts = value.split(':').map((p) => parseInt(p, 10) || 0);

  if (parts.length === 2) {
    // hh:mm format
    const [hours, minutes] = parts;
    return hours * 3600 + minutes * 60;
  } else if (parts.length === 3) {
    // hh:mm:ss format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * Format seconds to hh:mm:ss string
 * @param {number} seconds - Time in seconds
 * @returns {string}
 */
export function formatTimerValue(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

/**
 * Check if timer can be stopped (based on settings)
 * @param {TimerState} timer - Timer state
 * @returns {boolean}
 */
export function canStopTimer(timer) {
  return timer && timer.allowStoppingTimer;
}

// Export as default object
const timerModule = {
  getTimerRemainingTime,
  isTimerActive,
  getTimerSettings,
  startTimer,
  stopTimer,
  resumeTimer,
  createDefaultTimerState,
  parseTimerValue,
  formatTimerValue,
  canStopTimer,
};
export default timerModule;
