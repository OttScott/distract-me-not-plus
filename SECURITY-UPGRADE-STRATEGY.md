# Security Upgrade Strategy

## Current Status
- 177 vulnerabilities (6 low, 110 moderate, 49 high, 12 critical)
- Most vulnerabilities are in sub-dependencies that require major version upgrades

## Phase 1: Direct Dependencies (Safe Upgrades)
✅ **Completed**: `npm update shell-quote browserslist cookie cross-spawn path-to-regexp send serve-static minimatch loader-utils immer`
- Only 3 packages were updated (likely indirect dependencies)

## Phase 2: Major Infrastructure Upgrades Required

### 2A: React Scripts Upgrade
**Problem**: Most vulnerabilities stem from `react-scripts@4.x` and its dependencies
**Solution**: Upgrade to `react-scripts@5.x`
**Risk**: Breaking changes in build system
**Dependencies affected**:
- webpack, postcss, babel ecosystem
- jest testing framework
- CSS processing pipeline

### 2B: Development Tools Upgrade
**Problem**: Several development tools have security issues
**Solution**: Upgrade systematically
**Packages**:
- `web-ext@8.9.0` (fixes Babel, jose, ws vulnerabilities)
- `release-it@19.0.4` (fixes @octokit, semver, vm2 vulnerabilities)
- `sign-addon@6.4.0` (fixes form-data, jsonwebtoken, tough-cookie)
- `evergreen-ui@7.1.9` (fixes node-fetch vulnerability)

### 2C: Server/Static Tools
**Problem**: Server-side tools with vulnerabilities
**Solution**: Upgrade or replace
**Packages**:
- `serve@10.0.2` (fixes on-headers vulnerability)

## Implementation Strategy

### Step 1: Backup and Test
```bash
npm run upgrade:backup
npm run test:ci
```

### Step 2: Upgrade react-scripts (Major Breaking Change)
```bash
npm install react-scripts@5.0.1
# May require code changes for:
# - Jest configuration
# - Webpack configuration in craco.config.js
# - PostCSS configuration
# - Babel configuration updates
```

### Step 3: Upgrade Development Tools
```bash
npm install web-ext@8.9.0 release-it@19.0.4 sign-addon@6.4.0 serve@10.0.2
```

### Step 4: Upgrade UI Library
```bash
npm install evergreen-ui@7.1.9
# May require React 18 compatibility checks
```

### Step 5: Test and Validate
```bash
npm run test:ci
npm run build
npm run ci:check
```

## Risk Assessment

### High Risk
- `react-scripts@5.x`: Core build system change
- `evergreen-ui@7.x`: May require React 18

### Medium Risk
- `web-ext@8.x`: Extension build tooling changes
- `release-it@19.x`: Release process changes

### Low Risk
- `sign-addon@6.x`: Mostly internal API changes
- `serve@10.x`: Static file serving changes

## Rollback Plan
1. Restore from backup: `npm run upgrade:restore`
2. Manual package.json restoration if needed
3. `npm ci` to reinstall exact versions

## Testing Requirements
- All existing tests must pass
- Build process for all browsers (Chrome, Firefox, Edge)
- Extension functionality validation
- CI/CD pipeline validation

## Alternative Approach: Gradual Migration
If full upgrade proves too disruptive:
1. Accept known vulnerabilities in development dependencies
2. Use `npm audit --production` to focus on production dependencies
3. Implement security policies to mitigate risks
4. Plan gradual migration over multiple releases

## Next Actions
1. Run Phase 2A (react-scripts upgrade) in isolated environment
2. Document all required configuration changes
3. Update documentation and CI processes
4. Execute full upgrade with comprehensive testing
