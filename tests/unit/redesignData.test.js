/**
 * Tests for the redesign's pure data selectors (board + wire).
 * The committed fixtures are the cross-repo contract — tests run against them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  joinMomentum,
  storyMatches,
  filterStories,
  sortStories,
  sectionCounts,
  buildBoardModel,
  sparklinePoints,
  rampColor,
  trendLabel,
  ageLabel,
  outletBars,
} from '../../src/redesign/data.js';

const stories = JSON.parse(readFileSync('data/fixtures/stories_v0.3.0.json', 'utf-8'));
const momentum = JSON.parse(readFileSync('data/fixtures/momentum_v0.3.0.json', 'utf-8'));
const joined = joinMomentum(stories, momentum);

describe('joinMomentum', () => {
  it('attaches a momentum entry to every story that has one', () => {
    const withSeries = joined.filter((s) => s.momentum);
    expect(withSeries.length).toBeGreaterThan(0);
    for (const s of withSeries) {
      expect(Array.isArray(s.momentum.series)).toBe(true);
      expect(s.momentum.series.length).toBeGreaterThan(0);
    }
  });

  it('leaves stories without momentum renderable (momentum null)', () => {
    const fake = joinMomentum({ stories: [{ id: 'st_none99' }] }, { stories: {} });
    expect(fake[0].momentum).toBeNull();
  });

  it('preserves backend rank order', () => {
    expect(joined.map((s) => s.id)).toEqual(stories.stories.map((s) => s.id));
  });
});

describe('storyMatches (search contract: headline, article titles, outlets, keywords)', () => {
  const story = {
    headline: 'Google researchers depart as the Pixel 11 event approaches',
    keywords: ['pixel', 'google 2026'],
    outlets: [{ outlet: 'Lifehacker' }, { outlet: 'NYT' }],
    articles: [{ title: 'Four Top Google A.I. Researchers Form New Start-Up', outlet: 'NYT' }],
  };
  it('matches headline substring, case-insensitive', () => {
    expect(storyMatches(story, 'pixel 11')).toBe(true);
    expect(storyMatches(story, 'PIXEL 11')).toBe(true);
  });
  it('matches article titles', () => {
    expect(storyMatches(story, 'start-up')).toBe(true);
  });
  it('matches outlet names', () => {
    expect(storyMatches(story, 'lifehacker')).toBe(true);
  });
  it('matches keywords', () => {
    expect(storyMatches(story, 'google 2026')).toBe(true);
  });
  it('rejects non-matches and accepts empty query', () => {
    expect(storyMatches(story, 'zebra migration')).toBe(false);
    expect(storyMatches(story, '')).toBe(true);
  });
});

describe('filterStories', () => {
  it('section filter keeps only that section', () => {
    const tech = filterStories(joined, { query: '', cat: 'Tech', keyword: null });
    expect(tech.length).toBeGreaterThan(0);
    expect(tech.every((s) => s.section === 'Tech')).toBe(true);
  });
  it('keyword filter keeps only stories carrying the keyword', () => {
    const kw = joined.find((s) => s.keywords.length > 0).keywords[0];
    const filtered = filterStories(joined, { query: '', cat: 'All', keyword: kw });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((s) => s.keywords.includes(kw))).toBe(true);
  });
  it('the deals-and-roundups pill selects kind != story', () => {
    const commerce = filterStories(joined, { query: '', cat: 'Roundups & deals', keyword: null });
    expect(commerce.length).toBeGreaterThan(0);
    expect(commerce.every((s) => s.kind !== 'story')).toBe(true);
  });
  it('All shows everything (nothing is hidden)', () => {
    const all = filterStories(joined, { query: '', cat: 'All', keyword: null });
    expect(all.length).toBe(joined.length);
  });
});

describe('sortStories', () => {
  it('rank preserves backend order', () => {
    const shuffledIn = [...joined];
    expect(sortStories(shuffledIn, 'rank').map((s) => s.id)).toEqual(joined.map((s) => s.id));
  });
  it('outlets sorts by outlet_count desc', () => {
    const out = sortStories(joined, 'outlets').map((s) => s.outlet_count);
    for (let i = 1; i < out.length; i += 1) expect(out[i - 1]).toBeGreaterThanOrEqual(out[i]);
  });
  it('newest sorts by latest_published desc', () => {
    const out = sortStories(joined, 'newest').map((s) => s.latest_published);
    for (let i = 1; i < out.length; i += 1) expect(out[i - 1] >= out[i]).toBe(true);
  });
});

describe('sectionCounts — counts must reflect the CURRENT result set, not the corpus', () => {
  it('with no filters, All equals the corpus size', () => {
    const counts = sectionCounts(joined, { query: '', keyword: null });
    expect(counts.All).toBe(joined.length);
  });
  it('with a narrow query, counts shrink accordingly (the review bug)', () => {
    const story = joined.find((s) => s.kind === 'story');
    const q = story.headline.slice(0, 18);
    const counts = sectionCounts(joined, { query: q, keyword: null });
    const visible = filterStories(joined, { query: q, cat: 'All', keyword: null });
    expect(counts.All).toBe(visible.length);
    expect(counts.All).toBeLessThan(joined.length);
    // each section count equals what that pill would actually show
    for (const [cat, n] of Object.entries(counts)) {
      expect(n).toBe(filterStories(joined, { query: q, cat, keyword: null }).length);
    }
  });
});

describe('buildBoardModel', () => {
  const board = buildBoardModel(joined);
  it('board contains only kind == "story"', () => {
    const everything = [board.lead, ...board.cards, ...board.thinCoverage];
    expect(everything.every((s) => s.kind === 'story')).toBe(true);
  });
  it('lead is the top-ranked story and cards are the next four', () => {
    const newsOnly = joined.filter((s) => s.kind === 'story');
    expect(board.lead.id).toBe(newsOnly[0].id);
    expect(board.cards.map((s) => s.id)).toEqual(newsOnly.slice(1, 5).map((s) => s.id));
  });
  it('barely covered rail holds stories with three outlets or fewer', () => {
    expect(board.thinCoverage.length).toBeGreaterThan(0);
    expect(board.thinCoverage.every((s) => s.outlet_count <= 3)).toBe(true);
  });
  it('mostCovered has ramp colors and widths relative to the lead', () => {
    expect(board.mostCovered.length).toBe(4);
    expect(board.mostCovered[0].pct).toBe(100);
    for (const m of board.mostCovered) {
      expect(m.pct).toBeGreaterThan(0);
      expect(m.color).toMatch(/^#/);
    }
  });
  it('sections list only sections present, with counts', () => {
    for (const { section, count } of board.sections) {
      expect(count).toBe(joined.filter((s) => s.section === section).length);
    }
  });
});

describe('sparklinePoints', () => {
  it('maps a series to points inside the viewbox', () => {
    const pts = sparklinePoints([2, 3, 5, 9, 13, 11, 8], 190, 42);
    const pairs = pts.split(' ').map((p) => p.split(',').map(Number));
    expect(pairs.length).toBe(7);
    for (const [x, y] of pairs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(190);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(42);
    }
  });
  it('a single-point series still renders a visible mark', () => {
    const pts = sparklinePoints([5], 136, 32);
    expect(pts.split(' ').length).toBeGreaterThanOrEqual(2);
  });
});

describe('presentation helpers', () => {
  it('rampColor follows the accent ramp by outlet count', () => {
    expect(rampColor(9)).toBe('#9184d9');
    expect(rampColor(6)).toBe('#796cbf');
    expect(rampColor(2)).toBe('#5d5294');
  });
  it('trendLabel maps the contract vocabulary to UI copy', () => {
    expect(trendLabel('new')).toBe('new today');
    expect(trendLabel('climbing')).toBe('still climbing');
    expect(trendLabel('peaked')).toBe('peaked yesterday');
    expect(trendLabel('cooling')).toBe('cooling off');
    expect(trendLabel('steady')).toBe('steady');
    expect(trendLabel('single day')).toBe('single day');
  });
  it('ageLabel renders sensible relative ages', () => {
    const now = new Date('2026-08-09T18:00:00Z');
    expect(ageLabel('2026-08-09T16:00:00Z', now)).toBe('2h ago');
    expect(ageLabel('2026-08-09T17:59:00Z', now)).toBe('just now');
    expect(ageLabel('2026-08-07T16:00:00Z', now)).toBe('2d ago');
    expect(ageLabel('', now)).toBe('');
  });
  it('outletBars gives top three outlets plus a +N remainder, article-share widths', () => {
    const story = {
      article_count: 10,
      outlets: [
        { outlet: 'BBC', articles: 5 },
        { outlet: 'NYT', articles: 2 },
        { outlet: 'Politico', articles: 1 },
        { outlet: 'Yahoo', articles: 1 },
        { outlet: 'NPR', articles: 1 },
      ],
    };
    const bars = outletBars(story);
    expect(bars.map((b) => b.label)).toEqual(['BBC', 'NYT', 'Politico', '+2']);
    expect(bars.map((b) => b.weight)).toEqual([5, 2, 1, 2]);
    expect(bars[0].color).toBe('#9184d9');
  });
  it('outletBars with three or fewer outlets has no remainder', () => {
    const bars = outletBars({ article_count: 3, outlets: [{ outlet: 'BBC', articles: 3 }] });
    expect(bars.map((b) => b.label)).toEqual(['BBC']);
  });
});
