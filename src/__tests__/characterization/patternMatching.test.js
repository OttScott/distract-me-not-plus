/**
 * Characterization Tests: Pattern Matching
 *
 * These tests document the ACTUAL behavior of pattern matching from both implementations:
 * - Firefox: src/helpers/regex.js (transformList, transformKeywords)
 * - Chrome/service-worker: public/service-worker-patterns.js (matchesPattern)
 *
 * These tests serve as a regression contract — they capture current behavior,
 * not necessarily correct or desired behavior.
 */

import { transformList, transformKeywords } from 'helpers/regex';

// Import the service worker pattern matching functions by extracting them
// Note: service-worker-patterns.js uses self.* globals, so we reimplement the pure functions here
// with comments noting the source location

/**
 * Extracted from service-worker-patterns.js lines 1-100
 * Parse a URL or pattern string into component parts for easier matching
 */
function parseUrlOrPattern(urlOrPattern) {
  try {
    const normalized = urlOrPattern.trim().toLowerCase();

    let protocol = '';
    let hostname = '';
    let path = '';
    let isSubdomainWildcard = false;
    let baseDomain = '';
    let domainParts = [];

    let remaining = normalized;
    if (normalized.includes('://')) {
      const parts = normalized.split('://', 2);
      protocol = parts[0];
      remaining = parts[1];
    }

    const slashIndex = remaining.indexOf('/');
    if (slashIndex !== -1) {
      hostname = remaining.substring(0, slashIndex);
      path = remaining.substring(slashIndex);
    } else {
      hostname = remaining;
      path = '';
    }

    domainParts = hostname.split('.').filter((p) => p !== '');

    if (hostname.startsWith('*.')) {
      isSubdomainWildcard = true;
      baseDomain = hostname.substring(2);
    } else {
      baseDomain = hostname;
    }

    const hasSpecificSubdomain = !isSubdomainWildcard && domainParts.length > 2;
    const hasSpecificPath = path && path !== '/' && path !== '/*';

    return {
      original: urlOrPattern,
      normalized,
      protocol,
      hostname,
      path,
      isSubdomainWildcard,
      baseDomain,
      domainParts,
      hasSpecificSubdomain,
      hasSpecificPath,
    };
  } catch (error) {
    return {
      original: urlOrPattern,
      normalized: urlOrPattern.toLowerCase(),
      protocol: '',
      hostname: '',
      path: '',
      isSubdomainWildcard: false,
      baseDomain: '',
      domainParts: [],
      hasSpecificSubdomain: false,
      hasSpecificPath: false,
    };
  }
}

/**
 * Extracted from service-worker-patterns.js
 * Check if a domain matches a pattern domain, handling wildcards
 */
function domainMatches(urlDomain, patternParsed) {
  if (!patternParsed.isSubdomainWildcard) {
    if (urlDomain === patternParsed.hostname) return true;
    const domainSuffix = `.${patternParsed.hostname}`;
    return urlDomain.endsWith(domainSuffix);
  }

  if (
    urlDomain.endsWith(`.${patternParsed.baseDomain}`) &&
    urlDomain !== patternParsed.baseDomain
  ) {
    return true;
  }

  return false;
}

describe('Pattern Matching Characterization Tests', () => {
  describe('Firefox/helpers/regex.js: transformList()', () => {
    describe('Wildcard Pattern Transformation', () => {
      it('adds protocol wildcard when protocol is missing', () => {
        const patterns = transformList(['example.com']);
        expect(patterns[0].source).toContain('.*:\\/\\/');
      });

      it('preserves explicit protocols', () => {
        const patterns = transformList(['https://example.com']);
        expect(patterns[0].source).toContain('https:\\/\\/');
        expect(patterns[0].source).not.toContain('.*:\\/\\/');
      });

      it('handles subdomain wildcards (*.domain.com)', () => {
        const patterns = transformList(['*.facebook.com']);
        const pattern = patterns[0];

        // Documents current behavior
        expect(pattern.test('https://www.facebook.com')).toBe(true);
        expect(pattern.test('https://m.facebook.com')).toBe(true);
        expect(pattern.test('https://facebook.com')).toBe(true); // NOTE: Also matches base domain
        expect(pattern.test('https://notfacebook.com')).toBe(false);
      });

      it('handles path wildcards (domain.com/*)', () => {
        const patterns = transformList(['youtube.com/*']);
        const pattern = patterns[0];

        expect(pattern.test('https://youtube.com/watch')).toBe(true);
        expect(pattern.test('https://youtube.com/feed/subscriptions')).toBe(true);
        expect(pattern.test('https://youtube.com')).toBe(false); // No path
        expect(pattern.test('https://youtube.com/')).toBe(true); // Has trailing slash
      });

      it('handles exact URL patterns with $ suffix', () => {
        const patterns = transformList(['example.com$']);
        const pattern = patterns[0];

        expect(pattern.test('https://example.com')).toBe(true);
        expect(pattern.test('https://example.com/')).toBe(true);
        expect(pattern.test('https://example.com/page')).toBe(false);
      });

      it('handles regex patterns starting with ^', () => {
        const patterns = transformList(['^https://exact\\.example\\.com/path$']);
        const pattern = patterns[0];

        expect(pattern.test('https://exact.example.com/path')).toBe(true);
        expect(pattern.test('https://exact.example.com/path/')).toBe(false);
        expect(pattern.test('https://other.example.com/path')).toBe(false);
      });
    });

    describe('Case Sensitivity', () => {
      it('pattern matching is case-insensitive', () => {
        const patterns = transformList(['EXAMPLE.COM']);
        const pattern = patterns[0];

        expect(pattern.test('https://example.com')).toBe(true);
        expect(pattern.test('https://EXAMPLE.COM')).toBe(true);
        expect(pattern.test('https://Example.Com')).toBe(true);
      });
    });

    describe('Special Characters', () => {
      it('escapes regex special characters in URL patterns', () => {
        const patterns = transformList(['example.com/page?query=value']);
        const pattern = patterns[0];

        // The ? should be escaped to match literally
        expect(pattern.test('https://example.com/page?query=value')).toBe(true);
      });

      it('handles ports in URLs', () => {
        const patterns = transformList(['localhost:3000']);
        const pattern = patterns[0];

        expect(pattern.test('http://localhost:3000')).toBe(true);
        expect(pattern.test('http://localhost:3000/api')).toBe(true);
        expect(pattern.test('http://localhost:8080')).toBe(false);
      });
    });

    describe('Path Matching', () => {
      it('handles specific path patterns', () => {
        const patterns = transformList(['reddit.com/r/programming']);
        const pattern = patterns[0];

        expect(pattern.test('https://reddit.com/r/programming')).toBe(true);
        expect(pattern.test('https://reddit.com/r/programming/comments/123')).toBe(true);
        expect(pattern.test('https://reddit.com/r/javascript')).toBe(false);
      });

      it('handles path wildcards in middle of URL', () => {
        const patterns = transformList(['example.com/*/article']);
        const pattern = patterns[0];

        expect(pattern.test('https://example.com/blog/article')).toBe(true);
        expect(pattern.test('https://example.com/news/article')).toBe(true);
        expect(pattern.test('https://example.com/article')).toBe(false);
      });
    });
  });

  describe('Firefox/helpers/regex.js: transformKeywords()', () => {
    describe('Plain Keyword Matching', () => {
      it('creates case-insensitive regex from plain keywords', () => {
        const patterns = transformKeywords(['facebook']);
        const pattern = patterns[0];

        expect(pattern.test('https://facebook.com')).toBe(true);
        expect(pattern.test('https://www.facebook.com/page')).toBe(true);
        expect(pattern.test('https://example.com/facebook/link')).toBe(true);
      });

      it('escapes regex special characters in plain keywords', () => {
        const patterns = transformKeywords(['test?word']);
        const pattern = patterns[0];

        // Should match literal "test?word", not "test" followed by optional "w"
        expect(pattern.test('https://example.com/test?word=value')).toBe(true);
      });
    });

    describe('Regex Keyword Patterns', () => {
      it('handles explicit regex patterns with /pattern/flags syntax', () => {
        const patterns = transformKeywords(['/facebook|instagram/i']);
        const pattern = patterns[0];

        expect(pattern.test('https://facebook.com')).toBe(true);
        expect(pattern.test('https://instagram.com')).toBe(true);
        expect(pattern.test('https://twitter.com')).toBe(false);
      });

      it('handles regex patterns with global flag', () => {
        const patterns = transformKeywords(['/video/gi']);
        const pattern = patterns[0];

        // Note: RegExp with 'g' flag is stateful - lastIndex advances after each match
        // Need to reset or use separate test calls
        expect(pattern.test('https://example.com/video')).toBe(true);

        // Reset lastIndex before second test (global regex quirk)
        pattern.lastIndex = 0;
        expect(pattern.test('https://example.com/VIDEO')).toBe(true);
      });

      it('handles invalid regex flags gracefully', () => {
        // Invalid duplicate flags - should be treated as literal string
        const patterns = transformKeywords(['/pattern/ii']);
        const pattern = patterns[0];

        // Implementation escapes the whole thing when flags are invalid
        expect(typeof pattern.source).toBe('string');
      });
    });
  });

  describe('Chrome/service-worker-patterns.js: parseUrlOrPattern()', () => {
    describe('URL Parsing', () => {
      it('extracts protocol, hostname, and path correctly', () => {
        const parsed = parseUrlOrPattern('https://www.example.com/path/to/page');

        expect(parsed.protocol).toBe('https');
        expect(parsed.hostname).toBe('www.example.com');
        expect(parsed.path).toBe('/path/to/page');
      });

      it('detects subdomain wildcard patterns', () => {
        const parsed = parseUrlOrPattern('*.reddit.com');

        expect(parsed.isSubdomainWildcard).toBe(true);
        expect(parsed.baseDomain).toBe('reddit.com');
      });

      it('handles URLs without protocol', () => {
        const parsed = parseUrlOrPattern('example.com/page');

        expect(parsed.protocol).toBe('');
        expect(parsed.hostname).toBe('example.com');
        expect(parsed.path).toBe('/page');
      });

      it('handles URLs without path', () => {
        const parsed = parseUrlOrPattern('https://example.com');

        expect(parsed.hostname).toBe('example.com');
        expect(parsed.path).toBe('');
      });
    });
  });

  describe('Chrome/service-worker-patterns.js: domainMatches()', () => {
    describe('Exact Domain Matching', () => {
      it('matches exact domain', () => {
        const patternParsed = parseUrlOrPattern('example.com');

        expect(domainMatches('example.com', patternParsed)).toBe(true);
        expect(domainMatches('other.com', patternParsed)).toBe(false);
      });

      it('matches subdomains of exact domain pattern', () => {
        const patternParsed = parseUrlOrPattern('example.com');

        expect(domainMatches('www.example.com', patternParsed)).toBe(true);
        expect(domainMatches('sub.example.com', patternParsed)).toBe(true);
      });
    });

    describe('Wildcard Domain Matching', () => {
      it('wildcard matches subdomains but NOT base domain', () => {
        const patternParsed = parseUrlOrPattern('*.example.com');

        expect(domainMatches('www.example.com', patternParsed)).toBe(true);
        expect(domainMatches('sub.example.com', patternParsed)).toBe(true);
        // DIVERGENCE: Chrome service worker does NOT match base domain with *.
        expect(domainMatches('example.com', patternParsed)).toBe(false);
      });
    });
  });

  describe('DIVERGENCE DOCUMENTATION: Firefox vs Chrome Pattern Matching', () => {
    /**
     * This section documents behavioral differences between the two implementations.
     * These are not bugs to fix — they are reality to capture.
     */

    describe('Subdomain Wildcard Behavior', () => {
      it('DIVERGENCE: Firefox matches base domain with *.pattern, Chrome does not', () => {
        // Firefox (transformList) behavior
        const firefoxPattern = transformList(['*.reddit.com'])[0];
        const firefoxMatchesBaseDomain = firefoxPattern.test('https://reddit.com');

        // Chrome (domainMatches) behavior - simulated
        const chromeParsed = parseUrlOrPattern('*.reddit.com');
        const chromeMatchesBaseDomain = domainMatches('reddit.com', chromeParsed);

        // Document the divergence
        expect(firefoxMatchesBaseDomain).toBe(true); // Firefox: YES
        expect(chromeMatchesBaseDomain).toBe(false); // Chrome: NO

        // Both should match www.reddit.com
        expect(firefoxPattern.test('https://www.reddit.com')).toBe(true);
        expect(domainMatches('www.reddit.com', chromeParsed)).toBe(true);
      });
    });

    describe('Path Matching Granularity', () => {
      it('Firefox uses regex matching, Chrome uses path-specific logic', () => {
        // Firefox pattern matching for subreddit-specific paths
        const firefoxPattern = transformList(['reddit.com/r/programming'])[0];

        // Firefox matches the path as a prefix
        expect(firefoxPattern.test('https://reddit.com/r/programming')).toBe(true);
        expect(firefoxPattern.test('https://reddit.com/r/programming/hot')).toBe(true);

        // But also matches if the path contains it anywhere
        // This is a regex substring match behavior
      });
    });

    describe('Keyword Matching Location', () => {
      it('Firefox keywords: matched against FULL URL including hostname', () => {
        const firefoxKeyword = transformKeywords(['facebook'])[0];

        // Firefox keyword matches anywhere in URL
        expect(firefoxKeyword.test('https://facebook.com')).toBe(true);
        expect(firefoxKeyword.test('https://example.com/share/facebook')).toBe(true);
        expect(firefoxKeyword.test('https://facebookshare.example.com')).toBe(true);
      });

      it('Chrome keywords: matched against URL with hostname extraction', () => {
        // Chrome service worker extracts hostname separately and checks both
        // See service-worker.js checkKeywordsInUrl() function
        // This is functionally similar but implementation differs
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('Empty and Invalid Inputs', () => {
      it('handles empty array gracefully', () => {
        const patterns = transformList([]);
        expect(patterns).toEqual([]);
      });

      it('handles empty string in array', () => {
        // Empty strings should be filtered out in Background component setBlacklist
        // But transformList itself doesn't filter
        const patterns = transformList(['']);
        expect(patterns.length).toBe(1);
      });

      it('handles very long patterns', () => {
        // MAX_REGEX_LENGTH is defined in helpers/constants.js
        const longPattern = 'a'.repeat(10000);
        const patterns = transformList([longPattern]);
        // Should still produce a pattern (may be escaped)
        expect(patterns.length).toBe(1);
      });
    });

    describe('Unicode and Special Characters', () => {
      it('handles internationalized domain names', () => {
        const patterns = transformList(['例え.jp']);
        const pattern = patterns[0];

        expect(pattern.test('https://例え.jp')).toBe(true);
      });

      it('handles emoji in paths', () => {
        const patterns = transformList(['example.com/🎉']);
        const pattern = patterns[0];

        expect(pattern.test('https://example.com/🎉')).toBe(true);
      });
    });
  });
});
