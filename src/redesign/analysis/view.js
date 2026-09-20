/**
 * The Analysis view: entries row, entry header, panel pills, one section per
 * panel. renderAnalysis() returns HTML from whatever the loader already has;
 * mountAnalysis() kicks off loads (each completion calls refresh() so the
 * view re-renders) and mounts the active panel into its section.
 */
import { refresh } from '../state.js';
import { buildContext } from './context.js';
import { getEntryError, getEntryPayload, getIndex, getIndexError, loadEntry, loadIndex, resolveEntry } from './loader.js';
import { PANEL_LABELS, mountPanel } from './panels/index.js';

// Local copy of render.js's esc(): view.js must not import render.js (render.js imports this file).
const esc = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function monthYear(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
const fmtRange = (e) => `${monthYear(e.first_day)} – ${monthYear(e.last_day)}`;
const pad2 = (n) => String(n).padStart(2, '0');

function renderEntries(index, current) {
  const cards = index.entries
    .map(
      (e) => `<button class="an-entry${e.id === current.id ? ' is-active' : ''}" type="button" data-entry="${esc(e.id)}" ${
        e.id === current.id ? 'aria-current="true"' : ''
      }>
        <span class="an-entry-num">${pad2(e.number)}</span>
        <span class="an-entry-title">${esc(e.title)}</span>
        <span class="an-entry-range">${esc(fmtRange(e))} · published ${esc(monthYear(e.published))}</span>
      </button>`
    )
    .join('');
  return `<div class="an-entries">
    <div class="an-entries-head"><span class="nv-rail-label">Entries</span><span class="an-meta">${index.entries.length} published</span></div>
    <div class="an-entry-list">${cards}
      <div class="an-entry an-entry--next">The next entry appears here when a new analysis is published. Each entry keeps its own panels below.</div>
    </div>
  </div>`;
}

function renderEntryHead(e) {
  const stat = (v, label) =>
    `<div class="nv-stat"><span class="nv-stat-value">${esc(v)}</span><span class="nv-stat-label">${label}</span></div>`;
  const links = [
    e.links.post ? `<a href="${esc(e.links.post)}">Read the methods post →</a>` : '',
    e.links.code ? `<a href="${esc(e.links.code)}" target="_blank" rel="noopener">Analysis code on GitHub →</a>` : '',
  ].join('');
  return `<header class="an-entry-head">
    <div class="nv-kicker">Entry ${pad2(e.number)} · ${esc(fmtRange(e))}</div>
    <h2>${esc(e.title)}</h2>
    <p class="an-lede">${esc(e.summary)}</p>
    <div class="an-entry-stats">
      ${stat(e.stats.runs.toLocaleString(), 'runs replayed')}
      ${stat(e.stats.stories.toLocaleString(), 'unique stories')}
      ${stat(e.stats.days.toLocaleString(), 'days')}
      ${stat(String(e.stats.majors), 'major categories')}
    </div>
    <div class="an-entry-links">${links}</div>
  </header>`;
}

function renderPanels(e, panel, payload) {
  const names = e.panels.includes(panel) ? e.panels : [...e.panels, panel];
  const pills = names
    .map(
      (n) =>
        `<button class="nv-pill${n === panel ? ' nv-pill--active' : ''}" role="tab" data-panel="${esc(n)}" aria-selected="${n === panel}">${esc(
          PANEL_LABELS[n] || n
        )}</button>`
    )
    .join('');
  const meta = payload
    ? `${payload.meta.runs.toLocaleString()} runs · ${payload.meta.stories.toLocaleString()} stories · ${esc(payload.meta.first_day)} → ${esc(payload.meta.last_day)}`
    : '';
  const sections = names
    .map((n) => `<section class="an-panel" data-panel-section="${esc(n)}" ${n === panel ? '' : 'hidden'}></section>`)
    .join('');
  return `<div class="an-strip"><div class="nv-pills" role="tablist" aria-label="Analysis panels">${pills}</div><div class="an-meta">${meta}</div></div>${sections}`;
}

const retry = (msg) => `<div class="an-error"><p>${esc(msg)}</p><button class="nv-ghost" data-analysis-retry>Try again</button></div>`;

export function renderAnalysis(state) {
  const index = getIndex();
  let body;
  if (!index) {
    body = getIndexError()
      ? retry(`Could not load the analysis index (${getIndexError()}).`)
      : `<p class="an-loading">Loading the archive…</p>`;
  } else {
    const entry = resolveEntry(index, state.entry);
    if (!entry) body = `<p class="an-stub">No analysis entries published yet.</p>`;
    else {
      const payload = getEntryPayload(entry.id);
      const err = getEntryError(entry.id);
      body =
        renderEntries(index, entry) +
        renderEntryHead(entry) +
        (payload
          ? renderPanels(entry, state.panel, payload)
          : err
            ? retry(`Could not load this entry (${err}).`)
            : `<p class="an-loading">Loading ${esc(entry.title)}…</p>`);
    }
  }
  return `<section class="an-root" data-analysis-root>${body}<div class="an-tooltip" id="tooltip" role="status"></div></section>`;
}

/** A recorded error means "tried and failed"; the retry button clears errors first (retryAnalysis). */
export function mountAnalysis(root, state) {
  if (!root) return;
  const index = getIndex();
  if (!index) {
    if (!getIndexError()) loadIndex().then(refresh, refresh);
    return;
  }
  const entry = resolveEntry(index, state.entry);
  if (!entry) return;
  const payload = getEntryPayload(entry.id);
  if (!payload) {
    if (!getEntryError(entry.id)) loadEntry(entry).then(refresh, refresh);
    return;
  }
  const section = root.querySelector(`[data-panel-section="${state.panel}"]`);
  if (!section) return;
  const ctx = buildContext(payload, root);
  mountPanel(state.panel, section, ctx);
}
