/**
 * Deep links for the three views, so a page elsewhere can point at one:
 *
 *   (no hash)                        the board
 *   #wire                            the wire
 *   #analysis                        newest entry, its first panel
 *   #analysis/topstories             newest entry, a named panel
 *   #analysis/five-years/topstories  an explicit entry and panel
 *
 * The only module that touches `location`. Switching view pushes a history
 * entry so Back returns to the previous view; changing entry or panel
 * replaces, so a run through the pills does not fill the history stack.
 */
import { getState, setState, subscribe } from './state.js';
import { PANEL_LABELS } from './analysis/panels/index.js';

const isPanel = (s) => Object.prototype.hasOwnProperty.call(PANEL_LABELS, s);

/** Hash -> state patch. null for anything unrecognised, so a stray hash is ignored. */
export function parseHash(hash) {
  const parts = String(hash || '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean);
  if (!parts.length) return { view: 'board' };
  if (parts[0] === 'wire') return { view: 'wire' };
  if (parts[0] !== 'analysis') return null;

  const patch = { view: 'analysis', entry: null, panel: 'timeline' };
  if (parts.length === 2) {
    if (isPanel(parts[1])) patch.panel = parts[1];
    else patch.entry = parts[1];
  } else if (parts.length >= 3) {
    patch.entry = parts[1];
    patch.panel = parts[2];
  }
  return patch;
}

/** State -> hash. The board is the bare URL, not "#board". */
export function formatHash(state) {
  if (state.view === 'wire') return '#wire';
  if (state.view !== 'analysis') return '';
  if (state.entry) return `#analysis/${state.entry}/${state.panel}`;
  return state.panel && state.panel !== 'timeline' ? `#analysis/${state.panel}` : '#analysis';
}

export function startRouting(win = window) {
  let writing = false; // our own writes must not re-enter applyHash

  const applyHash = () => {
    const patch = parseHash(win.location.hash);
    if (!patch) return;
    const state = getState();
    const same = Object.entries(patch).every(([k, v]) => state[k] === v);
    if (!same) setState(patch);
  };

  applyHash();

  let last = formatHash(getState());
  let lastView = getState().view;
  subscribe((state) => {
    const next = formatHash(state);
    if (next === last) return;
    const method = state.view === lastView ? 'replaceState' : 'pushState';
    last = next;
    lastView = state.view;
    writing = true;
    try {
      win.history[method](null, '', next || win.location.pathname + win.location.search);
    } catch {
      win.location.hash = next; // history API unavailable (file://, some sandboxes)
    }
    writing = false;
  });

  win.addEventListener('hashchange', () => {
    if (writing) return;
    last = win.location.hash;
    applyHash();
    lastView = getState().view;
  });
}
