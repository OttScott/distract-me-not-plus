/**
 * Build Service Worker Script
 * 
 * Uses esbuild to bundle src/service-worker/index.js into build/service-worker.js
 * Format: IIFE (must work in service worker context, no module system)
 * Target: chrome90, firefox109
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

// Paths
const entryPoint = path.resolve(__dirname, '../src/service-worker/index.js');
const outfile = path.resolve(__dirname, '../build/service-worker.js');
const publicDir = path.resolve(__dirname, '../public');

// Ensure build directory exists
const buildDir = path.dirname(outfile);
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

/**
 * Plugin to resolve relative paths to public/_locales
 * This handles the i18n.js require('../../public/_locales/en/messages')
 */
const publicLocalesPlugin = {
  name: 'public-locales-resolver',
  setup(build) {
    // Resolve paths containing 'public/_locales'
    build.onResolve({ filter: /public\/_locales/ }, (args) => {
      // Extract the path after 'public/'
      const match = args.path.match(/public\/(.+)/);
      if (match) {
        const resolvedPath = path.join(publicDir, match[1]);
        // Add .json extension if not present
        const finalPath = resolvedPath.endsWith('.json') ? resolvedPath : resolvedPath + '.json';
        return { path: finalPath };
      }
      return null;
    });
  },
};

// Build configuration
const buildOptions = {
  entryPoints: [entryPoint],
  outfile: outfile,
  bundle: true,
  format: 'iife', // Immediately Invoked Function Expression - works in service worker
  target: ['chrome90', 'firefox109'],
  minify: isProduction,
  sourcemap: !isProduction,
  
  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  },
  
  // Handle imports from helpers
  alias: {
    'helpers': path.resolve(__dirname, '../src/helpers'),
  },
  
  // Plugins for custom resolution
  plugins: [publicLocalesPlugin],
  
  // Resolve extensions
  resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  
  // Banner for the bundle
  banner: {
    js: `/**
 * Distract-Me-Not Service Worker
 * 
 * Bundled from src/service-worker/index.js
 * Generated: ${new Date().toISOString()}
 * 
 * This is the unified service worker that handles URL blocking.
 */

// Import required libraries (browser-polyfill provides 'browser' API compatibility)
try {
  importScripts('browser-polyfill.min.js');
  importScripts('bcrypt.min.js');
} catch (e) {
  console.log('Service worker: importScripts not available or already loaded');
}
`,
  },
  
  // Log level
  logLevel: 'info',
  
  // External packages (none - we bundle everything)
  external: [],
  
  // Loader for different file types
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
    '.json': 'json',
  },
  
  // JSX configuration (in case helpers use JSX)
  jsx: 'automatic',
  jsxImportSource: 'react',
};

async function build() {
  try {
    console.log('Building service worker...');
    console.log(`  Entry: ${entryPoint}`);
    console.log(`  Output: ${outfile}`);
    console.log(`  Mode: ${isProduction ? 'production' : 'development'}`);
    
    if (isWatch) {
      // Watch mode
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      // Single build
      const result = await esbuild.build(buildOptions);
      
      if (result.errors.length > 0) {
        console.error('Build errors:', result.errors);
        process.exit(1);
      }
      
      if (result.warnings.length > 0) {
        console.warn('Build warnings:', result.warnings);
      }
      
      // Get file size
      const stats = fs.statSync(outfile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      console.log(`✓ Service worker built successfully (${sizeKB} KB)`);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();
