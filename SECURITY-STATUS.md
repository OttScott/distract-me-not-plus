# Outstanding Security Vulnerabilities

**Date**: 2026-01-24  
**Status**: 32 vulnerabilities remaining (down from 180)

## Summary

After running `npm audit fix` and updating safe dependencies, we've reduced vulnerabilities from **180 to 32**. The remaining issues require **breaking changes** that need careful testing.

## Remaining Vulnerabilities

### Critical (2)
1. **form-data** (< 2.5.4) - Unsafe random function for boundary selection
   - Affects: `request` → `sign-addon` 
   - Fix: No fix available, requires replacing `request` package
   - Priority: HIGH

2. **qs** (< 6.14.1) - DoS via memory exhaustion
   - Affects: `express`, `body-parser`, `web-ext`
   - Fix: Update `web-ext` (breaking change)
   - Priority: HIGH

### High Severity (21)
- **cross-spawn** (< 6.0.6) - ReDoS vulnerability
- **minimatch** (< 3.0.5) - ReDoS vulnerability  
- **nth-check** (< 2.0.1) - Inefficient regex complexity
- **path-to-regexp** (2.0.0 - 3.2.0) - Backtracking regex
- **qs arrayLimit bypass** - DoS vulnerability

### Moderate (7)
- **ajv** (< 6.12.3) - Prototype pollution
- **postcss** (< 8.4.31) - Line return parsing error
- **on-headers** (< 1.1.0) - HTTP header manipulation
- **tough-cookie** (< 4.1.3) - Prototype pollution
- **webpack-dev-server** (≤ 5.2.0) - Source code theft risk

## Recommended Actions

### Phase 1: Immediate (Low Risk)
✅ **COMPLETED** - Updated all safe dependencies

### Phase 2: Medium Risk (2-3 days)
- [ ] Replace `request` package with modern alternatives (axios, node-fetch)
  - Affects `sign-addon` package
  - Test Firefox extension signing workflow
  
- [ ] Update `web-ext` to 9.2.0
  - Breaking changes in API
  - Test extension loading and signing

### Phase 3: High Risk (1-2 weeks)
- [ ] Update React 17 → 18 → 19
  - **MAJOR BREAKING CHANGE**
  - See DEPENDENCY-UPGRADE-PLAN.md Phase 4
  - Requires extensive testing

- [ ] Update `react-scripts` and `@craco/craco`
  - Depends on React 18+ update
  - May require build configuration changes

- [ ] Update `serve` to 14.2.5
  - Breaking changes in CLI and API
  - Used for local testing only

## Risk Assessment

| Action | Risk | Impact | Effort |
|--------|------|--------|--------|
| Replace `request` | MEDIUM | Fixes 3 critical CVEs | 2 days |
| Update `web-ext` | MEDIUM | Fixes high severity qs issue | 1 day |
| Update React 17→18 | HIGH | Required for most other fixes | 1-2 weeks |
| Update `serve` | LOW | Dev tool only, not in production | 1 hour |

## Notes

- **Production Impact**: Extension currently works, vulnerabilities are mostly in dev dependencies
- **Priority Order**: Focus on `request` replacement first (affects addon signing)
- **Testing Required**: Full regression testing after each phase
- **React Update**: Should be done in a separate branch with comprehensive testing

## Status of Safe Updates (Completed)

✅ Babel packages (7.16.0 → 7.28.x)  
✅ bcryptjs (2.4.3 → 2.4.3 - v3.x incompatible with build)  
✅ DOMPurify (3.2.6 → 3.3.1)  
✅ Prettier (3.6.2 → 3.8.1)  
✅ Sass (1.85.1 → 1.97.3)  
✅ Nodemon (3.1.9 → 3.1.11)

## References

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [DEPENDENCY-UPGRADE-PLAN.md](./DEPENDENCY-UPGRADE-PLAN.md) - Full upgrade strategy
- [GitHub Advisory Database](https://github.com/advisories)
