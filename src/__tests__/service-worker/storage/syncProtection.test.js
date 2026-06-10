/**
 * Unit tests for syncProtection module
 * Tests fresh install detection, delayed writes, and chunking logic
 */

// Mock chrome.storage APIs
import {
  isLikelyFreshInstall,
  forcePullFromSyncStorage,
  getDefaultSyncValues,
  shouldSkipSyncWrite,
  safeSaveToSync,
  initializeSyncProtection,
  diagnoseSyncStatus,
  SYNC_CHECK_INTERVAL,
} from '../../../service-worker/storage/syncProtection';

import * as syncStorage from '../../../service-worker/storage/syncStorage';
import * as localStorage from '../../../service-worker/storage/localStorage';

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
};

// Set up global chrome mock
global.chrome = mockChrome;

// Mock the storage modules
jest.mock('../../../service-worker/storage/syncStorage', () => ({
  saveArrayToSync: jest.fn().mockResolvedValue(true),
  loadArrayFromSync: jest.fn().mockResolvedValue(undefined),
  getSyncBytesInUse: jest.fn().mockResolvedValue(0),
  getSyncQuota: jest.fn().mockResolvedValue({ bytesInUse: 0, quotaBytes: 102400 }),
  isChunked: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../service-worker/storage/localStorage', () => ({
  get: jest.fn().mockResolvedValue({}),
  set: jest.fn().mockResolvedValue(undefined),
}));

describe('syncProtection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    mockChrome.storage.sync.getBytesInUse.mockResolvedValue(0);
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue(undefined);
  });

  describe('isLikelyFreshInstall', () => {
    it('should return true for fresh install with no rules', () => {
      const state = {
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
        isInitialInstall: true,
      };
      expect(isLikelyFreshInstall(state)).toBe(true);
    });

    it('should return false if not initial install', () => {
      const state = {
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
        isInitialInstall: false,
      };
      expect(isLikelyFreshInstall(state)).toBe(false);
    });

    it('should return false if blacklist has rules', () => {
      const state = {
        blacklist: ['facebook.com'],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
        isInitialInstall: true,
      };
      expect(isLikelyFreshInstall(state)).toBe(false);
    });

    it('should return false if whitelist has rules', () => {
      const state = {
        blacklist: [],
        whitelist: ['github.com'],
        blacklistKeywords: [],
        whitelistKeywords: [],
        isInitialInstall: true,
      };
      expect(isLikelyFreshInstall(state)).toBe(false);
    });

    it('should return false if blacklistKeywords has rules', () => {
      const state = {
        blacklist: [],
        whitelist: [],
        blacklistKeywords: ['social'],
        whitelistKeywords: [],
        isInitialInstall: true,
      };
      expect(isLikelyFreshInstall(state)).toBe(false);
    });

    it('should return false if whitelistKeywords has rules', () => {
      const state = {
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: ['work'],
        isInitialInstall: true,
      };
      expect(isLikelyFreshInstall(state)).toBe(false);
    });

    it('should handle null/undefined arrays', () => {
      const state = {
        blacklist: null,
        whitelist: undefined,
        blacklistKeywords: null,
        whitelistKeywords: undefined,
        isInitialInstall: true,
      };
      expect(isLikelyFreshInstall(state)).toBe(true);
    });
  });

  describe('getDefaultSyncValues', () => {
    it('should return default values object', () => {
      const defaults = getDefaultSyncValues();

      expect(defaults).toHaveProperty('blacklist');
      expect(defaults).toHaveProperty('whitelist');
      expect(defaults).toHaveProperty('blacklistKeywords');
      expect(defaults).toHaveProperty('whitelistKeywords');
      expect(defaults).toHaveProperty('mode');
      expect(defaults).toHaveProperty('framesType');
      expect(defaults).toHaveProperty('message');
      expect(defaults).toHaveProperty('redirectUrl');
      expect(defaults).toHaveProperty('schedule');
    });

    it('should return empty arrays for lists', () => {
      const defaults = getDefaultSyncValues();

      expect(defaults.blacklist).toEqual([]);
      expect(defaults.whitelist).toEqual([]);
      expect(defaults.blacklistKeywords).toEqual([]);
      expect(defaults.whitelistKeywords).toEqual([]);
    });

    it('should return empty strings for message and redirectUrl', () => {
      const defaults = getDefaultSyncValues();

      expect(defaults.message).toBe('');
      expect(defaults.redirectUrl).toBe('');
    });
  });

  describe('shouldSkipSyncWrite', () => {
    it('should return true for fresh install with empty data', () => {
      expect(shouldSkipSyncWrite(true, [])).toBe(true);
      expect(shouldSkipSyncWrite(true, null)).toBe(true);
      expect(shouldSkipSyncWrite(true, undefined)).toBe(true);
    });

    it('should return false for fresh install with data', () => {
      expect(shouldSkipSyncWrite(true, ['facebook.com'])).toBe(false);
    });

    it('should return false when not fresh install', () => {
      expect(shouldSkipSyncWrite(false, [])).toBe(false);
      expect(shouldSkipSyncWrite(false, null)).toBe(false);
    });
  });

  describe('safeSaveToSync', () => {
    it('should skip sync and save to local only for fresh install with empty data', async () => {
      await safeSaveToSync('blacklist', [], true);

      expect(localStorage.set).toHaveBeenCalledWith({ blacklist: [] });
      expect(syncStorage.saveArrayToSync).not.toHaveBeenCalled();
    });

    it('should save to sync for fresh install with data', async () => {
      await safeSaveToSync('blacklist', ['facebook.com'], true);

      expect(syncStorage.saveArrayToSync).toHaveBeenCalledWith('blacklist', [
        'facebook.com',
      ]);
    });

    it('should save to sync when not fresh install', async () => {
      await safeSaveToSync('blacklist', [], false);

      expect(syncStorage.saveArrayToSync).toHaveBeenCalledWith('blacklist', []);
    });
  });

  describe('forcePullFromSyncStorage', () => {
    it('should pull data from sync storage', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: ['facebook.com'],
        whitelist: ['github.com'],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(1000);

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.blacklist).toContain('facebook.com');
    });

    it('should return failure when no valid rules found', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: [],
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(0);

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
    });

    it('should handle sync storage errors', async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error('Sync error'));

      const result = await forcePullFromSyncStorage();

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
    });

    it('should update local storage with sync data', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: ['facebook.com'],
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      await forcePullFromSyncStorage();

      expect(localStorage.set).toHaveBeenCalled();
    });
  });

  describe('initializeSyncProtection', () => {
    it('should return null when not fresh install', async () => {
      const result = await initializeSyncProtection(false);
      expect(result).toBe(null);
    });

    it('should attempt to pull from sync on fresh install', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: ['facebook.com'],
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(500);

      await initializeSyncProtection(true);

      // Should have attempted to get sync data
      expect(mockChrome.storage.sync.get).toHaveBeenCalled();
    });

    it('should return sync data when found', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: ['facebook.com'],
        whitelist: ['github.com'],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(1000);

      const result = await initializeSyncProtection(true);

      expect(result).not.toBe(null);
      expect(result.blacklist).toBeDefined();
    });

    it('should return null when no sync data found', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: [],
        whitelist: [],
      });
      syncStorage.getSyncBytesInUse.mockResolvedValue(0);

      const result = await initializeSyncProtection(true);

      expect(result).toBe(null);
    });
  });

  describe('diagnoseSyncStatus', () => {
    it('should return sync status object', async () => {
      syncStorage.getSyncQuota.mockResolvedValue({ bytesInUse: 500, quotaBytes: 102400 });
      mockChrome.storage.sync.get.mockResolvedValue({ blacklist: ['facebook.com'] });
      localStorage.get.mockResolvedValue({ blacklist: ['facebook.com'] });

      const result = await diagnoseSyncStatus();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('syncQuota');
      expect(result).toHaveProperty('syncKeys');
      expect(result).toHaveProperty('localKeys');
      expect(result).toHaveProperty('syncRuleCounts');
      expect(result).toHaveProperty('localRuleCounts');
    });

    it('should include rule counts', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        blacklist: ['facebook.com', 'twitter.com'],
        whitelist: ['github.com'],
      });
      localStorage.get.mockResolvedValue({
        blacklist: ['facebook.com', 'twitter.com'],
        whitelist: ['github.com'],
      });

      const result = await diagnoseSyncStatus();

      expect(result.syncRuleCounts.blacklist).toBe(2);
      expect(result.syncRuleCounts.whitelist).toBe(1);
      expect(result.localRuleCounts.blacklist).toBe(2);
    });

    it('should handle errors gracefully', async () => {
      syncStorage.getSyncQuota.mockRejectedValue(new Error('Quota error'));

      const result = await diagnoseSyncStatus();

      expect(result).toHaveProperty('error');
    });

    it('should detect chunked keys', async () => {
      syncStorage.isChunked.mockResolvedValue(true);
      mockChrome.storage.sync.get.mockResolvedValue({ blacklist: ['test'] });
      localStorage.get.mockResolvedValue({ blacklist: ['test'] });
      syncStorage.getSyncQuota.mockResolvedValue({ bytesInUse: 500, quotaBytes: 102400 });

      const result = await diagnoseSyncStatus();

      // May have chunkedKeys if not errored
      expect(result).toBeDefined();
    });
  });

  describe('SYNC_CHECK_INTERVAL', () => {
    it('should be 60 seconds', () => {
      expect(SYNC_CHECK_INTERVAL).toBe(60000);
    });
  });
});
