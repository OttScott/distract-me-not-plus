import { syncStorage } from './syncStorage';
import { logInfo, debug } from './debug';

/**
 * Settings that should sync between devices
 */
export const syncableSettings = [
  'mode',
  'action',
  'framesType',
  'blacklist',
  'whitelist',
  'blacklistKeywords',
  'whitelistKeywords',
  'message',
  'displayBlankPage',
  'displayBlockedLink',
  'redirectUrl',
  'schedule',
  'misc.hideReportIssueButton',
  'misc.showAddWebsitePrompt'
];

/**
 * Settings that should remain local to each device
 */
export const localOnlySettings = [
  'isEnabled',
  'password',
  'timer',
  'logs',
  'logsLength',
  'enableLogs',
  'enableTimer',
  'enableOnBrowserStartup',
  'syncStatus'  // Track sync status locally
];

/**
 * Sync status tracking (stored locally only)
 */
export const syncStatusTracker = {
  /**
   * Record a successful sync operation
   */
  async recordSyncSuccess(operation = 'general') {
    try {
      // Check if chrome.storage.local is available
      if (!chrome?.storage?.local?.set) {
        debug.error('Chrome storage local API not available for recording sync success');
        return {
          lastSuccessfulSync: new Date().toISOString(),
          lastSyncOperation: operation,
          lastSyncAttempt: new Date().toISOString(),
          consecutiveErrors: 0,
          syncHealth: 'good'
        };
      }

      const syncStatus = await this.getSyncStatus();
      const now = new Date().toISOString();
      
      const updatedStatus = {
        ...syncStatus,
        lastSuccessfulSync: now,
        lastSyncOperation: operation,
        lastSyncAttempt: now,
        consecutiveErrors: 0,  // Reset error count on success
        syncHealth: 'good'
      };
      
      await chrome.storage.local.set({ syncStatus: updatedStatus });
      logInfo(`Sync success recorded: ${operation} at ${now}`);
      return updatedStatus;
    } catch (error) {
      debug.error('Failed to record sync success:', error);
      return {
        lastSuccessfulSync: new Date().toISOString(),
        lastSyncOperation: operation,
        lastSyncAttempt: new Date().toISOString(),
        consecutiveErrors: 0,
        syncHealth: 'good'
      };
    }
  },

  /**
   * Record a sync error
   */
  async recordSyncError(error, operation = 'general') {
    try {
      // Check if chrome.storage.local is available
      if (!chrome?.storage?.local?.set) {
        debug.error('Chrome storage local API not available for recording sync error');
        return {
          lastSyncAttempt: new Date().toISOString(),
          consecutiveErrors: 1,
          syncHealth: 'fair'
        };
      }

      const syncStatus = await this.getSyncStatus();
      const now = new Date().toISOString();
      
      // Handle different error types more robustly
      let errorMessage = 'Unknown error';
      let errorStack = undefined;
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message;
        } else {
          // Convert object to string for better error reporting
          errorMessage = JSON.stringify(error);
        }
        errorStack = error.stack;
      } else {
        errorMessage = String(error);
      }
      
      const errorEntry = {
        timestamp: now,
        operation,
        message: errorMessage,
        stack: errorStack
      };

      const recentErrors = (syncStatus.recentErrors || []).slice(-4); // Keep last 5 errors
      recentErrors.push(errorEntry);

      const consecutiveErrors = (syncStatus.consecutiveErrors || 0) + 1;
      
      const updatedStatus = {
        ...syncStatus,
        lastSyncAttempt: now,
        lastSyncError: errorEntry,
        recentErrors,
        consecutiveErrors,
        syncHealth: consecutiveErrors >= 3 ? 'poor' : consecutiveErrors >= 1 ? 'fair' : 'good'
      };
      
      await chrome.storage.local.set({ syncStatus: updatedStatus });
      debug.error(`Sync error recorded: ${operation}`, error);
      return updatedStatus;
    } catch (storageError) {
      debug.error('Failed to record sync error:', storageError);
      return {
        lastSyncAttempt: new Date().toISOString(),
        consecutiveErrors: 1,
        syncHealth: 'fair'
      };
    }
  },

  /**
   * Get current sync status
   */
  async getSyncStatus() {
    try {
      // Check if chrome.storage.local is available
      if (!chrome?.storage?.local?.get) {
        debug.error('Chrome storage local API not available');
        return {
          lastSuccessfulSync: null,
          lastSyncAttempt: null,
          lastSyncError: null,
          lastSyncOperation: null,
          recentErrors: [],
          consecutiveErrors: 0,
          syncHealth: 'unknown'
        };
      }

      const result = await chrome.storage.local.get('syncStatus');
      const syncStatus = result && result.syncStatus;
      return syncStatus || {
        lastSuccessfulSync: null,
        lastSyncAttempt: null,
        lastSyncError: null,
        lastSyncOperation: null,
        recentErrors: [],
        consecutiveErrors: 0,
        syncHealth: 'unknown'
      };
    } catch (error) {
      debug.error('Failed to get sync status:', error);
      return {
        lastSuccessfulSync: null,
        lastSyncAttempt: null,
        lastSyncError: null,
        lastSyncOperation: null,
        recentErrors: [],
        consecutiveErrors: 0,
        syncHealth: 'unknown'
      };
    }
  },

  /**
   * Clear sync status history
   */
  async clearSyncStatus() {
    try {
      if (chrome?.storage?.local?.remove) {
        await chrome.storage.local.remove('syncStatus');
        logInfo('Sync status history cleared');
      } else {
        debug.error('Chrome storage local API not available for clearing sync status');
      }
    } catch (error) {
      debug.error('Failed to clear sync status:', error);
    }
  }
};

export const diagnostics = {
  async checkSyncStatus() {
    const results = {
      syncAvailable: false,
      storageQuota: null,
      storageUsed: null,
      syncSettings: {},
      localSettings: {},
      syncableSettingsFound: [],
      localOnlySettingsFound: [],
      missingSettings: [],
      browser: navigator.userAgent,
      errors: [],
      // New sync status tracking
      syncStatusHistory: await syncStatusTracker.getSyncStatus()
    };

    try {
      // Check if sync storage is available
      results.syncAvailable = !!chrome?.storage?.sync;
      
      if (results.syncAvailable) {
        try {
          const syncInfo = await chrome.storage.sync.getBytesInUse(null);
          results.storageUsed = syncInfo;
  
          // Get sync quota if available
          if (chrome.storage.sync.getQuota) {
            const storageInfo = await chrome.storage.sync.getQuota();
            results.storageQuota = storageInfo || "Unknown";
          } else {
            results.storageQuota = "~100KB (API not available)";
          }
  
          // Get sync settings
          const syncSettings = await chrome.storage.sync.get(null);
          results.syncSettings = syncSettings;
          
          // Count rules in sync storage
          ['blacklist', 'whitelist', 'blacklistKeywords', 'whitelistKeywords'].forEach(key => {
            if (syncSettings[key] && Array.isArray(syncSettings[key])) {
              results.syncRuleCounts[key] = syncSettings[key].length;
            }
          });
          
          // Check for sync metadata
          if (syncSettings._lastSyncUp) {
            results.lastSyncInfo.lastSyncUp = syncSettings._lastSyncUp;
          }
          if (syncSettings._lastSyncDown) {
            results.lastSyncInfo.lastSyncDown = syncSettings._lastSyncDown;
          }
          
          // Analyze what settings are present
          for (const key of syncableSettings) {
            if (key.includes('.')) {
              // Handle nested properties
              const [parent, child] = key.split('.');
              if (syncSettings[parent] && syncSettings[parent][child] !== undefined) {
                results.syncableSettingsFound.push(key);
              } else {
                results.missingSettings.push(key);
              }
            } else if (syncSettings[key] !== undefined) {
              results.syncableSettingsFound.push(key);
            } else {
              results.missingSettings.push(key);
            }
          }
        } catch (error) {
          results.errors.push({
            location: 'sync storage access',
            message: error.message,
            stack: error.stack
          });
        }
      }

      // Get local settings
      try {
        const localSettings = await chrome.storage.local.get(null);
        results.localSettings = localSettings;
        
        // Count rules in local storage
        ['blacklist', 'whitelist', 'blacklistKeywords', 'whitelistKeywords'].forEach(key => {
          if (localSettings[key] && Array.isArray(localSettings[key])) {
            results.localRuleCounts[key] = localSettings[key].length;
          }
        });
        
        // Check for local sync metadata
        if (localSettings._lastSyncUp) {
          results.lastSyncInfo.lastSyncUp = localSettings._lastSyncUp;
        }
        if (localSettings._lastSyncDown) {
          results.lastSyncInfo.lastSyncDown = localSettings._lastSyncDown;
        }
        
        // Check which local-only settings exist
        for (const key of localOnlySettings) {
          if (key.includes('.')) {
            // Handle nested properties
            const [parent, child] = key.split('.');
            if (localSettings[parent] && localSettings[parent][child] !== undefined) {
              results.localOnlySettingsFound.push(key);
            }
          } else if (localSettings[key] !== undefined) {
            results.localOnlySettingsFound.push(key);
          }
        }
      } catch (error) {
        results.errors.push({
          location: 'local storage access',
          message: error.message,
          stack: error.stack
        });
      }

      return results;
    } catch (error) {
      results.errors.push({
        location: 'general operation',
        message: error.message,
        stack: error.stack
      });
      
      logInfo('Sync diagnostics error', error);
      return results;
    }
  },

  async clearSyncStorage() {
    try {
      await chrome.storage.sync.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  async forceSyncSettings() {
    try {
      // Get all current settings
      const allSettings = await syncStorage.get({
        // List all syncable settings with default values
        mode: 'blacklist',
        action: 'blockTab',
        framesType: ['main_frame'],
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
        schedule: { isEnabled: false, days: {} },
        message: '',
        displayBlankPage: false,
        displayBlockedLink: true,
        redirectUrl: '',
        misc: {
          hideReportIssueButton: false,
          showAddWebsitePrompt: false
        }
      });

      // Extract only the syncable settings
      const syncableSettingsObj = {};
      for (const key of syncableSettings) {
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          if (!syncableSettingsObj[parent]) syncableSettingsObj[parent] = {};
          if (allSettings[parent] && allSettings[parent][child] !== undefined) {
            syncableSettingsObj[parent][child] = allSettings[parent][child];
          }
        } else if (allSettings[key] !== undefined) {
          syncableSettingsObj[key] = allSettings[key];
        }
      }

      // Force save to sync storage
      await chrome.storage.sync.set(syncableSettingsObj);
      
      return { 
        success: true,
        syncedSettings: Object.keys(syncableSettingsObj)
      };
    } catch (error) {
      return { 
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Test sync functionality by writing and reading test data
   */
  async testSync() {
    const startTimestamp = performance.now();
    const testId = `sync_test_${Date.now()}`;
    const testData = {
      testTimestamp: new Date().toISOString(),
      testId: testId,
      testArray: ['test1', 'test2', 'test3'],
      testObject: { nested: { value: 'test' } }
    };

    const results = {
      testId: testId,
      startTime: new Date().toISOString(),
      success: false,
      steps: [],
      errors: [],
      telemetry: {
        effectiveSettings: {},
        storageUsage: {},
        performance: {}
      }
    };

    try {
      // Collect storage telemetry before test
      results.steps.push('Collecting storage telemetry...');
      const preTestTelemetry = await this.collectStorageTelemetry();
      results.telemetry.storageUsage.preTest = preTestTelemetry;
      results.steps.push(`✅ Current sync storage: ${preTestTelemetry.bytesUsed} bytes (${preTestTelemetry.quotaPercentage}% of quota)`);

      // Collect effective settings count
      results.steps.push('Analyzing effective settings...');
      const effectiveSettings = await this.getEffectiveSettingsCount();
      results.telemetry.effectiveSettings = effectiveSettings;
      results.steps.push(`✅ Found ${effectiveSettings.totalRules} blocking rules, ${effectiveSettings.totalKeywords} keywords across ${effectiveSettings.enabledCategories} enabled categories`);

      // Step 1: Write to sync storage
      const writeStartTime = performance.now();
      results.steps.push('Writing test data to sync storage...');
      await chrome.storage.sync.set({ [testId]: testData });
      const writeEndTime = performance.now();
      results.telemetry.performance.writeLatency = Math.round(writeEndTime - writeStartTime);
      results.steps.push(`✅ Successfully wrote to sync storage (${results.telemetry.performance.writeLatency}ms)`);

      // Wait a moment for potential replication
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Read from sync storage
      const readStartTime = performance.now();
      results.steps.push('Reading test data from sync storage...');
      const readData = await chrome.storage.sync.get(testId);
      if (!readData[testId]) {
        throw new Error('Test data not found in sync storage after write');
      }
      const readEndTime = performance.now();
      results.telemetry.performance.readLatency = Math.round(readEndTime - readStartTime);
      results.steps.push(`✅ Successfully read from sync storage (${results.telemetry.performance.readLatency}ms)`);

      // Step 3: Verify data integrity
      results.steps.push('Verifying data integrity...');
      if (!this.isDataIntegrityValid(testData, readData[testId])) {
        throw new Error('Data integrity check failed - written and read data do not match');
      }
      results.steps.push('✅ Data integrity verified');

      // Step 4: Test storage listener (if available)
      const listenerStartTime = performance.now();
      results.steps.push('Testing storage change listener...');
      let listenerTriggered = false;
      
      if (chrome.storage && chrome.storage.onChanged) {
        const testListener = (changes, areaName) => {
          if (areaName === 'sync' && changes[testId]) {
            listenerTriggered = true;
          }
        };
        
        chrome.storage.onChanged.addListener(testListener);
        await chrome.storage.sync.set({ [testId]: { ...testData, updated: true } });
        await new Promise(resolve => setTimeout(resolve, 100));
        chrome.storage.onChanged.removeListener(testListener);
        
        const listenerEndTime = performance.now();
        results.telemetry.performance.listenerLatency = Math.round(listenerEndTime - listenerStartTime);
        
        if (listenerTriggered) {
          results.steps.push(`✅ Storage change listener working correctly (${results.telemetry.performance.listenerLatency}ms)`);
        } else {
          results.steps.push(`⚠️ Storage change listener may not be working (${results.telemetry.performance.listenerLatency}ms)`);
        }
      } else {
        results.steps.push('⚠️ Storage change listener API not available');
      }

      // Step 5: Collect post-test telemetry
      results.steps.push('Collecting post-test storage telemetry...');
      const postTestTelemetry = await this.collectStorageTelemetry();
      results.telemetry.storageUsage.postTest = postTestTelemetry;
      results.steps.push(`✅ Post-test sync storage: ${postTestTelemetry.bytesUsed} bytes (${postTestTelemetry.quotaPercentage}% of quota)`);

      // Step 6: Clean up
      results.steps.push('Cleaning up test data...');
      await chrome.storage.sync.remove(testId);
      results.steps.push('✅ Test data cleaned up');

      results.success = true;
      results.steps.push('🎉 Sync test completed successfully');

    } catch (error) {
      results.errors.push(error.message);
      results.steps.push(`❌ Test failed: ${error.message}`);
      
      // Try to clean up even if test failed
      try {
        await chrome.storage.sync.remove(testId);
        results.steps.push('✅ Cleanup completed despite test failure');
      } catch (cleanupError) {
        results.errors.push(`Cleanup failed: ${cleanupError.message}`);
        results.steps.push('❌ Cleanup failed');
      }
    }

    const endTimestamp = performance.now();
    results.endTime = new Date().toISOString();
    results.duration = Math.round(endTimestamp - startTimestamp);
    results.telemetry.performance.totalDuration = results.duration;
    
    return results;
  },

  /**
   * Validates data integrity between written and read objects
   * Follows Single Responsibility Principle - only handles data comparison
   * Uses deep comparison instead of JSON.stringify to avoid property ordering issues
   * 
   * @param {Object} original - The original data that was written
   * @param {Object} retrieved - The data that was read back
   * @returns {boolean} True if data integrity is maintained
   */
  isDataIntegrityValid(original, retrieved) {
    return this.deepEquals(original, retrieved);
  },

  /**
   * Performs deep equality comparison of two objects
   * Follows Single Responsibility Principle - only handles deep comparison
   * Handles nested objects, arrays, and primitive values properly
   * 
   * @param {*} a - First value to compare
   * @param {*} b - Second value to compare
   * @returns {boolean} True if values are deeply equal
   */
  deepEquals(a, b) {
    if (a === b) return true;
    
    if (a == null || b == null) return a === b;
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a !== 'object') return a === b;
    
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEquals(a[key], b[key])) return false;
    }
    
    return true;
  },

  /**
   * Monitor storage changes for debugging
   */
  startMonitoring() {
    const changes = [];
    
    const listener = (storageChanges, areaName) => {
      const changeInfo = {
        timestamp: new Date().toISOString(),
        area: areaName,
        keys: Object.keys(storageChanges),
        changes: {}
      };
      
      // Log details for each changed key
      Object.keys(storageChanges).forEach(key => {
        changeInfo.changes[key] = {
          oldValue: storageChanges[key].oldValue,
          newValue: storageChanges[key].newValue,
          hadOldValue: storageChanges[key].oldValue !== undefined,
          hasNewValue: storageChanges[key].newValue !== undefined
        };
      });
      
      changes.push(changeInfo);
      console.log('🔄 Storage Change Detected:', changeInfo);
    };

    chrome.storage.onChanged.addListener(listener);
    
    return {
      stop: () => {
        chrome.storage.onChanged.removeListener(listener);
        return {
          totalChanges: changes.length,
          changes: changes
        };
      },
      getChanges: () => changes
    };
  },

  /**
   * Force sync all current data (bypass fresh install protection)
   */
  async forceSyncAllData() {
    try {
      // Get all current local data
      const localData = await chrome.storage.local.get(null);
      
      // Filter out local-only settings
      const syncableData = {};
      Object.keys(localData).forEach(key => {
        if (!localOnlySettings.some(setting => 
          setting === key || key.startsWith(setting + '.')
        )) {
          syncableData[key] = localData[key];
        }
      });
      
      // Add timestamp to track when this sync was forced
      syncableData._lastForcedSync = new Date().toISOString();
      
      // Write directly to sync storage (bypass syncStorage wrapper)
      await chrome.storage.sync.set(syncableData);
      
      return {
        success: true,
        syncedKeys: Object.keys(syncableData),
        syncedCount: Object.keys(syncableData).length,
        timestamp: syncableData._lastForcedSync,
        message: `Successfully synced ${Object.keys(syncableData).length} settings to cloud storage`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Check for common sync problems
   */
  async diagnoseProblems() {
    const problems = [];
    const suggestions = [];
    const telemetry = {};
    
    try {
      // Collect storage telemetry for analysis
      const storageTelemetry = await this.collectStorageTelemetry();
      telemetry.storage = storageTelemetry;
      
      // Collect effective settings telemetry
      const effectiveSettings = await this.getEffectiveSettingsCount();
      telemetry.settings = effectiveSettings;
      
      // Check sync status history first
      const syncStatus = await syncStatusTracker.getSyncStatus();
      telemetry.syncHistory = syncStatus;
      
      // Enhanced storage quota analysis
      if (storageTelemetry.quotaPercentage > 85) {
        problems.push(`Sync storage critical: ${storageTelemetry.quotaPercentage}% of quota used (${storageTelemetry.bytesUsed}/${storageTelemetry.quotaBytes} bytes)`);
        suggestions.push('Urgent: Clear old data or reduce rule/keyword lists to prevent sync failures');
      } else if (storageTelemetry.quotaPercentage > 70) {
        problems.push(`Sync storage warning: ${storageTelemetry.quotaPercentage}% of quota used (${storageTelemetry.bytesUsed}/${storageTelemetry.quotaBytes} bytes)`);
        suggestions.push('Consider optimizing rule lists or clearing unused categories');
      }
      
      // Analyze largest storage items
      if (storageTelemetry.largestItems && storageTelemetry.largestItems.length > 0) {
        const largestItem = storageTelemetry.largestItems[0];
        if (largestItem.size > 10000) { // >10KB for single item
          problems.push(`Large storage item detected: "${largestItem.key}" uses ${largestItem.size} bytes`);
          suggestions.push(`Review and optimize the "${largestItem.key}" list to reduce storage usage`);
        }
      }
      
      // Check for sync health issues
      if (syncStatus.consecutiveErrors >= 3) {
        problems.push(`${syncStatus.consecutiveErrors} consecutive sync errors detected`);
        suggestions.push('Check network connectivity and browser sync settings');
      }
      
      if (syncStatus.syncHealth === 'poor') {
        problems.push('Sync health is poor due to repeated failures');
        suggestions.push('Consider clearing sync storage and forcing a fresh sync');
      }
      
      if (syncStatus.recentErrors && syncStatus.recentErrors.length >= 3) {
        problems.push(`${syncStatus.recentErrors.length} recent sync errors`);
        suggestions.push('Review recent error messages for patterns');
      }
      
      // Analyze effective settings configuration
      // Only warn about missing rules if the extension is enabled and expected to block content
      if (effectiveSettings.totalRules === 0 && effectiveSettings.totalKeywords === 0) {
        if (effectiveSettings.isEnabled && effectiveSettings.syncEnabled) {
          // Check if this might be a fresh install or sync issue rather than intentional
          if (telemetry.storage && telemetry.storage.bytesUsed < 100) { // Very minimal storage suggests fresh install
            suggestions.push('Add blocking rules or keywords to enable content filtering functionality');
          } else {
            problems.push('No active blocking rules or keywords found despite extension being enabled');
            suggestions.push('Check if rules failed to sync properly or add new blocking rules');
          }
        }
        // If extension is disabled, don't warn about missing rules
      } else if (effectiveSettings.enabledCategories === 0 && (effectiveSettings.totalRules > 0 || effectiveSettings.totalKeywords > 0)) {
        problems.push('Rules/keywords configured but no categories appear active');
        suggestions.push('Check category settings or rule list configuration');
      }
      
      // Only warn about very large rule sets if they're actually causing storage issues
      // 1000+ rules is fine if storage usage is reasonable
      if (effectiveSettings.totalRules > 1000 && telemetry.storage?.quotaPercentage > 50) {
        problems.push(`Large rule set: ${effectiveSettings.totalRules} rules using ${telemetry.storage.quotaPercentage}% of storage quota`);
        suggestions.push('Consider optimizing rules or using more specific patterns to reduce storage usage');
      } else if (effectiveSettings.totalRules > 2000) {
        // Only warn at very high counts regardless of storage
        problems.push(`Very large rule set: ${effectiveSettings.totalRules} rules across ${effectiveSettings.enabledCategories} categories`);
        suggestions.push('Consider if all rules are necessary - extremely large rule sets may impact performance');
      }
      
      if (!effectiveSettings.syncEnabled) {
        problems.push('Sync is disabled in extension settings');
        suggestions.push('Enable sync in extension settings to synchronize rules across devices');
      }
      
      // Check for duplicate data (only if chrome.storage is available)
      if (chrome?.storage?.sync?.get && chrome?.storage?.local?.get) {
        try {
          const syncData = await chrome.storage.sync.get(null);
          const localData = await chrome.storage.local.get(null);
          
          if (syncData && localData) {
            let duplicates = 0;
            const duplicateKeys = [];
            
            Object.keys(syncData).forEach(key => {
              if (localData.hasOwnProperty(key) && !localOnlySettings.includes(key)) {
                duplicates++;
                duplicateKeys.push(key);
              }
            });
            
            if (duplicates > 5) {
              problems.push(`Data synchronization inefficiency: ${duplicates} settings are stored in both local and cloud storage, potentially causing conflicts and using extra storage space`);
              suggestions.push('Run storage cleanup to remove local duplicates and improve sync reliability - the extension will use cloud storage as the primary source');
              telemetry.duplicateKeys = duplicateKeys.slice(0, 10); // Show first 10
            }
            
            // Check for missing timestamps
            const timestampKeys = [
              'blacklistLastModifiedDate',
              'whitelistLastModifiedDate', 
              'blacklistKeywordsLastModifiedDate',
              'whitelistKeywordsLastModifiedDate'
            ];
            
            const missingTimestamps = timestampKeys.filter(key => !syncData[key] && !localData[key]);
            if (missingTimestamps.length > 0) {
              problems.push(`Missing sync timestamps: ${missingTimestamps.join(', ')}`);
              suggestions.push('Timestamps help resolve sync conflicts - consider forcing a sync to generate them');
            }
            
            // Enhanced analysis for large arrays - focus on storage impact rather than count
            ['blacklist', 'whitelist', 'blacklistKeywords', 'whitelistKeywords'].forEach(key => {
              const syncArray = syncData[key] || [];
              const localArray = localData[key] || [];
              const effectiveArray = localArray.length > 0 ? localArray : syncArray;
              
              if (Array.isArray(effectiveArray) && effectiveArray.length > 0) {
                const arraySize = new Blob([JSON.stringify(effectiveArray)]).size;
                
                // Only warn if array is consuming significant storage (>10KB per array)
                if (arraySize > 10240) {
                  problems.push(`Large ${key}: ${effectiveArray.length} items using ${Math.round(arraySize/1024)}KB of storage`);
                  suggestions.push(`Consider optimizing ${key} patterns or removing unused entries`);
                }
                // Or if array count is extremely high (>1000 items)
                else if (effectiveArray.length > 1000) {
                  problems.push(`Very large ${key}: ${effectiveArray.length} items`);
                  suggestions.push(`Consider organizing ${key} into more specific patterns`);
                }
              }
            });
          }
        } catch (storageError) {
          problems.push(`Failed to analyze storage data: ${storageError.message}`);
          suggestions.push('Storage access errors may indicate browser sync issues');
        }
      }
      
    } catch (error) {
      problems.push(`Error during diagnosis: ${error.message}`);
      suggestions.push('Diagnostic errors may indicate deeper sync system issues');
    }
    
    // Determine overall health based on sync status and problems
    let overallHealth = 'excellent';
    const syncStatus = await syncStatusTracker.getSyncStatus();
    
    if (syncStatus.syncHealth === 'poor' || problems.length >= 4) {
      overallHealth = 'poor';
    } else if (syncStatus.syncHealth === 'fair' || problems.length >= 2) {
      overallHealth = 'fair';
    } else if (problems.length === 1) {
      overallHealth = 'good';
    }
    
    // Generate summary message
    let summaryMessage = 'No Problems Found';
    if (problems.length > 0) {
      summaryMessage = `Found ${problems.length} ${problems.length === 1 ? 'issue' : 'issues'} affecting sync health`;
    } else {
      // Provide positive feedback about what's working
      const activeRules = telemetry.settings?.totalRules || 0;
      const activeKeywords = telemetry.settings?.totalKeywords || 0;
      const enabledCategories = telemetry.settings?.enabledCategories || 0;
      const storageUsage = telemetry.storage?.quotaPercentage || 0;
      
      summaryMessage = `✅ Sync healthy: ${activeRules} rules, ${activeKeywords} keywords across ${enabledCategories} categories. Storage: ${storageUsage}% used.`;
    }
    
    return {
      problemCount: problems.length,
      problems: problems,
      suggestions: suggestions,
      overallHealth: overallHealth,
      syncHealth: syncStatus.syncHealth,
      telemetry: telemetry,
      summaryMessage: summaryMessage
    };
  },

  /**
   * Clean up duplicate settings between local and sync storage
   * Follows Single Responsibility Principle - only handles duplicate cleanup
   */
  async cleanupDuplicateSettings() {
    const results = {
      success: false,
      duplicatesFound: 0,
      itemsRemoved: 0,
      cleanedUp: [],
      errors: [],
      details: []
    };

    try {
      // Get data from both storages
      const syncData = await chrome.storage.sync.get(null);
      const localData = await chrome.storage.local.get(null);
      
      const duplicateKeys = [];
      
      // Find settings that exist in both storages but shouldn't
      Object.keys(syncData).forEach(key => {
        if (localData.hasOwnProperty(key) && !localOnlySettings.includes(key)) {
          // This is a syncable setting that exists in local storage too
          duplicateKeys.push(key);
        }
      });
      
      // Also check for local-only settings that exist in sync storage
      localOnlySettings.forEach(key => {
        if (syncData.hasOwnProperty(key)) {
          duplicateKeys.push(key);
        }
      });
      
      results.duplicatesFound = duplicateKeys.length;
      
      if (duplicateKeys.length === 0) {
        results.success = true;
        results.details.push('No duplicate settings found');
        return results;
      }
      
      // Remove duplicates
      for (const key of duplicateKeys) {
        try {
          if (localOnlySettings.includes(key)) {
            // Remove from sync storage if it's a local-only setting
            await chrome.storage.sync.remove(key);
            results.cleanedUp.push(`Removed ${key} from sync storage (local-only setting)`);
          } else {
            // Remove from local storage if it's a syncable setting
            await chrome.storage.local.remove(key);
            results.cleanedUp.push(`Removed ${key} from local storage (syncable setting)`);
          }
          results.itemsRemoved++;
        } catch (error) {
          results.errors.push(`Failed to remove ${key}: ${error.message}`);
        }
      }
      
      results.success = results.errors.length === 0;
      results.details.push(`Processed ${duplicateKeys.length} duplicate settings`);
      
    } catch (error) {
      results.errors.push(error.message);
      results.details.push(`Error during cleanup: ${error.message}`);
    }
    
    return results;
  },

  /**
   * Analyze large arrays and provide optimization recommendations
   * Follows Single Responsibility Principle - only handles array analysis
   */
  async optimizeLargeArrays() {
    const results = {
      success: false,
      arraysAnalyzed: 0,
      totalSize: 0,
      analyzed: [],
      recommendations: [],
      potentialSavings: 0,
      details: []
    };

    try {
      const syncData = await chrome.storage.sync.get(null);
      const arrayKeys = ['blacklist', 'whitelist', 'blacklistKeywords', 'whitelistKeywords'];
      
      for (const key of arrayKeys) {
        if (syncData[key] && Array.isArray(syncData[key])) {
          const array = syncData[key];
          const analysis = {
            key: key,
            count: array.length,
            sizeBytes: JSON.stringify(array).length,
            duplicates: 0,
            emptyItems: 0,
            recommendation: '',
            priority: 'low'
          };
          
          // Check for duplicates
          const uniqueItems = new Set(array);
          analysis.duplicates = array.length - uniqueItems.size;
          
          // Check for empty/invalid items
          analysis.emptyItems = array.filter(item => !item || item.trim() === '').length;
          
          // Generate recommendations
          if (analysis.count > 200) {
            analysis.recommendation = `Very large ${key} (${analysis.count} items). Consider organizing into categories.`;
            analysis.priority = 'high';
          } else if (analysis.count > 100) {
            analysis.recommendation = `Large ${key} (${analysis.count} items). Monitor for performance impact.`;
            analysis.priority = 'medium';
          } else if (analysis.duplicates > 0) {
            analysis.recommendation = `Found ${analysis.duplicates} duplicate items in ${key}. Remove duplicates to save space.`;
            analysis.priority = 'medium';
          } else if (analysis.emptyItems > 0) {
            analysis.recommendation = `Found ${analysis.emptyItems} empty items in ${key}. Clean up for better performance.`;
            analysis.priority = 'low';
          } else {
            analysis.recommendation = `${key} looks optimized (${analysis.count} items).`;
            analysis.priority = 'none';
          }
          
          // Calculate potential savings
          const duplicateSavings = analysis.duplicates * (JSON.stringify(array[0] || '').length);
          const emptySavings = analysis.emptyItems * 10; // Rough estimate
          analysis.potentialSavings = duplicateSavings + emptySavings;
          
          results.analyzed.push(analysis);
          results.totalSize += analysis.sizeBytes;
          results.potentialSavings += analysis.potentialSavings;
          results.arraysAnalyzed++;
        }
      }
      
      // Generate overall recommendations
      if (results.potentialSavings > 1000) {
        results.recommendations.push(`Potential space savings: ${results.potentialSavings} bytes`);
      }
      
      const highPriorityIssues = results.analyzed.filter(a => a.priority === 'high').length;
      if (highPriorityIssues > 0) {
        results.recommendations.push(`${highPriorityIssues} arrays need immediate attention`);
      }
      
      results.success = true;
      results.details.push(`Analyzed ${results.arraysAnalyzed} arrays, total size: ${results.totalSize} bytes`);
      
    } catch (error) {
      results.errors = [error.message];
      results.details.push(`Error during analysis: ${error.message}`);
    }
    
    return results;
  },

  /**
   * Force sync settings from local to cloud
   * Follows Single Responsibility Principle - only handles upward sync
   */
  async forceSyncUp() {
    try {
      // Get all local data
      const localData = await chrome.storage.local.get(null);
      
      // Filter to only syncable settings
      const syncableData = {};
      for (const key of syncableSettings) {
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          if (localData[parent] && localData[parent][child] !== undefined) {
            if (!syncableData[parent]) syncableData[parent] = {};
            syncableData[parent][child] = localData[parent][child];
          }
        } else if (localData[key] !== undefined) {
          syncableData[key] = localData[key];
        }
      }
      
      // Add sync metadata
      syncableData._lastSyncUp = new Date().toISOString();
      
      // Write to sync storage
      await chrome.storage.sync.set(syncableData);
      
      return {
        success: true,
        syncedKeys: Object.keys(syncableData),
        timestamp: syncableData._lastSyncUp,
        message: `Successfully synced ${Object.keys(syncableData).length} settings to cloud`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to sync to cloud: ${error.message}`
      };
    }
  },

  /**
   * Force sync settings from cloud to local
   * Follows Single Responsibility Principle - only handles downward sync
   */
  async forceSyncDown() {
    try {
      // Get all sync data
      const syncData = await chrome.storage.sync.get(null);
      
      // Filter out metadata and local-only settings
      const localUpdateData = {};
      Object.keys(syncData).forEach(key => {
        if (!key.startsWith('_') && !localOnlySettings.includes(key)) {
          localUpdateData[key] = syncData[key];
        }
      });
      
      // Add sync metadata
      localUpdateData._lastSyncDown = new Date().toISOString();
      
      // Write to local storage
      await chrome.storage.local.set(localUpdateData);
      
      return {
        success: true,
        syncedKeys: Object.keys(localUpdateData),
        timestamp: localUpdateData._lastSyncDown,
        message: `Successfully synced ${Object.keys(localUpdateData).length} settings from cloud`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to sync from cloud: ${error.message}`
      };
    }
  },

  /**
   * Collects comprehensive storage telemetry
   * Following SRP - only handles storage usage analysis
   * 
   * @returns {Object} Storage usage metrics
   */
  async collectStorageTelemetry() {
    try {
      const allData = await chrome.storage.sync.get(null);
      const keys = Object.keys(allData);
      
      // Calculate individual item sizes
      const itemSizes = {};
      let totalBytes = 0;
      
      for (const key of keys) {
        const itemSize = new Blob([JSON.stringify(allData[key])]).size;
        itemSizes[key] = itemSize;
        totalBytes += itemSize;
      }
      
      // Chrome sync storage quota is 100KB (102,400 bytes)
      const SYNC_QUOTA_BYTES = 102400;
      const quotaPercentage = Math.round((totalBytes / SYNC_QUOTA_BYTES) * 100);
      
      return {
        bytesUsed: totalBytes,
        quotaBytes: SYNC_QUOTA_BYTES,
        quotaPercentage: quotaPercentage,
        itemCount: keys.length,
        maxItemsAllowed: 512, // Chrome sync storage item limit
        largestItems: Object.entries(itemSizes)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([key, size]) => ({ key, size }))
      };
    } catch (error) {
      return {
        error: error.message,
        bytesUsed: 0,
        quotaBytes: 102400,
        quotaPercentage: 0,
        itemCount: 0
      };
    }
  },

  /**
   * Analyzes current effective settings and rules
   * Following SRP - only handles settings analysis
   * 
   * @returns {Object} Effective settings metrics
   */
  async getEffectiveSettingsCount() {
    try {
      const localData = await chrome.storage.local.get(null);
      const syncData = await chrome.storage.sync.get(null);
      
      let totalRules = 0;
      let totalKeywords = 0;
      let enabledCategories = 0;
      const categoryStatus = {};
      
      // Check for standard blacklist/whitelist structure (most common)
      const standardLists = [
        { key: 'blacklist', type: 'rules' },
        { key: 'whitelist', type: 'rules' }, 
        { key: 'blacklistKeywords', type: 'keywords' },
        { key: 'whitelistKeywords', type: 'keywords' }
      ];
      
      standardLists.forEach(({ key, type }) => {
        const localList = localData[key] || [];
        const syncList = syncData[key] || [];
        const effectiveList = localList.length > 0 ? localList : syncList;
        
        if (Array.isArray(effectiveList) && effectiveList.length > 0) {
          const activeItems = effectiveList.filter(item => 
            item && typeof item === 'string' && item.trim().length > 0
          );
          
          if (activeItems.length > 0) {
            if (type === 'keywords') {
              totalKeywords += activeItems.length;
            } else {
              totalRules += activeItems.length;
            }
            
            categoryStatus[key] = { 
              enabled: true, 
              count: activeItems.length,
              type: type
            };
            enabledCategories++;
          }
        }
      });
      
      // Check if extension/sync is enabled
      const isEnabled = localData.isEnabled !== false;
      const syncEnabled = localData.syncEnabled !== false;
      
      return {
        totalRules,
        totalKeywords,
        enabledCategories,
        totalCategories: Object.keys(categoryStatus).length,
        categoryBreakdown: categoryStatus,
        isEnabled,
        syncEnabled
      };
    } catch (error) {
      return {
        totalRules: 0,
        totalKeywords: 0,
        enabledCategories: 0,
        totalCategories: 0,
        error: error.message
      };
    }
  }
};

export const syncStatusLog = async () => {
  const status = await diagnostics.checkSyncStatus();
  console.log('===== SYNC DIAGNOSTICS =====');
  console.log('Sync available:', status.syncAvailable);
  console.log('Storage quota:', status.storageQuota);
  console.log('Storage used:', status.storageUsed);
  console.log('Browser:', status.browser);
  console.log('Synced settings:', status.syncableSettingsFound.join(', '));
  console.log('Missing syncable settings:', status.missingSettings.join(', '));
  console.log('Local settings:', status.localOnlySettingsFound.join(', '));
  
  if (status.errors.length) {
    console.log('Errors:', status.errors);
  }
  console.log('===========================');
  return status;
};

/**
 * Diagnostic tool for checking sync storage functionality
 * This file helps diagnose issues with Chrome Sync for settings
 */

// Test if chrome.storage.sync is available and working
export async function testSyncStorage() {
  const results = {
    syncAvailable: false,
    writeSuccessful: false,
    readSuccessful: false,
    dataMatched: false,
    syncError: null,
    quotaInfo: null,
    syncItems: null
  };
  
  // Check if sync is available
  if (!chrome.storage || !chrome.storage.sync) {
    results.syncError = 'chrome.storage.sync API is not available';
    return results;
  }
  
  results.syncAvailable = true;
  
  try {
    // Try to write a test value
    const testValue = { _syncTest: `test-${Date.now()}` };
    await chrome.storage.sync.set(testValue);
    results.writeSuccessful = true;
    
    // Try to read it back
    const readValue = await chrome.storage.sync.get('_syncTest');
    results.readSuccessful = true;
    
    // Check if the value matches
    if (readValue && readValue._syncTest === testValue._syncTest) {
      results.dataMatched = true;
    }
    
    // Clean up
    await chrome.storage.sync.remove('_syncTest');
    
    // Get sync storage usage information
    results.quotaInfo = await getSyncStorageInfo();
    
    // Get current sync items
    const syncItems = await chrome.storage.sync.get(null);
    results.syncItems = Object.keys(syncItems);
    
  } catch (error) {
    results.syncError = error.message || 'Unknown error in sync storage test';
  }
  
  return results;
}

// Get information about sync storage usage
async function getSyncStorageInfo() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
        const info = {
          bytesInUse,
          percentUsed: (bytesInUse / chrome.storage.sync.QUOTA_BYTES) * 100,
          quotaBytes: chrome.storage.sync.QUOTA_BYTES,
          quotaBytesPerItem: chrome.storage.sync.QUOTA_BYTES_PER_ITEM,
          maxItems: chrome.storage.sync.MAX_ITEMS
        };
        resolve(info);
      });
    } catch (error) {
      resolve({
        error: error.message || 'Unknown error getting sync storage info'
      });
    }
  });
}

// Check if sync is enabled for this Google account
export function checkBrowserSyncStatus() {
  if (chrome.identity) {
    try {
      chrome.identity.getProfileUserInfo((userInfo) => {
        if (userInfo && userInfo.email) {
          logInfo('User is signed in:', userInfo.email);
          return { signedIn: true, email: userInfo.email };
        } else {
          logInfo('User is not signed in to Chrome');
          return { signedIn: false };
        }
      });
    } catch (error) {
      return { error: error.message || 'Unable to check sync status' };
    }
  }
  
  return { 
    signedIn: 'unknown',
    message: 'Unable to determine sign-in status - identity API not available'
  };
}

// Utility to manually sync settings from local to sync storage
export async function forceSyncToCloud() {
  const syncItems = {
    blacklist: [],
    whitelist: [],
    blacklistKeywords: [],
    whitelistKeywords: [],
    mode: '',
    framesType: [],
    message: '',
    redirectUrl: '',
    schedule: { isEnabled: false, days: {} }
  };
  
  try {
    // Get values from local storage
    const localValues = await chrome.storage.local.get(Object.keys(syncItems));
    
    // Only include values that exist
    Object.keys(syncItems).forEach(key => {
      if (localValues[key] !== undefined) {
        syncItems[key] = localValues[key];
      }
    });
    
    // Write to sync storage
    await chrome.storage.sync.set(syncItems);
    
    return { 
      success: true, 
      message: 'Settings pushed to sync storage', 
      syncedItems: Object.keys(syncItems).filter(key => localValues[key] !== undefined)
    };
  } catch (error) {
    return { 
      success: false, 
      message: 'Failed to push settings to sync storage', 
      error: error.message 
    };
  }
}

// Get complete sync diagnostics
export async function getSyncDiagnostics() {
  const results = {
    timestamp: new Date().toISOString(),
    syncTest: await testSyncStorage(),
    syncStatus: checkBrowserSyncStatus(),
    storageComparison: await compareStorages()
  };
  
  return results;
}

// Compare what's in sync vs local storage for debugging
async function compareStorages() {
  const syncItemKeys = [
    'blacklist',
    'whitelist', 
    'blacklistKeywords',
    'whitelistKeywords',
    'mode',
    'framesType',
    'message',
    'redirectUrl',
    'schedule'
  ];
  
  const comparison = {
    mismatchedItems: [],
    missingInSync: [],
    missingInLocal: [],
    matched: []
  };
  
  try {
    const syncData = await chrome.storage.sync.get(syncItemKeys);
    const localData = await chrome.storage.local.get(syncItemKeys);
    
    syncItemKeys.forEach(key => {
      const syncValue = JSON.stringify(syncData[key]);
      const localValue = JSON.stringify(localData[key]);
      
      if (syncData[key] === undefined && localData[key] !== undefined) {
        comparison.missingInSync.push(key);
      } else if (syncData[key] !== undefined && localData[key] === undefined) {
        comparison.missingInLocal.push(key);
      } else if (syncValue !== localValue) {
        comparison.mismatchedItems.push({
          key,
          syncValue: syncData[key],
          localValue: localData[key]
        });
      } else if (syncData[key] !== undefined && localData[key] !== undefined) {
        comparison.matched.push(key);
      }
    });
    
  } catch (error) {
    comparison.error = error.message || 'Error comparing storage';
  }
  
  return comparison;
}
