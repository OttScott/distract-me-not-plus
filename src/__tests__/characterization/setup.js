/**
 * Characterization Test Infrastructure
 *
 * This file provides mock factories for chrome.* and browser.* APIs
 * to enable testing both Chrome (MV3 service worker) and Firefox (MV2 Background component)
 * implementations with consistent test infrastructure.
 *
 * The mocks support both callback-style (Chrome) and Promise-style (Firefox/polyfill) APIs.
 */

/**
 * Creates an in-memory storage area that supports both callback and Promise APIs
 * @returns {Object} Storage area with get, set, remove, clear methods
 */
export function createStorageArea() {
  const data = new Map();

  return {
    _data: data, // Expose for testing

    get: jest.fn((keys, callback) => {
      const result = {};

      // Handle different key formats
      if (keys === null || keys === undefined) {
        // Get all data
        data.forEach((value, key) => {
          result[key] = value;
        });
      } else if (typeof keys === 'string') {
        if (data.has(keys)) {
          result[keys] = data.get(keys);
        }
      } else if (Array.isArray(keys)) {
        keys.forEach((key) => {
          if (data.has(key)) {
            result[key] = data.get(key);
          }
        });
      } else if (typeof keys === 'object') {
        // Keys with default values
        Object.entries(keys).forEach(([key, defaultValue]) => {
          result[key] = data.has(key) ? data.get(key) : defaultValue;
        });
      }

      // Support both callback and Promise styles
      if (callback) {
        callback(result);
        return undefined;
      }
      return Promise.resolve(result);
    }),

    set: jest.fn((items, callback) => {
      Object.entries(items).forEach(([key, value]) => {
        data.set(key, value);
      });

      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    }),

    remove: jest.fn((keys, callback) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => data.delete(key));

      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    }),

    clear: jest.fn((callback) => {
      data.clear();

      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    }),

    getBytesInUse: jest.fn((keys, callback) => {
      let size = 0;
      if (keys === null) {
        data.forEach((value) => {
          size += JSON.stringify(value).length;
        });
      } else {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach((key) => {
          if (data.has(key)) {
            size += JSON.stringify(data.get(key)).length;
          }
        });
      }

      if (callback) {
        callback(size);
        return undefined;
      }
      return Promise.resolve(size);
    }),
  };
}

/**
 * Creates a mock event listener system
 * @returns {Object} Event with addListener, removeListener, hasListener
 */
export function createEventEmitter() {
  const listeners = new Set();

  return {
    addListener: jest.fn((listener) => {
      listeners.add(listener);
    }),
    removeListener: jest.fn((listener) => {
      listeners.delete(listener);
    }),
    hasListener: jest.fn((listener) => {
      return listeners.has(listener);
    }),
    // Helper for tests to trigger events
    _emit: (...args) => {
      listeners.forEach((listener) => listener(...args));
    },
    _listeners: listeners,
  };
}

/**
 * Creates a complete Chrome API mock
 * @returns {Object} Mock chrome.* API object
 */
export function createChromeMock() {
  const localStorageArea = createStorageArea();
  const syncStorageArea = createStorageArea();

  return {
    storage: {
      local: localStorageArea,
      sync: syncStorageArea,
      onChanged: createEventEmitter(),
    },

    runtime: {
      id: 'test-extension-id',
      getManifest: jest.fn(() => ({
        version: '3.14.2',
        name: 'Distract Me Not Plus',
        manifest_version: 3,
      })),
      sendMessage: jest.fn((message, callback) => {
        if (callback) {
          callback({ success: true });
          return undefined;
        }
        return Promise.resolve({ success: true });
      }),
      onMessage: createEventEmitter(),
      onInstalled: createEventEmitter(),
      onStartup: createEventEmitter(),
      lastError: null,
    },

    tabs: {
      query: jest.fn((queryInfo, callback) => {
        const tabs = [{ id: 1, url: 'https://example.com', active: true }];
        if (callback) {
          callback(tabs);
          return undefined;
        }
        return Promise.resolve(tabs);
      }),
      update: jest.fn((tabId, updateProperties, callback) => {
        const tab = { id: tabId, ...updateProperties };
        if (callback) {
          callback(tab);
          return undefined;
        }
        return Promise.resolve(tab);
      }),
      create: jest.fn((createProperties, callback) => {
        const tab = { id: Date.now(), ...createProperties };
        if (callback) {
          callback(tab);
          return undefined;
        }
        return Promise.resolve(tab);
      }),
      remove: jest.fn((tabIds, callback) => {
        if (callback) {
          callback();
          return undefined;
        }
        return Promise.resolve();
      }),
      get: jest.fn((tabId, callback) => {
        const tab = { id: tabId, url: 'https://example.com' };
        if (callback) {
          callback(tab);
          return undefined;
        }
        return Promise.resolve(tab);
      }),
      onUpdated: createEventEmitter(),
      onActivated: createEventEmitter(),
      onRemoved: createEventEmitter(),
      onReplaced: createEventEmitter(),
    },

    alarms: {
      create: jest.fn(),
      clear: jest.fn((name, callback) => {
        if (callback) {
          callback(true);
          return undefined;
        }
        return Promise.resolve(true);
      }),
      clearAll: jest.fn((callback) => {
        if (callback) {
          callback(true);
          return undefined;
        }
        return Promise.resolve(true);
      }),
      get: jest.fn((name, callback) => {
        if (callback) {
          callback(null);
          return undefined;
        }
        return Promise.resolve(null);
      }),
      getAll: jest.fn((callback) => {
        if (callback) {
          callback([]);
          return undefined;
        }
        return Promise.resolve([]);
      }),
      onAlarm: createEventEmitter(),
    },

    i18n: {
      getMessage: jest.fn((messageName) => {
        const messages = {
          appName: 'Distract Me Not Plus',
          denyList: 'Deny List',
          allowList: 'Allow List',
          combined: 'Combined',
          blockTab: 'Block Tab',
          redirectToUrl: 'Redirect to URL',
          closeTab: 'Close Tab',
          defaultBlockingMessage: 'This page has been blocked.',
        };
        return messages[messageName] || messageName;
      }),
    },

    webRequest: {
      onBeforeRequest: createEventEmitter(),
    },

    webNavigation: {
      onBeforeNavigate: createEventEmitter(),
      onCompleted: createEventEmitter(),
    },

    declarativeNetRequest: {
      updateDynamicRules: jest.fn((options, callback) => {
        if (callback) {
          callback();
          return undefined;
        }
        return Promise.resolve();
      }),
      getDynamicRules: jest.fn((callback) => {
        if (callback) {
          callback([]);
          return undefined;
        }
        return Promise.resolve([]);
      }),
    },

    contextMenus: {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      removeAll: jest.fn(),
      onClicked: createEventEmitter(),
    },

    browserAction: {
      setIcon: jest.fn(),
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
    },

    notifications: {
      create: jest.fn((id, options, callback) => {
        if (callback) {
          callback(id || 'notification-id');
          return undefined;
        }
        return Promise.resolve(id || 'notification-id');
      }),
    },
  };
}

/**
 * Creates a Firefox browser.* API mock (Promise-based polyfill style)
 * @returns {Object} Mock browser.* API object
 */
export function createBrowserMock() {
  const chromeMock = createChromeMock();

  // Firefox uses browser.* with Promise-based APIs (via webextension-polyfill)
  // The structure is similar to Chrome but all methods return Promises
  return {
    ...chromeMock,

    // Override any Chrome-specific APIs with Firefox equivalents
    browserAction: chromeMock.browserAction,

    // Firefox-specific: contextMenus returns Promise
    contextMenus: {
      ...chromeMock.contextMenus,
      create: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      removeAll: jest.fn(() => Promise.resolve()),
    },
  };
}

/**
 * Sets up the global mocks for testing
 * @param {string} platform - 'chrome' or 'firefox'
 */
export function setupGlobalMocks(platform = 'chrome') {
  if (platform === 'firefox') {
    global.browser = createBrowserMock();
    global.chrome = global.browser; // Firefox polyfill also sets chrome
  } else {
    global.chrome = createChromeMock();
    global.browser = global.chrome; // Some code uses browser even in Chrome
  }

  // Set up self for service worker tests
  global.self = {
    ...global,
    importScripts: jest.fn(),
    matchesPattern: jest.fn((pattern, url) => {
      // Stub implementation for testing
      return url.includes(pattern.replace(/\*/g, ''));
    }),
  };
}

/**
 * Clears all storage and resets mocks
 */
export function clearAllMocks() {
  if (global.chrome) {
    global.chrome.storage.local._data?.clear();
    global.chrome.storage.sync._data?.clear();
    jest.clearAllMocks();
  }
  if (global.browser && global.browser !== global.chrome) {
    global.browser.storage.local._data?.clear();
    global.browser.storage.sync._data?.clear();
  }
}

/**
 * Helper to populate storage with test data
 * @param {Object} localData - Data for local storage
 * @param {Object} syncData - Data for sync storage
 */
export async function populateStorage(localData = {}, syncData = {}) {
  if (global.chrome) {
    if (Object.keys(localData).length > 0) {
      await global.chrome.storage.local.set(localData);
    }
    if (Object.keys(syncData).length > 0) {
      await global.chrome.storage.sync.set(syncData);
    }
  }
}

/**
 * Creates a mock tab object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock tab object
 */
export function createMockTab(overrides = {}) {
  return {
    id: 1,
    url: 'https://example.com',
    active: true,
    windowId: 1,
    index: 0,
    pinned: false,
    highlighted: true,
    status: 'complete',
    incognito: false,
    ...overrides,
  };
}

/**
 * Creates a mock request details object for webRequest events
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock request details
 */
export function createMockRequestDetails(overrides = {}) {
  return {
    requestId: '12345',
    url: 'https://example.com',
    method: 'GET',
    frameId: 0,
    parentFrameId: -1,
    tabId: 1,
    type: 'main_frame',
    timeStamp: Date.now(),
    ...overrides,
  };
}

// Export default setup for convenience
const setupModule = {
  createChromeMock,
  createBrowserMock,
  createStorageArea,
  createEventEmitter,
  setupGlobalMocks,
  clearAllMocks,
  populateStorage,
  createMockTab,
  createMockRequestDetails,
};
export default setupModule;

// Jest requires at least one test in each file
describe('Characterization Test Setup', () => {
  it('exports mock factories', () => {
    expect(typeof createChromeMock).toBe('function');
    expect(typeof createBrowserMock).toBe('function');
    expect(typeof createStorageArea).toBe('function');
    expect(typeof setupGlobalMocks).toBe('function');
  });

  it('creates working storage mocks', async () => {
    const storage = createStorageArea();
    await storage.set({ test: 'value' });
    const result = await storage.get({ test: 'default' });
    expect(result.test).toBe('value');
  });

  it('creates working event emitters', () => {
    const emitter = createEventEmitter();
    const mockListener = jest.fn();
    emitter.addListener(mockListener);
    emitter._emit('test', 'data');
    expect(mockListener).toHaveBeenCalledWith('test', 'data');
  });
});
