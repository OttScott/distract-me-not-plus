/**
 * Schedule Module
 *
 * Thin wrapper around helpers/schedule.js.
 * Provides schedule evaluation for blocking rules.
 *
 * From Background component's parseTodaySchedule() (line 972).
 */

import {
  getTodaySchedule as helperGetTodaySchedule,
  isScheduleAllowed as helperIsScheduleAllowed,
  defaultSchedule,
  ScheduleType,
  parseTime,
  inTime,
} from '../../helpers/schedule';

// Re-export from helpers
export {
  defaultSchedule,
  ScheduleType,
  parseTime,
  inTime,
  helperGetTodaySchedule as getTodaySchedule,
  helperIsScheduleAllowed as isScheduleAllowed,
};

/**
 * @typedef {Object} Schedule
 * @property {boolean} isEnabled - Whether schedule is enabled
 * @property {Object} days - Schedule for each day of the week
 */

/**
 * @typedef {Object} ScheduleEvaluation
 * @property {boolean} isAllowedTime - Whether current time is in allowed period
 * @property {any} todaySchedule - Today's schedule configuration
 */

/**
 * Check if blocking is active based on schedule
 * Combines getTodaySchedule + isScheduleAllowed into one call
 *
 * @param {Schedule} schedule - Schedule configuration
 * @returns {boolean} - True if blocking is currently active (NOT in allowed time)
 */
export function isBlockingScheduleActive(schedule) {
  if (!schedule || !schedule.isEnabled) {
    // No schedule configured - blocking is always active
    return true;
  }

  const todaySchedule = helperGetTodaySchedule(schedule);
  const isAllowedTime = helperIsScheduleAllowed(todaySchedule);

  // If it's allowed time, blocking is NOT active
  // If it's NOT allowed time, blocking IS active
  return !isAllowedTime;
}

/**
 * Parse today's schedule (matches Background component's parseTodaySchedule)
 *
 * @param {Schedule} schedule - Schedule configuration
 * @returns {ScheduleEvaluation}
 */
export function parseTodaySchedule(schedule) {
  let isAllowedTime = false;
  let todaySchedule = null;

  if (schedule && schedule.isEnabled) {
    todaySchedule = helperGetTodaySchedule(schedule);
    isAllowedTime = helperIsScheduleAllowed(todaySchedule);
  }

  return {
    isAllowedTime,
    todaySchedule,
  };
}

/**
 * Check if current time is within a blocking period
 * Returns true if we should block based on schedule
 *
 * @param {Schedule} schedule - Schedule configuration
 * @returns {boolean}
 */
export function shouldBlockBasedOnSchedule(schedule) {
  if (!schedule || !schedule.isEnabled) {
    // No schedule - default to blocking
    return true;
  }

  const { isAllowedTime } = parseTodaySchedule(schedule);

  // Block if NOT in allowed time
  return !isAllowedTime;
}

/**
 * Get human-readable schedule status
 * @param {Schedule} schedule - Schedule configuration
 * @returns {Object}
 */
export function getScheduleStatus(schedule) {
  if (!schedule || !schedule.isEnabled) {
    return {
      enabled: false,
      blocking: true,
      message: 'Schedule disabled - blocking always active',
    };
  }

  const { isAllowedTime, todaySchedule } = parseTodaySchedule(schedule);

  return {
    enabled: true,
    blocking: !isAllowedTime,
    isAllowedTime,
    todaySchedule,
    message: isAllowedTime
      ? 'Currently in allowed time period'
      : 'Currently in blocking time period',
  };
}

/**
 * Create default schedule configuration
 * @returns {Schedule}
 */
export function createDefaultSchedule() {
  return { ...defaultSchedule };
}

/**
 * Check if schedule has any rules configured
 * @param {Schedule} schedule - Schedule configuration
 * @returns {boolean}
 */
export function hasScheduleRules(schedule) {
  if (!schedule || !schedule.days) {
    return false;
  }

  // Check if any day has schedule rules
  for (const day of Object.values(schedule.days)) {
    if (Array.isArray(day) && day.length > 0) {
      return true;
    }
  }

  return false;
}

// Export as default object
const scheduleModule = {
  isBlockingScheduleActive,
  parseTodaySchedule,
  shouldBlockBasedOnSchedule,
  getScheduleStatus,
  createDefaultSchedule,
  hasScheduleRules,
  getTodaySchedule: helperGetTodaySchedule,
  isScheduleAllowed: helperIsScheduleAllowed,
  defaultSchedule,
  ScheduleType,
};
export default scheduleModule;
