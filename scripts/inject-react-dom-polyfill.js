#!/usr/bin/env node

/**
 * Injects a polyfill for react-dom/client for React 17 compatibility
 * This addresses the evergreen-ui compatibility issue with React 17
 */

const fs = require('fs');
const path = require('path');

// Polyfill content that provides react-dom/client functionality for React 17
const polyfillContent = `// React DOM Client Polyfill for React 17
// This file provides compatibility for packages expecting react-dom/client (React 18+)

const ReactDOM = require('react-dom');

// Polyfill for createRoot (React 18 feature)
function createRoot(container, options = {}) {
  return {
    render(element) {
      ReactDOM.render(element, container);
    },
    unmount() {
      ReactDOM.unmountComponentAtNode(container);
    }
  };
}

// Polyfill for hydrateRoot (React 18 feature)
function hydrateRoot(container, element, options = {}) {
  ReactDOM.hydrate(element, container);
  return {
    render(element) {
      ReactDOM.hydrate(element, container);
    },
    unmount() {
      ReactDOM.unmountComponentAtNode(container);
    }
  };
}

module.exports = {
  createRoot,
  hydrateRoot
};
`;

// Path to the polyfill file in node_modules
const polyfillPath = path.join(__dirname, '..', 'node_modules', 'react-dom', 'client.js');

// Check if the polyfill already exists
if (fs.existsSync(polyfillPath)) {
  console.log('✓ react-dom/client polyfill already exists');
  return; // Just return instead of exiting
}

try {
  // Create the polyfill file
  fs.writeFileSync(polyfillPath, polyfillContent, 'utf8');
  console.log('✅ Successfully injected react-dom/client polyfill for React 17 compatibility');
  console.log(`   Created: ${polyfillPath}`);
} catch (error) {
  console.error('❌ Failed to inject react-dom/client polyfill:', error.message);
  process.exit(1);
}
