import { describe, it, expect } from 'vitest';
import { calculateScore, rankGroupings, rankSubGroupings, TAG_WEIGHT, SUBGROUPING_WEIGHT, ARTICLE_WEIGHT } from '../../src/data/rankGroupings.js';

describe('rankGroupings', () => {
  describe('calculateScore', () => {
    it('should calculate correct score with all components', () => {
      const grouping = {
        tags: ['Tag A', 'Tag B', 'Tag C', 'Tag D'], // 4 tags
        subGroupings: [
          { articles: [{}, {}, {}, {}] }, // 4 articles
          { articles: [{}, {}, {}, {}] }, // 4 articles
          { articles: [{}, {}, {}, {}] }, // 4 articles
          { articles: [{}, {}, {}, {}] }, // 4 articles
          { articles: [{}, {}, {}, {}] }  // 4 articles
        ] // 5 sub-groupings
      };

      // Expected: (4 * 3) + (5 * 2) + (20 * 1) = 12 + 10 + 20 = 42
      expect(calculateScore(grouping)).toBe(42);
    });

    it('should handle grouping with no tags', () => {
      const grouping = {
        tags: [],
        subGroupings: [
          { articles: [{}, {}] }
        ]
      };

      // Expected: (0 * 3) + (1 * 2) + (2 * 1) = 0 + 2 + 2 = 4
      expect(calculateScore(grouping)).toBe(4);
    });

    it('should handle grouping with no sub-groupings', () => {
      const grouping = {
        tags: ['Tag A', 'Tag B'],
        subGroupings: []
      };

      // Expected: (2 * 3) + (0 * 2) + (0 * 1) = 6 + 0 + 0 = 6
      expect(calculateScore(grouping)).toBe(6);
    });

    it('should handle grouping with no articles', () => {
      const grouping = {
        tags: ['Tag A'],
        subGroupings: [
          { articles: [] },
          { articles: [] }
        ]
      };

      // Expected: (1 * 3) + (2 * 2) + (0 * 1) = 3 + 4 + 0 = 7
      expect(calculateScore(grouping)).toBe(7);
    });

    it('should return 0 for empty grouping', () => {
      const grouping = {
        tags: [],
        subGroupings: []
      };

      expect(calculateScore(grouping)).toBe(0);
    });

    it('should handle missing properties gracefully', () => {
      const grouping = {};
      expect(calculateScore(grouping)).toBe(0);
    });

    it('should use correct weights', () => {
      expect(TAG_WEIGHT).toBe(3);
      expect(SUBGROUPING_WEIGHT).toBe(2);
      expect(ARTICLE_WEIGHT).toBe(1);
    });
  });

  describe('rankGroupings', () => {
    it('should rank grouping with higher score first', () => {
      const groupingLow = {
        id: 'low',
        rawLabel: '[Tag A]',
        tags: ['Tag A'],
        subGroupings: [
          { articles: [{}, {}] }
        ]
      };
      // Score: (1 * 3) + (1 * 2) + (2 * 1) = 7

      const groupingHigh = {
        id: 'high',
        rawLabel: '[Tag A] [Tag B] [Tag C] [Tag D]',
        tags: ['Tag A', 'Tag B', 'Tag C', 'Tag D'],
        subGroupings: [
          { articles: [{}, {}, {}, {}] },
          { articles: [{}, {}, {}, {}] },
          { articles: [{}, {}, {}, {}] },
          { articles: [{}, {}, {}, {}] },
          { articles: [{}, {}, {}, {}] }
        ]
      };
      // Score: (4 * 3) + (5 * 2) + (20 * 1) = 42

      const result = rankGroupings([groupingLow, groupingHigh]);

      expect(result[0].id).toBe('high');
      expect(result[1].id).toBe('low');
    });

    it('should break ties alphabetically by rawLabel', () => {
      const groupingB = {
        id: 'b',
        rawLabel: '[Beta]',
        tags: ['Beta'],
        subGroupings: [
          { articles: [{}, {}] }
        ]
      };

      const groupingA = {
        id: 'a',
        rawLabel: '[Alpha]',
        tags: ['Alpha'],
        subGroupings: [
          { articles: [{}, {}] }
        ]
      };

      // Both have same score: (1 * 3) + (1 * 2) + (2 * 1) = 7
      const result = rankGroupings([groupingB, groupingA]);

      // Alphabetically: Alpha comes before Beta
      expect(result[0].rawLabel).toBe('[Alpha]');
      expect(result[1].rawLabel).toBe('[Beta]');
    });

    it('should handle empty string grouping (score 0, should appear last)', () => {
      const emptyGrouping = {
        id: 'empty',
        rawLabel: '',
        tags: [],
        subGroupings: []
      };

      const regularGrouping = {
        id: 'regular',
        rawLabel: '[News]',
        tags: ['News'],
        subGroupings: [
          { articles: [{}] }
        ]
      };

      const result = rankGroupings([emptyGrouping, regularGrouping]);

      expect(result[0].id).toBe('regular');
      expect(result[1].id).toBe('empty');
    });

    it('should not mutate input array', () => {
      const grouping1 = {
        id: '1',
        rawLabel: '[A]',
        tags: ['A'],
        subGroupings: []
      };

      const grouping2 = {
        id: '2',
        rawLabel: '[B]',
        tags: ['B', 'C'],
        subGroupings: []
      };

      const input = [grouping1, grouping2];
      const inputCopy = [...input];

      rankGroupings(input);

      // Input array should remain unchanged
      expect(input).toEqual(inputCopy);
      expect(input[0].id).toBe('1');
      expect(input[1].id).toBe('2');
    });

    it('should return empty array for non-array input', () => {
      expect(rankGroupings(null)).toEqual([]);
      expect(rankGroupings(undefined)).toEqual([]);
      expect(rankGroupings('string')).toEqual([]);
      expect(rankGroupings(123)).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = rankGroupings([]);
      expect(result).toEqual([]);
    });

    it('should handle single grouping', () => {
      const grouping = {
        id: 'only',
        rawLabel: '[Solo]',
        tags: ['Solo'],
        subGroupings: [
          { articles: [{}] }
        ]
      };

      const result = rankGroupings([grouping]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('only');
    });

    it('should sort multiple groupings correctly', () => {
      const groupings = [
        {
          id: 'medium',
          rawLabel: '[Medium]',
          tags: ['Medium', 'News'],
          subGroupings: [
            { articles: [{}, {}] },
            { articles: [{}] }
          ]
        }, // Score: (2*3) + (2*2) + (3*1) = 13
        {
          id: 'low',
          rawLabel: '[Low]',
          tags: ['Low'],
          subGroupings: [
            { articles: [{}] }
          ]
        }, // Score: (1*3) + (1*2) + (1*1) = 6
        {
          id: 'high',
          rawLabel: '[High]',
          tags: ['High', 'Important', 'Breaking'],
          subGroupings: [
            { articles: [{}, {}, {}] },
            { articles: [{}, {}] },
            { articles: [{}] }
          ]
        } // Score: (3*3) + (3*2) + (6*1) = 21
      ];

      const result = rankGroupings(groupings);

      expect(result[0].id).toBe('high');
      expect(result[1].id).toBe('medium');
      expect(result[2].id).toBe('low');
    });

    it('should handle multiple ties with alphabetical sorting', () => {
      const groupings = [
        {
          id: '1',
          rawLabel: '[Zebra]',
          tags: ['Zebra'],
          subGroupings: [{ articles: [{}] }]
        },
        {
          id: '2',
          rawLabel: '[Apple]',
          tags: ['Apple'],
          subGroupings: [{ articles: [{}] }]
        },
        {
          id: '3',
          rawLabel: '[Mango]',
          tags: ['Mango'],
          subGroupings: [{ articles: [{}] }]
        }
      ];
      // All have same score: (1*3) + (1*2) + (1*1) = 6

      const result = rankGroupings(groupings);

      expect(result[0].rawLabel).toBe('[Apple]');
      expect(result[1].rawLabel).toBe('[Mango]');
      expect(result[2].rawLabel).toBe('[Zebra]');
    });

    it('should maintain correct relative order after filtering and ranking', () => {
      // Simulate filtered results
      const filteredGroupings = [
        {
          id: '1',
          rawLabel: '[Technology AI]',
          tags: ['Technology', 'AI'],
          subGroupings: [
            { articles: [{}] }
          ]
        }, // Score: (2*3) + (1*2) + (1*1) = 9
        {
          id: '2',
          rawLabel: '[Technology]',
          tags: ['Technology'],
          subGroupings: [
            { articles: [{}, {}, {}] },
            { articles: [{}, {}] }
          ]
        }, // Score: (1*3) + (2*2) + (5*1) = 12
        {
          id: '3',
          rawLabel: '[Tech News Innovation]',
          tags: ['Tech', 'News', 'Innovation'],
          subGroupings: [
            { articles: [{}] }
          ]
        } // Score: (3*3) + (1*2) + (1*1) = 12
      ];

      const result = rankGroupings(filteredGroupings);

      // First should be highest score (12), tied items sorted alphabetically
      expect(result[0].rawLabel).toBe('[Tech News Innovation]');
      expect(result[1].rawLabel).toBe('[Technology]');
      expect(result[2].rawLabel).toBe('[Technology AI]');
    });
  });

  describe('rankSubGroupings', () => {
    it('should rank sub-grouping with more articles first', () => {
      const subGroupings = [
        {
          id: 'sub-1',
          rawLabel: '[Sub A]',
          tags: ['Sub A'],
          articles: [{}, {}] // 2 articles
        },
        {
          id: 'sub-2',
          rawLabel: '[Sub B]',
          tags: ['Sub B'],
          articles: [{}, {}, {}, {}, {}] // 5 articles
        },
        {
          id: 'sub-3',
          rawLabel: '[Sub C]',
          tags: ['Sub C'],
          articles: [{}] // 1 article
        }
      ];

      const result = rankSubGroupings(subGroupings);

      expect(result[0].id).toBe('sub-2'); // 5 articles
      expect(result[1].id).toBe('sub-1'); // 2 articles
      expect(result[2].id).toBe('sub-3'); // 1 article
    });

    it('should break ties alphabetically by rawLabel', () => {
      const subGroupings = [
        {
          id: 'sub-1',
          rawLabel: '[Zebra]',
          tags: ['Zebra'],
          articles: [{}, {}]
        },
        {
          id: 'sub-2',
          rawLabel: '[Apple]',
          tags: ['Apple'],
          articles: [{}, {}]
        },
        {
          id: 'sub-3',
          rawLabel: '[Mango]',
          tags: ['Mango'],
          articles: [{}, {}]
        }
      ];

      const result = rankSubGroupings(subGroupings);

      expect(result[0].rawLabel).toBe('[Apple]');
      expect(result[1].rawLabel).toBe('[Mango]');
      expect(result[2].rawLabel).toBe('[Zebra]');
    });

    it('should handle sub-groupings with no articles', () => {
      const subGroupings = [
        {
          id: 'sub-1',
          rawLabel: '[Empty]',
          tags: ['Empty'],
          articles: []
        },
        {
          id: 'sub-2',
          rawLabel: '[Has Articles]',
          tags: ['Has Articles'],
          articles: [{}]
        }
      ];

      const result = rankSubGroupings(subGroupings);

      expect(result[0].id).toBe('sub-2');
      expect(result[1].id).toBe('sub-1');
    });

    it('should not mutate input array', () => {
      const subGroupings = [
        {
          id: 'sub-1',
          rawLabel: '[A]',
          tags: ['A'],
          articles: [{}]
        },
        {
          id: 'sub-2',
          rawLabel: '[B]',
          tags: ['B'],
          articles: [{}, {}]
        }
      ];

      const inputCopy = [...subGroupings];
      rankSubGroupings(subGroupings);

      expect(subGroupings).toEqual(inputCopy);
      expect(subGroupings[0].id).toBe('sub-1');
      expect(subGroupings[1].id).toBe('sub-2');
    });

    it('should return empty array for non-array input', () => {
      expect(rankSubGroupings(null)).toEqual([]);
      expect(rankSubGroupings(undefined)).toEqual([]);
      expect(rankSubGroupings('string')).toEqual([]);
      expect(rankSubGroupings(123)).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = rankSubGroupings([]);
      expect(result).toEqual([]);
    });

    it('should handle single sub-grouping', () => {
      const subGroupings = [
        {
          id: 'only',
          rawLabel: '[Solo]',
          tags: ['Solo'],
          articles: [{}]
        }
      ];

      const result = rankSubGroupings(subGroupings);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('only');
    });

    it('should handle missing articles property', () => {
      const subGroupings = [
        {
          id: 'sub-1',
          rawLabel: '[No Articles Prop]',
          tags: ['No Articles Prop']
        },
        {
          id: 'sub-2',
          rawLabel: '[Has Articles]',
          tags: ['Has Articles'],
          articles: [{}, {}]
        }
      ];

      const result = rankSubGroupings(subGroupings);

      expect(result[0].id).toBe('sub-2'); // 2 articles
      expect(result[1].id).toBe('sub-1'); // 0 articles (missing property)
    });

    it('should sort complex real-world example', () => {
      const subGroupings = [
        {
          id: 'sub-1',
          rawLabel: '[Trump Iran war]',
          tags: ['Trump', 'Iran', 'war'],
          articles: [{}, {}, {}] // 3 articles
        },
        {
          id: 'sub-2',
          rawLabel: '[Oil Prices Surge]',
          tags: ['Oil', 'Prices', 'Surge'],
          articles: [{}, {}, {}, {}, {}, {}, {}] // 7 articles
        },
        {
          id: 'sub-3',
          rawLabel: '[Middle East Tensions]',
          tags: ['Middle East', 'Tensions'],
          articles: [{}, {}, {}, {}, {}] // 5 articles
        },
        {
          id: 'sub-4',
          rawLabel: '[Diplomatic Response]',
          tags: ['Diplomatic', 'Response'],
          articles: [{}, {}] // 2 articles
        }
      ];

      const result = rankSubGroupings(subGroupings);

      expect(result[0].id).toBe('sub-2'); // 7 articles
      expect(result[1].id).toBe('sub-3'); // 5 articles
      expect(result[2].id).toBe('sub-1'); // 3 articles
      expect(result[3].id).toBe('sub-4'); // 2 articles
    });
  });
});
