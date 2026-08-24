# Data Loss Prevention - Technical Details

## Critical Bug Fixed (v3.14.1+)

**Issue:** Reinstalling the extension could delete all your cloud-synced rules.

**Root Cause:** When the extension was reinstalled, empty arrays could overwrite chunked cloud data after a 2-minute protection window expired.

## How the Protection Works

### 1. Metadata Timestamp Checking
Every time rules are saved to sync storage, metadata is created with a `lastUpdated` timestamp:
```javascript
metadata: {
  totalChunks: 3,
  totalCount: 150,
  key: 'blacklist',
  lastUpdated: '2026-01-27T21:15:30.123Z'
}
```

### 2. Empty Array Protection
Before writing empty arrays to sync storage, the system:
1. Checks for existing metadata with timestamps
2. Calculates age of existing data
3. Refuses to overwrite if data exists
4. Logs detailed warning with data age
5. Saves to local storage only as fallback

### 3. Global Sync Version
A universal timestamp (`syncVersion`) tracks the last sync write:
```javascript
syncVersion: {
  lastUpdated: '2026-01-27T21:15:30.123Z',
  key: 'blacklist',
  itemCount: 150
}
```

This provides a reference point independent of individual metadata.

## Scenarios That Are Now Protected

### Scenario 1: Reinstall After 2 Minutes
**Before:** Extension reinstalled → 2 minutes pass → Settings page opens → writes empty arrays → **DATA LOST**

**After:** Extension reinstalled → 2 minutes pass → Settings page opens → checks metadata timestamp → finds existing data → **REFUSES TO WRITE** → saves locally only

### Scenario 2: Sync Failure on Fresh Install
**Before:** Fresh install → sync fails to load → empty arrays in memory → writes to sync → **DATA LOST**

**After:** Fresh install → sync fails to load → attempts write → checks for existing data → finds chunked data → **REFUSES TO WRITE**

### Scenario 3: Race Condition
**Before:** Extension loads → sync read starts → user quickly opens settings → sync not done yet → empty arrays written → **DATA LOST**

**After:** Extension loads → sync read starts → user opens settings → write attempt → checks existing data → finds metadata → **REFUSES TO WRITE**

## Log Messages to Watch For

### Success (Data Protected)
```
PREVENTED DATA LOSS: Found existing blacklist metadata:
  - 150 items in 3 chunks
  - Last updated: 1/27/2026, 1:15:30 PM (5.2 minutes ago)
  - Refusing to overwrite with empty array!
  - Saving to local storage only
```

### Normal Operation
```
Updated sync version for blacklist: 2026-01-27T21:15:30.123Z
```

## For Users

If you see "PREVENTED DATA LOSS" in the console logs:
1. **Don't panic** - your data was protected
2. Check sync storage with the diagnostic tool (`check-sync-data.html`)
3. If data exists in sync, try reloading the extension
4. If data is missing, restore from backup (if available)

## For Developers

The protection is implemented in:
- `src/helpers/syncStorage.js` - Frontend sync operations
- `public/service-worker.js` - Service worker sync operations
- Both locations check metadata timestamps before writes

Key functions:
- `saveArrayToSync()` - Service worker protection
- `syncStorage.set()` - Frontend protection
- Both use `loadArrayFromSync()` to verify existing data

## Testing

Run the diagnostic tool to check sync state:
```
chrome-extension://YOUR_ID/check-sync-data.html
```

This shows:
- All sync storage keys
- Metadata for each key
- Dechunked data (first 5 items)
- Total bytes used
- Data age

## Future Improvements

Consider:
1. Backup mechanism before any destructive operation
2. User confirmation dialog for large data deletions
3. Automatic recovery from local storage if sync is empty
4. Periodic sync health checks with alerts
