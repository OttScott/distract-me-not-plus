# Testing Instructions: Chunked Sync Storage

## What Was Fixed

Implemented automatic chunking for large arrays to work within Chrome's 8KB per-item sync storage limit.

**Your issue:** 243 URLs in whitelist exceeded 8KB limit → failed to sync → stored only in local storage

**Solution:** Arrays are now automatically split into 7KB chunks and stored as:
- `whitelist_chunk_0`, `whitelist_chunk_1`, `whitelist_chunk_2`, etc.
- `whitelist_metadata` (tracks total chunks and count)

## How to Test

### Step 1: Load the Extension

1. Build the extension from Features branch (already built in `build/` folder)
2. Load in Chrome: chrome://extensions → Load unpacked → select `build` folder
3. The extension should load normally

### Step 2: Migrate Your Existing Data

**On your SOURCE machine** (the one with 243 whitelist URLs in local storage):

1. Click the extension icon → Settings (gear icon)
2. Scroll to Advanced section → Click "Diagnostics"
3. Click the **"Migrate to Chunked Storage"** button (yellow/warning)
4. You should see a success message like:
   ```
   Migrated: whitelist: 243 items (8,xxx bytes)
   ```

### Step 3: Verify Migration

**In the service worker console** (chrome://extensions → Distract-Me-Not → service worker):

```javascript
// Check that chunks were created
chrome.storage.sync.get(null, (all) => {
  const chunkKeys = Object.keys(all).filter(k => k.includes('chunk'));
  console.log('Chunk keys found:', chunkKeys);
  
  // Check whitelist metadata
  console.log('Whitelist metadata:', all.whitelist_metadata);
  
  // Check if old monolithic key is gone
  console.log('Old whitelist key:', all.whitelist); // Should be undefined
});
```

Expected output:
- `whitelist_chunk_0`, `whitelist_chunk_1`, etc.
- `whitelist_metadata: { totalChunks: X, totalCount: 243, ... }`
- Old `whitelist` key should be gone

### Step 4: Test Sync to Destination

**On your DESTINATION machine:**

1. Wait 30-60 seconds for Chrome sync to propagate
2. Load the extension
3. Check Settings → see if whitelist appears
4. OR run in service worker console:
   ```javascript
   chrome.storage.sync.get(null, (all) => {
     console.log('Whitelist metadata:', all.whitelist_metadata);
     console.log('Chunk keys:', Object.keys(all).filter(k => k.includes('whitelist_chunk')));
   });
   ```

### Step 5: Verify Extension Reads Chunked Data

**On destination machine, in service worker console:**

```javascript
// Test that dechunking works
const { syncStorage } = await import('./helpers/syncStorage.js');
const data = await syncStorage.get({ whitelist: [] });
console.log('Dechunked whitelist count:', data.whitelist?.length);
console.log('Sample URLs:', data.whitelist?.slice(0, 5));
```

Expected: Should show 243 URLs reconstructed from chunks

## What to Watch For

### Success Indicators ✅
- Migration button shows success message
- Multiple `whitelist_chunk_X` keys in sync storage
- `whitelist_metadata` present with correct totalCount
- Destination machine receives all 243 URLs
- No "quota exceeded" errors

### Failure Indicators ❌
- "quota exceeded" error still appears
- Chunks not created
- Old monolithic whitelist key still exists
- Destination doesn't get data after 2-3 minutes

## Rollback If Needed

If migration fails, your data is safe in local storage. To rollback:

```javascript
// In service worker console
chrome.storage.local.get(['whitelist'], (data) => {
  console.log('Whitelist still in local storage:', data.whitelist?.length);
});
```

## Common Issues

**Issue**: "Migration failed: storage.sync.set quota exceeded"
- **Cause**: Total sync storage > 100KB
- **Solution**: Check total usage first, may need to reduce other data

**Issue**: Chunks created but not syncing
- **Cause**: Browser sync disabled or slow
- **Solution**: Check chrome://settings/syncSetup

**Issue**: Destination shows partial data
- **Cause**: Sync still in progress
- **Solution**: Wait 2-3 minutes, click "Force Sync Down" in Diagnostics

## After Successful Migration

1. Verify blocking still works on both machines
2. Test adding/removing URLs - should sync properly now
3. Check sync status button - should show green health
4. Monitor for any quota warnings in console

## Notes

- **Backwards Compatible**: Old non-chunked data is automatically migrated
- **Automatic**: Future large lists will auto-chunk on save
- **Transparent**: Users don't see any difference in UI
- **Safe**: Original data preserved in local storage during migration
