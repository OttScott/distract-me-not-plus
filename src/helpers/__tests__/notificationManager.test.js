import { NotificationManager } from '../notificationManager';
import { sendNotification } from '../webext';

// Mock the webext helper
jest.mock('../webext', () => ({
  sendNotification: jest.fn()
}));

describe('NotificationManager', () => {
  let notificationManager;
  let realDate;

  beforeEach(() => {
    // Save original Date 
    realDate = global.Date;
    
    notificationManager = new NotificationManager();
    sendNotification.mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original Date
    global.Date = realDate;
  });

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      expect(notificationManager.settings).toBeDefined();
      expect(notificationManager.settings.quietHours.enabled).toBe(false);
    });
  });

  describe('basic notification functionality', () => {
    it('should send schedule start notification', () => {
      const mockSchedule = {
        isEnabled: true,
        days: {
          wednesday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      const timeRange = '09:00-17:00';

      notificationManager.showScheduleStart(mockSchedule, timeRange);

      expect(sendNotification).toHaveBeenCalledWith(
        'Blocking schedule started at 9:00 AM',
        'Distract Me Not',
        'basic',
        'schedule-start'
      );
    });

    it('should send schedule end notification', () => {
      const mockSchedule = {
        isEnabled: true,
        days: {
          wednesday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      const timeRange = '09:00-17:00';

      notificationManager.showScheduleEnd(mockSchedule, timeRange);

      expect(sendNotification).toHaveBeenCalledWith(
        'Blocking schedule ended at 5:00 PM',
        'Distract Me Not',
        'basic',
        'schedule-end'
      );
    });
  });

  describe('quiet hours functionality', () => {
    it('should not be in quiet hours when disabled', () => {
      notificationManager.settings.quietHours.enabled = false;
      expect(notificationManager.isQuietHours()).toBe(false);
    });

    it('should detect quiet hours correctly for same-day range', () => {
      notificationManager.settings.quietHours = {
        enabled: true,
        start: '14:00', // 2:00 PM
        end: '15:00'    // 3:00 PM
      };
      
      // Create a mock date with local time 2:30 PM (no timezone conversion)
      // We'll mock getHours() and getMinutes() directly
      const mockDate = {
        getHours: () => 14,   // 2 PM
        getMinutes: () => 30  // 30 minutes
      };
      global.Date = function() { return mockDate; };
      global.Date.now = () => Date.now();
      
      // Current time is 2:30 PM - should be in quiet hours
      expect(notificationManager.isQuietHours()).toBe(true);
    });

    it('should detect quiet hours correctly for overnight range', () => {
      notificationManager.settings.quietHours = {
        enabled: true,
        start: '22:00', // 10:00 PM
        end: '08:00'    // 8:00 AM next day
      };
      
      // Mock the current time to 2:30 PM - should not be in quiet hours
      const mockDatePM = {
        getHours: () => 14,   // 2 PM
        getMinutes: () => 30  // 30 minutes
      };
      global.Date = function() { return mockDatePM; };
      global.Date.now = () => Date.now();
      
      expect(notificationManager.isQuietHours()).toBe(false);
      
      // Test overnight time (3:00 AM) - should be in quiet hours
      const mockDate3AM = {
        getHours: () => 3,    // 3 AM
        getMinutes: () => 0   // 0 minutes
      };
      global.Date = function() { return mockDate3AM; };
      global.Date.now = () => Date.now();
      
      expect(notificationManager.isQuietHours()).toBe(true);
    });

    it('should not show notifications during quiet hours', () => {
      notificationManager.settings.quietHours = {
        enabled: true,
        start: '14:00',
        end: '15:00'
      };
      
      // Mock the current time to be in quiet hours (2:30 PM)
      const mockDate = {
        getHours: () => 14,   // 2 PM
        getMinutes: () => 30  // 30 minutes
      };
      global.Date = function() { return mockDate; };
      global.Date.now = () => Date.now();
      
      const mockSchedule = {
        isEnabled: true,
        days: {
          wednesday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      const timeRange = '09:00-17:00';
      
      notificationManager.showScheduleStart(mockSchedule, timeRange);
      
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('time formatting', () => {
    it('should format time correctly for AM/PM', () => {
      expect(notificationManager.formatTime('09:00')).toBe('9:00 AM');
      expect(notificationManager.formatTime('13:30')).toBe('1:30 PM');
      expect(notificationManager.formatTime('00:00')).toBe('12:00 AM');
      expect(notificationManager.formatTime('12:00')).toBe('12:00 PM');
    });
  });

  describe('schedule type detection', () => {
    it('should determine schedule type correctly', () => {
      const blockingSchedule = {
        days: {
          monday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      
      const allowingSchedule = {
        days: {
          monday: [{ type: 'allowing', time: { start: '09:00', end: '17:00' } }]
        }
      };

      expect(notificationManager.getScheduleType(blockingSchedule)).toBe('blocking');
      expect(notificationManager.getScheduleType(allowingSchedule)).toBe('allowing');
    });
  });

  describe('notification settings', () => {
    it('should update notification settings', () => {
      const newSettings = {
        schedule: {
          enabled: false,
          showStartNotifications: false,
          showEndNotifications: true
        }
      };

      notificationManager.updateSettings(newSettings);

      expect(notificationManager.settings.schedule.enabled).toBe(false);
      expect(notificationManager.settings.schedule.showStartNotifications).toBe(false);
      expect(notificationManager.settings.schedule.showEndNotifications).toBe(true);
    });

    it('should not show notifications when schedule notifications are disabled', () => {
      notificationManager.settings.schedule.enabled = false;
      
      const mockSchedule = {
        isEnabled: true,
        days: {
          wednesday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      const timeRange = '09:00-17:00';

      notificationManager.showScheduleStart(mockSchedule, timeRange);

      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('should not show start notifications when showStart is disabled', () => {
      notificationManager.settings.schedule.showStartNotifications = false;
      
      const mockSchedule = {
        isEnabled: true,
        days: {
          wednesday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      const timeRange = '09:00-17:00';

      notificationManager.showScheduleStart(mockSchedule, timeRange);

      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('should not show end notifications when showEnd is disabled', () => {
      notificationManager.settings.schedule.showEndNotifications = false;
      
      const mockSchedule = {
        isEnabled: true,
        days: {
          wednesday: [{ type: 'blocking', time: { start: '09:00', end: '17:00' } }]
        }
      };
      const timeRange = '09:00-17:00';

      notificationManager.showScheduleEnd(mockSchedule, timeRange);

      expect(sendNotification).not.toHaveBeenCalled();
    });
  });
});
