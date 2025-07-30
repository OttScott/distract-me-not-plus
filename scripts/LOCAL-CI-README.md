# Local CI Integration Scripts

These scripts simulate the CI pipeline locally to catch issues before pushing to GitHub.

## Quick Start

### npm Scripts (Recommended)
```bash
# Full CI check (recommended before pushing)
npm run ci:check

# Fix formatting and linting issues automatically  
npm run ci:fix

# Fast check (skip build step)
npm run ci:check:fast
```

### PowerShell (Windows)
```powershell
# Full CI check with build
./scripts/local-ci-check.ps1

# Fix issues automatically
./scripts/local-ci-check.ps1 -Fix

# Fast check (skip build)
./scripts/local-ci-check.ps1 -SkipBuild

# Verbose output
./scripts/local-ci-check.ps1 -Verbose
```

### Bash (Linux/macOS)
```bash
# Make script executable
chmod +x scripts/local-ci-check.sh

# Full CI check
./scripts/local-ci-check.sh

# Fix issues automatically
./scripts/local-ci-check.sh --fix

# Fast check (skip build)
./scripts/local-ci-check.sh --skip-build

# Verbose output
./scripts/local-ci-check.sh --verbose
```

## What the Scripts Check

1. **Dependencies**: Ensures npm dependencies are installed
2. **Code Formatting**: Verifies Prettier formatting (can auto-fix)
3. **Linting**: Runs ESLint with zero warnings tolerance (can auto-fix)
4. **SARIF Generation**: Creates security scanning file for GitHub CodeQL
5. **Test Suite**: Runs all tests with coverage reporting
6. **Build**: Compiles the application for production (optional with fast mode)

## Features

- ✅ **Cross-Platform**: Works on Windows (PowerShell) and Unix (Bash)
- ✅ **Auto-Fix**: Automatically fixes formatting and linting issues
- ✅ **Fast Mode**: Skip build for quicker feedback during development
- ✅ **SARIF Validation**: Validates generated security scanning files
- ✅ **Exit Codes**: Returns appropriate exit codes for CI integration

## Usage Patterns

### Before Every Commit
```bash
npm run ci:check:fast
```

### Before Creating PR
```bash
npm run ci:check
```

### Fix Issues Automatically
```bash
npm run ci:fix
```

## Exit Codes

- `0`: All checks passed ✅
- `1`: One or more checks failed ❌

## Script Options

| Option | PowerShell | Bash | npm Script | Description |
|--------|------------|------|------------|-------------|
| Auto-fix | `-Fix` | `--fix` | `ci:fix` | Fix formatting and linting issues |
| Skip build | `-SkipBuild` | `--skip-build` | `ci:check:fast` | Skip build for faster testing |
| Verbose | `-Verbose` | `--verbose` | - | Show detailed output |

## Individual Commands
```bash
# Check formatting only
npm run format:check

# Fix formatting
npm run format

# Lint with CI settings (zero warnings)
npm run lint:ci

# Generate SARIF file for security scanning
npm run lint:sarif

# Run tests with coverage
npm run test:ci

# Build application
npm run build
```

## Troubleshooting

### Common Issues

1. **Formatting Failures**: Run `npm run ci:fix` to auto-fix
2. **Linting Errors**: Check the output and fix manually or use auto-fix
3. **SARIF Missing**: ESLint may not have generated results - this is usually fine
4. **Build Failures**: Check for TypeScript/compilation errors
5. **PowerShell Execution Policy**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Getting Help

If the script fails:

1. Check the error messages for specific issues
2. Run with auto-fix: `npm run ci:fix`
3. Run individual commands to isolate the problem
4. Check that Node.js and npm versions match CI requirements

## Integration with CI/CD

These scripts mirror the validation steps in `.github/workflows/ci.yml`:

- Same ESLint configuration and rules
- Same Prettier formatting rules  
- Same test runners and coverage thresholds
- Same build process and artifact generation
- Same SARIF generation for security scanning

Perfect for pre-commit hooks and local development validation!
