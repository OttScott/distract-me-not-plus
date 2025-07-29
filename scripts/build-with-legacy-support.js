#!/usr/bin/env node

/**
 * Build script that gracefully handles --openssl-legacy-provider compatibility
 * Tries different approaches based on Node.js version and environment
 */

const { spawn } = require('child_process');

// Check if we're in dev mode
const isDevMode = process.argv.includes('--dev');

function runBuild(useExport = false, useLegacyProvider = false) {
  return new Promise((resolve, reject) => {
    // Build the command
    const command = 'npx';
    let baseArgs = ['cross-env'];

    // Handle different Node.js versions and environments
    if (useLegacyProvider) {
      baseArgs.push('NODE_OPTIONS=--openssl-legacy-provider');
      console.log(`Attempting build with --openssl-legacy-provider...`);
    } else if (useExport) {
      baseArgs.push('NODE_OPTIONS=--openssl-legacy-provider --max-old-space-size=8192');
      console.log(`Attempting build with legacy provider and increased memory...`);
    } else {
      console.log(`Building without --openssl-legacy-provider...`);
    }

    // Add build-specific environment variables for production builds
    if (!isDevMode) {
      baseArgs.push('INLINE_RUNTIME_CHUNK=false', 'GENERATE_SOURCEMAP=false');
      // Ensure CI doesn't treat warnings as errors for build process
      baseArgs.push('CI=false');
    }

    // Add the craco command
    const cracoCommand = isDevMode ? 'start' : 'build';
    const args = [...baseArgs, 'craco', cracoCommand];

    console.log(`Running: ${command} ${args.join(' ')}`);

    // Spawn the process
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        // Explicitly set these for extra safety
        GENERATE_SOURCEMAP: 'false',
        INLINE_RUNTIME_CHUNK: 'false'
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
  
  // For Node.js 20+, start without legacy provider
  const startWithoutLegacy = nodeVersion.startsWith('v20') || nodeVersion.startsWith('v21') || parseInt(nodeVersion.substring(1)) >= 20;
  
  if (startWithoutLegacy) {
    console.log('Node.js 20+ detected, trying without legacy provider first...');
    try {
      await runBuild(false, false);
      console.log('\n✅ Build succeeded without --openssl-legacy-provider');
      return;
    } catch (error) {
      console.log('\n❌ Build failed without legacy provider, trying with increased memory...');
      try {
        await runBuild(true, false);
        console.log('\n✅ Build succeeded with increased memory');
        return;
      } catch (error2) {
        console.log('\n❌ Build failed with increased memory, trying with legacy provider...');
      }
    }
  }
  
  try {
    // Try with legacy provider
    await runBuild(false, true);
    console.log('\n✅ Build succeeded with --openssl-legacy-provider');
  } catch (error) {
    console.log('\n❌ Build failed with --openssl-legacy-provider');
    console.log('🔄 Retrying without --openssl-legacy-provider...\n');
    
    try {
      // Fallback: try without legacy provider
      await runBuild(false, false);
      console.log('\n✅ Build succeeded without --openssl-legacy-provider');
    } catch (fallbackError) {
      console.error('\n❌ Build failed with all strategies');
      console.error('Strategies tried:');
      if (startWithoutLegacy) {
        console.error('1. Without legacy provider (Node 20+ default)');
        console.error('2. With increased memory');
        console.error('3. With legacy provider (fallback)');
        console.error('4. Without legacy provider (final fallback)');
      } else {
        console.error('1. With legacy provider');
        console.error('2. Without legacy provider');
      }
      console.error('\nThis may indicate a deeper compatibility issue with your Node.js version or dependencies.');
      process.exit(1);
    }
  }
}

main();
