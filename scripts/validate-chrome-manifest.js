/**
 * Validates that the generated Chrome build manifest is actually Chrome/MV3 valid.
 *
 * This guards against the common footgun of loading a Firefox build into Chrome:
 * Firefox MV3 legitimately uses `background.scripts` and `webRequestBlocking`, but
 * Chrome rejects both ("requires manifest version of 2 or lower") and then the popup
 * fails with "Could not establish connection. Receiving end does not exist."
 *
 * It also strips stale Firefox manifest artifacts so the build directory only ever
 * contains a Chrome-loadable manifest.
 *
 * Exits non-zero (fails the build) when the manifest is not Chrome-valid.
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '../build');
const CHROME_MANIFEST = path.join(BUILD_DIR, 'manifest.json');
const FIREFOX_MANIFEST = path.join(BUILD_DIR, 'manifest.firefox.json');

// Permissions that only exist in Manifest V2 and are rejected by Chrome MV3.
const V2_ONLY_PERMISSIONS = ['webRequestBlocking'];

function fail(message, remediation) {
  console.error(`\n❌ Chrome manifest validation failed: ${message}`);
  if (remediation) {
    console.error(`   → ${remediation}`);
  }
  process.exit(1);
}

function readChromeManifest() {
  if (!fs.existsSync(CHROME_MANIFEST)) {
    fail(
      'build/manifest.json does not exist.',
      'Run the full Chrome build (npm run build:chrome) before validating.'
    );
  }

  try {
    return JSON.parse(fs.readFileSync(CHROME_MANIFEST, 'utf8'));
  } catch (error) {
    fail(`build/manifest.json is not valid JSON: ${error.message}`);
  }
}

function stripFirefoxArtifacts() {
  if (fs.existsSync(FIREFOX_MANIFEST)) {
    fs.unlinkSync(FIREFOX_MANIFEST);
    console.log('🧹 Removed stale Firefox manifest artifact: build/manifest.firefox.json');
  }
}

function assertManifestVersion(manifest) {
  if (manifest.manifest_version !== 3) {
    fail(
      `manifest_version is ${manifest.manifest_version}, expected 3.`,
      'Chrome builds must use Manifest V3. Check public/manifest.json.'
    );
  }
}

function assertServiceWorkerBackground(manifest) {
  const background = manifest.background || {};

  if (background.scripts) {
    fail(
      "background.scripts is present (Firefox/MV2 style). Chrome MV3 requires background.service_worker.",
      'This build is a Firefox manifest. Rebuild for Chrome with: npm run build:chrome'
    );
  }

  if (!background.service_worker) {
    fail(
      'background.service_worker is missing.',
      'Chrome MV3 requires background.service_worker. Check public/manifest.json.'
    );
  }
}

function assertNoV2OnlyPermissions(manifest) {
  const permissions = manifest.permissions || [];
  const offenders = V2_ONLY_PERMISSIONS.filter((permission) => permissions.includes(permission));

  if (offenders.length > 0) {
    fail(
      `Manifest V2-only permission(s) present: ${offenders.join(', ')}.`,
      'Chrome MV3 does not support these. This is a Firefox build; rebuild with: npm run build:chrome'
    );
  }
}

function assertNoFirefoxSettings(manifest) {
  if (manifest.browser_specific_settings || manifest.applications) {
    fail(
      'browser_specific_settings (gecko) is present — this is a Firefox manifest, not a Chrome one.',
      'Rebuild for Chrome with: npm run build:chrome'
    );
  }
}

function main() {
  console.log('🔎 Validating Chrome build manifest...');

  stripFirefoxArtifacts();

  const manifest = readChromeManifest();

  assertManifestVersion(manifest);
  assertServiceWorkerBackground(manifest);
  assertNoV2OnlyPermissions(manifest);
  assertNoFirefoxSettings(manifest);

  console.log('✅ Chrome manifest is valid (MV3, service worker, no V2-only permissions).');
}

main();
