# Uninstall Data Loss Protection

## The Problem

When a Chrome extension is **uninstalled** (not just disabled or reloaded), Chrome immediately **deletes all sync storage** associated with that extension from the cloud. This causes a catastrophic cascade:

1. **Machine A**: User uninstalls extension
2. **Chrome Cloud**: Sync storage for extension is deleted (all rules gone)
3. **Machine B**: Still running, receives sync update with EMPTY arrays
4. **Machine B**: Would normally accept the empty data and lose all rules
5. **All machines**: Data loss complete

This is Chrome's intended behavior - uninstall means "remove all traces" including cloud data.

## The Solution: Multi-Layer Protection

We've implemented **4 layers of protection** to prevent data loss:

### Layer 1: Catastrophic Data Loss Detection (NEW - MOST CRITICAL)

### What It Does

**Location**: `service-worker.js` - `handleStorageChanges()`

**What it does**: 
- Monitors all incoming sync storage changes
- If local storage has rules (e.g., 50+ items) but sync change has `newValue = undefined` (key deleted), `null`, or `[]` (empty)
- **REFUSES** to accept the empty data
- **IMMEDIATELY RE-UPLOADS** local data back to sync storage to restore the cloud
- Logs critical warning with 🚨 emoji
- Sends notification to UI

**Why it matters**: This is the ONLY protection that saves Machine B when Machine A uninstalls. Without this, Machine B would blindly accept empty data and lose everything.

**Critical Implementation Detail**: 
When Chrome uninstalls an extension, it **deletes** the sync storage keys, sending `newValue = undefined` (not `newValue = []`). The check must use:
```javascript
!changes.blacklist.newValue || (Array.isArray(changes.blacklist.newValue) && changes.blacklist.newValue.length === 0)
```
Not just `Array.isArray()` check, which would miss the undefined case!

**Code**:
```javascript
async function handleStorageChanges(changes, areaName) {
  if (areaName !== 'sync') return;

  const hasLocalRules = blacklist.length > 0 || whitelist.length > 0;
  
  if (hasLocalRules) {
    const syncSettingToEmpty = 
      (changes.blacklist?.newValue?.length === 0) ||
      (changes.whitelist?.newValue?.length === 0);
    
    if (syncSettingToEmpty) {
      logError('🚨 CATASTROPHIC DATA LOSS DETECTED! 🚨');
      logError('REFUSING to accept empty data and RE-UPLOADING local rules!');
      
      // Restore cloud from local
      await saveArrayToSync('blacklist', blacklist);
      await saveArrayToSync('whitelist', whitelist);
      // ... etc
      
      return; // DO NOT accept empty data
    }
  }
  
  // Normal sync handling continues...
}
```

### Layer 2: Fresh Install Time-Based Protection

**Location**: `service-worker.js` - `saveArrayToSync()` and `syncStorage.js` - `checkIfFreshInstall()`

**What it does**:
- Tracks `installTime` in local storage
- For **15 minutes** after installation, REFUSES to write empty arrays to sync
- Checks metadata and existing chunks before any write
- Saves to local storage only during protection period

**Why it matters**: Prevents Machine A from overwriting cloud data during fresh install before cloud sync completes.

**Duration**: 15 minutes (service worker) + 15 minutes (frontend)

### Layer 3: Metadata-Based Protection

**Location**: `service-worker.js` - `saveArrayToSync()`

**What it does**:
- Before writing empty array, checks for existing `{key}_metadata` in sync storage
- If metadata exists with `totalCount > 0`, refuses to overwrite
- Logs: "PREVENTED DATA LOSS: Found existing X items in Y chunks"

**Why it matters**: Catches attempts to overwrite chunked data with empty arrays.

### Layer 4: Dechunk Verification

**Location**: `service-worker.js` - `saveArrayToSync()`

**What it does**:
- If no metadata found, tries to load and dechunk existing data
- If any items found, refuses to overwrite with empty array
- Logs: "PREVENTED DATA LOSS: Found X existing items (no metadata)"

**Why it matters**: Final safety net for data that exists but has corrupted metadata.

## Protection Summary Table

| Layer | Trigger | Action | Protects Against |
|-------|---------|--------|------------------|
| 1. Catastrophic Detection | Machine B receives empty sync | Restore from local to cloud | Uninstall on Machine A |
| 2. Fresh Install Time | Writing empty during first 15 min | Skip sync, local only | Fresh install overwrite |
| 3. Metadata Check | Empty write + existing metadata | Refuse write, local only | Accidental empty saves |
| 4. Dechunk Check | Empty write + can load chunks | Refuse write, local only | Metadata corruption |

## User Notifications

When Layer 1 triggers (catastrophic detection), users see:

**Settings Page**:
```
⚠️ Data loss detected! Cloud storage was empty but local had 50 rules. 
Automatically restored from local backup.
```

**Console Logs**:
```
🚨 CATASTROPHIC DATA LOSS DETECTED! 🚨
Local storage has 45 deny + 5 allow rules
But sync storage is trying to set them to EMPTY!
This likely means another machine uninstalled the extension.
REFUSING to accept empty data and RE-UPLOADING local rules to restore cloud!
✅ Successfully restored cloud sync storage from local data
Restored 45 deny + 5 allow rules to cloud
```

## Development Best Practices

### ✅ DO:
- **Use "Reload" button** in `chrome://extensions` for testing
- **Use "Load unpacked"** for development builds
- **Export settings** before major changes (Settings → Export)
- Test on separate browser profile for destructive tests

### ❌ DON'T:
- **DON'T uninstall** to test fresh install - use separate profile instead
- **DON'T uninstall** on a machine with production rules
- **DON'T disable sync** during testing (breaks Layer 1)

## Testing the Protection

### Test 1: Simulate Uninstall on Machine A ✅ CONFIRMED WORKING

**Machine A** (test machine):
1. Install extension with test data (or real data)
2. Wait for sync to Machine B (verify data appears)
3. Uninstall extension (simulates the catastrophic event)

**Machine B** (production machine with rules):
1. Check console logs - should see: 🚨 CATASTROPHIC DATA LOSS DETECTED!
2. Check settings - rules should still be there (258 rules confirmed in testing)
3. Check sync storage (check-sync-data.html) - rules should be restored
4. Optional: Notification appears about recovery

**Expected**: Machine B refuses empty sync, restores cloud from local

**Actual Test Results** (2026-01-29):
```
[DMN ERROR] 🚨 CATASTROPHIC DATA LOSS DETECTED! 🚨
[DMN ERROR] Local storage has 12 deny + 246 allow rules
[DMN ERROR] But sync storage is trying to set them to EMPTY!
[DMN ERROR] REFUSING to accept empty data and RE-UPLOADING local rules to restore cloud!
[SYNC] Writing to sync storage - {"keys":["blacklist"]}
[DMN INFO] ✅ Successfully restored cloud sync storage from local data
```
✅ All 258 rules preserved and cloud restored successfully!

### Test 2: Fresh Install Write Protection

1. Install extension on fresh machine
2. Settings loads with empty arrays
3. Click Save within 15 minutes
4. Check logs - should skip sync write
5. After 15 minutes, should allow writes (if metadata checks pass)

**Expected**: No cloud data overwritten during fresh install period

## Technical Details

### Why Uninstall Clears Cloud Storage

Chrome treats each extension as a separate sync namespace. When you uninstall:
- Extension ID is the key for sync storage
- Chrome immediately removes ALL keys with that extension ID from sync
- This propagates to all devices within ~30-60 seconds
- **There is no "undo" or "recycle bin"**

This is by design - Chrome assumes uninstall means "I don't want this anymore, delete everything."

### The Timing Problem

Without Layer 1 protection:
- **T+0s**: Machine A uninstalls
- **T+5s**: Chrome cloud deletes sync storage
- **T+30s**: Machine B receives sync update (empty arrays)
- **T+30s**: Machine B's `handleStorageChanges()` updates in-memory vars to empty
- **T+35s**: User opens Settings on Machine B
- **T+35s**: Settings reads from local storage... but it's already been overwritten
- **T+40s**: Data loss complete

With Layer 1 protection:
- **T+0s**: Machine A uninstalls
- **T+5s**: Chrome cloud deletes sync storage
- **T+30s**: Machine B receives sync update (empty arrays)
- **T+30s**: Machine B's `handleStorageChanges()` **DETECTS ANOMALY**
- **T+31s**: Machine B **REFUSES** empty data
- **T+32s**: Machine B **RE-UPLOADS** local rules to cloud
- **T+35s**: Cloud restored ✅
- **T+60s**: Machine A (if reinstalled) syncs restored rules from Machine B

## Logs to Monitor

### Normal Operation
```
[DMN INFO] Sync storage updated: deny patterns, allow patterns
[DMN INFO] Re-evaluating all open tabs with new rules from sync
```

### Protection Triggered (Layer 1)
```
[DMN ERROR] 🚨 CATASTROPHIC DATA LOSS DETECTED! 🚨
[DMN ERROR] Local storage has 45 deny + 5 allow rules
[DMN ERROR] But sync storage is trying to set them to EMPTY!
[DMN ERROR] REFUSING to accept empty data and RE-UPLOADING local rules!
[DMN INFO] ✅ Successfully restored cloud sync storage from local data
```

### Protection Triggered (Layer 2)
```
[DMN ERROR] PREVENTED DATA LOSS: Extension installed only 3.5 minutes ago
[DMN ERROR] Refusing to write empty blacklist to sync storage during fresh install period
```

### Protection Triggered (Layer 3)
```
[DMN ERROR] PREVENTED DATA LOSS: Found existing blacklist metadata:
[DMN ERROR]   - 45 items in 2 chunks
[DMN ERROR]   - Last updated: 1/29/2026 3:45:23 PM (12.3 minutes ago)
[DMN ERROR]   - Refusing to overwrite with empty array!
```

## Related Files

- `public/service-worker.js` - All 4 protection layers
- `src/helpers/syncStorage.js` - Frontend fresh install check (Layer 2)
- `src/components/Settings/index.jsx` - Data loss notification handler
- `DATA-LOSS-PREVENTION.md` - Original protection documentation
- `check-sync-data.html` - Diagnostic tool for inspecting sync storage

## Version History

- **v3.14.2** (2026-01-29): 
  - Added Layer 1 (Catastrophic Detection) - THE CRITICAL FIX
  - **BUGFIX**: Fixed detection to catch `undefined` (key deletion) not just empty arrays
  - Tested and confirmed working with real uninstall scenario
- **v3.14.0** (2026-01-27): Added Layers 2-4 (Fresh install, metadata, dechunk protection)
