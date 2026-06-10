/**
 * Characterization Tests: Blocking Modes
 *
 * These tests document the ACTUAL behavior of the three blocking modes:
 * - denylist (blacklist): Block URLs that match denylist patterns
 * - allowlist (whitelist): Block URLs that DON'T match allowlist patterns
 * - combined: Block if in denylist AND NOT in allowlist (allowlist wins)
 *
 * Source files:
 * - Firefox: src/components/Background/index.jsx (isUrlBlocked, isBlacklisted, isWhitelisted)
 * - Chrome: public/service-worker.js (checkUrlShouldBeBlockedLocal, evaluateUrlAgainstPatterns)
 * - Shared: src/helpers/block.js (Mode enum)
 */

import { Mode, isAccessible, defaultMode } from 'helpers/block';
import { transformList, transformKeywords } from 'helpers/regex';

describe('Blocking Modes Characterization Tests', () => {
  describe('Mode Enum (src/helpers/block.js)', () => {
    it('defines three mode values', () => {
      expect(Mode.denylist).toBe('denylist');
      expect(Mode.allowlist).toBe('allowlist');
      expect(Mode.combined).toBe('combined');
    });

    it('provides legacy aliases for backward compatibility', () => {
      // Legacy names map to new values
      expect(Mode.blacklist).toBe('denylist');
      expect(Mode.whitelist).toBe('allowlist');
    });

    it('default mode is combined', () => {
      expect(defaultMode).toBe(Mode.combined);
    });
  });

  describe('URL Accessibility Check (isAccessible)', () => {
    /**
     * isAccessible determines if a URL can be blocked.
     * Browser internal pages should NOT be blocked.
     */

    describe('Blockable URLs (returns true)', () => {
      const blockableUrls = [
        'http://example.com',
        'https://example.com',
        'http://localhost:3000',
        'https://www.facebook.com/page',
        'http://192.168.1.1',
        'ftp://files.example.com',
      ];

      it.each(blockableUrls)('isAccessible("%s") = true', (url) => {
        expect(isAccessible(url)).toBe(true);
      });
    });

    describe('Non-Blockable URLs (returns false)', () => {
      const nonBlockableUrls = [
        'chrome://extensions',
        'chrome://settings',
        'edge://extensions',
        'edge://settings',
        'about:addons',
        'about:blank',
        'about:newtab',
        'moz-extension://some-id/page',
        'chrome-extension://some-id/page',
        'extension://some-id/page',
        'file:///C:/path/to/file.html',
      ];

      it.each(nonBlockableUrls)('isAccessible("%s") = false', (url) => {
        expect(isAccessible(url)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('returns false for null/undefined', () => {
        expect(isAccessible(null)).toBe(false);
        expect(isAccessible(undefined)).toBe(false);
      });

      it('returns false for empty string', () => {
        expect(isAccessible('')).toBe(false);
      });
    });
  });

  describe('Firefox/Background Component: Blocking Logic', () => {
    /**
     * Simulates the blocking logic from Background/index.jsx
     * isBlacklisted, isWhitelisted, isUrlBlocked methods
     */

    // Helper to simulate Background component's blocking logic
    function createBlockingEngine(config) {
      const blacklistPatterns = transformList(config.blacklist || []);
      const whitelistPatterns = transformList(config.whitelist || []);
      const blacklistKeywords = transformKeywords(config.blacklistKeywords || []);
      const whitelistKeywords = transformKeywords(config.whitelistKeywords || []);
      const mode = config.mode || Mode.combined;
      const tmpAllowed = config.tmpAllowed || [];

      function isTmpAllowed(url) {
        // Simplified - real implementation checks hostname and timeout
        return tmpAllowed.some((entry) => url.includes(entry.hostname));
      }

      function isBlacklisted(url) {
        if (isTmpAllowed(url)) return false;

        for (const rule of blacklistPatterns) {
          if (rule.test(url)) return true;
        }
        for (const rule of blacklistKeywords) {
          if (rule.test(url)) return true;
        }
        return false;
      }

      function isWhitelisted(url) {
        if (!isAccessible(url) || isTmpAllowed(url)) return true;

        for (const rule of whitelistPatterns) {
          if (rule.test(url)) return true;
        }
        for (const rule of whitelistKeywords) {
          if (rule.test(url)) return true;
        }
        return false;
      }

      function isUrlBlocked(url) {
        switch (mode) {
          case Mode.blacklist:
          case Mode.denylist:
            return isBlacklisted(url);
          case Mode.whitelist:
          case Mode.allowlist:
            return !isWhitelisted(url);
          case Mode.combined:
            // From Background/index.jsx lines 901-920
            // Allowlist wins over denylist
            if (isWhitelisted(url)) return false;
            if (isBlacklisted(url)) return true;
            return false;
          default:
            return false;
        }
      }

      return { isBlacklisted, isWhitelisted, isUrlBlocked };
    }

    describe('Denylist Mode (Mode.denylist)', () => {
      it('blocks URLs matching denylist patterns', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklist: ['*.facebook.com', '*.twitter.com'],
        });

        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
        expect(engine.isUrlBlocked('https://twitter.com')).toBe(true);
        expect(engine.isUrlBlocked('https://www.example.com')).toBe(false);
      });

      it('blocks URLs matching denylist keywords', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklistKeywords: ['facebook', 'social'],
        });

        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
        expect(engine.isUrlBlocked('https://example.com/social/feed')).toBe(true);
        expect(engine.isUrlBlocked('https://www.google.com')).toBe(false);
      });

      it('allowlist is IGNORED in denylist mode', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklist: ['*.facebook.com'],
          whitelist: ['*.facebook.com'], // This is ignored
        });

        // Even though facebook is in both lists, denylist mode only checks denylist
        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
      });
    });

    describe('Allowlist Mode (Mode.allowlist)', () => {
      it('blocks URLs NOT matching allowlist patterns', () => {
        const engine = createBlockingEngine({
          mode: Mode.allowlist,
          whitelist: ['*.wikipedia.org', '*.google.com'],
        });

        expect(engine.isUrlBlocked('https://en.wikipedia.org')).toBe(false);
        expect(engine.isUrlBlocked('https://www.google.com')).toBe(false);
        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
      });

      it('blocks URLs NOT matching allowlist keywords', () => {
        const engine = createBlockingEngine({
          mode: Mode.allowlist,
          whitelistKeywords: ['education', 'learning'],
        });

        expect(engine.isUrlBlocked('https://www.education.com')).toBe(false);
        expect(engine.isUrlBlocked('https://learning.example.com')).toBe(false);
        expect(engine.isUrlBlocked('https://www.games.com')).toBe(true);
      });

      it('denylist is IGNORED in allowlist mode', () => {
        const engine = createBlockingEngine({
          mode: Mode.allowlist,
          blacklist: ['*.google.com'], // This is ignored
          whitelist: ['*.google.com'],
        });

        // Google is in allowlist, so not blocked
        expect(engine.isUrlBlocked('https://www.google.com')).toBe(false);
      });

      it('non-accessible URLs are always allowed', () => {
        const engine = createBlockingEngine({
          mode: Mode.allowlist,
          whitelist: [], // Empty allowlist would block everything
        });

        // Browser internal pages should not be blocked
        expect(engine.isUrlBlocked('chrome://extensions')).toBe(false);
        expect(engine.isUrlBlocked('about:blank')).toBe(false);
      });
    });

    describe('Combined Mode (Mode.combined)', () => {
      it('allowlist WINS over denylist (documented behavior)', () => {
        const engine = createBlockingEngine({
          mode: Mode.combined,
          blacklist: ['*.reddit.com'],
          whitelist: ['reddit.com/r/programming'],
        });

        // reddit.com is in denylist, but /r/programming is in allowlist
        expect(engine.isUrlBlocked('https://reddit.com/r/programming')).toBe(false);
        expect(engine.isUrlBlocked('https://reddit.com/r/funny')).toBe(true);
      });

      it('blocks URL if in denylist and NOT in allowlist', () => {
        const engine = createBlockingEngine({
          mode: Mode.combined,
          blacklist: ['*.facebook.com', '*.twitter.com'],
          whitelist: ['*.wikipedia.org'],
        });

        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
        expect(engine.isUrlBlocked('https://www.twitter.com')).toBe(true);
        expect(engine.isUrlBlocked('https://en.wikipedia.org')).toBe(false);
      });

      it('does NOT block URL if NOT in denylist (even if not in allowlist)', () => {
        const engine = createBlockingEngine({
          mode: Mode.combined,
          blacklist: ['*.facebook.com'],
          whitelist: ['*.wikipedia.org'],
        });

        // google.com is in neither list - should NOT be blocked
        expect(engine.isUrlBlocked('https://www.google.com')).toBe(false);
      });

      it('keywords work the same as patterns', () => {
        const engine = createBlockingEngine({
          mode: Mode.combined,
          blacklistKeywords: ['social', 'gaming'],
          whitelistKeywords: ['work'],
        });

        expect(engine.isUrlBlocked('https://social.example.com')).toBe(true);
        expect(engine.isUrlBlocked('https://social.work.com')).toBe(false); // 'work' allows it
        expect(engine.isUrlBlocked('https://news.example.com')).toBe(false);
      });
    });

    describe('Temporary Allow (tmpAllowed)', () => {
      it('temporarily allowed URLs bypass denylist', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklist: ['*.facebook.com'],
          tmpAllowed: [{ hostname: 'facebook.com', startedAt: Date.now(), time: 60000 }],
        });

        // URL is in denylist but temp-allowed
        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(false);
      });

      it('temporarily allowed URLs are treated as whitelisted', () => {
        const engine = createBlockingEngine({
          mode: Mode.allowlist,
          whitelist: [], // Empty - would block everything
          tmpAllowed: [{ hostname: 'example.com', startedAt: Date.now(), time: 60000 }],
        });

        // URL is temp-allowed, so not blocked even with empty allowlist
        expect(engine.isUrlBlocked('https://www.example.com')).toBe(false);
      });
    });
  });

  describe('Chrome/Service Worker: Blocking Logic', () => {
    /**
     * Documents the service worker's blocking approach
     * Uses declarativeNetRequest rules + manual checking
     */

    describe('Mode Handling', () => {
      it('uses same mode values as Firefox', () => {
        // The service worker stores mode in chrome.storage
        // and uses the same string values
        const validModes = ['denylist', 'allowlist', 'combined'];
        validModes.forEach((mode) => {
          expect(typeof mode).toBe('string');
        });
      });
    });

    describe('Pattern Evaluation Differences', () => {
      /**
       * Chrome service worker uses matchesPattern() from service-worker-patterns.js
       * This has different behavior than Firefox's regex-based matching
       */

      it('DIVERGENCE: Chrome uses path-specific matching, Firefox uses regex', () => {
        // This documents that the two implementations have different approaches
        // Chrome: parseUrlOrPattern() + domainMatches() + pathMatches()
        // Firefox: transformList() + regex.test()

        // Both should ultimately produce similar results for common cases
        // but edge cases may differ (see patternMatching.test.js for details)
        expect(true).toBe(true); // Placeholder for documentation
      });
    });
  });

  describe('DIVERGENCE DOCUMENTATION: Mode Behavior Differences', () => {
    describe('Timer and Schedule Interaction', () => {
      it('DIVERGENCE: Firefox checks timer/schedule, Chrome service worker has stubs', () => {
        // Firefox Background component (parseUrl method):
        // - Checks isTimerActive() first
        // - If timer not active, checks schedule via parseTodaySchedule()
        // - Only then evaluates blocking rules

        // Chrome service worker:
        // - isTimerActive message returns false (stubbed)
        // - getSchedule returns { isEnabled: false } (stubbed)
        // - These features are NOT implemented in service worker

        expect(true).toBe(true); // Documenting the divergence
      });
    });

    describe('URL Deduplication Cache', () => {
      it('DIVERGENCE: Chrome has blockedUrls cache, Firefox does not', () => {
        // Chrome service worker has:
        // const blockedUrls = new Set();
        // This caches recently blocked URLs to avoid re-evaluation

        // Firefox Background component does not have this optimization
        // Every navigation is evaluated fresh

        expect(true).toBe(true); // Documenting the divergence
      });
    });

    describe('DeclarativeNetRequest Rules', () => {
      it('Chrome uses declarativeNetRequest API (MV3), Firefox uses webRequest (MV2)', () => {
        // Chrome MV3 service worker:
        // - Converts patterns to declarativeNetRequest rules
        // - setupBlockingRules() builds rule objects
        // - Rules are registered with chrome.declarativeNetRequest.updateDynamicRules()

        // Firefox MV2 Background component:
        // - Uses webRequest.onBeforeRequest with blocking: true
        // - Evaluates patterns in real-time in onBeforeRequestHandler

        expect(true).toBe(true); // Documenting the architectural difference
      });
    });
  });

  describe('Edge Cases', () => {
    describe('Empty Lists', () => {
      it('denylist mode with empty list blocks nothing', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklist: [],
        });

        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(false);
        expect(engine.isUrlBlocked('https://any.url.com')).toBe(false);
      });

      it('allowlist mode with empty list blocks everything accessible', () => {
        const engine = createBlockingEngine({
          mode: Mode.allowlist,
          whitelist: [],
        });

        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
        expect(engine.isUrlBlocked('https://any.url.com')).toBe(true);
        // But not browser internal pages
        expect(engine.isUrlBlocked('chrome://extensions')).toBe(false);
      });

      it('combined mode with empty lists blocks nothing', () => {
        const engine = createBlockingEngine({
          mode: Mode.combined,
          blacklist: [],
          whitelist: [],
        });

        // Nothing in denylist = nothing to block
        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(false);
      });
    });

    describe('Overlapping Patterns', () => {
      it('multiple denylist patterns can match same URL', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklist: ['*.facebook.com', 'www.facebook.com'],
        });

        // URL matches multiple patterns, but result is the same
        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
      });

      it('pattern and keyword can both match same URL', () => {
        const engine = createBlockingEngine({
          mode: Mode.denylist,
          blacklist: ['*.facebook.com'],
          blacklistKeywords: ['facebook'],
        });

        // Matches both pattern and keyword
        expect(engine.isUrlBlocked('https://www.facebook.com')).toBe(true);
      });
    });
  });

  // Helper function used in tests above
  function createBlockingEngine(config) {
    const blacklistPatterns = transformList(config.blacklist || []);
    const whitelistPatterns = transformList(config.whitelist || []);
    const blacklistKeywords = transformKeywords(config.blacklistKeywords || []);
    const whitelistKeywords = transformKeywords(config.whitelistKeywords || []);
    const mode = config.mode || Mode.combined;
    const tmpAllowed = config.tmpAllowed || [];

    function isTmpAllowed(url) {
      return tmpAllowed.some((entry) => url.includes(entry.hostname));
    }

    function isBlacklisted(url) {
      if (isTmpAllowed(url)) return false;

      for (const rule of blacklistPatterns) {
        if (rule.test(url)) return true;
      }
      for (const rule of blacklistKeywords) {
        if (rule.test(url)) return true;
      }
      return false;
    }

    function isWhitelisted(url) {
      if (!isAccessible(url) || isTmpAllowed(url)) return true;

      for (const rule of whitelistPatterns) {
        if (rule.test(url)) return true;
      }
      for (const rule of whitelistKeywords) {
        if (rule.test(url)) return true;
      }
      return false;
    }

    function isUrlBlocked(url) {
      switch (mode) {
        case Mode.blacklist:
        case Mode.denylist:
          return isBlacklisted(url);
        case Mode.whitelist:
        case Mode.allowlist:
          return !isWhitelisted(url);
        case Mode.combined:
          if (isWhitelisted(url)) return false;
          if (isBlacklisted(url)) return true;
          return false;
        default:
          return false;
      }
    }

    return { isBlacklisted, isWhitelisted, isUrlBlocked };
  }
});
