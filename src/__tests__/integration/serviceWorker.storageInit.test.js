/**
 * Integration tests for storage initialization
 * Tests fresh install, existing install, and sync scenarios
 */

// Mock chrome.storage APIs
import {
  isLikelyFreshInstall,
  forcePullFromSyncStorage,
  initializeSyncProtection,
  safeSaveToSync,
  getDefaultSyncValues,
} from '../../service-worker/storage/syncProtection';

import * as syncStorage from '../../service-worker/storage/syncStorage';
import * as localStorage from '../../service-worker/storage/localStorage';

const mockChrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      getBytesInUse: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  runtime: {
    getManifest: jest.fn(() => ({ version: '3.15.0' })),
  },
};

// Set up global chrome mock
global.chrome = mockChrome;

// Mock the storage modules
jest.mock('../../service-worker/storage/syncStorage', () => ({
  saveArrayToSync: jest.fn().mockResolvedValue(true),
  loadArrayFromSync: jest.fn().mockResolvedValue(undefined),
  getSyncBytesInUse: jest.fn().mockResolvedValue(0),
  getSyncQuota: jest.fn().mockResolvedValue({ bytesInUse: 0, quotaBytes: 102400 }),
  isChunked: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../service-worker/storage/localStorage', () => ({
  get: jest.fn().mockResolvedValue({}),
  set: jest.fn().mockResolvedValue(undefined),
}));

describe('Storage Initialization Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    mockChrome.storage.sync.getBytesInUse.mockResolvedValue(0);
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue(undefined);
  });

  describe('Fresh Install Scenarios', () => {
    it('should detect fresh install with no data', () => {
      const state = {
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
        isInitialInstall: true,
      };

      expect(isLikelyFreshInstall(state)).toBe(true);
    });

    it('should not detect fresh install if rules exist', () => {
      const state = {
        blacklist: ['facebook.com'],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
        isInitialInstall: true,
      };

      expect(isLikelyFreshInstall(state)).toBe(false);
    });

    it('should initialize with defaults on true fresh install', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: [],
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(0);

      const result = await initializeSyncProtection(true);

      expect(result).toBe(null); // No cloud data found
    });

    it('should pull cloud data on fresh install if data exists', async () => {
      const cloudData = {
        blacklist: ['facebook.com', 'twitter.com'],
        whitelist: ['github.com'],
      };
      mockChrome.storage.sync.get.mockResolvedValue(cloudData);
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      const result = await initializeSyncProtection(true);

      expect(result).not.toBe(null);
      expect(result.blacklist).toContain('facebook.com');
    });

    it('should protect against overwriting cloud data on fresh install', async () => {
      // Simulate fresh install - should not write empty data to sync
      const isInitialInstall = true;
      const emptyData = [];

      await safeSaveToSync('blacklist', emptyData, isInitialInstall);

      // Should save to local only, not sync
      expect(localStorage.set).toHaveBeenCalledWith({ blacklist: [] });
      expect(syncStorage.saveArrayToSync).not.toHaveBeenCalled();
    });

    it('should get correct default values', () => {
      const defaults = getDefaultSyncValues();

      expect(defaults.blacklist).toEqual([]);
      expect(defaults.whitelist).toEqual([]);
      expect(defaults.blacklistKeywords).toEqual([]);
      expect(defaults.whitelistKeywords).toEqual([]);
      expect(defaults.mode).toBeDefined();
      expect(defaults.framesType).toBeDefined();
    });
  });

  describe('Existing Install Scenarios', () => {
    it('should not trigger sync protection on existing install', async () => {
      const result = await initializeSyncProtection(false);

      expect(result).toBe(null);
      expect(mockChrome.storage.sync.get).not.toHaveBeenCalled();
    });

    it('should allow sync writes on existing install even with empty data', async () => {
      const isInitialInstall = false;
      const emptyData = [];

      await safeSaveToSync('blacklist', emptyData, isInitialInstall);

      expect(syncStorage.saveArrayToSync).toHaveBeenCalledWith('blacklist', []);
    });

    it('should properly save new rules on existing install', async () => {
      const isInitialInstall = false;
      const rules = ['facebook.com', 'twitter.com'];

      await safeSaveToSync('blacklist', rules, isInitialInstall);

      expect(syncStorage.saveArrayToSync).toHaveBeenCalledWith('blacklist', rules);
    });
  });

  describe('Sync Storage Scenarios', () => {
    it('should force pull from sync storage', async () => {
      const syncData = {
        blacklist: ['facebook.com'],
        whitelist: ['github.com'],
      };
      mockChrome.storage.sync.get.mockResolvedValue(syncData);
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.blacklist).toContain('facebook.com');
    });

    it('should handle sync storage errors gracefully', async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error('Sync error'));

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
    });

    it('should detect when sync storage has data but no valid rules', async () => {
      // Sync has bytes but no valid rule arrays
      mockChrome.storage.sync.get.mockResolvedValue({
        mode: 'denylist',
        framesType: 'all',
        // No blacklist or whitelist
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(100);

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(false);
    });

    it('should update local storage after successful sync pull', async () => {
      const syncData = {
        blacklist: ['facebook.com'],
        whitelist: [],
      };
      mockChrome.storage.sync.get.mockResolvedValue(syncData);
      syncStorage.getSyncBytesInUse.mockResolvedValue(300);

      await forcePullFromSyncStorage();

      expect(localStorage.set).toHaveBeenCalled();
    });

    it('should handle dechunking of large arrays', async () => {
      const syncData = {
        blacklist: ['chunk0_data'],
        whitelist: [],
      };
      mockChrome.storage.sync.get.mockResolvedValue(syncData);
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);
      syncStorage.loadArrayFromSync.mockResolvedValue(['dechunked_data']);

      await forcePullFromSyncStorage();

      expect(syncStorage.loadArrayFromSync).toHaveBeenCalled();
    });
  });

  describe('Cross-device sync scenarios', () => {
    it('should preserve existing cloud rules on new device', async () => {
      // Simulate new device with existing cloud data
      const cloudData = {
        blacklist: ['facebook.com', 'twitter.com', 'instagram.com'],
        whitelist: ['github.com', 'stackoverflow.com'],
        blacklistKeywords: ['social', 'games'],
        whitelistKeywords: ['work', 'productivity'],
        mode: 'denylist',
      };
      mockChrome.storage.sync.get.mockResolvedValue(cloudData);
      syncStorage.getSyncBytesInUse.mockResolvedValue(1500);

      const result = await initializeSyncProtection(true);

      expect(result).not.toBe(null);
      expect(result.blacklist).toHaveLength(3);
      expect(result.whitelist).toHaveLength(2);
    });

    it('should handle empty cloud storage on new device', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});
      syncStorage.getSyncBytesInUse.mockResolvedValue(0);

      const result = await initializeSyncProtection(true);

      expect(result).toBe(null);
    });
  });

  describe('Error handling', () => {
    it('should handle sync get timeout', async () => {
      mockChrome.storage.sync.get.mockImplementation(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      );

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(false);
    });

    it('should handle malformed sync data', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: 'not an array',
        whitelist: null,
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(100);

      const result = await forcePullFromSyncStorage();

      // Should handle gracefully - malformed data treated as no valid rules
      expect(result.success).toBe(false);
    });

    it('should handle localStorage errors', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: ['facebook.com'],
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);
      localStorage.set.mockRejectedValue(new Error('Local storage error'));

      // Should not throw, but may log error
      await expect(forcePullFromSyncStorage()).resolves.toBeDefined();
    });
  });

  describe('Data integrity', () => {
    it('should preserve rule order during sync', async () => {
      const orderedRules = ['first.com', 'second.com', 'third.com'];
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: orderedRules,
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      const result = await forcePullFromSyncStorage();

      expect(result.data.blacklist).toEqual(orderedRules);
    });

    it('should handle special characters in rules', async () => {
      const rulesWithSpecialChars = [
        '*.example.com',
        'site.com/path?query=value',
        'domain.com/page#section',
      ];
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: rulesWithSpecialChars,
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      const result = await forcePullFromSyncStorage();

      expect(result.data.blacklist).toEqual(rulesWithSpecialChars);
    });

    it('should handle Unicode characters in rules', async () => {
      const unicodeRules = ['例え.jp', 'тест.ru', '测试.cn'];
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: unicodeRules,
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      const result = await forcePullFromSyncStorage();

      expect(result.data.blacklist).toEqual(unicodeRules);
    });
  });
});
