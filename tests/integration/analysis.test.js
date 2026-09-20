/**
 * Integration: the Analysis view against the trimmed fixture in jsdom.
 * Panel-specific assertions are appended by the panel tasks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { joinMomentum } from '../../src/redesign/data.js';
import { attachHandlers, render } from '../../src/redesign/render.js';
import { getState, setState, subscribe } from '../../src/redesign/state.js';
import { configureAnalysis, resetAnalysisCache } from '../../src/redesign/analysis/loader.js';

const storiesDoc = JSON.parse(readFileSync('data/fixtures/stories_v0.3.0.json', 'utf-8'));
const momentumDoc = JSON.parse(readFileSync('data/fixtures/momentum_v0.3.0.json', 'utf-8'));
const data = { doc: storiesDoc, stories: joinMomentum(storiesDoc, momentumDoc) };
const index = JSON.parse(readFileSync('data/fixtures/analysis/index.json', 'utf-8'));
const payload = JSON.parse(readFileSync('data/fixtures/analysis/entries/five-years/payload.json', 'utf-8'));
const entry = index.entries[0];

let container;
let failIndex = false;
let unsubscribe = null;

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  container = document.getElementById('app');
  attachHandlers(container);
  // Keep the unsubscribe: a leaked listener re-renders (and remounts the D3
  // timeline) once per earlier test on every state change.
  unsubscribe = subscribe(() => render(container, data));
  render(container, data);
}

afterEach(() => {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
});

const q = (sel) => container.querySelector(sel);
const until = (fn) => vi.waitFor(fn, { timeout: 2000 });

beforeEach(() => {
  failIndex = false;
  resetAnalysisCache();
  configureAnalysis({
    index: '/idx',
    entry: (id) => `/e/${id}`,
    fetchJson: async (url) => {
      if (url === '/idx') {
        if (failIndex) throw new Error('503 index');
        return structuredClone(index);
      }
      if (url === '/e/five-years') return structuredClone(payload);
      throw new Error(`404 ${url}`);
    },
  });
  setState({ view: 'analysis', query: '', cat: 'All', keyword: null, sort: 'rank', open: {}, entry: null, panel: 'timeline' });
  mount();
});

describe('analysis shell', () => {
  it('shows a loading state, then the entries row and entry header from the index', async () => {
    expect(q('[data-analysis-root] .an-loading')).not.toBeNull();
    await until(() => expect(q('.an-entry-title')).not.toBeNull());
    expect(q('.an-entry.is-active')).not.toBeNull();
    expect(q('.an-entry-head h2').textContent).toBe(entry.title);
    expect(q('.an-lede').textContent).toBe(entry.summary);
    expect(q('.an-entry-links a[href="' + entry.links.code + '"]')).not.toBeNull();
    expect([...container.querySelectorAll('.an-entry-stats .nv-stat-value')].map((e) => e.textContent)).toEqual([
      entry.stats.runs.toLocaleString(), entry.stats.stories.toLocaleString(),
      entry.stats.days.toLocaleString(), String(entry.stats.majors),
    ]);
  });

  it('renders one pill per panel in index order, timeline active, and one section per panel', async () => {
    await until(() => expect(q('.an-strip .nv-pills')).not.toBeNull());
    const pills = [...container.querySelectorAll('.an-strip [data-panel]')];
    expect(pills.map((p) => p.getAttribute('data-panel'))).toEqual(entry.panels);
    expect(q('.an-strip [data-panel="timeline"]').classList.contains('nv-pill--active')).toBe(true);
    for (const name of entry.panels) expect(q(`[data-panel-section="${name}"]`)).not.toBeNull();
    expect(q('[data-panel-section="timeline"]').hidden).toBe(false);
    expect(q('[data-panel-section="ledger"]').hidden).toBe(true);
  });

  it('a pill click switches the panel', async () => {
    await until(() => expect(q('.an-strip [data-panel="ledger"]')).not.toBeNull());
    q('.an-strip [data-panel="ledger"]').click();
    expect(getState().panel).toBe('ledger');
    await until(() => expect(q('[data-panel-section="ledger"]').hidden).toBe(false));
    expect(q('[data-panel-section="timeline"]').hidden).toBe(true);
  });

  it('an unknown panel name renders the placeholder, not an error', async () => {
    await until(() => expect(q('.an-strip .nv-pills')).not.toBeNull());
    setState({ panel: 'mystery' });
    await until(() => expect(q('[data-panel-section="mystery"] .an-stub')).not.toBeNull());
  });

  it('an index failure shows an inline retry that recovers', async () => {
    failIndex = true;
    resetAnalysisCache();
    setState({ view: 'analysis' });
    await until(() => expect(q('[data-analysis-retry]')).not.toBeNull());
    failIndex = false;
    q('[data-analysis-retry]').click();
    await until(() => expect(q('.an-entry-title')).not.toBeNull());
  });
});

const open = async (name) => {
  await until(() => expect(q(`.an-strip [data-panel="${name}"]`)).not.toBeNull());
  q(`.an-strip [data-panel="${name}"]`).click();
  await until(() => expect(q(`[data-panel-section="${name}"]`).hidden).toBe(false));
};

describe('table panels', () => {
  it('ledger renders one row per ledger entry, sorted by peak outlets desc, with sparklines', async () => {
    await open('ledger');
    const rows = container.querySelectorAll('[data-panel-section="ledger"] table.ledger tbody tr');
    expect(rows.length).toBe(payload.ledger.length);
    const peaks = [...rows].map((r) => Number(r.children[3].textContent));
    expect(peaks).toEqual([...peaks].sort((a, b) => b - a));
    expect(container.querySelectorAll('[data-panel-section="ledger"] tbody svg path').length).toBe(payload.ledger.length);
  });

  it('ledger header click re-sorts', async () => {
    await open('ledger');
    const th = [...container.querySelectorAll('[data-panel-section="ledger"] th')].find((h) => h.textContent === 'Days seen');
    th.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const days = [...container.querySelectorAll('[data-panel-section="ledger"] tbody tr')].map((r) => Number(r.children[4].textContent));
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it('stats renders the grains table and top sources', async () => {
    await open('stats');
    expect(q('[data-panel-section="stats"] #stats-core table')).not.toBeNull();
    expect(container.querySelectorAll('[data-panel-section="stats"] #stats-sources tbody tr').length).toBe(payload.stats.top_sources.length);
    expect(q('[data-panel-section="stats"] #stats-src-title').textContent).toContain(String(payload.stats.n_sources));
  });

  it('categories renders one row per sub-category', async () => {
    await open('categories');
    expect(container.querySelectorAll('[data-panel-section="categories"] #cat-table tbody tr').length).toBe(payload.categories.subs.length);
    expect(q('[data-panel-section="categories"] #cat-note').textContent).toContain(payload.categories.labeled.toLocaleString());
  });
});

describe('timeline panel', () => {
  it('renders the strip with one marker per event and the stream with one band per section', async () => {
    await until(() => expect(q('[data-panel-section="timeline"] #strip svg')).not.toBeNull());
    const strip = q('[data-panel-section="timeline"] #strip svg');
    expect(strip.querySelectorAll('circle').length).toBe(payload.events.length);
    const stream = q('[data-panel-section="timeline"] #stream svg');
    expect(stream).not.toBeNull();
    expect(stream.querySelectorAll('g > path').length).toBeGreaterThanOrEqual(payload.sections.length);
    expect(container.querySelectorAll('[data-panel-section="timeline"] #stream-legend .li').length).toBe(payload.sections.length);
    expect(q('[data-panel-section="timeline"] #stream-back').hidden).toBe(true);
  });

  it('clicking a band drills into that major and back returns', async () => {
    await until(() => expect(q('[data-panel-section="timeline"] #stream svg')).not.toBeNull());
    const major = Object.keys(payload.drill)[0];
    const idx = payload.sections.indexOf(major);
    const band = q('[data-panel-section="timeline"] #stream svg').querySelectorAll('g > path')[idx];
    band.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await until(() => expect(q('[data-panel-section="timeline"] #drill-title').textContent).toBe(major));
    expect(q('[data-panel-section="timeline"] #stream-back').hidden).toBe(false);
    q('[data-panel-section="timeline"] #stream-back').click();
    await until(() => expect(q('[data-panel-section="timeline"] #stream-back').hidden).toBe(true));
  });
});

describe('top stories, lifetimes, archetypes', () => {
  it('top stories starts on landmark events with one row per event and a chip per drill major', async () => {
    await open('topstories');
    expect(container.querySelectorAll('[data-panel-section="topstories"] #ts-table tbody tr').length).toBe(payload.events.length);
    expect(container.querySelectorAll('[data-panel-section="topstories"] #ts-chips button').length).toBe(1 + Object.keys(payload.drill).length);
    expect(q('[data-panel-section="topstories"] #ts-mode').hidden).toBe(true);
  });

  it('top stories chip switches to a major and shows the mode buttons', async () => {
    await open('topstories');
    const major = Object.keys(payload.drill)[0];
    const chip = [...container.querySelectorAll('[data-panel-section="topstories"] #ts-chips button')].find((b) => b.textContent === major);
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await until(() => expect(q('[data-panel-section="topstories"] #ts-mode').hidden).toBe(false));
    expect(container.querySelectorAll('[data-panel-section="topstories"] #ts-table tbody tr').length).toBe(payload.drill[major].top.length);
  });

  it('lifetimes draws base and named circles plus labels', async () => {
    await open('lifetimes');
    const svg = q('[data-panel-section="lifetimes"] #lifetimes svg');
    expect(svg.querySelectorAll('circle').length).toBe(payload.lifetimes.base.length + payload.lifetimes.named.length);
    expect(q('[data-panel-section="lifetimes"] #lifetimes-title').textContent).toContain(payload.lifetimes.total.toLocaleString());
  });

  it('archetypes draws one cell per cluster and one per discord', async () => {
    await open('archetypes');
    expect(container.querySelectorAll('[data-panel-section="archetypes"] .arch-cell').length).toBe(payload.archetypes.clusters.length);
    expect(container.querySelectorAll('[data-panel-section="archetypes"] .discord-cell').length).toBe(payload.discords.length);
    expect(q('[data-panel-section="archetypes"] #arch-note').textContent).toContain(String(payload.archetypes.clusters.length));
  });
});

describe('learnings panel', () => {
  it('renders the static learnings content with its three tables', async () => {
    await open('learnings');
    expect(container.querySelectorAll('[data-panel-section="learnings"] table.ledger').length).toBe(3);
    expect(q('[data-panel-section="learnings"]').textContent).toContain('golden set');
  });
});
