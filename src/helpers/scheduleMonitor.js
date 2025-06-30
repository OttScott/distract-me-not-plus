import { logInfo, logError } from './debug';
import { parseTime, getTodaySchedule, ScheduleType } from './schedule';
import { notificationManager } from './notificationManager';

/**
 * ScheduleMonitor - Monitors schedule changes and triggers notifications
 * Follows Single Responsibility Principle - only monitors schedule transitions
 */
export class ScheduleMonitor {
  constructor() {
    this.currentSchedule = null;
    this.activeTimeRanges = new Set();
    this.checkInterval = null;
    this.isMonitoring = false;
  }

  /**
   * Start monitoring schedule transitions
   * @param {Object} schedule - The schedule configuration to monitor
   */
  startMonitoring(schedule) {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    if (!schedule || !schedule.isEnabled) {
      logInfo('Schedule monitoring not started - schedule disabled');
      return;
    }

    this.currentSchedule = schedule;
    this.isMonitoring = true;

    // Check every minute for schedule transitions
    this.checkInterval = setInterval(() => {
      this.checkScheduleTransitions();
    }, 60000); // 1 minute

    // Initial check
    this.checkScheduleTransitions();
    
    logInfo('Schedule monitoring started');
  }

  /**
   * Stop monitoring schedule transitions
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.isMonitoring = false;
    this.currentSchedule = null;
    this.activeTimeRanges.clear();
    
    logInfo('Schedule monitoring stopped');
  }

  /**
   * Check for schedule transitions and trigger notifications
   */
  checkScheduleTransitions() {
    if (!this.currentSchedule || !this.currentSchedule.isEnabled) {
      return;
    }

    try {
      const todaySchedule = getTodaySchedule(this.currentSchedule);
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      for (const range of todaySchedule) {
        const timeRangeKey = `${range.time.start}-${range.time.end}`;
        const { start, end } = parseTime(range.time);
        
        const isCurrentlyInRange = this.isTimeInRange(currentTime, start, end);
        const wasInRange = this.activeTimeRanges.has(timeRangeKey);

        // Detect schedule start (entering a blocking time range)
        if (isCurrentlyInRange && !wasInRange && range.type === ScheduleType.blockingTime) {
          this.activeTimeRanges.add(timeRangeKey);
          notificationManager.showScheduleStart(this.currentSchedule, timeRangeKey);
          logInfo(`Schedule started: ${timeRangeKey}`);
        }

        // Detect schedule end (leaving a blocking time range)
        if (!isCurrentlyInRange && wasInRange && range.type === ScheduleType.blockingTime) {
          this.activeTimeRanges.delete(timeRangeKey);
          notificationManager.showScheduleEnd(this.currentSchedule, timeRangeKey);
          logInfo(`Schedule ended: ${timeRangeKey}`);
        }
      }
    } catch (error) {
      logError('Error checking schedule transitions', error);
    }
  }

  /**
   * Check if current time is within a time range
   * @param {number} currentTime - Current time in minutes since midnight
   * @param {number} start - Start time in minutes since midnight
   * @param {number} end - End time in minutes since midnight
   * @returns {boolean} - True if current time is in range
   */
  isTimeInRange(currentTime, start, end) {
    // Handle overnight ranges (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    
    return currentTime >= start && currentTime < end;
  }

  /**
   * Update the schedule being monitored
   * @param {Object} schedule - New schedule configuration
   */
  updateSchedule(schedule) {
    this.currentSchedule = schedule;
    
    if (this.isMonitoring) {
      // Restart monitoring with new schedule
      this.startMonitoring(schedule);
    }
  }

  /**
   * Get current monitoring status
   * @returns {Object} - Current status information
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      hasSchedule: !!this.currentSchedule,
      scheduleEnabled: this.currentSchedule?.isEnabled || false,
      activeRanges: Array.from(this.activeTimeRanges)
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopMonitoring();
    this.currentSchedule = null;
    logInfo('ScheduleMonitor cleaned up');
  }
}

// Create and export a singleton instance
export const scheduleMonitor = new ScheduleMonitor();
