/**
 * Search Query Utilities Tests
 *
 * Tests multi-signal scoring, kind bonuses, path relevance, and API intent detection.
 */

import { describe, it, expect } from 'vitest';
import {
  extractSearchTerms,
  scorePathRelevance,
  kindBonus,
  detectApiIntent,
  inferRouteDirectories,
  STOP_WORDS,
} from '../src/search/query-utils';

describe('Search Query Utilities', () => {
  describe('extractSearchTerms', () => {
    it('should extract meaningful terms from a query', () => {
      const terms = extractSearchTerms('find the login handler');
      expect(terms).toContain('login');
      expect(terms).toContain('handler');
      // 'find' and 'the' are stop words
      expect(terms).not.toContain('find');
      expect(terms).not.toContain('the');
    });

    it('should filter stop words', () => {
      const terms = extractSearchTerms('how does the authentication work');
      expect(terms).not.toContain('how');
      expect(terms).not.toContain('does');
      expect(terms).not.toContain('the');
      expect(terms).toContain('authentication');
      expect(terms).toContain('work');
    });

    it('should handle camelCase by lowercasing', () => {
      const terms = extractSearchTerms('UserService');
      expect(terms).toContain('userservice');
    });

    it('should strip punctuation', () => {
      const terms = extractSearchTerms('payment.process()');
      expect(terms).toContain('payment');
      expect(terms).toContain('process');
    });

    it('should return empty for all stop words', () => {
      const terms = extractSearchTerms('how do I get the');
      expect(terms).toHaveLength(0);
    });

    it('should filter single-character terms', () => {
      const terms = extractSearchTerms('a b c auth');
      expect(terms).toEqual(['auth']);
    });
  });

  describe('scorePathRelevance', () => {
    it('should score filename matches highest', () => {
      const score = scorePathRelevance('src/auth/login.ts', 'login');
      expect(score).toBeGreaterThanOrEqual(10);
    });

    it('should score directory matches', () => {
      const score = scorePathRelevance('src/auth/index.ts', 'auth');
      expect(score).toBeGreaterThanOrEqual(5);
    });

    it('should return 0 for unrelated paths', () => {
      const score = scorePathRelevance('src/utils/format.ts', 'payment');
      expect(score).toBe(0);
    });

    it('should accumulate scores for multiple matching terms', () => {
      const score = scorePathRelevance('src/auth/login.ts', 'auth login');
      // Both 'auth' (dir match) and 'login' (filename match)
      expect(score).toBeGreaterThanOrEqual(15);
    });

    it('should return 0 for empty query terms', () => {
      const score = scorePathRelevance('src/auth/login.ts', 'the a an');
      expect(score).toBe(0);
    });
  });

  describe('kindBonus', () => {
    it('should give functions and methods highest bonus', () => {
      expect(kindBonus('function')).toBe(10);
      expect(kindBonus('method')).toBe(10);
    });

    it('should rank functions > classes > variables > imports', () => {
      expect(kindBonus('function')).toBeGreaterThan(kindBonus('class'));
      expect(kindBonus('class')).toBeGreaterThan(kindBonus('variable'));
      expect(kindBonus('variable')).toBeGreaterThan(kindBonus('import'));
    });

    it('should give routes high priority', () => {
      expect(kindBonus('route')).toBeGreaterThanOrEqual(9);
    });

    it('should give components high priority', () => {
      expect(kindBonus('component')).toBeGreaterThanOrEqual(8);
    });

    it('should return 0 for parameter and file kinds', () => {
      expect(kindBonus('parameter')).toBe(0);
      expect(kindBonus('file')).toBe(0);
    });

    it('should return 0 for unknown kinds', () => {
      expect(kindBonus('unknown_kind' as any)).toBe(0);
    });
  });

  describe('detectApiIntent', () => {
    it('should detect API-related queries', () => {
      expect(detectApiIntent('find the API endpoint for users')).toBe(true);
      expect(detectApiIntent('where is the login route')).toBe(true);
      expect(detectApiIntent('show me the request handler')).toBe(true);
    });

    it('should detect HTTP method patterns', () => {
      expect(detectApiIntent('GET /api/users')).toBe(true);
      expect(detectApiIntent('post /users/create')).toBe(true);
    });

    it('should detect REST and GraphQL', () => {
      expect(detectApiIntent('REST API for payments')).toBe(true);
      expect(detectApiIntent('GraphQL resolver for orders')).toBe(true);
    });

    it('should not detect non-API queries', () => {
      expect(detectApiIntent('fix the login bug')).toBe(false);
      expect(detectApiIntent('add dark mode support')).toBe(false);
    });

    it('should detect controller and middleware mentions', () => {
      expect(detectApiIntent('find the auth controller')).toBe(true);
      expect(detectApiIntent('CORS middleware configuration')).toBe(true);
    });
  });

  describe('inferRouteDirectories', () => {
    it('should detect route directories', () => {
      const files = [
        'src/routes/auth.ts',
        'src/routes/users.ts',
        'src/utils/format.ts',
      ];
      const dirs = inferRouteDirectories(files);
      expect(dirs).toBeDefined();
      if (dirs) {
        expect(dirs.some(d => d.includes('route'))).toBe(true);
      }
    });

    it('should detect controller directories', () => {
      const files = [
        'src/controllers/AuthController.ts',
        'src/models/User.ts',
      ];
      const dirs = inferRouteDirectories(files);
      expect(dirs).toBeDefined();
      if (dirs) {
        expect(dirs.some(d => d.includes('controller'))).toBe(true);
      }
    });

    it('should detect api directories', () => {
      const files = [
        'src/api/v1/users.ts',
        'src/api/v1/orders.ts',
      ];
      const dirs = inferRouteDirectories(files);
      expect(dirs).toBeDefined();
      if (dirs) {
        expect(dirs.some(d => d.includes('api'))).toBe(true);
      }
    });

    it('should return undefined when no route dirs found', () => {
      const files = [
        'src/utils/format.ts',
        'src/models/User.ts',
        'src/index.ts',
      ];
      const dirs = inferRouteDirectories(files);
      expect(dirs).toBeUndefined();
    });
  });

  describe('STOP_WORDS', () => {
    it('should contain common English stop words', () => {
      expect(STOP_WORDS.has('the')).toBe(true);
      expect(STOP_WORDS.has('and')).toBe(true);
      expect(STOP_WORDS.has('or')).toBe(true);
    });

    it('should contain action verbs used in queries', () => {
      expect(STOP_WORDS.has('find')).toBe(true);
      expect(STOP_WORDS.has('show')).toBe(true);
      expect(STOP_WORDS.has('get')).toBe(true);
      expect(STOP_WORDS.has('list')).toBe(true);
    });

    it('should not contain technical terms', () => {
      expect(STOP_WORDS.has('function')).toBe(false);
      expect(STOP_WORDS.has('class')).toBe(false);
      expect(STOP_WORDS.has('auth')).toBe(false);
    });
  });
});
