/**
 * Entry point for the redesigned Newvelles (board + wire).
 *
 * Data: two fetches at load — stories.json and momentum.json — joined on
 * story id. Nothing else is fetched. The source is fixture files for now
 * (VITE_NV_DATA_SOURCE=live switches to the S3-backed endpoints at cutover).
 */
import { joinMomentum } from './data.js';
import { subscribe } from './state.js';
import { attachHandlers, render, renderError, renderLoading } from './render.js';

const SUPPORTED_MAJOR = '0.3';

const SOURCES = {
  fixture: {
    stories: '/data/fixtures/stories_v0.3.0.json',
    momentum: '/data/fixtures/momentum_v0.3.0.json',
  },
  live: {
    stories: '/stories.json',
    momentum: '/momentum.json',
  },
  local: {
    // your own pipeline output: run the backend CLI, then copy
    // stories.json + momentum.json into data/local/ (gitignored)
    stories: '/data/local/stories.json',
    momentum: '/data/local/momentum.json',
  },
};

function dataSource() {
  const flag = import.meta.env?.VITE_NV_DATA_SOURCE;
  return SOURCES[flag] || SOURCES.fixture;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

function checkVersion(doc, name) {
  const version = String(doc.version || '');
  if (!version.startsWith(SUPPORTED_MAJOR)) {
    // Refuse to render an unrecognised version — log loudly, don't fail silently.
    throw new Error(
      `${name} carries schema version "${version}" but this build understands ${SUPPORTED_MAJOR}.x — refusing to render`
    );
  }
}

async function init() {
  const container = document.getElementById('app');
  renderLoading(container);
  try {
    const source = dataSource();
    const [storiesDoc, momentumDoc] = await Promise.all([
      fetchJson(source.stories),
      fetchJson(source.momentum).catch((error) => {
        // Momentum is enhancement, not structure — a missing rollup file
        // renders the wire without sparklines rather than an error page.
        console.error('momentum.json unavailable, rendering without sparklines:', error);
        return { version: '0.3.0', stories: {} };
      }),
    ]);
    checkVersion(storiesDoc, 'stories.json');

    const data = {
      doc: storiesDoc,
      stories: joinMomentum(storiesDoc, momentumDoc),
    };

    attachHandlers(container);
    subscribe(() => render(container, data));
    render(container, data);
  } catch (error) {
    console.error('Failed to initialize redesign:', error);
    renderError(container, init);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
