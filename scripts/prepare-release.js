#!/usr/bin/env node

/**
 * Local Release Helper
 * Makes it easy to prepare releases locally before pushing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    log(`Running: ${command}`, colors.cyan);
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    log(`❌ Command failed: ${command}`, colors.red);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const releaseType = args[0] || 'patch';
  
  if (!['patch', 'minor', 'major'].includes(releaseType)) {
    log('❌ Invalid release type. Use: patch, minor, or major', colors.red);
    process.exit(1);
  }

  try {
    log('🚀 Starting Local Release Process...', colors.bright);
    
    // Check git status
    log('\n📋 Checking git status...', colors.yellow);
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      log('⚠️  You have uncommitted changes:', colors.yellow);
      console.log(gitStatus);
      log('Please commit or stash your changes before releasing.', colors.yellow);
      process.exit(1);
    }
    
    // Run quality checks
    log('\n🔍 Running quality checks...', colors.yellow);
    execCommand('npm run lint');
    execCommand('npm test -- --watchAll=false');
    execCommand('npm run security:test');
    
    // Build all extensions
    log('\n🔨 Building extensions...', colors.yellow);
    execCommand('npm run build:firefox');
    execCommand('npm run build:chrome');
    
    // Package all extensions
    log('\n📦 Packaging extensions...', colors.yellow);
    execCommand('npm run package:all');
    
    // Show what would be released
    log('\n📋 Release Preview:', colors.bright);
    const currentVersion = require('./package.json').version;
    log(`Current version: ${currentVersion}`, colors.cyan);
    
    // Calculate next version (simplified)
    const versionParts = currentVersion.split('.').map(Number);
    if (releaseType === 'major') {
      versionParts[0]++;
      versionParts[1] = 0;
      versionParts[2] = 0;
    } else if (releaseType === 'minor') {
      versionParts[1]++;
      versionParts[2] = 0;
    } else {
      versionParts[2]++;
    }
    const nextVersion = versionParts.join('.');
    log(`Next version: ${nextVersion} (${releaseType} release)`, colors.green);
    
    // List generated files
    log('\n📁 Generated files:', colors.cyan);
    const files = fs.readdirSync('.').filter(f => f.endsWith('.zip'));
    files.forEach(file => {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024 / 1024).toFixed(2);
      log(`  - ${file} (${size} MB)`, colors.reset);
    });
    
    log('\n✅ Local build completed successfully!', colors.green);
    log('\n🚀 To create a GitHub release:', colors.bright);
    log(`   1. Go to: https://github.com/OttScott/distract-me-not/actions/workflows/release.yml`, colors.cyan);
    log(`   2. Click "Run workflow"`, colors.cyan);
    log(`   3. Select release type: ${releaseType}`, colors.cyan);
    log(`   4. Click "Run workflow" button`, colors.cyan);
    log('\n   Or push a tag:', colors.cyan);
    log(`   git tag v${nextVersion} && git push origin v${nextVersion}`, colors.cyan);
    
  } catch (error) {
    log('\n❌ Release preparation failed!', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
