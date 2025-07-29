#!/usr/bin/env node

/**
 * Build script that gracefully handles --openssl-legacy-provider compatibility
 * Tries with the flag first, then falls back without it if it fails
 */

const { spawn } = require('child_process');

// Check if we're in dev mode
const isDevMode = process.argv.includes('--dev');

function runBuild(useLegacyProvider = true) {
  return new Promise((resolve, reject) => {
    // Build the command
    const command = 'npx';
    let baseArgs = ['cross-env'];

    // Add NODE_OPTIONS only if requested
    if (useLegacyProvider) {
      baseArgs.push('NODE_OPTIONS=--openssl-legacy-provider');
      console.log(`Attempting build with --openssl-legacy-provider...`);
    } else {
      console.log(`Building without --openssl-legacy-provider...`);
    }

    // Add build-specific environment variables for production builds
    if (!isDevMode) {
      baseArgs.push('INLINE_RUNTIME_CHUNK=false', 'GENERATE_SOURCEMAP=false');
    }

    // Add the craco command
    const cracoCommand = isDevMode ? 'start' : 'build';
    const args = [...baseArgs, 'craco', cracoCommand];

    console.log(`Running: ${command} ${args.join(' ')}`);

    // Spawn the process
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: process.env
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
  try {
    // First try with legacy provider
    await runBuild(true);
  } catch (error) {
    console.log('\n❌ Build failed with --openssl-legacy-provider');
    console.log('🔄 Retrying without --openssl-legacy-provider...\n');
    
    try {
      // Fallback: try without legacy provider
      await runBuild(false);
      console.log('\n✅ Build succeeded without --openssl-legacy-provider');
    } catch (fallbackError) {
      console.error('\n❌ Build failed both with and without --openssl-legacy-provider');
      console.error('Original error:', error.message);
      console.error('Fallback error:', fallbackError.message);
      process.exit(1);
    }
  }
}

main();
