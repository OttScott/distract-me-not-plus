#!/usr/bin/env node

/**
 * Build script that gracefully handles Node.js compatibility issues
 * Supports Node.js 16+ with proper polyfills and OpenSSL handling
 */

const { spawn } = require('child_process');
const semver = require('semver');

// Check if we're in dev mode
const isDevMode = process.argv.includes('--dev');

function runBuildCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    // Spawn the process
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ...env
      }
    });

    // Handle exit
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Main execution
async function main() {
  const nodeVersion = process.version;
  console.log(`Node.js version: ${nodeVersion}`);
  
  // Inject React DOM polyfill before building (for evergreen-ui compatibility)
  console.log('🔧 Injecting React DOM polyfill for React 17 compatibility...');
  try {
    require('./inject-react-dom-polyfill.js');
  } catch (error) {
    console.warn('⚠️  Could not inject React DOM polyfill:', error.message);
    console.warn('   Build may show warnings about react-dom/client');
  }
  
  // Base environment variables for all builds
  const baseEnv = {
    INLINE_RUNTIME_CHUNK: 'false',
    GENERATE_SOURCEMAP: 'false',
    CI: 'false'
  };

  // Build the craco command
  const cracoCommand = isDevMode ? 'start' : 'build';

  // Build strategies to try in order based on Node.js version
  const strategies = [];

  if (semver.lt(nodeVersion, '17.0.0')) {
    console.log('🔧 Node.js 16 detected, using direct node commands...');
    
    // For Node.js 16, use direct node command with legacy provider
    strategies.push({
      name: 'Node.js 16 with legacy OpenSSL (direct command)',
      command: 'node',
      args: ['--openssl-legacy-provider', 'node_modules/.bin/craco', cracoCommand],
      env: {
        ...baseEnv,
        NODE_OPTIONS: '--experimental-global-webcrypto --experimental-fetch'
      }
    });

    // Fallback without legacy provider
    strategies.push({
      name: 'Node.js 16 with polyfills only',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, `NODE_OPTIONS=--experimental-global-webcrypto --experimental-fetch`, 'craco', cracoCommand],
      env: {}
    });

    // Minimal fallback
    strategies.push({
      name: 'Node.js 16 minimal setup',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, 'craco', cracoCommand],
      env: {}
    });

  } else if (semver.gte(nodeVersion, '20.0.0')) {
    console.log('🚀 Node.js 20+ detected, using modern strategies...');
    
    // Strategy 1: Try without legacy provider first (modern Node.js default)
    strategies.push({
      name: 'Modern Node.js without legacy OpenSSL',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, 'craco', cracoCommand],
      env: {}
    });

    // Strategy 2: Try with increased memory
    strategies.push({
      name: 'Modern Node.js with increased memory',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, `NODE_OPTIONS=--max-old-space-size=8192`, 'craco', cracoCommand],
      env: {}
    });

    // Strategy 3: Fallback to legacy provider
    strategies.push({
      name: 'Modern Node.js with legacy OpenSSL',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, `NODE_OPTIONS=--openssl-legacy-provider`, 'craco', cracoCommand],
      env: {}
    });

  } else {
    console.log('🔄 Node.js 17-19 detected, using standard strategies...');
    
    // Strategy 1: Try with legacy provider (common for Node 17-19)
    strategies.push({
      name: 'Standard Node.js with legacy OpenSSL',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, `NODE_OPTIONS=--openssl-legacy-provider`, 'craco', cracoCommand],
      env: {}
    });

    // Strategy 2: Fallback without legacy provider
    strategies.push({
      name: 'Standard Node.js without legacy OpenSSL',
      command: 'npx',
      args: ['cross-env', `INLINE_RUNTIME_CHUNK=${baseEnv.INLINE_RUNTIME_CHUNK}`, `GENERATE_SOURCEMAP=${baseEnv.GENERATE_SOURCEMAP}`, `CI=${baseEnv.CI}`, 'craco', cracoCommand],
      env: {}
    });
  }

  console.log(`📋 Will try ${strategies.length} build strategies:`);
  strategies.forEach((strategy, index) => {
    console.log(`  ${index + 1}. ${strategy.name}`);
  });
  console.log('');

  // Try each strategy
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    try {
      console.log(`🔄 Strategy ${i + 1}: ${strategy.name}...`);
      await runBuildCommand(strategy.command, strategy.args, strategy.env);
      console.log(`\n✅ Build succeeded using strategy ${i + 1}: ${strategy.name}`);
      return;
    } catch (error) {
      console.log(`\n❌ Strategy ${i + 1} failed: ${error.message}`);
      if (i < strategies.length - 1) {
        console.log('🔄 Trying next strategy...\n');
      }
    }
  }

  // If we get here, all strategies failed
  console.error('\n❌ Build failed with all strategies');
  console.error('\nStrategies tried:');
  strategies.forEach((strategy, index) => {
    console.error(`${index + 1}. ${strategy.name}`);
  });
  console.error('\nThis may indicate a deeper compatibility issue with your Node.js version or dependencies.');
  console.error('Consider:');
  console.error('- Updating to Node.js 18+ LTS');
  console.error('- Checking for conflicting global packages');
  console.error('- Running: npm ci to ensure clean dependencies');
  process.exit(1);
}

main();
