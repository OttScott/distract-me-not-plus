# Dependency Upgrade Plan 🚀

## Overview
This document outlines the comprehensive strategy for upgrading dependencies in the distract-me-not browser extension project.

## Current Status
- **Total vulnerabilities**: 180 (7 low, 111 moderate, 49 high, 13 critical)
- **Major dependencies**: React 17, Node.js 16+ support required
- **CI/CD**: Fully functional pipeline with security scanning

## Critical Security Vulnerabilities 🚨

### High Priority (Critical/High Severity)
1. **vm2** - Critical sandbox escape vulnerabilities
2. **ejs** - Critical template injection vulnerability  
3. **shell-quote** - Critical command injection vulnerability
4. **loader-utils** - Critical prototype pollution
5. **immer** - Critical prototype pollution
6. **form-data** - Critical unsafe random function
7. **pbkdf2** - Critical predictable key generation
8. **ansi-html** - High severity resource consumption
9. **jsonwebtoken** - High severity key validation bypass
10. **node-forge** - Multiple high severity crypto vulnerabilities

### Key Dependencies to Upgrade

#### Core Framework
- **React**: `17.0.2` → `19.1.1` (Major breaking changes expected)
- **React-DOM**: `17.0.2` → `19.1.1` (Major breaking changes expected)
- **React Router**: `5.3.4` → `7.7.1` (Major breaking changes expected)

#### Build Tools
- **@craco/craco**: `6.4.5` → `7.1.0` (Breaking changes)
- **react-scripts**: `4.0.3` → `5.0.1` (Major upgrade)
- **webpack**: Various vulnerable versions in dependency tree

#### Development Tools
- **@babel/core**: `7.16.0` → `7.28.0`
- **@testing-library/react**: `12.1.5` → `16.3.0` (Breaking changes)
- **eslint-related**: Various upgrades needed
- **prettier**: `3.0.0` → `3.6.2`

#### UI Libraries
- **evergreen-ui**: `6.9.0` → `7.1.9` (Potential breaking changes)
- **sass**: `1.77.8` → `1.89.2`

## Upgrade Strategy 🎯

### Phase 1: Security-Critical Dependencies (Week 1)
**Goal**: Address critical and high severity vulnerabilities

1. **Immediate Security Fixes**
   ```bash
   npm audit fix  # Safe automatic fixes
   ```

2. **Manual Security Upgrades** (Breaking changes expected)
   - `shell-quote` - Command injection fix
   - `loader-utils` - Prototype pollution fix
   - `immer` - Prototype pollution fix
   - `pbkdf2` - Key generation fix
   - `node-forge` - Multiple crypto fixes

3. **Testing Priority**
   - Security regression testing
   - Core functionality testing
   - Build process validation

### Phase 2: Build System Upgrades (Week 2)
**Goal**: Modernize build tools and development environment

1. **React Scripts Upgrade**
   - `react-scripts` `4.0.3` → `5.0.1`
   - Test all build processes (dev, prod, extensions)
   - Validate webpack configuration

2. **Craco Upgrade**
   - `@craco/craco` `6.4.5` → `7.1.0`
   - Update craco configuration
   - Test custom webpack overrides

3. **Babel Ecosystem**
   - Upgrade all `@babel/*` packages to `7.28.x`
   - Update babel configuration
   - Test transpilation for all browser targets

### Phase 3: Testing Framework Upgrades (Week 3)
**Goal**: Modernize testing infrastructure

1. **Testing Libraries**
   - `@testing-library/react` `12.1.5` → `16.3.0`
   - `@testing-library/jest-dom` `5.17.0` → `6.6.4`
   - `@testing-library/user-event` `13.5.0` → `14.6.1`

2. **Jest Configuration**
   - Update Jest configuration for new versions
   - Validate all test suites
   - Update test patterns if needed

### Phase 4: Core Framework Upgrades (Week 4-5)
**Goal**: Upgrade React and related core dependencies

⚠️ **High Risk Phase** - Major breaking changes expected

1. **React Upgrade Strategy**
   - **Option A**: Direct upgrade `17.0.2` → `19.1.1`
   - **Option B**: Incremental upgrade `17` → `18` → `19`
   - **Recommendation**: Option B for safety

2. **React 17 → 18 First**
   - Update React and ReactDOM to `18.x`
   - Address React 18 breaking changes
   - Update ReactDOM render to `createRoot`
   - Test concurrent features compatibility
   - Update evergreen-ui compatibility

3. **React 18 → 19 Second**
   - Update to React 19
   - Address React 19 breaking changes
   - Test new React 19 features
   - Validate browser extension compatibility

### Phase 5: UI and Application Dependencies (Week 6)
**Goal**: Upgrade UI libraries and application-specific dependencies

1. **UI Framework**
   - `evergreen-ui` `6.9.0` → `7.1.9`
   - Test all UI components
   - Address any breaking changes

2. **Utility Libraries**
   - `date-fns` `2.30.0` → `4.1.0` (Breaking changes expected)
   - `query-string` `7.1.3` → `9.2.2` (Breaking changes expected)
   - `lodash` - Evaluate if upgrade needed

3. **Router Upgrade**
   - `react-router-dom` `5.3.4` → `7.7.1` (Major breaking changes)
   - Rewrite routing logic for v6+ patterns
   - Update navigation patterns

### Phase 6: Development and Release Tools (Week 7)
**Goal**: Upgrade development tooling and release processes

1. **Development Tools**
   - `nodemon` `3.1.9` → `3.1.10`
   - `prettier` `3.0.0` → `3.6.2`
   - `web-ext` `7.12.0` → `8.9.0`

2. **Release Tools**
   - `release-it` `15.5.0` → `19.0.4` (Breaking changes)
   - `sign-addon` `3.11.0` → `6.4.0` (Breaking changes)

## Risk Assessment 🚨

### High Risk Dependencies
1. **React** - Major version upgrade, significant breaking changes
2. **react-router-dom** - Complete API rewrite in v6+
3. **evergreen-ui** - Potential React compatibility issues
4. **@craco/craco** - Build configuration changes
5. **react-scripts** - Webpack and build tool changes

### Medium Risk Dependencies
1. **@testing-library/react** - Test API changes
2. **date-fns** - API changes in v3/v4
3. **query-string** - API changes
4. **release-it** - Release process changes

### Low Risk Dependencies
1. **@babel/** packages - Generally backward compatible
2. **prettier** - Formatting only
3. **sass** - Generally backward compatible
4. **nodemon** - Development only

## Testing Strategy 🧪

### Pre-Upgrade Testing
1. **Baseline Tests**
   ```bash
   npm run test:ci
   npm run lint:ci
   npm run build
   ```

2. **Manual Testing Checklist**
   - [ ] Extension loads in Chrome/Firefox/Edge
   - [ ] Core blocking functionality works
   - [ ] Settings panel functionality
   - [ ] Password protection
   - [ ] Sync functionality
   - [ ] Timer functionality
   - [ ] All UI components render correctly

### During Upgrade Testing
1. **After Each Phase**
   - Run full test suite
   - Manual regression testing
   - Build validation for all browser targets
   - Security vulnerability re-scan

2. **Rollback Strategy**
   - Git branch per phase
   - Package-lock.json backup
   - Build snapshot backup

### Post-Upgrade Validation
1. **Comprehensive Testing**
   - Full CI/CD pipeline execution
   - Security scan validation
   - Performance benchmarking
   - Cross-browser compatibility

2. **Deployment Testing**
   - Chrome extension store validation
   - Firefox add-on store validation
   - Edge extension store validation

## Implementation Timeline 📅

### Week 1: Security Critical (Jan 30 - Feb 5)
- [ ] Run `npm audit fix` for safe fixes
- [ ] Manual security vulnerability fixes
- [ ] Security regression testing
- [ ] CI/CD validation

### Week 2: Build System (Feb 6 - Feb 12)
- [ ] Upgrade react-scripts
- [ ] Upgrade @craco/craco
- [ ] Upgrade @babel/* packages
- [ ] Build process validation

### Week 3: Testing Framework (Feb 13 - Feb 19)
- [ ] Upgrade @testing-library/* packages
- [ ] Update Jest configuration
- [ ] Validate all test suites
- [ ] Update test patterns

### Week 4-5: React Core (Feb 20 - Mar 5)
- [ ] React 17 → 18 upgrade
- [ ] React 18 → 19 upgrade
- [ ] Address breaking changes
- [ ] Extensive testing

### Week 6: UI Libraries (Mar 6 - Mar 12)
- [ ] Upgrade evergreen-ui
- [ ] Upgrade utility libraries
- [ ] Upgrade react-router-dom
- [ ] UI regression testing

### Week 7: Dev Tools (Mar 13 - Mar 19)
- [ ] Upgrade development tools
- [ ] Upgrade release tools
- [ ] Final integration testing
- [ ] Release preparation

## Rollback Plan 🔄

### Immediate Rollback (If Critical Issues Found)
1. **Git Reset**
   ```bash
   git reset --hard HEAD~1  # Last working commit
   ```

2. **Package Restoration**
   ```bash
   git checkout HEAD~1 -- package.json package-lock.json
   npm ci
   ```

### Phase-Level Rollback
1. **Branch Strategy**
   - Create branch before each phase
   - Maintain working branches
   - Cherry-pick successful changes

2. **Dependency Pinning**
   - Pin working versions in package.json
   - Use exact versions for critical dependencies

## Success Criteria ✅

### Technical Success
- [ ] All 180 vulnerabilities resolved
- [ ] 100% test suite passing
- [ ] All builds successful (Chrome/Firefox/Edge)
- [ ] CI/CD pipeline fully functional
- [ ] No performance regressions

### Quality Success  
- [ ] No breaking changes to user experience
- [ ] Maintained backward compatibility where possible
- [ ] Updated documentation
- [ ] Security scan clean
- [ ] Code quality maintained

### Process Success
- [ ] Rollback plan validated
- [ ] Timeline met
- [ ] Team knowledge transfer
- [ ] Dependency update process documented

## Next Steps 🎯

1. **Immediate Actions**
   - Review and approve this plan
   - Create phase-specific branches
   - Run baseline testing
   - Begin Phase 1: Security Critical

2. **Preparation**
   - Set up monitoring for upgrade process
   - Prepare rollback procedures
   - Schedule team review sessions
   - Document current functionality

3. **Communication**
   - Stakeholder notification
   - Progress tracking setup
   - Issue escalation process
   - Success criteria validation

---

**Last Updated**: July 30, 2025
**Next Review**: Weekly during upgrade process
**Owner**: Development Team
**Status**: Planning Phase
