# CI/CD Pipeline Documentation

This document outlines the comprehensive CI/CD pipeline implemented for the Distract Me Not browser extension.

## 🚀 Pipeline Overview

Our CI/CD pipeline consists of multiple workflows that ensure code quality, security, and reliable deployments:

### Core Workflows

1. **Continuous Integration (CI)** - `ci.yml`
2. **Test Pull Requests** - `test-pull-requests.yml`
3. **Build and Release** - `release.yml`
4. **Deploy to Staging** - `deploy-staging.yml`
5. **Code Quality** - `code-quality.yml`
6. **Security Scanning** - `security.yml`
7. **Dependency Updates** - `dependency-updates.yml`

## 📋 Workflow Details

### 1. Continuous Integration (`ci.yml`)

**Triggers:**
- Push to `master`, `Features`, `develop` branches
- Pull requests to `master`, `Features`
- Daily scheduled runs at 06:00 UTC

**Jobs:**
- **Lint and Format Check**: ESLint, Prettier, SARIF upload
- **Test Suite**: Multi-node testing (16, 18, 20) with coverage
- **Build Test**: Browser-specific builds (Firefox, Chrome, Edge)
- **Security Scan**: npm audit, CodeQL analysis
- **Dependency Review**: For pull requests

### 2. Test Pull Requests (`test-pull-requests.yml`)

**Triggers:**
- Pull requests to `master`, `Features`
- Pull request target events

**Features:**
- Multi-node version testing
- Coverage reporting to Codecov
- Build validation for all browsers
- Artifact upload for review

### 3. Build and Release (`release.yml`)

**Triggers:**
- Version tags (`v*.*.*`)
- Manual workflow dispatch

**Process:**
1. Quality checks (linting, testing)
2. Multi-browser builds (Firefox, Chrome, Edge)
3. Artifact packaging
4. GitHub release creation with auto-generated notes

### 4. Deploy to Staging (`deploy-staging.yml`)

**Triggers:**
- Push to `Features`, `develop` branches
- Manual workflow dispatch

**Features:**
- Environment-specific deployments
- Slack notifications
- Artifact retention for 30 days

### 5. Code Quality (`code-quality.yml`)

**Triggers:**
- Push to `master`, `Features`
- Pull requests
- Weekly scheduled runs on Sundays

**Tools:**
- SonarCloud analysis
- Lighthouse performance audits
- Bundle size analysis
- Dead code detection

### 6. Security Scanning (`security.yml`)

**Triggers:**
- Push to `master`, `Features`
- Pull requests
- Daily scheduled runs at 02:00 UTC

**Security Checks:**
- Dependency vulnerabilities (npm audit, Snyk)
- Secrets detection (TruffleHog)
- Static Application Security Testing (Semgrep)
- License compliance verification

### 7. Dependency Updates (`dependency-updates.yml`)

**Triggers:**
- Weekly scheduled runs on Mondays at 09:00 UTC
- Manual workflow dispatch

**Features:**
- Automated dependency updates
- Test validation
- Auto-generated pull requests

## 🔧 Configuration Files

### Quality Tools
- `lighthouserc.json` - Lighthouse CI configuration
- `sonar-project.properties` - SonarCloud settings

### Environment Variables
Set these secrets in your GitHub repository:

```
CODECOV_TOKEN      # Codecov integration
SONAR_TOKEN        # SonarCloud analysis
SNYK_TOKEN         # Snyk security scanning
SEMGREP_APP_TOKEN  # Semgrep SAST scanning
SLACK_WEBHOOK_URL  # Slack notifications (optional)
```

## 📦 New NPM Scripts

The pipeline adds several new scripts to `package.json`:

```json
{
  "test:ci": "Run tests with CI configuration and coverage",
  "lint": "Run ESLint on source code",
  "lint:fix": "Auto-fix ESLint issues",
  "audit:fix": "Fix npm audit issues",
  "analyze": "Bundle size analysis",
  "clean": "Clean build artifacts and cache",
  "validate": "Run full validation suite"
}
```

## 🌟 Key Features

### Multi-Browser Support
- Automated builds for Firefox, Chrome, and Edge
- Browser-specific optimizations and validations
- Parallel build processes for efficiency

### Quality Assurance
- Multi-node version testing (16, 18, 20)
- Code coverage reporting
- Performance monitoring with Lighthouse
- Bundle size tracking

### Security First
- Daily security scans
- Dependency vulnerability monitoring
- Secrets detection
- License compliance checking

### Developer Experience
- Automated dependency updates
- Clear feedback on PRs
- Comprehensive error reporting
- Slack notifications for team awareness

### Deployment Pipeline
- Staging environment for testing
- Production releases with approval gates
- Artifact management and retention
- Release notes auto-generation

## 🚦 Pipeline Status Indicators

Each workflow provides clear status indicators:

- ✅ **Passing**: All checks successful
- ⚠️ **Warning**: Non-critical issues found
- ❌ **Failing**: Critical issues require attention
- 🔄 **Running**: Workflow in progress

## 🔄 Continuous Improvement

The pipeline is designed for continuous improvement:

1. **Monitoring**: Regular review of pipeline performance
2. **Optimization**: Periodic updates to improve efficiency
3. **Security**: Regular security tool updates
4. **Dependencies**: Automated dependency management

## 📚 Best Practices

### For Developers
1. Run `npm run validate` before pushing code
2. Keep commits small and focused
3. Write meaningful commit messages
4. Update tests with code changes

### For Maintainers
1. Review security scan results regularly
2. Monitor dependency updates
3. Update pipeline configurations as needed
4. Maintain secret rotation schedule

## 🆘 Troubleshooting

### Common Issues

**Build Failures:**
- Check Node.js version compatibility
- Verify all dependencies are installed
- Review browser-specific build logs

**Test Failures:**
- Run tests locally with `npm run test:ci`
- Check coverage requirements
- Verify test environment setup

**Security Issues:**
- Review dependency vulnerabilities
- Check for exposed secrets
- Validate license compliance

### Getting Help

1. Check workflow logs in GitHub Actions
2. Review artifact uploads for detailed reports
3. Contact the development team via Slack
4. Create an issue for persistent problems

---

This CI/CD pipeline ensures the Distract Me Not extension maintains high quality, security, and reliability standards throughout its development lifecycle.
