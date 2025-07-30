#!/usr/bin/env node

/**
 * Node.js 16 polyfills for missing Web APIs
 * This script polyfills ReadableStream and other Web APIs not available in Node.js 16
 */

const nodeVersion = process.version;

if (require('semver').lt(nodeVersion, '18.0.0')) {
  try {
    // Polyfill ReadableStream for Node.js 16
    if (typeof globalThis.ReadableStream === 'undefined') {
      // Try to use the web-streams-polyfill if available
      try {
        const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill/ponyfill');
        globalThis.ReadableStream = ReadableStream;
        globalThis.WritableStream = WritableStream;
        globalThis.TransformStream = TransformStream;
        console.log('✅ ReadableStream polyfill applied for Node.js 16');
      } catch (e) {
        // Fallback: Simple ReadableStream mock for build compatibility
        globalThis.ReadableStream = class ReadableStream {
          constructor() {
            console.warn('⚠️  Using minimal ReadableStream polyfill - some functionality may be limited');
          }
        };
        console.log('✅ Minimal ReadableStream polyfill applied for Node.js 16');
      }
    }

    // Polyfill other missing Web APIs if needed
    if (typeof globalThis.Response === 'undefined') {
      try {
        const { Response, Request } = require('undici');
        globalThis.Response = Response;
        globalThis.Request = Request;
        console.log('✅ Fetch API polyfill applied for Node.js 16');
      } catch (e) {
        // Ignore if undici is not available
      }
    }

  } catch (error) {
    console.warn('⚠️  Node.js 16 polyfills failed to load:', error.message);
    console.warn('   Some build functionality may be limited');
  }
} else {
  console.log('ℹ️  Node.js 18+ detected, skipping polyfills');
}
