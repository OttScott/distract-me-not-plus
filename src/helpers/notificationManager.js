import { logInfo, logError } from './debug';
import { sendNotification } from './webext';

/**
 * NotificationManager - Handles all types of notifications for the extension
 * Follows Single Responsibility Principle - only manages notifications
 */
export class NotificationManager {
  constructor() {
    this.activeNotifications = new Set();
    this.settings = {
      enabled: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      schedule: {
        enabled: true,
        showStartNotifications: true,
        showEndNotifications: true
      },
      timer: {
        enabled: true,
        showProgress: false,
        showCompletion: true
      },
      blocking: {
        enabled: false,
        showBlocked: false
      },
      sync: {
        enabled: false,
        showSuccess: false,
        showErrors: true
      }
    };
  }

  /**
   * Initialize the notification manager
   */
  async initialize() {
    try {
      await this.loadSettings();
      logInfo('NotificationManager initialized');
    } catch (error) {
      logError('Failed to initialize NotificationManager', error);
    }
  }

  /**
   * Load notification settings from storage
   */
  async loadSettings() {
    // This will be implemented when we add settings persistence
    logInfo('Loading notification settings (placeholder)');
  }

  /**
   * Check if notifications should be shown based on quiet hours
   */
  isQuietHours() {
    if (!this.settings.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMinute] = this.settings.quietHours.start.split(':');
    const startTime = parseInt(startHour) * 60 + parseInt(startMinute);
    
    const [endHour, endMinute] = this.settings.quietHours.end.split(':');
    const endTime = parseInt(endHour) * 60 + parseInt(endMinute);

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }
    
    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Show schedule start notification
   * @param {Object} schedule - The schedule configuration
   * @param {string} timeRange - The time range string (e.g., "09:00-17:00")
   */
  showScheduleStart(schedule, timeRange) {
    if (!this.settings.schedule.enabled || !this.settings.schedule.showStartNotifications) {
      return;
    }

    if (this.isQuietHours()) {
      logInfo('Skipping schedule start notification due to quiet hours');
      return;
    }

    const [startTime] = timeRange.split('-');
    const formattedTime = this.formatTime(startTime);
    
    const title = 'Distract Me Not';
    const message = `Blocking schedule started at ${formattedTime}`;
    
    this.sendNotificationSafely('schedule-start', title, message);
  }

  /**
   * Show schedule end notification
   * @param {Object} schedule - The schedule configuration
   * @param {string} timeRange - The time range string (e.g., "09:00-17:00")
   */
  showScheduleEnd(schedule, timeRange) {
    if (!this.settings.schedule.enabled || !this.settings.schedule.showEndNotifications) {
      return;
    }

    if (this.isQuietHours()) {
      logInfo('Skipping schedule end notification due to quiet hours');
      return;
    }

    const [, endTime] = timeRange.split('-');
    const formattedTime = this.formatTime(endTime);
    
    const title = 'Distract Me Not';
    const message = `Blocking schedule ended at ${formattedTime}`;
    
    this.sendNotificationSafely('schedule-end', title, message);
  }

  /**
   * Get the schedule type from a schedule object
   */
  getScheduleType(schedule) {
    // Find the first time range to determine the schedule type
    for (const day in schedule.days) {
      if (schedule.days[day].length > 0) {
        return schedule.days[day][0].type;
      }
    }
    return 'blocking'; // default
  }

  /**
   * Format time from 24-hour to 12-hour format
   * @param {string} time - Time in HH:MM format
   * @returns {string} - Formatted time string
   */
  formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    
    return `${formattedHour}:${minutes} ${ampm}`;
  }

  /**
   * Send notification with error handling and tracking
   * @param {string} id - Unique notification ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  sendNotificationSafely(id, title, message) {
    try {
      if (!this.settings.enabled) {
        logInfo(`Notifications disabled, skipping: ${id}`);
        return;
      }

      sendNotification(message, title, 'basic', id);
      this.activeNotifications.add(id);
      
      logInfo(`Notification sent: ${id} - ${message}`);
      
      // Auto-remove from tracking after 10 seconds
      setTimeout(() => {
        this.activeNotifications.delete(id);
      }, 10000);
      
    } catch (error) {
      logError(`Failed to send notification ${id}`, error);
    }
  }

  /**
   * Update notification settings
   * @param {Object} newSettings - New settings to merge
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    logInfo('Notification settings updated');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.activeNotifications.clear();
    logInfo('NotificationManager cleaned up');
  }
}

// Create and export a singleton instance
export const notificationManager = new NotificationManager();
