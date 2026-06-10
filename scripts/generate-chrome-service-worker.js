/**
 * This script generates a Chrome-compatible service worker
 * by running the esbuild bundler to create a unified service worker
 * from the modular src/service-worker/ code.
 * 
 * Falls back to copying the legacy public/service-worker.js if bundling fails.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const BUILD_DIR = path.join(__dirname, '../build');
const BUNDLED_SERVICE_WORKER = path.join(BUILD_DIR, 'service-worker.js');
const LEGACY_SERVICE_WORKER = path.join(__dirname, '../public/service-worker.js');

console.log('Generating Chrome-compatible service worker...');

try {
  // Create build directory if it doesn't exist
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Try to use the esbuild bundler first (unified service worker)
  console.log('Building unified service worker with esbuild...');
  try {
    execSync('node scripts/build-service-worker.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
    });

    // Verify the bundle was created
    if (fs.existsSync(BUNDLED_SERVICE_WORKER)) {
      const stats = fs.statSync(BUNDLED_SERVICE_WORKER);
      console.log(`✅ Unified service worker generated successfully (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      throw new Error('Bundled service worker not found after build');
    }
  } catch (bundleError) {
    // Fallback to legacy service worker
    console.warn('⚠️ Esbuild bundle failed, falling back to legacy service worker...');
    console.warn('  Error:', bundleError.message);
    
    if (!fs.existsSync(LEGACY_SERVICE_WORKER)) {
      throw new Error('Legacy service worker not found: ' + LEGACY_SERVICE_WORKER);
    }
    
    let serviceWorkerContent = fs.readFileSync(LEGACY_SERVICE_WORKER, 'utf8');
    
    // Add a header for the Chrome build
    const chromeServiceWorkerContent = `/**
 * Distract-Me-Not Chrome Service Worker (Legacy)
 * This service worker uses importScripts to load required libraries
 */

${serviceWorkerContent}`;

    fs.writeFileSync(BUNDLED_SERVICE_WORKER, chromeServiceWorkerContent);
    console.log('✅ Legacy service worker copied as fallback');
  }

} catch (error) {
  console.error('❌ Error generating Chrome service worker:', error);
  process.exit(1);
}
