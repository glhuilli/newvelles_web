import { describe, it, expect, beforeEach } from 'vitest';
import { filterGroupings, getMatchStats, filterByMultipleQueries, getMatchingArticles } from '../../src/data/searchFilter.js';
import { parseNewsData } from '../../src/data/newsStore.js';
import sampleNews from '../fixtures/sample_news.json';

describe('searchFilter', () => {
  let groupings;

  beforeEach(() => {
    groupings = parseNewsData(sampleNews);
  });

  describe('filterGroupings', () => {
    it('should return all groupings for empty query', () => {
      const result = filterGroupings(groupings, '');
      expect(result.length).toBe(groupings.length);
    });

    it('should return all groupings for whitespace-only query', () => {
      const result = filterGroupings(groupings, '   ');
      expect(result.length).toBe(groupings.length);
    });

    it('should return all groupings for null query', () => {
      const result = filterGroupings(groupings, null);
      expect(result.length).toBe(groupings.length);
    });

    it('should return all groupings for undefined query', () => {
      const result = filterGroupings(groupings, undefined);
      expect(result.length).toBe(groupings.length);
    });

    it('should filter by grouping tag (case insensitive)', () => {
      const result = filterGroupings(groupings, 'technology');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(g => g.tags.some(t => t.toLowerCase().includes('technology')))).toBe(true);
    });

    it('should filter by grouping tag (exact case)', () => {
      const result = filterGroupings(groupings, 'Technology');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by partial tag match', () => {
      const result = filterGroupings(groupings, 'tech');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(g => g.tags.some(t => t.toLowerCase().includes('tech')))).toBe(true);
    });

    it('should filter by sub-grouping tag', () => {
      const result = filterGroupings(groupings, 'AI');
      expect(result.length).toBeGreaterThan(0);

      // Verify the match is in sub-grouping tags
      const hasMatch = result.some(g =>
        g.subGroupings.some(sg =>
          sg.tags.some(t => t.toLowerCase().includes('ai'))
        )
      );
      expect(hasMatch).toBe(true);
    });

    it('should filter by article title', () => {
      const result = filterGroupings(groupings, 'breakthrough');
      expect(result.length).toBeGreaterThan(0);

      // Verify the match is in article titles
      const hasMatch = result.some(g =>
        g.subGroupings.some(sg =>
          sg.articles.some(a => a.title.toLowerCase().includes('breakthrough'))
        )
      );
      expect(hasMatch).toBe(true);
    });

    it('should filter by partial article title', () => {
      const result = filterGroupings(groupings, 'security');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-matching query', () => {
      const result = filterGroupings(groupings, 'xyz123nonexistent');
      expect(result.length).toBe(0);
    });

    it('should be case-insensitive', () => {
      const result1 = filterGroupings(groupings, 'TECHNOLOGY');
      const result2 = filterGroupings(groupings, 'technology');
      const result3 = filterGroupings(groupings, 'TeCHNoLoGy');

      expect(result1.length).toBe(result2.length);
      expect(result2.length).toBe(result3.length);
    });

    it('should handle multi-word queries', () => {
      const result = filterGroupings(groupings, 'climate change');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should progressively filter as query lengthens', () => {
      const result1 = filterGroupings(groupings, 't');
      const result2 = filterGroupings(groupings, 'te');
      const result3 = filterGroupings(groupings, 'tech');

      // More specific queries should return same or fewer results
      expect(result2.length).toBeLessThanOrEqual(result1.length);
      expect(result3.length).toBeLessThanOrEqual(result2.length);
    });

    it('should handle query with extra whitespace', () => {
      const result1 = filterGroupings(groupings, 'technology');
      const result2 = filterGroupings(groupings, '  technology  ');

      expect(result1.length).toBe(result2.length);
    });

    it('should return empty array for non-array input', () => {
      const result = filterGroupings(null, 'test');
      expect(result).toEqual([]);
    });

    it('should match on raw label even if tags are empty', () => {
      // The empty string grouping has no tags but has a raw label
      const result = filterGroupings(groupings, 'uncategorized');

      // Should find the grouping with "Uncategorized News" sub-grouping
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getMatchStats', () => {
    it('should return correct stats for empty query', () => {
      const stats = getMatchStats(groupings, '');

      expect(stats.totalGroupings).toBe(groupings.length);
      expect(stats.matchedGroupings).toBe(groupings.length);
      expect(stats.hasFilter).toBe(false);
    });

    it('should return correct stats for active query', () => {
      const stats = getMatchStats(groupings, 'technology');

      expect(stats.totalGroupings).toBe(groupings.length);
      expect(stats.matchedGroupings).toBeGreaterThan(0);
      expect(stats.matchedGroupings).toBeLessThanOrEqual(stats.totalGroupings);
      expect(stats.hasFilter).toBe(true);
    });

    it('should return zero matches for non-matching query', () => {
      const stats = getMatchStats(groupings, 'xyz123nonexistent');

      expect(stats.totalGroupings).toBe(groupings.length);
      expect(stats.matchedGroupings).toBe(0);
      expect(stats.hasFilter).toBe(true);
    });

    it('should indicate no filter for whitespace query', () => {
      const stats = getMatchStats(groupings, '   ');

      expect(stats.hasFilter).toBe(false);
    });
  });

  describe('filterByMultipleQueries', () => {
    it('should return all groupings for empty queries array', () => {
      const result = filterByMultipleQueries(groupings, []);
      expect(result.length).toBe(groupings.length);
    });

    it('should filter with single query', () => {
      const result = filterByMultipleQueries(groupings, ['technology']);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(groupings.length);
    });

    it('should filter with multiple queries (AND logic)', () => {
      const result = filterByMultipleQueries(groupings, ['climate', 'warming']);

      // Should only return groupings that match BOTH queries
      expect(result.length).toBeGreaterThan(0);

      result.forEach(grouping => {
        const matchesClimate = filterGroupings([grouping], 'climate').length > 0;
        const matchesWarming = filterGroupings([grouping], 'warming').length > 0;
        expect(matchesClimate && matchesWarming).toBe(true);
      });
    });

    it('should return fewer results with more queries', () => {
      const result1 = filterByMultipleQueries(groupings, ['climate']);
      const result2 = filterByMultipleQueries(groupings, ['climate', 'environment']);

      expect(result2.length).toBeLessThanOrEqual(result1.length);
    });

    it('should ignore empty string queries', () => {
      const result1 = filterByMultipleQueries(groupings, ['technology']);
      const result2 = filterByMultipleQueries(groupings, ['technology', '', '  ']);

      expect(result1.length).toBe(result2.length);
    });

    it('should return all groupings if all queries are empty', () => {
      const result = filterByMultipleQueries(groupings, ['', '  ', null]);
      expect(result.length).toBe(groupings.length);
    });

    it('should handle non-array queries parameter', () => {
      const result = filterByMultipleQueries(groupings, null);
      expect(result.length).toBe(groupings.length);
    });

    it('should handle non-array groupings parameter', () => {
      const result = filterByMultipleQueries(null, ['test']);
      expect(result).toBeNull();
    });
  });

  describe('getMatchingArticles', () => {
    it('should return empty array for empty query', () => {
      const grouping = groupings[0];
      const result = getMatchingArticles(grouping, '');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace query', () => {
      const grouping = groupings[0];
      const result = getMatchingArticles(grouping, '   ');
      expect(result).toEqual([]);
    });

    it('should return matching articles from all sub-groupings', () => {
      // Find a grouping with multiple sub-groupings
      const techGrouping = groupings.find(g => g.tags.includes('Technology'));
      const result = getMatchingArticles(techGrouping, 'new');

      expect(result.length).toBeGreaterThan(0);
      result.forEach(article => {
        expect(article.title.toLowerCase()).toContain('new');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('link');
      });
    });

    it('should be case-insensitive', () => {
      const techGrouping = groupings.find(g => g.tags.includes('Technology'));
      const result1 = getMatchingArticles(techGrouping, 'NEW');
      const result2 = getMatchingArticles(techGrouping, 'new');

      expect(result1.length).toBe(result2.length);
    });

    it('should return articles from multiple sub-groupings', () => {
      // Assuming first grouping has articles with common words
      const grouping = groupings[0];
      const result = getMatchingArticles(grouping, 'new');

      // Should find articles across sub-groupings if they contain 'new'
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle grouping with no matching articles', () => {
      const grouping = groupings[0];
      const result = getMatchingArticles(grouping, 'xyzabc123nonexistent');

      expect(result).toEqual([]);
    });
  });
});
