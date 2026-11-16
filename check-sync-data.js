const output = document.getElementById('output');

async function loadArrayFromSync(key) {
  // Check if there's chunked data
  const metadataKey = `${key}_metadata`;
  const metadataResult = await chrome.storage.sync.get(metadataKey);
  const metadata = metadataResult?.[metadataKey];
  
  if (metadata && metadata.totalChunks > 0) {
    console.log(`Dechunking ${key} (${metadata.totalChunks} chunks)`);
    
    // Load all chunks
    const chunkKeys = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      chunkKeys.push(`${key}_chunk_${i}`);
    }
    
    const chunksData = await chrome.storage.sync.get(chunkKeys);
    
    // Reconstruct array
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
    // Not chunked - load normally
    const result = await chrome.storage.sync.get(key);
    return result[key];
  }
}

document.getElementById('checkBtn').addEventListener('click', async () => {
  output.innerHTML = '<div class="section">Checking sync storage...</div>';
  
  try {
    // Get all keys from sync storage
    const allData = await chrome.storage.sync.get(null);
    const allKeys = Object.keys(allData);
    
    output.innerHTML += `<div class="section"><strong>All Sync Keys (${allKeys.length}):</strong><br>${allKeys.join(', ')}</div>`;
    
    // Check for chunked data
    const chunkKeys = ['blacklist', 'whitelist', 'blacklistKeywords', 'whitelistKeywords'];
    
    for (const key of chunkKeys) {
      const directValue = allData[key];
      const metadata = allData[`${key}_metadata`];
      
      output.innerHTML += `<div class="section">
        <strong>${key}:</strong><br>
        Direct value: ${JSON.stringify(directValue)}<br>
        Metadata: ${JSON.stringify(metadata)}<br>
      `;
      
      // Try to dechunk
      const dechunked = await loadArrayFromSync(key);
      output.innerHTML += `Dechunked (${dechunked?.length || 0} items): <pre>${JSON.stringify(dechunked?.slice(0, 5), null, 2)}${dechunked?.length > 5 ? '\n...' : ''}</pre></div>`;
    }
    
    // Check bytes used
    const bytesUsed = await chrome.storage.sync.getBytesInUse(null);
    output.innerHTML += `<div class="section ${bytesUsed > 0 ? 'success' : 'warning'}"><strong>Total Sync Bytes Used:</strong> ${bytesUsed} / 102400 (${(bytesUsed/102400*100).toFixed(2)}%)</div>`;
    
  } catch (error) {
    output.innerHTML += `<div class="section error"><strong>Error:</strong> ${error.message}<br><pre>${error.stack}</pre></div>`;
  }
});

document.getElementById('checkLocalBtn').addEventListener('click', async () => {
  try {
    const localData = await chrome.storage.local.get(['blacklist', 'whitelist', 'blacklistKeywords', 'whitelistKeywords']);
    output.innerHTML += `<div class="section">
      <strong>Local Storage:</strong><br>
      blacklist: ${localData.blacklist?.length || 0} items<br>
      whitelist: ${localData.whitelist?.length || 0} items<br>
      blacklistKeywords: ${localData.blacklistKeywords?.length || 0} items<br>
      whitelistKeywords: ${localData.whitelistKeywords?.length || 0} items<br>
      <pre>${JSON.stringify(localData, null, 2)}</pre>
    </div>`;
  } catch (error) {
    output.innerHTML += `<div class="section error"><strong>Error:</strong> ${error.message}</div>`;
  }
});
