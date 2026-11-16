# Service Worker Architecture

**Last Updated**: 2026-01-24

## Overview

The Distract-Me-Not service worker is the core of the extension, responsible for intercepting web navigation and blocking distracting sites. It runs in the background and persists across browser sessions.

## File Structure

```
public/
├── service-worker.js              # Main service worker (650+ lines)
├── service-worker-patterns.js     # Pattern matching utilities
└── service-worker-sync-logging.js # Sync diagnostics logging
```

## Core Responsibilities

### 1. URL Interception (Multi-Layer Approach)

The service worker uses **three** complementary APIs to ensure comprehensive coverage:

```javascript
// Layer 1: Address bar navigation
chrome.webNavigation.onBeforeNavigate

// Layer 2: Page loads and in-page navigation  
chrome.tabs.onUpdated

// Layer 3: Link clicks (when available)
chrome.webRequest.onBeforeRequest
```

**Why three layers?** Each API has gaps:
- `webNavigation` misses some link clicks
- `tabs.onUpdated` can fire multiple times
- `webRequest` isn't available in all browsers (Manifest V3 restrictions)

### 2. Pattern Matching

URLs are matched using **wildcard patterns** converted to regex:

```javascript
// Example patterns:
"*://*.youtube.com/*"        → Blocks all YouTube pages
"*://facebook.com/feed/*"    → Blocks Facebook feed only
"^https://reddit\\.com/r/.*" → Regex pattern for all subreddits
```

**Pattern conversion flow:**
1. User enters wildcard pattern (`*://site.com/*`)
2. `wildcardToRegExp()` converts to regex (`^.*:\/\/site\.com\/.*$`)
3. Regex is cached and matched against URLs
4. Match result determines blocking action

### 3. Storage Synchronization

**Two-tier storage strategy:**

| Storage Type | What's Stored | Why |
|--------------|---------------|-----|
| **Sync Storage** | Block lists, keywords, mode, schedule | Cross-device sync via cloud |
| **Local Storage** | isEnabled, timer state, logs | Device-specific, avoid conflicts |

**Critical sync behavior:**
- Fresh installs wait up to 60s for sync data before using defaults
- Service worker polls sync storage 6 times (10s intervals)
- UI import operations temporarily disable sync to prevent conflicts
- See `SYNC-TROUBLESHOOTING.md` for common issues

### 4. Blocking Modes

```javascript
const Mode = {
  denylist: 'denylist',   // Block only listed sites
  allowlist: 'allowlist', // Block everything except listed sites  
  combined: 'combined'    // Block listed sites + keyword matching
};
```

**Combined mode** enables keyword blocking (e.g., block pages containing "reddit", "twitter").

### 5. Blocking Actions

When a URL matches:

```javascript
// Option 1: Redirect to blocked page (default)
chrome.tabs.update(tabId, { 
  url: 'blocked.html?url=' + encodeURIComponent(blockedUrl) 
});

// Option 2: Redirect to custom URL
chrome.tabs.update(tabId, { url: customRedirectUrl });

// Option 3: Close tab
chrome.tabs.remove(tabId);
```

## State Management

### Global State Variables

```javascript
// Core state
let isEnabled = false;           // Master on/off switch (local only)
let mode = 'combined';           // Blocking mode (synced)
let blacklist = [];              // Deny list patterns (synced)
let whitelist = [];              // Allow list patterns (synced)
let blacklistKeywords = [];      // Deny list keywords (synced)
let whitelistKeywords = [];      // Allow list keywords (synced)
let timerSettings = {...};       // Timer config (device-specific)
let framesType = ['main_frame']; // What to block (main vs iframes)
```

### Initialization Flow

```
1. chrome.runtime.onInstalled
   ↓
2. Check if fresh install → set isInitialInstall = true
   ↓
3. Wait for sync storage (up to 60s)
   ↓
4. Load settings from storage (sync + local)
   ↓
5. Initialize listeners (webNavigation, tabs, webRequest)
   ↓
6. Service worker ready
```

## Message Passing

The service worker communicates with UI components via `chrome.runtime.sendMessage`:

```javascript
// UI → Service Worker
chrome.runtime.sendMessage({
  type: 'setBlacklist',
  payload: ['*://youtube.com/*']
});

// Service Worker → UI
chrome.runtime.sendMessage({
  type: 'settingsUpdated',
  payload: { isEnabled: true }
});
```

**Common message types:**
- `setBlacklist`, `setWhitelist` - Update block lists
- `enable`, `disable` - Toggle blocking
- `getSettings` - Request current config
- `syncStatus` - Sync diagnostics

## Performance Considerations

### Current Issues

1. **Pattern compilation overhead**
   - Wildcard→Regex conversion happens on every navigation
   - **Optimization needed**: Cache compiled regex patterns

2. **Large blocklist impact**
   - 100+ patterns = linear O(n) matching on every URL
   - **Optimization needed**: Trie data structure or bloom filters

3. **Multiple listener invocations**
   - Same URL can trigger all 3 listeners (webNavigation, tabs, webRequest)
   - Deduplication logic prevents duplicate blocks but adds overhead

### Memory Footprint

```javascript
// Estimated memory per pattern:
// - Wildcard string: ~50 bytes
// - Compiled RegExp: ~200 bytes
// - 100 patterns ≈ 25KB (acceptable)
// - 1000 patterns ≈ 250KB (monitoring needed)
```

## Error Handling

```javascript
try {
  // Blocking logic
} catch (error) {
  logError('Failed to block URL', error);
  // Fail open: Allow navigation if blocking fails
}
```

**Fail-safe principles:**
1. Never crash the service worker (catch all errors)
2. Fail open (allow navigation on errors, don't break browsing)
3. Log errors for debugging

## Security Considerations

1. **ReDoS Prevention**: Max regex length (10,000 chars) enforced in `regex.js`
2. **Password hashing**: bcrypt with 10 salt rounds (now configurable via constants)
3. **No eval()**: All patterns validated before regex compilation
4. **CSP compliance**: No inline scripts in blocked pages

## Testing Gaps

❌ **Missing**: Service worker unit tests  
✅ **Exists**: Pattern matching tests (`regex.test.js`)  
✅ **Exists**: Integration tests for keyword blocking  

**Recommended testing:**
```bash
# Unit tests for pattern matching
npm test -- service-worker-patterns.test.js

# Integration tests for blocking flow
npm test -- service-worker-integration.test.js
```

## Refactoring Plan

The service worker is currently **monolithic** (650+ lines). Proposed modular structure:

```
public/
├── service-worker/
│   ├── index.js              # Main entry point (import modules)
│   ├── patterns.js           # Pattern matching & regex
│   ├── blocking.js           # Core blocking logic
│   ├── storage.js            # Storage sync & local operations
│   ├── listeners.js          # Event listener setup
│   └── logging.js            # Debug utilities
└── service-worker.js         # Build output (bundled)
```

**Benefits:**
- Testable modules (each <200 lines)
- Clear separation of concerns
- Easier debugging and maintenance

## Debugging

### Enable Deep Debugging

```javascript
// In service-worker.js line 65
const ENABLE_DEEP_DEBUGGING = true; // Shows every URL check
```

### Common Debug Scenarios

**Scenario 1: Site not blocking**
```javascript
// Check pattern matching:
1. Open DevTools → Sources → service-worker.js
2. Set breakpoint at pattern matching logic
3. Navigate to site
4. Inspect `blacklist` array and regex matching
```

**Scenario 2: Sync not working**
```javascript
// Check sync logs:
chrome.storage.sync.get(null, console.log);
// Look for "syncPollAttempt" messages in console
```

**Scenario 3: Multiple blocks on same URL**
```javascript
// Check deduplication:
// Search logs for "[DMN INFO] Already blocked recently"
```

## Related Documentation

- [SYNC-TROUBLESHOOTING.md](./SYNC-TROUBLESHOOTING.md) - Sync storage issues
- [DEPENDENCY-UPGRADE-PLAN.md](./DEPENDENCY-UPGRADE-PLAN.md) - Tech debt roadmap
- [CI-CD-DOCUMENTATION.md](./CI-CD-DOCUMENTATION.md) - Build pipeline

## Future Improvements

1. **Module splitting** (Phase 3 of cleanup plan)
2. **Regex caching** for performance
3. **Comprehensive unit tests**
4. **Trie-based pattern matching** for large lists
5. **Service worker lifecycle monitoring** (detect crashes)
