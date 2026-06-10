/**
 * Unit tests for patternMatcher module
 * Tests URL pattern compilation and matching functionality
 */

import {
  compileDenyPatterns,
  compileAllowPatterns,
  testUrlAgainstPatterns,
  testUrlWithPatternReport,
  matchesDenylist,
  matchesAllowlist,
  wildcardToRegex,
  testSinglePattern,
} from '../../../service-worker/rules/patternMatcher';

describe('patternMatcher', () => {
  describe('compileDenyPatterns', () => {
    it('should return empty array for non-array input', () => {
      expect(compileDenyPatterns(null)).toEqual([]);
      expect(compileDenyPatterns(undefined)).toEqual([]);
      expect(compileDenyPatterns('string')).toEqual([]);
      expect(compileDenyPatterns(123)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(compileDenyPatterns([])).toEqual([]);
    });

    it('should filter out null and empty patterns', () => {
      const patterns = ['facebook.com', null, '', '  ', 'twitter.com'];
      const result = compileDenyPatterns(patterns);
      expect(result).toHaveLength(2);
    });

    it('should compile valid patterns into RegExp objects', () => {
      const patterns = ['facebook.com', 'twitter.com'];
      const result = compileDenyPatterns(patterns);
      expect(result).toHaveLength(2);
      result.forEach((regex) => {
        expect(regex).toBeInstanceOf(RegExp);
      });
    });

    it('should compile wildcard patterns correctly', () => {
      const patterns = ['*.facebook.com', 'twitter.*'];
      const result = compileDenyPatterns(patterns);
      expect(result).toHaveLength(2);
      result.forEach((regex) => {
        expect(regex).toBeInstanceOf(RegExp);
      });
    });
  });

  describe('compileAllowPatterns', () => {
    it('should return empty array for non-array input', () => {
      expect(compileAllowPatterns(null)).toEqual([]);
      expect(compileAllowPatterns(undefined)).toEqual([]);
      expect(compileAllowPatterns('string')).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(compileAllowPatterns([])).toEqual([]);
    });

    it('should filter out null and empty patterns', () => {
      const patterns = ['github.com', null, '', 'stackoverflow.com'];
      const result = compileAllowPatterns(patterns);
      expect(result).toHaveLength(2);
    });

    it('should compile valid patterns into RegExp objects', () => {
      const patterns = ['github.com', 'stackoverflow.com'];
      const result = compileAllowPatterns(patterns);
      expect(result).toHaveLength(2);
      result.forEach((regex) => {
        expect(regex).toBeInstanceOf(RegExp);
      });
    });
  });

  describe('testUrlAgainstPatterns', () => {
    it('should return no match for empty URL', () => {
      const patterns = compileDenyPatterns(['facebook.com']);
      expect(testUrlAgainstPatterns('', patterns)).toEqual({ matched: false, index: -1 });
      expect(testUrlAgainstPatterns(null, patterns)).toEqual({
        matched: false,
        index: -1,
      });
    });

    it('should return no match for empty patterns', () => {
      expect(testUrlAgainstPatterns('https://facebook.com', [])).toEqual({
        matched: false,
        index: -1,
      });
      expect(testUrlAgainstPatterns('https://facebook.com', null)).toEqual({
        matched: false,
        index: -1,
      });
    });

    it('should match exact domain patterns', () => {
      const patterns = compileDenyPatterns(['facebook.com', 'twitter.com']);

      const result = testUrlAgainstPatterns('https://facebook.com/page', patterns);
      expect(result.matched).toBe(true);
      expect(result.index).toBe(0);
    });

    it('should match second pattern in list', () => {
      const patterns = compileDenyPatterns(['facebook.com', 'twitter.com']);

      const result = testUrlAgainstPatterns('https://twitter.com/user', patterns);
      expect(result.matched).toBe(true);
      expect(result.index).toBe(1);
    });

    it('should not match non-matching URLs', () => {
      const patterns = compileDenyPatterns(['facebook.com']);

      const result = testUrlAgainstPatterns('https://github.com', patterns);
      expect(result.matched).toBe(false);
      expect(result.index).toBe(-1);
    });

    it('should match subdomain patterns with wildcard', () => {
      const patterns = compileDenyPatterns(['*.facebook.com']);

      expect(testUrlAgainstPatterns('https://www.facebook.com', patterns).matched).toBe(
        true,
      );
      expect(testUrlAgainstPatterns('https://m.facebook.com', patterns).matched).toBe(
        true,
      );
      expect(
        testUrlAgainstPatterns('https://api.facebook.com/v1', patterns).matched,
      ).toBe(true);
    });

    it('should be case insensitive', () => {
      const patterns = compileDenyPatterns(['facebook.com']);

      expect(testUrlAgainstPatterns('https://FACEBOOK.COM', patterns).matched).toBe(true);
      expect(testUrlAgainstPatterns('https://Facebook.Com/Page', patterns).matched).toBe(
        true,
      );
    });
  });

  describe('testUrlWithPatternReport', () => {
    it('should return matched pattern when URL matches', () => {
      const originalPatterns = ['facebook.com', 'twitter.com'];
      const compiledPatterns = compileDenyPatterns(originalPatterns);

      const result = testUrlWithPatternReport(
        'https://facebook.com/page',
        compiledPatterns,
        originalPatterns,
      );

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe('facebook.com');
    });

    it('should return null pattern when URL does not match', () => {
      const originalPatterns = ['facebook.com'];
      const compiledPatterns = compileDenyPatterns(originalPatterns);

      const result = testUrlWithPatternReport(
        'https://github.com',
        compiledPatterns,
        originalPatterns,
      );

      expect(result.matched).toBe(false);
      expect(result.pattern).toBe(null);
    });

    it('should handle missing original patterns gracefully', () => {
      const compiledPatterns = compileDenyPatterns(['facebook.com']);

      const result = testUrlWithPatternReport(
        'https://facebook.com',
        compiledPatterns,
        null,
      );

      expect(result.matched).toBe(true);
      expect(result.pattern).toContain('pattern at index');
    });
  });

  describe('matchesDenylist', () => {
    it('should match URLs in deny list', () => {
      const originalPatterns = ['facebook.com', 'twitter.com'];
      const compiledPatterns = compileDenyPatterns(originalPatterns);

      const result = matchesDenylist(
        'https://facebook.com/page',
        compiledPatterns,
        originalPatterns,
      );

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe('facebook.com');
    });

    it('should not match URLs not in deny list', () => {
      const originalPatterns = ['facebook.com'];
      const compiledPatterns = compileDenyPatterns(originalPatterns);

      const result = matchesDenylist(
        'https://github.com',
        compiledPatterns,
        originalPatterns,
      );

      expect(result.matched).toBe(false);
      expect(result.pattern).toBe(null);
    });
  });

  describe('matchesAllowlist', () => {
    it('should match URLs in allow list', () => {
      const originalPatterns = ['github.com', 'stackoverflow.com'];
      const compiledPatterns = compileAllowPatterns(originalPatterns);

      const result = matchesAllowlist(
        'https://github.com/user/repo',
        compiledPatterns,
        originalPatterns,
      );

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe('github.com');
    });

    it('should not match URLs not in allow list', () => {
      const originalPatterns = ['github.com'];
      const compiledPatterns = compileAllowPatterns(originalPatterns);

      const result = matchesAllowlist(
        'https://facebook.com',
        compiledPatterns,
        originalPatterns,
      );

      expect(result.matched).toBe(false);
      expect(result.pattern).toBe(null);
    });
  });

  describe('wildcardToRegex', () => {
    it('should convert wildcard pattern to regex', () => {
      const regex = wildcardToRegex('facebook.com');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('https://facebook.com')).toBe(true);
    });

    it('should handle subdomain wildcards', () => {
      const regex = wildcardToRegex('*.facebook.com');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('https://www.facebook.com')).toBe(true);
      expect(regex.test('https://m.facebook.com')).toBe(true);
    });

    it('should handle path wildcards', () => {
      const regex = wildcardToRegex('facebook.com/*');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('https://facebook.com/page')).toBe(true);
    });
  });

  describe('testSinglePattern', () => {
    it('should return true for matching pattern', () => {
      expect(testSinglePattern('https://facebook.com/page', 'facebook.com')).toBe(true);
    });

    it('should return false for non-matching pattern', () => {
      expect(testSinglePattern('https://github.com', 'facebook.com')).toBe(false);
    });

    it('should handle wildcard subdomain patterns', () => {
      expect(testSinglePattern('https://www.facebook.com', '*.facebook.com')).toBe(true);
      expect(testSinglePattern('https://m.facebook.com', '*.facebook.com')).toBe(true);
    });

    it('should handle invalid patterns gracefully', () => {
      // Empty string may match everything depending on regex implementation
      // Just verify it doesn't throw
      expect(() => testSinglePattern('https://example.com', '')).not.toThrow();
    });
  });

  describe('path matching', () => {
    it('should match specific paths', () => {
      const patterns = compileDenyPatterns(['facebook.com/marketplace']);

      expect(
        testUrlAgainstPatterns('https://facebook.com/marketplace', patterns).matched,
      ).toBe(true);
      expect(
        testUrlAgainstPatterns('https://facebook.com/marketplace/item', patterns).matched,
      ).toBe(true);
    });

    it('should match path wildcards', () => {
      const patterns = compileDenyPatterns(['youtube.com/watch*']);

      expect(
        testUrlAgainstPatterns('https://youtube.com/watch?v=abc123', patterns).matched,
      ).toBe(true);
    });

    it('should match exact path termination with $', () => {
      const patterns = compileDenyPatterns(['example.com/page$']);

      expect(testUrlAgainstPatterns('https://example.com/page', patterns).matched).toBe(
        true,
      );
      // Note: The exact behavior depends on how the regex helper handles $
    });
  });

  describe('protocol handling', () => {
    it('should match HTTP URLs', () => {
      const patterns = compileDenyPatterns(['http://insecure-site.com']);

      expect(testUrlAgainstPatterns('http://insecure-site.com', patterns).matched).toBe(
        true,
      );
    });

    it('should match HTTPS URLs', () => {
      const patterns = compileDenyPatterns(['https://secure-site.com']);

      expect(testUrlAgainstPatterns('https://secure-site.com', patterns).matched).toBe(
        true,
      );
    });

    it('should match any protocol with *://', () => {
      const patterns = compileDenyPatterns(['*://any-protocol.com']);

      expect(testUrlAgainstPatterns('https://any-protocol.com', patterns).matched).toBe(
        true,
      );
      expect(testUrlAgainstPatterns('http://any-protocol.com', patterns).matched).toBe(
        true,
      );
    });

    it('should match without protocol specification', () => {
      const patterns = compileDenyPatterns(['no-protocol.com']);

      expect(testUrlAgainstPatterns('https://no-protocol.com', patterns).matched).toBe(
        true,
      );
      expect(testUrlAgainstPatterns('http://no-protocol.com', patterns).matched).toBe(
        true,
      );
    });
  });
});
