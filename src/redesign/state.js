/**
 * State for the redesign — the six variables from the handoff, all
 * client-side, no persistence and no accounts:
 *
 *   view      'board' | 'wire' | 'analysis'
 *   query     search string
 *   cat       active section filter, default 'All'
 *   keyword   active keyword pill or null
 *   sort      'rank' | 'outlets' | 'newest'
 *   open      { [storyId]: true }   expanded rows
 *   entry     analysis entry id; null = newest
 *   panel     analysis panel name
 */
import { clearAnalysisErrors } from './analysis/loader.js';

let state = {
  view: 'board',
  query: '',
  cat: 'All',
  keyword: null,
  sort: 'rank',
  open: {},
  entry: null,
  panel: 'timeline',
};

const listeners = [];

export function getState() {
  return { ...state, open: { ...state.open } };
}

export function setState(updates) {
  state = { ...state, ...updates };
  listeners.forEach((listener) => listener(getState()));
}

export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

/** Board -> wire with a story expanded, filters reset. */
export function diveToStory(storyId) {
  setState({ view: 'wire', query: '', cat: 'All', keyword: null, open: { [storyId]: true } });
}

/** Board -> wire filtered to one section. */
export function diveToSection(section) {
  setState({ view: 'wire', query: '', cat: section, keyword: null, open: {} });
}

/** Typing in the board search switches to the wire with the query applied. */
export function searchFromBoard(query) {
  setState({ view: 'wire', query, cat: 'All', keyword: null });
}

/** The "← Today" link: back to the board, clearing query, filter and keyword. */
export function goBoard() {
  setState({ view: 'board', query: '', cat: 'All', keyword: null, open: {} });
}

export function goWire() {
  setState({ view: 'wire' });
}

/** Expand toggles in place; multiple rows may be open at once. */
export function toggleStory(storyId) {
  const open = { ...state.open };
  if (open[storyId]) delete open[storyId];
  else open[storyId] = true;
  setState({ open });
}

/** Keyword pill: clicking filters to it; clicking again clears. */
export function toggleKeyword(keyword) {
  setState({ keyword: state.keyword === keyword ? null : keyword, cat: 'All' });
}

export function setQuery(query) {
  setState({ query });
}

export function setCat(cat) {
  setState({ cat });
}

export function setSort(sort) {
  setState({ sort });
}

export function resetFilters() {
  setState({ query: '', cat: 'All', keyword: null });
}

/** The Analysis tab. Keeps entry and panel so coming back lands where you were. */
export function goAnalysis() {
  setState({ view: 'analysis', query: '', keyword: null });
}

export function selectEntry(entry) {
  setState({ view: 'analysis', entry, panel: 'timeline' });
}

export function selectPanel(panel) {
  setState({ view: 'analysis', panel });
}

/** Re-run listeners without changing state (used when async data arrives). */
export function refresh() {
  setState({});
}

/** Retry button in the analysis view: forget recorded errors, re-render, which re-attempts the load. */
export function retryAnalysis() {
  clearAnalysisErrors();
  setState({});
}
