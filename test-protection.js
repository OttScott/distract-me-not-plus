// Helper to show results
function showResult(elementId, message, type = 'info') {
  const element = document.getElementById(elementId);
  const timestamp = new Date().toLocaleTimeString();
  element.innerHTML = `<div class="result ${type}">[${timestamp}] ${message}</div>`;
}

// Add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Setup buttons
  document.getElementById('btn-create-small').addEventListener('click', createTestData);
  document.getElementById('btn-create-large').addEventListener('click', createLargeTestData);
  document.getElementById('btn-check-current').addEventListener('click', checkCurrentData);
  
  // Test buttons
  document.getElementById('btn-test1').addEventListener('click', testEmptyArrayProtection);
  document.getElementById('btn-test2').addEventListener('click', testTimestampCheck);
  document.getElementById('btn-test3a').addEventListener('click', testSyncVersion);
  document.getElementById('btn-test3b').addEventListener('click', updateDataAndCheckVersion);
  document.getElementById('btn-test4').addEventListener('click', testServiceWorkerProtection);
  document.getElementById('btn-test5').addEventListener('click', triggerProtectionLogs);
  
  // Cleanup button
  document.getElementById('btn-cleanup').addEventListener('click', cleanupTestData);
});


// Helper to load array from sync (handles chunking)
async function loadArrayFromSync(key) {
  const metadataKey = `${key}_metadata`;
  const metadataResult = await chrome.storage.sync.get(metadataKey);
  const metadata = metadataResult?.[metadataKey];
  
  if (metadata && metadata.totalChunks > 0) {
    const chunkKeys = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      chunkKeys.push(`${key}_chunk_${i}`);
    }
    
    const chunksData = await chrome.storage.sync.get(chunkKeys);
    const result = [];
    
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkKey = `${key}_chunk_${i}`;
      const chunk = chunksData[chunkKey];
      if (chunk && Array.isArray(chunk)) {
        result.push(...chunk);
      }
    }
    
    return result;
  } else {
    const result = await chrome.storage.sync.get(key);
    return result[key];
  }
}

// Setup: Create test data
async function createTestData() {
  showResult('setup-result', 'Creating test data...', 'info');
  
  try {
    const testData = [];
    for (let i = 1; i <= 10; i++) {
      testData.push(`test-rule-${i}.com`);
    }
    
    // Use the extension's sync storage helper by sending message to service worker
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [testData]
    });
    
    // Wait a bit for sync to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify it was saved
    const saved = await loadArrayFromSync('blacklist');
    
    if (saved && saved.length === 10) {
      showResult('setup-result', 
        `✅ SUCCESS: Created ${saved.length} test rules\n` +
        `First 3: ${saved.slice(0, 3).join(', ')}`, 
        'success'
      );
    } else {
      showResult('setup-result', 
        `⚠️ WARNING: Expected 10 rules, got ${saved?.length || 0}`, 
        'warning'
      );
    }
  } catch (error) {
    showResult('setup-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

async function createLargeTestData() {
  showResult('setup-result', 'Creating large test data (this will be chunked)...', 'info');
  
  try {
    const testData = [];
    for (let i = 1; i <= 50; i++) {
      testData.push(`large-test-rule-${i}.example.com/path/to/resource?query=param`);
    }
    
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [testData]
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for metadata
    const metadata = await chrome.storage.sync.get('blacklist_metadata');
    const saved = await loadArrayFromSync('blacklist');
    
    if (metadata.blacklist_metadata && metadata.blacklist_metadata.totalChunks > 0) {
      showResult('setup-result', 
        `✅ SUCCESS: Created ${saved.length} rules in ${metadata.blacklist_metadata.totalChunks} chunks\n` +
        `Metadata: ${JSON.stringify(metadata.blacklist_metadata, null, 2)}`,
        'success'
      );
    } else {
      showResult('setup-result', 
        `⚠️ Data saved but not chunked (${saved.length} items)`,
        'warning'
      );
    }
  } catch (error) {
    showResult('setup-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

async function checkCurrentData() {
  showResult('setup-result', 'Checking current data...', 'info');
  
  try {
    const data = await loadArrayFromSync('blacklist');
    const metadata = await chrome.storage.sync.get('blacklist_metadata');
    const syncVersion = await chrome.storage.sync.get('syncVersion');
    
    let result = `Current blacklist: ${data?.length || 0} items\n\n`;
    
    if (metadata.blacklist_metadata) {
      result += `Metadata:\n${JSON.stringify(metadata.blacklist_metadata, null, 2)}\n\n`;
    }
    
    if (syncVersion.syncVersion) {
      const age = (Date.now() - new Date(syncVersion.syncVersion.lastUpdated).getTime()) / 60000;
      result += `Sync Version: ${syncVersion.syncVersion.lastUpdated}\n`;
      result += `Age: ${age.toFixed(1)} minutes ago\n\n`;
    }
    
    if (data && data.length > 0) {
      result += `First 5 items:\n${data.slice(0, 5).join('\n')}`;
    }
    
    showResult('setup-result', result, data?.length > 0 ? 'success' : 'warning');
  } catch (error) {
    showResult('setup-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

// Test 1: Empty Array Protection
async function testEmptyArrayProtection() {
  showResult('test1-result', 'Testing empty array protection...', 'info');
  console.log('🧪 TEST 1: Attempting to write empty array to sync storage');
  
  try {
    // First check if we have existing data
    const existingData = await loadArrayFromSync('blacklist');
    
    if (!existingData || existingData.length === 0) {
      showResult('test1-result', 
        `⚠️ SKIP: No existing data to protect. Create test data first.`,
        'warning'
      );
      return;
    }
    
    console.log(`Current data: ${existingData.length} items`);
    console.log('Attempting to send empty array...');
    
    // Try to write empty array via service worker
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [[]]  // Empty array
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if data still exists
    const afterData = await loadArrayFromSync('blacklist');
    
    if (afterData && afterData.length === existingData.length) {
      showResult('test1-result', 
        `✅ PASS: Protection worked!\n` +
        `- Attempted to write: 0 items\n` +
        `- Data before: ${existingData.length} items\n` +
        `- Data after: ${afterData.length} items\n` +
        `- Result: DATA PROTECTED ✓\n\n` +
        `Check console for "PREVENTED DATA LOSS" message`,
        'success'
      );
      console.log('✅ Protection successful!');
    } else {
      showResult('test1-result', 
        `❌ FAIL: Protection may have failed!\n` +
        `- Data before: ${existingData.length} items\n` +
        `- Data after: ${afterData?.length || 0} items`,
        'error'
      );
      console.error('❌ Protection failed!');
    }
  } catch (error) {
    showResult('test1-result', `❌ ERROR: ${error.message}`, 'error');
    console.error('Test error:', error);
  }
}

// Test 2: Timestamp Check
async function testTimestampCheck() {
  showResult('test2-result', 'Checking metadata timestamps...', 'info');
  
  try {
    const metadata = await chrome.storage.sync.get('blacklist_metadata');
    
    if (!metadata.blacklist_metadata) {
      showResult('test2-result', 
        `⚠️ No metadata found. Create test data first, or data is not chunked.`,
        'warning'
      );
      return;
    }
    
    const lastUpdated = new Date(metadata.blacklist_metadata.lastUpdated);
    const age = (Date.now() - lastUpdated.getTime()) / 60000;
    
    let result = `✅ PASS: Metadata found\n\n`;
    result += `Metadata Details:\n`;
    result += `- Total Chunks: ${metadata.blacklist_metadata.totalChunks}\n`;
    result += `- Total Items: ${metadata.blacklist_metadata.totalCount}\n`;
    result += `- Last Updated: ${lastUpdated.toLocaleString()}\n`;
    result += `- Age: ${age.toFixed(2)} minutes\n\n`;
    result += `This timestamp is checked before any empty array write.`;
    
    showResult('test2-result', result, 'success');
  } catch (error) {
    showResult('test2-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

// Test 3: Sync Version
async function testSyncVersion() {
  showResult('test3-result', 'Checking global sync version...', 'info');
  
  try {
    const syncVersion = await chrome.storage.sync.get('syncVersion');
    
    if (!syncVersion.syncVersion) {
      showResult('test3-result', 
        `⚠️ No sync version found. Write some data first.`,
        'warning'
      );
      return;
    }
    
    const lastUpdated = new Date(syncVersion.syncVersion.lastUpdated);
    const age = (Date.now() - lastUpdated.getTime()) / 60000;
    
    let result = `✅ PASS: Sync version found\n\n`;
    result += `Version Details:\n`;
    result += `- Last Updated: ${lastUpdated.toLocaleString()}\n`;
    result += `- Age: ${age.toFixed(2)} minutes\n`;
    result += `- Last Key: ${syncVersion.syncVersion.key || 'N/A'}\n`;
    result += `- Item Count: ${syncVersion.syncVersion.itemCount || 'N/A'}\n\n`;
    result += `This version is updated after every successful sync write.`;
    
    showResult('test3-result', result, 'success');
  } catch (error) {
    showResult('test3-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

async function updateDataAndCheckVersion() {
  showResult('test3-result', 'Updating data and verifying version...', 'info');
  
  try {
    // Get current version
    const beforeVersion = await chrome.storage.sync.get('syncVersion');
    const beforeTime = beforeVersion.syncVersion?.lastUpdated;
    
    // Update data
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [['updated-rule-1.com', 'updated-rule-2.com', 'updated-rule-3.com']]
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check new version
    const afterVersion = await chrome.storage.sync.get('syncVersion');
    const afterTime = afterVersion.syncVersion?.lastUpdated;
    
    if (afterTime && afterTime !== beforeTime) {
      showResult('test3-result', 
        `✅ PASS: Sync version was updated\n\n` +
        `- Before: ${beforeTime || 'none'}\n` +
        `- After: ${afterTime}\n` +
        `- New item count: ${afterVersion.syncVersion.itemCount}`,
        'success'
      );
    } else {
      showResult('test3-result', 
        `❌ FAIL: Sync version was not updated`,
        'error'
      );
    }
  } catch (error) {
    showResult('test3-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

// Test 4: Service Worker Protection
async function testServiceWorkerProtection() {
  showResult('test4-result', 'Testing service worker protection...', 'info');
  console.log('🧪 TEST 4: Testing service worker saveArrayToSync protection');
  
  try {
    // Ensure we have data
    const existing = await loadArrayFromSync('blacklist');
    if (!existing || existing.length === 0) {
      showResult('test4-result', 
        `⚠️ SKIP: No existing data. Create test data first.`,
        'warning'
      );
      return;
    }
    
    console.log(`Existing data: ${existing.length} items`);
    
    // Try to use the service worker message handler
    console.log('Sending empty array via setBlacklist message...');
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [[]]
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const after = await loadArrayFromSync('blacklist');
    
    if (after && after.length === existing.length) {
      showResult('test4-result',
        `✅ PASS: Service worker protection worked!\n` +
        `Data preserved: ${after.length} items\n\n` +
        `Check service worker console for "PREVENTED DATA LOSS" message`,
        'success'
      );
    } else {
      showResult('test4-result',
        `❌ FAIL: Service worker may not have protected data`,
        'error'
      );
    }
  } catch (error) {
    showResult('test4-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

// Test 5: Console Logging
async function triggerProtectionLogs() {
  showResult('test5-result', 'Triggering protection to generate logs...', 'info');
  
  console.log('');
  console.log('='.repeat(80));
  console.log('🧪 TEST 5: Protection Logging Test');
  console.log('='.repeat(80));
  console.log('Watch for "PREVENTED DATA LOSS" messages below:');
  console.log('');
  
  try {
    const existing = await loadArrayFromSync('blacklist');
    
    if (!existing || existing.length === 0) {
      showResult('test5-result',
        `⚠️ SKIP: No data to protect. Create test data first.`,
        'warning'
      );
      return;
    }
    
    // Trigger protection
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [[]]
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showResult('test5-result',
      `✅ Check the console!\n\n` +
      `Look for messages like:\n` +
      `"PREVENTED DATA LOSS: Found existing blacklist metadata:"\n` +
      `"  - XX items in Y chunks"\n` +
      `"  - Last updated: [timestamp] (X.X minutes ago)"\n` +
      `"  - Refusing to overwrite with empty array!"\n` +
      `"  - Saving to local storage only"\n\n` +
      `If you see these messages, logging is working correctly.`,
      'success'
    );
  } catch (error) {
    showResult('test5-result', `❌ ERROR: ${error.message}`, 'error');
  }
}

// Cleanup
async function cleanupTestData() {
  if (!confirm('This will remove ALL test data from sync storage. Continue?')) {
    return;
  }
  
  showResult('cleanup-result', 'Cleaning up test data...', 'info');
  
  try {
    // Remove via service worker
    await chrome.runtime.sendMessage({
      action: 'setBlacklist',
      params: [[]]
    });
    
    // Also manually clean up any chunks
    const allData = await chrome.storage.sync.get(null);
    const keysToRemove = Object.keys(allData).filter(key => 
      key.startsWith('blacklist_chunk_') || 
      key === 'blacklist_metadata' ||
      key === 'blacklist'
    );
    
    if (keysToRemove.length > 0) {
      await chrome.storage.sync.remove(keysToRemove);
    }
    
    showResult('cleanup-result',
      `✅ Cleaned up:\n` +
      `- Blacklist data\n` +
      `- ${keysToRemove.length} sync storage keys removed`,
      'success'
    );
  } catch (error) {
    showResult('cleanup-result', `❌ ERROR: ${error.message}`, 'error');
  }
}
