#!/usr/bin/env node

/**
 * Copy Edge build to local Z:\ drive
 * Only runs locally (not in CI) to provide easy access to builds for testing
 */

const fs = require('fs');
const path = require('path');

function isRunningInCI() {
  // Check common CI environment variables
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.APPVEYOR ||
    process.env.GITLAB_CI ||
    process.env.AZURE_PIPELINES ||
    process.env.BUILD_ID
  );
}

function getPackageInfo() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return {
    name: packageJson.name,
    version: packageJson.version
  };
}

function copyEdgeZip() {
  if (isRunningInCI()) {
    console.log('🤖 Running in CI environment - skipping local copy to Z:\\');
    return;
  }

  const { name, version } = getPackageInfo();
  
  // web-ext converts hyphens to underscores in filenames
  const webExtName = name.replace(/-/g, '_');
  const edgeZipName = `${webExtName}-${version}-edge.zip`;
  const sourcePath = path.join(__dirname, '..', edgeZipName);
  const targetDir = 'Z:\\';
  const targetPath = path.join(targetDir, edgeZipName);

  // Check if source file exists
  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  Edge zip file not found: ${sourcePath}`);
    console.log('   Make sure to run "npm run package:edge" first');
    return;
  }

  // Check if Z:\ drive exists
  if (!fs.existsSync(targetDir)) {
    console.log(`⚠️  Target drive not accessible: ${targetDir}`);
    console.log('   Make sure Z:\\ drive is mounted/available');
    return;
  }

  try {
    // Copy the file
    console.log(`📦 Copying Edge build to local drive...`);
    console.log(`   Source: ${sourcePath}`);
    console.log(`   Target: ${targetPath}`);
    
    fs.copyFileSync(sourcePath, targetPath);
    
    // Get file sizes for confirmation
    const sourceStats = fs.statSync(sourcePath);
    const targetStats = fs.statSync(targetPath);
    
    if (sourceStats.size === targetStats.size) {
      console.log(`✅ Successfully copied ${edgeZipName} to Z:\\`);
      console.log(`   File size: ${(sourceStats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.log(`❌ Copy verification failed - file sizes don't match`);
      console.log(`   Source size: ${sourceStats.size} bytes`);
      console.log(`   Target size: ${targetStats.size} bytes`);
    }
  } catch (error) {
    console.error(`❌ Failed to copy Edge build: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  copyEdgeZip();
}

module.exports = { copyEdgeZip, isRunningInCI };
