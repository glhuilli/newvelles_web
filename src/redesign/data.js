/**
 * Pure data selectors for the redesign (board + wire).
 *
 * The contract is stories_v0.3.0.json + momentum_v0.3.0.json, joined on story
 * id. Everything here is a pure function so the selection/filter/sort/count
 * logic — including the filter-counts bug called out in the design review —
 * is unit-testable without a DOM.
 */

export const ACCENT = '#9184d9';
export const RAMP = ['#9184d9', '#5d5294', '#423a6a', '#3f424d'];
export const COMMERCE_CAT = 'Roundups & deals';
const BOARD_CARDS = 4;
const THIN_COVERAGE_MAX_OUTLETS = 3;
const THIN_COVERAGE_ROWS = 4;
const MOST_COVERED_ROWS = 4;

/** Join momentum entries onto stories by id; momentum is null when absent. */
export function joinMomentum(storiesDoc, momentumDoc) {
  const entries = (momentumDoc && momentumDoc.stories) || {};
  return storiesDoc.stories.map((story) => ({
    ...story,
    momentum: entries[story.id] || null,
  }));
}

/** Search contract: story headline, article titles, outlet names, keywords. */
export function storyMatches(story, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    story.headline,
    ...(story.keywords || []),
    ...(story.outlets || []).map((o) => o.outlet),
    ...(story.articles || []).map((a) => `${a.title} ${a.outlet || ''}`),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function inCategory(story, cat) {
  if (cat === 'All') return true;
  if (cat === COMMERCE_CAT) return story.kind !== 'story';
  return story.section === cat;
}

export function filterStories(stories, { query, cat, keyword }) {
  return stories.filter(
    (s) =>
      inCategory(s, cat) &&
      (!keyword || (s.keywords || []).includes(keyword)) &&
      storyMatches(s, query)
  );
}

export function sortStories(stories, sort) {
  if (sort === 'outlets') {
    return [...stories].sort((a, b) => b.outlet_count - a.outlet_count);
  }
  if (sort === 'newest') {
    return [...stories].sort((a, b) =>
      (b.latest_published || '').localeCompare(a.latest_published || '')
    );
  }
  return stories; // 'rank' — the backend order is the ranking
}

/** Pill labels present in the data, in a stable order. */
export function categoryList(stories) {
  const preferred = ['World', 'US politics', 'Markets', 'Tech', 'Science', 'Local', 'General'];
  const present = new Set(stories.map((s) => s.section));
  const sections = preferred.filter((c) => present.has(c));
  for (const s of stories) {
    if (!sections.includes(s.section)) sections.push(s.section);
  }
  return ['All', ...sections, COMMERCE_CAT];
}

/**
 * Counts per pill under the CURRENT query/keyword — each count equals what
 * that pill would show if clicked. Showing "All 23" beside a single visible
 * story was a bug found in the design review.
 */
export function sectionCounts(stories, { query, keyword }) {
  const counts = {};
  for (const cat of categoryList(stories)) {
    counts[cat] = filterStories(stories, { query, cat, keyword }).length;
  }
  return counts;
}

/** The board is a ranked skim of real news: kind == "story" only. */
export function buildBoardModel(stories) {
  const news = stories.filter((s) => s.kind === 'story');
  const lead = news[0] || null;
  const leadOutlets = lead ? lead.outlet_count : 1;
  return {
    lead,
    cards: news.slice(1, 1 + BOARD_CARDS),
    mostCovered: news.slice(0, MOST_COVERED_ROWS).map((s) => ({
      story: s,
      label: (s.keywords && s.keywords[0]) || s.headline,
      pct: Math.max(1, Math.round((s.outlet_count / leadOutlets) * 100)),
      color: rampColor(s.outlet_count),
      ...s,
    })),
    thinCoverage: news
      .filter((s) => s.outlet_count <= THIN_COVERAGE_MAX_OUTLETS)
      .sort((a, b) => (b.latest_published || '').localeCompare(a.latest_published || ''))
      .slice(0, THIN_COVERAGE_ROWS),
    sections: categoryList(stories)
      .filter((c) => c !== 'All' && c !== COMMERCE_CAT)
      .map((section) => ({
        section,
        count: stories.filter((s) => s.section === section).length,
      })),
  };
}

/** Accent-ramp color by outlet count: >=9 accent, >=6 mid, else deep. */
export function rampColor(outletCount) {
  if (outletCount >= 9) return '#9184d9';
  if (outletCount >= 6) return '#796cbf';
  return '#5d5294';
}

/** SVG polyline points for a numeric series inside w x h (4px padding). */
export function sparklinePoints(series, width, height) {
  const values = series && series.length ? series : [0];
  const max = Math.max(1, ...values);
  const pad = 4;
  if (values.length === 1) {
    const y = height - pad - (values[0] / max) * (height - pad * 2);
    return `${pad},${y} ${width - pad},${y}`;
  }
  const step = (width - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - (v / max) * (height - pad * 2);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(' ');
}

/** momentum series -> outlet counts for the sparkline. */
export function momentumSeries(story) {
  if (!story.momentum || !story.momentum.series) return [];
  return story.momentum.series.map((p) => p.outlets);
}

/** Trend vocabulary is a backend contract; this is the display copy. */
const TREND_COPY = {
  new: 'new today',
  climbing: 'still climbing',
  peaked: 'peaked yesterday',
  cooling: 'cooling off',
  steady: 'steady',
  'single day': 'single day',
};
export function trendLabel(trend) {
  return TREND_COPY[trend] || trend || '';
}

/** Relative age for a published ISO timestamp. */
export function ageLabel(publishedIso, now = new Date()) {
  if (!publishedIso) return '';
  const then = new Date(publishedIso);
  if (Number.isNaN(then.getTime())) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 60) return minutes < 5 ? 'just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Stacked source bar: top three outlets by articles plus a "+N" remainder. */
export function outletBars(story) {
  const outlets = story.outlets || [];
  const top = outlets.slice(0, 3).map((o, i) => ({
    label: o.outlet,
    weight: o.articles,
    color: RAMP[i],
  }));
  const rest = outlets.slice(3);
  if (rest.length > 0) {
    top.push({
      label: `+${rest.length}`,
      weight: rest.reduce((sum, o) => sum + o.articles, 0),
      color: RAMP[3],
    });
  }
  return top;
}

/** Meta line for a wire row: "N outlets · N articles · running N days · Nh ago". */
export function storyMeta(story, now = new Date()) {
  const days = story.days_running || 1;
  const parts = [
    `${story.outlet_count} ${story.outlet_count === 1 ? 'outlet' : 'outlets'}`,
    `${story.article_count} ${story.article_count === 1 ? 'article' : 'articles'}`,
    days === 1 ? 'new today' : `running ${days} days`,
  ];
  const age = ageLabel(story.latest_published, now);
  if (age) parts.push(age);
  return parts.join(' · ');
}
