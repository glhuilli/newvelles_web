import { describe, it, expect, beforeEach } from 'vitest';
import sampleNews from '../fixtures/sample_news.json';

// Import the rendering logic from main.js
// For now, we'll test the basic JSON structure rendering
describe('News Renderer Integration', () => {
  let container;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    container.id = 'show-news';
    document.body.appendChild(container);
  });

  it('should parse sample news JSON without errors', () => {
    expect(() => {
      const newsData = sampleNews;
      expect(newsData).toBeDefined();
      expect(typeof newsData).toBe('object');
    }).not.toThrow();
  });

  it('should have top-level groupings', () => {
    const groupings = Object.keys(sampleNews);
    expect(groupings.length).toBeGreaterThan(0);
  });

  it('should include empty string grouping', () => {
    const groupings = Object.keys(sampleNews);
    expect(groupings).toContain('');
  });

  it('should include single-tag grouping', () => {
    const groupings = Object.keys(sampleNews);
    expect(groupings).toContain('[Technology]');
  });

  it('should include multi-tag groupings', () => {
    const groupings = Object.keys(sampleNews);
    expect(groupings.some(g => g.includes('[Politics]') && g.includes('[Elections]'))).toBe(true);
  });

  it('should have three-level structure', () => {
    // Level 1: Groupings
    const groupings = Object.keys(sampleNews);
    expect(groupings.length).toBeGreaterThan(0);

    // Level 2: Sub-groupings
    const firstGrouping = sampleNews[groupings[1]]; // Skip empty string
    const subGroupings = Object.keys(firstGrouping);
    expect(subGroupings.length).toBeGreaterThan(0);

    // Level 3: Articles
    const firstSubGrouping = firstGrouping[subGroupings[0]];
    const articles = Object.keys(firstSubGrouping);
    expect(articles.length).toBeGreaterThan(0);

    // Verify article has expected properties
    const firstArticle = firstSubGrouping[articles[0]];
    expect(firstArticle).toHaveProperty('title');
    expect(firstArticle).toHaveProperty('link');
    expect(firstArticle).toHaveProperty('timestamp');
    expect(firstArticle).toHaveProperty('source');
  });

  it('should have articles with valid URLs', () => {
    const techGroup = sampleNews['[Technology]'];
    const aiSubGroup = techGroup['[AI Developments]'];
    const firstArticle = Object.values(aiSubGroup)[0];

    expect(firstArticle.link).toMatch(/^https?:\/\//);
  });

  it('should have article title match the JSON key', () => {
    const techGroup = sampleNews['[Technology]'];
    const aiSubGroup = techGroup['[AI Developments]'];
    const articleKey = Object.keys(aiSubGroup)[0];
    const article = aiSubGroup[articleKey];

    // The title field should match the key
    expect(article.title).toBe(articleKey);
  });
});
