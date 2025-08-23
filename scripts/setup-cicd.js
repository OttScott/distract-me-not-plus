#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * Sets up the local development environment for CI/CD pipeline
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up development environment for CI/CD...\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Run this script from the project root.');
  process.exit(1);
}

// Install development dependencies
console.log('📦 Installing development dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Set up Git hooks (optional)
console.log('🔗 Setting up Git hooks...');
try {
  const huskyDir = '.husky';
  if (!fs.existsSync(huskyDir)) {
    fs.mkdirSync(huskyDir);
  }

  // Pre-commit hook
  const preCommitHook = `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."
npm run lint
npm run test:ci
echo "✅ Pre-commit checks passed!"
`;

  fs.writeFileSync(path.join(huskyDir, 'pre-commit'), preCommitHook);
  
  // Make it executable (Unix systems)
  if (process.platform !== 'win32') {
    execSync(`chmod +x ${path.join(huskyDir, 'pre-commit')}`);
  }

  console.log('✅ Git hooks configured\n');
} catch (error) {
  console.log('⚠️ Git hooks setup skipped (optional feature)\n');
}

// Create .env.example if it doesn't exist
console.log('📄 Creating environment template...');
const envExample = `# Environment Variables for Development
NODE_ENV=development

# CI/CD Configuration (for GitHub Actions)
# CODECOV_TOKEN=your_codecov_token
# SONAR_TOKEN=your_sonar_token
# SNYK_TOKEN=your_snyk_token
# SEMGREP_APP_TOKEN=your_semgrep_token

# Build Configuration
INLINE_RUNTIME_CHUNK=false
GENERATE_SOURCEMAP=false
`;

if (!fs.existsSync('.env.example')) {
  fs.writeFileSync('.env.example', envExample);
  console.log('✅ Created .env.example file\n');
} else {
  console.log('✅ .env.example already exists\n');
}

// Validate the setup
console.log('🔍 Validating setup...');
try {
  console.log('  - Testing linting...');
  execSync('npm run lint', { stdio: 'pipe' });
  
  console.log('  - Testing build process...');
  execSync('npm run build:firefox', { stdio: 'pipe' });
  
  console.log('✅ Setup validation successful!\n');
} catch (error) {
  console.log('⚠️ Setup validation had issues - you may need to fix code before CI/CD works properly\n');
}

// Final instructions
console.log('🎉 Development environment setup complete!\n');
console.log('📋 Next steps:');
console.log('  1. Copy .env.example to .env and configure your environment');
console.log('  2. Set up the optional secrets in your GitHub repository:');
console.log('     - CODECOV_TOKEN (optional, for coverage reporting)');
console.log('     - SONAR_TOKEN (optional, for code quality analysis)');
console.log('     - SNYK_TOKEN (optional, for security scanning)');
console.log('     - SEMGREP_APP_TOKEN (optional, for SAST scanning)');
console.log('  3. Run "npm run validate" to test the full pipeline locally');
console.log('  4. Push your changes to trigger the CI/CD pipeline\n');

console.log('📚 Documentation:');
console.log('  - Read CI-CD-DOCUMENTATION.md for detailed pipeline information');
console.log('  - Check .github/workflows/ for individual workflow configurations\n');

console.log('🚀 Happy coding!');
