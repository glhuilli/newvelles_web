/**
 * Integration: the Analysis view against the trimmed fixture in jsdom.
 * Panel-specific assertions are appended by the panel tasks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  container = document.getElementById('app');
  attachHandlers(container);
  subscribe(() => render(container, data));
  render(container, data);
}

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
