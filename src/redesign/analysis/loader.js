/**
 * Analysis data: an index of entries plus one payload per entry. Nothing is
 * fetched at page load; the index loads on the first switch to the tab and a
 * payload when its entry is opened. Both memoize in module scope.
 */
const ENTRY_ID = /^[a-z0-9-]{1,64}$/;

async function defaultFetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

let cfg = {
  index: '/analysis/index.json',
  entry: (id) => `/analysis/entries/${id}/payload.json`,
  fetchJson: defaultFetchJson,
};

let cache;
export function resetAnalysisCache() {
  cache = { index: null, indexError: null, indexPromise: null, payloads: {}, errors: {}, promises: {} };
}
resetAnalysisCache();

export function configureAnalysis(overrides = {}) {
  cfg = { ...cfg, ...overrides };
}

export function isValidEntryId(id) {
  return typeof id === 'string' && ENTRY_ID.test(id);
}

export const getIndex = () => cache.index;
export const getIndexError = () => cache.indexError;
export const getEntryPayload = (id) => cache.payloads[id] || null;
export const getEntryError = (id) => cache.errors[id] || null;

/** Forget recorded failures so the next render re-attempts the loads. */
export function clearAnalysisErrors() {
  cache.indexError = null;
  cache.errors = {};
}

export function loadIndex() {
  if (cache.index) return Promise.resolve(cache.index);
  if (!cache.indexPromise) {
    cache.indexPromise = cfg
      .fetchJson(cfg.index)
      .then((doc) => {
        if (!doc || !Array.isArray(doc.entries)) throw new Error('index.json has no entries');
        cache.index = doc;
        cache.indexError = null;
        return doc;
      })
      .catch((error) => {
        cache.indexError = String(error.message || error);
        throw error;
      })
      .finally(() => {
        cache.indexPromise = null;
      });
  }
  return cache.indexPromise;
}

/** Newest first is the index order; null or an unknown id resolves to entries[0]. */
export function resolveEntry(index, entryId) {
  const entries = (index && index.entries) || [];
  return entries.find((e) => e.id === entryId) || entries[0] || null;
}

export function loadEntry(entry) {
  const id = entry && entry.id;
  if (!isValidEntryId(id)) {
    cache.errors[id] = `invalid entry id: ${id}`;
    return Promise.reject(new Error(cache.errors[id]));
  }
  if (cache.payloads[id]) return Promise.resolve(cache.payloads[id]);
  if (!cache.promises[id]) {
    cache.promises[id] = cfg
      .fetchJson(cfg.entry(id))
      .then((doc) => {
        cache.payloads[id] = doc;
        delete cache.errors[id];
        return doc;
      })
      .catch((error) => {
        cache.errors[id] = String(error.message || error);
        throw error;
      })
      .finally(() => {
        delete cache.promises[id];
      });
  }
  return cache.promises[id];
}
