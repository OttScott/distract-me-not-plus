#!/bin/bash
# Local CI Integration Test Script for Unix/Linux/macOS
# This script simulates the CI pipeline locally to catch issues before pushing

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
FIX=false
SKIP_BUILD=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --fix)
      FIX=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo "Unknown option $1"
      echo "Usage: $0 [--fix] [--skip-build] [--verbose]"
      exit 1
      ;;
  esac
done

log_status() {
    local message=$1
    local type=${2:-"info"}
    local timestamp=$(date '+%H:%M:%S')
    
    case $type in
        "success") echo -e "[$timestamp] ✅ ${GREEN}$message${NC}" ;;
        "error")   echo -e "[$timestamp] ❌ ${RED}$message${NC}" ;;
        "warning") echo -e "[$timestamp] ⚠️  ${YELLOW}$message${NC}" ;;
        "info")    echo -e "[$timestamp] ℹ️  ${CYAN}$message${NC}" ;;
        "step")    echo -e "[$timestamp] 🔄 ${BLUE}$message${NC}" ;;
    esac
}

test_command() {
    local command=$1
    local description=$2
    
    log_status "Running: $description" "step"
    if [ "$VERBOSE" = true ]; then
        echo "Command: $command"
    fi
    
    if eval $command; then
        log_status "$description completed successfully" "success"
        return 0
    else
        log_status "$description failed" "error"
        return 1
    fi
}

all_passed=true

log_status "Starting Local CI Integration Check" "info"
log_status "Working Directory: $(pwd)" "info"

# Check Node.js and npm
log_status "Checking Node.js and npm versions" "step"
node --version
npm --version

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log_status "Installing dependencies..." "step"
    npm ci
fi

# Clean previous artifacts
log_status "Cleaning previous artifacts" "step"
rm -f eslint-results.sarif
rm -rf coverage

# Format Check (or Fix)
if [ "$FIX" = true ]; then
    log_status "Auto-fixing formatting issues" "step"
    if ! test_command "npm run format" "Format Fix"; then
        all_passed=false
    fi
else
    log_status "Checking code formatting" "step"
    if ! test_command "npm run format:check" "Format Check"; then
        log_status "Formatting issues found. Run with --fix to auto-fix." "warning"
        all_passed=false
    fi
fi

# Linting Check (or Fix)
if [ "$FIX" = true ]; then
    log_status "Auto-fixing linting issues" "step"
    if ! test_command "npm run lint:fix" "Lint Fix"; then
        all_passed=false
    fi
fi

log_status "Running ESLint with zero warnings" "step"
if ! test_command "npm run lint:ci" "Lint Check"; then
    all_passed=false
fi

# Generate SARIF for CodeQL
log_status "Generating SARIF file for security scanning" "step"
if ! test_command "npm run lint:sarif" "SARIF Generation"; then
    all_passed=false
fi

# Verify SARIF file was created
if [ -f "eslint-results.sarif" ]; then
    sarif_size=$(stat -f%z "eslint-results.sarif" 2>/dev/null || stat -c%s "eslint-results.sarif" 2>/dev/null)
    log_status "SARIF file created successfully ($sarif_size bytes)" "success"
    
    # Validate SARIF is valid JSON
    if jq empty eslint-results.sarif >/dev/null 2>&1; then
        log_status "SARIF file is valid JSON" "success"
    else
        log_status "SARIF file is not valid JSON" "error"
        all_passed=false
    fi
else
    log_status "SARIF file was not created" "error"
    all_passed=false
fi

# Run Tests with Coverage
log_status "Running test suite with coverage" "step"
if ! test_command "npm run test:ci" "Test Suite"; then
    all_passed=false
fi

# Build Application (optional)
if [ "$SKIP_BUILD" != true ]; then
    log_status "Building application" "step"
    if ! test_command "npm run build" "Build"; then
        all_passed=false
    fi
    
    if [ -d "build" ]; then
        build_size=$(du -sh build | cut -f1)
        log_status "Build completed successfully ($build_size)" "success"
    fi
else
    log_status "Skipping build step as requested" "info"
fi

# Final Results
log_status "================================" "info"
if [ "$all_passed" = true ]; then
    log_status "🎉 All CI checks passed! Ready to push." "success"
    log_status "Your code should pass all CI pipeline checks." "success"
    exit 0
else
    log_status "💥 Some CI checks failed!" "error"
    log_status "Please fix the issues above before pushing." "error"
    if [ "$FIX" != true ]; then
        log_status "💡 Try running with --fix to auto-fix formatting and linting issues." "info"
    fi
    exit 1
fi
