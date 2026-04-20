import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseNewsData,
  initializeStore,
  getAllGroupings,
  getSubGroupings,
  getGrouping,
  getArticles,
  getSubGrouping,
  getTotalArticleCount,
  getGroupingArticleCount
} from '../../src/data/newsStore.js';
import sampleNews from '../fixtures/sample_news.json';

describe('newsStore', () => {
  describe('parseNewsData', () => {
    it('should parse raw JSON into structured groupings array', () => {
      const groupings = parseNewsData(sampleNews);

      expect(Array.isArray(groupings)).toBe(true);
      expect(groupings.length).toBeGreaterThan(0);
    });

    it('should assign unique IDs to groupings', () => {
      const groupings = parseNewsData(sampleNews);

      const ids = groupings.map(g => g.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should parse tags from grouping labels', () => {
      const groupings = parseNewsData(sampleNews);

      const techGrouping = groupings.find(g => g.rawLabel === '[Technology]');
      expect(techGrouping).toBeDefined();
      expect(techGrouping.tags).toEqual(['Technology']);
    });

    it('should parse multi-tag grouping labels', () => {
      const groupings = parseNewsData(sampleNews);

      const politicsGrouping = groupings.find(g => g.rawLabel.includes('[Politics]'));
      expect(politicsGrouping).toBeDefined();
      expect(politicsGrouping.tags).toContain('Politics');
      expect(politicsGrouping.tags).toContain('Elections');
    });

    it('should handle empty string grouping label', () => {
      const groupings = parseNewsData(sampleNews);

      const emptyGrouping = groupings.find(g => g.rawLabel === '');
      expect(emptyGrouping).toBeDefined();
      expect(emptyGrouping.tags).toEqual([]);
    });

    it('should create sub-groupings with correct structure', () => {
      const groupings = parseNewsData(sampleNews);

      const firstGrouping = groupings[1]; // Skip empty string
      expect(firstGrouping.subGroupings).toBeDefined();
      expect(Array.isArray(firstGrouping.subGroupings)).toBe(true);

      const firstSub = firstGrouping.subGroupings[0];
      expect(firstSub).toHaveProperty('id');
      expect(firstSub).toHaveProperty('rawLabel');
      expect(firstSub).toHaveProperty('tags');
      expect(firstSub).toHaveProperty('articles');
    });

    it('should assign hierarchical IDs to sub-groupings', () => {
      const groupings = parseNewsData(sampleNews);

      const firstGrouping = groupings[0];
      const firstSub = firstGrouping.subGroupings[0];

      expect(firstSub.id).toMatch(/^grouping-\d+-sub-\d+$/);
      expect(firstSub.id).toContain(firstGrouping.id);
    });

    it('should parse articles with correct properties', () => {
      const groupings = parseNewsData(sampleNews);

      const firstGrouping = groupings.find(g => g.rawLabel === '[Technology]');
      const firstSub = firstGrouping.subGroupings[0];
      const firstArticle = firstSub.articles[0];

      expect(firstArticle).toHaveProperty('title');
      expect(firstArticle).toHaveProperty('link');
      expect(firstArticle).toHaveProperty('timestamp');
      expect(firstArticle).toHaveProperty('source');
    });

    it('should use JSON key as article title, not title field', () => {
      const rawData = {
        '[Test]': {
          '[Sub]': {
            'Article Title Here': {
              title: 'Article Title Here',
              link: 'https://example.com',
              timestamp: 'Wed, 11 Mar 2026 09:44:07 +0000',
              source: 'https://rss.example.com'
            }
          }
        }
      };

      const groupings = parseNewsData(rawData);
      const article = groupings[0].subGroupings[0].articles[0];

      expect(article.title).toBe('Article Title Here');
    });

    it('should parse timestamp as Date object', () => {
      const groupings = parseNewsData(sampleNews);

      const firstGrouping = groupings.find(g => g.rawLabel === '[Technology]');
      const firstSub = firstGrouping.subGroupings[0];
      const firstArticle = firstSub.articles[0];

      expect(firstArticle.timestamp).toBeInstanceOf(Date);
      expect(firstArticle.timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('Store accessor functions', () => {
    beforeEach(() => {
      // Initialize store before each test
      initializeStore(sampleNews);
    });

    describe('getAllGroupings', () => {
      it('should return all groupings', () => {
        const groupings = getAllGroupings();

        expect(Array.isArray(groupings)).toBe(true);
        expect(groupings.length).toBeGreaterThan(0);
      });

      it('should return groupings with correct structure', () => {
        const groupings = getAllGroupings();
        const firstGrouping = groupings[0];

        expect(firstGrouping).toHaveProperty('id');
        expect(firstGrouping).toHaveProperty('rawLabel');
        expect(firstGrouping).toHaveProperty('tags');
        expect(firstGrouping).toHaveProperty('subGroupings');
      });
    });

    describe('getGrouping', () => {
      it('should return a grouping by ID', () => {
        const groupings = getAllGroupings();
        const firstId = groupings[0].id;

        const grouping = getGrouping(firstId);
        expect(grouping).toBeDefined();
        expect(grouping.id).toBe(firstId);
      });

      it('should return null for non-existent ID', () => {
        const grouping = getGrouping('non-existent-id');
        expect(grouping).toBeNull();
      });
    });

    describe('getSubGroupings', () => {
      it('should return sub-groupings for a valid grouping ID', () => {
        const groupings = getAllGroupings();
        const firstId = groupings[1].id; // Skip empty string grouping

        const subGroupings = getSubGroupings(firstId);
        expect(Array.isArray(subGroupings)).toBe(true);
        expect(subGroupings.length).toBeGreaterThan(0);
      });

      it('should return null for non-existent grouping ID', () => {
        const subGroupings = getSubGroupings('non-existent-id');
        expect(subGroupings).toBeNull();
      });
    });

    describe('getSubGrouping', () => {
      it('should return a sub-grouping by ID', () => {
        const groupings = getAllGroupings();
        const firstGrouping = groupings[1];
        const firstSubId = firstGrouping.subGroupings[0].id;

        const subGrouping = getSubGrouping(firstSubId);
        expect(subGrouping).toBeDefined();
        expect(subGrouping.id).toBe(firstSubId);
      });

      it('should return null for invalid ID format', () => {
        const subGrouping = getSubGrouping('invalid-format');
        expect(subGrouping).toBeNull();
      });

      it('should return null for non-existent sub-grouping', () => {
        const subGrouping = getSubGrouping('grouping-999-sub-999');
        expect(subGrouping).toBeNull();
      });
    });

    describe('getArticles', () => {
      it('should return articles for a valid sub-grouping ID', () => {
        const groupings = getAllGroupings();
        const firstGrouping = groupings[1];
        const firstSubId = firstGrouping.subGroupings[0].id;

        const articles = getArticles(firstSubId);
        expect(Array.isArray(articles)).toBe(true);
        expect(articles.length).toBeGreaterThan(0);
      });

      it('should return null for invalid ID format', () => {
        const articles = getArticles('invalid-format');
        expect(articles).toBeNull();
      });

      it('should return null for non-existent sub-grouping', () => {
        const articles = getArticles('grouping-999-sub-999');
        expect(articles).toBeNull();
      });
    });

    describe('getTotalArticleCount', () => {
      it('should return total article count across all groupings', () => {
        const count = getTotalArticleCount();
        expect(count).toBeGreaterThan(0);
        expect(typeof count).toBe('number');
      });

      it('should match manual count', () => {
        const groupings = getAllGroupings();
        let manualCount = 0;

        groupings.forEach(grouping => {
          grouping.subGroupings.forEach(subGrouping => {
            manualCount += subGrouping.articles.length;
          });
        });

        expect(getTotalArticleCount()).toBe(manualCount);
      });
    });

    describe('getGroupingArticleCount', () => {
      it('should return article count for a specific grouping', () => {
        const groupings = getAllGroupings();
        const firstGrouping = groupings[1];

        const count = getGroupingArticleCount(firstGrouping.id);
        expect(count).toBeGreaterThan(0);
        expect(typeof count).toBe('number');
      });

      it('should return 0 for non-existent grouping', () => {
        const count = getGroupingArticleCount('non-existent-id');
        expect(count).toBe(0);
      });

      it('should match manual count for a grouping', () => {
        const groupings = getAllGroupings();
        const firstGrouping = groupings[1];

        let manualCount = 0;
        firstGrouping.subGroupings.forEach(subGrouping => {
          manualCount += subGrouping.articles.length;
        });

        expect(getGroupingArticleCount(firstGrouping.id)).toBe(manualCount);
      });
    });
  });
});
