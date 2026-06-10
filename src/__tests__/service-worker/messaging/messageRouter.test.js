/**
 * Unit tests for messageRouter module
 * Tests message routing for key message types
 */

import { createMessageRouter } from '../../../service-worker/messaging/messageRouter';
import { MessageTypes } from '../../../service-worker/messaging/messageTypes';

describe('messageRouter', () => {
  // Mock state
  const createMockState = () => ({
    isEnabled: true,
    mode: 'denylist',
    blacklist: ['facebook.com'],
    whitelist: ['github.com'],
    blacklistKeywords: ['social'],
    whitelistKeywords: ['work'],
    timer: { isEnabled: false },
    schedule: { isEnabled: false, days: {} },
    action: 'blockPage',
    redirectUrl: 'https://example.com',
    framesType: 'all',
    isPasswordEnabled: false,
    blockAccessToExtensionsPage: false,
    tmpAllowed: [],
    unblock: {
      isEnabled: false,
      unblockOnceTimeout: 30,
      displayNotificationOnTimeout: true,
      autoReblockOnTimeout: false,
      requirePassword: false,
    },
  });

  // Mock handlers
  const createMockHandlers = () => ({
    getIsEnabled: jest.fn(() => true),
    setIsEnabled: jest.fn((val) => val),
    getMode: jest.fn(() => 'denylist'),
    setMode: jest.fn((val) => val),
    getBlacklist: jest.fn(() => ['facebook.com']),
    setBlacklist: jest.fn().mockResolvedValue(true),
    getWhitelist: jest.fn(() => ['github.com']),
    setWhitelist: jest.fn().mockResolvedValue(true),
    getBlacklistKeywords: jest.fn(() => ['social']),
    setBlacklistKeywords: jest.fn().mockResolvedValue(true),
    getWhitelistKeywords: jest.fn(() => ['work']),
    setWhitelistKeywords: jest.fn().mockResolvedValue(true),
    getTimerSettings: jest.fn(() => ({ isEnabled: false })),
    setTimerSettings: jest.fn(() => true),
    startTimer: jest.fn(() => true),
    stopTimer: jest.fn(() => true),
    isTimerActive: jest.fn(() => false),
    getSchedule: jest.fn(() => ({ isEnabled: false, days: {} })),
    setSchedule: jest.fn(() => true),
    getAction: jest.fn(() => 'blockPage'),
    setAction: jest.fn(() => true),
    getRedirectUrl: jest.fn(() => 'https://example.com'),
    setRedirectUrl: jest.fn(() => true),
    getUnblockSettings: jest.fn(() => ({
      isEnabled: false,
      unblockOnceTimeout: 30,
    })),
    setUnblockSettings: jest.fn(() => true),
    getFramesType: jest.fn(() => 'all'),
    setFramesType: jest.fn(() => true),
    getIsPasswordEnabled: jest.fn(() => false),
    setIsPasswordEnabled: jest.fn(() => true),
    getBlockAccessToExtensionsPage: jest.fn(() => false),
    setBlockAccessToExtensionsPage: jest.fn(() => true),
    getLogsSettings: jest.fn(() => ({ isEnabled: false, maxLength: 100 })),
    setLogsSettings: jest.fn(() => true),
    getTmpAllowed: jest.fn(() => []),
    isUrlStillBlocked: jest.fn(() => false),
    getCurrentSettings: jest.fn(() => ({})),
    forceUpdateRules: jest.fn().mockResolvedValue({ success: true }),
    updateRules: jest.fn().mockResolvedValue({ success: true }),
    forcePullFromSync: jest.fn().mockResolvedValue({ success: true }),
    diagnoseSyncStatus: jest.fn().mockResolvedValue({ success: true }),
    getSyncDiagnostics: jest.fn().mockResolvedValue({ success: true }),
    reinitialize: jest.fn().mockResolvedValue({ success: true }),
    clearBlockedCache: jest.fn(() => true),
    testUrl: jest.fn(() => ({ result: 'allowed' })),
    debugUrlMatching: jest.fn(() => null),
  });

  // Mock native API
  const createMockNativeAPI = () => ({
    tabs: {
      update: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    },
    runtime: {
      getManifest: jest.fn(() => ({ version: '1.0.0' })),
    },
  });

  let handleMessage;
  let mockState;
  let mockHandlers;
  let mockNativeAPI;

  beforeEach(() => {
    mockState = createMockState();
    mockHandlers = createMockHandlers();
    mockNativeAPI = createMockNativeAPI();

    handleMessage = createMessageRouter({
      state: mockState,
      handlers: mockHandlers,
      nativeAPI: mockNativeAPI,
    });
  });

  describe('createMessageRouter', () => {
    it('should return a function', () => {
      expect(typeof handleMessage).toBe('function');
    });
  });

  describe('Enable/Disable messages', () => {
    it('should handle GET_IS_ENABLED', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_IS_ENABLED },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getIsEnabled).toHaveBeenCalled();
      expect(result.response).toBe(true);
    });

    it('should handle SET_IS_ENABLED', async () => {
      await handleMessage(
        { message: MessageTypes.SET_IS_ENABLED, params: [false] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setIsEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('Mode messages', () => {
    it('should handle GET_MODE', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_MODE },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getMode).toHaveBeenCalled();
      expect(result.response).toBe('denylist');
    });

    it('should handle SET_MODE', async () => {
      await handleMessage(
        { message: MessageTypes.SET_MODE, params: ['allowlist'] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setMode).toHaveBeenCalledWith('allowlist');
    });
  });

  describe('Deny List messages', () => {
    it('should handle GET_BLACKLIST', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_BLACKLIST },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getBlacklist).toHaveBeenCalled();
      expect(result.response).toEqual(['facebook.com']);
    });

    it('should handle SET_BLACKLIST', async () => {
      await handleMessage(
        { message: MessageTypes.SET_BLACKLIST, params: [['twitter.com']] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setBlacklist).toHaveBeenCalledWith(['twitter.com']);
    });

    it('should handle GET_BLACKLIST_KEYWORDS', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_BLACKLIST_KEYWORDS },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getBlacklistKeywords).toHaveBeenCalled();
      expect(result.response).toEqual(['social']);
    });

    it('should handle SET_BLACKLIST_KEYWORDS', async () => {
      await handleMessage(
        { message: MessageTypes.SET_BLACKLIST_KEYWORDS, params: [['games']] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setBlacklistKeywords).toHaveBeenCalledWith(['games']);
    });
  });

  describe('Allow List messages', () => {
    it('should handle GET_WHITELIST', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_WHITELIST },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getWhitelist).toHaveBeenCalled();
      expect(result.response).toEqual(['github.com']);
    });

    it('should handle SET_WHITELIST', async () => {
      await handleMessage(
        { message: MessageTypes.SET_WHITELIST, params: [['stackoverflow.com']] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setWhitelist).toHaveBeenCalledWith(['stackoverflow.com']);
    });

    it('should handle GET_WHITELIST_KEYWORDS', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_WHITELIST_KEYWORDS },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getWhitelistKeywords).toHaveBeenCalled();
      expect(result.response).toEqual(['work']);
    });

    it('should handle SET_WHITELIST_KEYWORDS', async () => {
      await handleMessage(
        { message: MessageTypes.SET_WHITELIST_KEYWORDS, params: [['productivity']] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setWhitelistKeywords).toHaveBeenCalledWith(['productivity']);
    });
  });

  describe('Timer messages', () => {
    it('should handle GET_TIMER_SETTINGS', async () => {
      await handleMessage({ message: MessageTypes.GET_TIMER_SETTINGS }, {}, jest.fn());

      expect(mockHandlers.getTimerSettings).toHaveBeenCalled();
    });

    it('should handle SET_TIMER_SETTINGS', async () => {
      const timerSettings = { isEnabled: true, duration: 3600 };
      await handleMessage(
        { message: MessageTypes.SET_TIMER_SETTINGS, params: [timerSettings] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setTimerSettings).toHaveBeenCalledWith(timerSettings);
    });

    it('should handle START_TIMER', async () => {
      await handleMessage(
        { message: MessageTypes.START_TIMER, params: [3600] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.startTimer).toHaveBeenCalledWith(3600);
    });

    it('should handle STOP_TIMER', async () => {
      await handleMessage({ message: MessageTypes.STOP_TIMER }, {}, jest.fn());

      expect(mockHandlers.stopTimer).toHaveBeenCalled();
    });

    it('should handle IS_TIMER_ACTIVE', async () => {
      const result = await handleMessage(
        { message: MessageTypes.IS_TIMER_ACTIVE },
        {},
        jest.fn(),
      );

      expect(mockHandlers.isTimerActive).toHaveBeenCalled();
      expect(result.response).toBe(false);
    });
  });

  describe('Schedule messages', () => {
    it('should handle GET_SCHEDULE', async () => {
      await handleMessage({ message: MessageTypes.GET_SCHEDULE }, {}, jest.fn());

      expect(mockHandlers.getSchedule).toHaveBeenCalled();
    });

    it('should handle SET_SCHEDULE', async () => {
      const schedule = { isEnabled: true, days: { monday: true } };
      await handleMessage(
        { message: MessageTypes.SET_SCHEDULE, params: [schedule] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setSchedule).toHaveBeenCalledWith(schedule);
    });
  });

  describe('Action messages', () => {
    it('should handle GET_ACTION', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_ACTION },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getAction).toHaveBeenCalled();
      expect(result.response).toBe('blockPage');
    });

    it('should handle SET_ACTION', async () => {
      await handleMessage(
        { message: MessageTypes.SET_ACTION, params: ['redirect'] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setAction).toHaveBeenCalledWith('redirect');
    });
  });

  describe('Redirect URL messages', () => {
    it('should handle GET_REDIRECT_URL', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_REDIRECT_URL },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getRedirectUrl).toHaveBeenCalled();
      expect(result.response).toBe('https://example.com');
    });

    it('should handle SET_REDIRECT_URL', async () => {
      await handleMessage(
        { message: MessageTypes.SET_REDIRECT_URL, params: ['https://new-url.com'] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setRedirectUrl).toHaveBeenCalledWith('https://new-url.com');
    });
  });

  describe('Unblock messages', () => {
    it('should handle GET_UNBLOCK_SETTINGS', async () => {
      await handleMessage({ message: MessageTypes.GET_UNBLOCK_SETTINGS }, {}, jest.fn());

      expect(mockHandlers.getUnblockSettings).toHaveBeenCalled();
    });

    it('should handle SET_UNBLOCK_SETTINGS', async () => {
      const settings = { isEnabled: true, unblockOnceTimeout: 60 };
      await handleMessage(
        { message: MessageTypes.SET_UNBLOCK_SETTINGS, params: [settings] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setUnblockSettings).toHaveBeenCalledWith(settings);
    });
  });

  describe('Frames type messages', () => {
    it('should handle GET_FRAMES_TYPE', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_FRAMES_TYPE },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getFramesType).toHaveBeenCalled();
      expect(result.response).toBe('all');
    });

    it('should handle SET_FRAMES_TYPE', async () => {
      await handleMessage(
        { message: MessageTypes.SET_FRAMES_TYPE, params: ['main'] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setFramesType).toHaveBeenCalledWith('main');
    });
  });

  describe('Password messages', () => {
    it('should handle GET_IS_PASSWORD_ENABLED', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_IS_PASSWORD_ENABLED },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getIsPasswordEnabled).toHaveBeenCalled();
      expect(result.response).toBe(false);
    });

    it('should handle SET_IS_PASSWORD_ENABLED', async () => {
      await handleMessage(
        { message: MessageTypes.SET_IS_PASSWORD_ENABLED, params: [true] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.setIsPasswordEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('Diagnostics messages', () => {
    it('should handle PING', async () => {
      const result = await handleMessage({ message: MessageTypes.PING }, {}, jest.fn());

      expect(result.response).toHaveProperty('timestamp');
      expect(result.response).toHaveProperty('status', 'alive');
    });

    it('should handle GET_CURRENT_SETTINGS', async () => {
      await handleMessage({ message: MessageTypes.GET_CURRENT_SETTINGS }, {}, jest.fn());

      expect(mockHandlers.getCurrentSettings).toHaveBeenCalled();
    });

    it('should handle FORCE_UPDATE_RULES', async () => {
      await handleMessage({ message: MessageTypes.FORCE_UPDATE_RULES }, {}, jest.fn());

      expect(mockHandlers.forceUpdateRules).toHaveBeenCalled();
    });

    it('should handle FORCE_PULL_FROM_SYNC', async () => {
      await handleMessage({ message: MessageTypes.FORCE_PULL_FROM_SYNC }, {}, jest.fn());

      expect(mockHandlers.forcePullFromSync).toHaveBeenCalled();
    });

    it('should handle DIAGNOSE_SYNC_STATUS', async () => {
      await handleMessage({ message: MessageTypes.DIAGNOSE_SYNC_STATUS }, {}, jest.fn());

      expect(mockHandlers.diagnoseSyncStatus).toHaveBeenCalled();
    });
  });

  describe('URL checking messages', () => {
    it('should handle IS_URL_STILL_BLOCKED', async () => {
      await handleMessage(
        { message: MessageTypes.IS_URL_STILL_BLOCKED, params: ['https://facebook.com'] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.isUrlStillBlocked).toHaveBeenCalledWith('https://facebook.com');
    });

    it('should handle TEST_URL', async () => {
      const request = { message: MessageTypes.TEST_URL, url: 'https://test.com' };
      await handleMessage(request, {}, jest.fn());

      expect(mockHandlers.testUrl).toHaveBeenCalledWith(request);
    });

    it('should handle DEBUG_URL_MATCHING', async () => {
      await handleMessage(
        { message: MessageTypes.DEBUG_URL_MATCHING, params: ['https://facebook.com'] },
        {},
        jest.fn(),
      );

      expect(mockHandlers.debugUrlMatching).toHaveBeenCalledWith('https://facebook.com');
    });
  });

  describe('Temp allowed messages', () => {
    it('should handle GET_TMP_ALLOWED', async () => {
      const result = await handleMessage(
        { message: MessageTypes.GET_TMP_ALLOWED },
        {},
        jest.fn(),
      );

      expect(mockHandlers.getTmpAllowed).toHaveBeenCalled();
      expect(result.response).toEqual([]);
    });
  });

  describe('Fallback to state when handlers not provided', () => {
    it('should fall back to state for GET_IS_ENABLED without handler', async () => {
      const routerWithoutHandler = createMessageRouter({
        state: mockState,
        handlers: {},
        nativeAPI: mockNativeAPI,
      });

      const result = await routerWithoutHandler(
        { message: MessageTypes.GET_IS_ENABLED },
        {},
        jest.fn(),
      );

      expect(result.response).toBe(true);
    });

    it('should fall back to state for GET_MODE without handler', async () => {
      const routerWithoutHandler = createMessageRouter({
        state: mockState,
        handlers: {},
        nativeAPI: mockNativeAPI,
      });

      const result = await routerWithoutHandler(
        { message: MessageTypes.GET_MODE },
        {},
        jest.fn(),
      );

      expect(result.response).toBe('denylist');
    });
  });
});
