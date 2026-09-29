import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  configureAnalysis, resetAnalysisCache, isValidEntryId, getIndex, getIndexError,
  loadIndex, resolveEntry, getEntryPayload, getEntryError, loadEntry,
} from '../../src/redesign/analysis/loader.js';

const index = JSON.parse(readFileSync('data/fixtures/analysis/index.json', 'utf-8'));
const payload = JSON.parse(readFileSync('data/fixtures/analysis/entries/five-years/payload.json', 'utf-8'));

let calls;
beforeEach(() => {
  calls = [];
  resetAnalysisCache();
  configureAnalysis({
    index: '/idx',
    entry: (id) => `/e/${id}`,
    fetchJson: async (url) => {
      calls.push(url);
      if (url === '/idx') return structuredClone(index);
      if (url === '/e/five-years') return structuredClone(payload);
      throw new Error(`404 ${url}`);
    },
  });
});

describe('isValidEntryId', () => {
  it('accepts lowercase ids and rejects everything else', () => {
    expect(isValidEntryId('five-years')).toBe(true);
    expect(isValidEntryId('Five')).toBe(false);
    expect(isValidEntryId('../x')).toBe(false);
    expect(isValidEntryId('')).toBe(false);
    expect(isValidEntryId(null)).toBe(false);
  });
});

describe('loadIndex', () => {
  it('fetches once and memoizes', async () => {
    expect(getIndex()).toBeNull();
    await loadIndex();
    await loadIndex();
    expect(calls.filter((u) => u === '/idx').length).toBe(1);
    expect(getIndex().entries[0].id).toBe('five-years');
  });

  it('records an error and allows a retry', async () => {
    configureAnalysis({ index: '/missing' });
    await loadIndex().catch(() => {});
    expect(getIndexError()).toMatch(/404/);
    configureAnalysis({ index: '/idx' });
    await loadIndex();
    expect(getIndex()).not.toBeNull();
    expect(getIndexError()).toBeNull();
  });
});

describe('resolveEntry', () => {
  it('returns the newest entry for null or an unknown id', () => {
    expect(resolveEntry(index, null).id).toBe('five-years');
    expect(resolveEntry(index, 'nope').id).toBe('five-years');
    expect(resolveEntry(index, 'five-years').id).toBe('five-years');
  });
});

describe('loadEntry', () => {
  it('fetches the payload for a valid entry and memoizes', async () => {
    const entry = index.entries[0];
    await loadEntry(entry);
    await loadEntry(entry);
    expect(calls.filter((u) => u === '/e/five-years').length).toBe(1);
    expect(getEntryPayload('five-years').entry).toBe('five-years');
  });

  it('refuses an invalid id without fetching', async () => {
    await expect(loadEntry({ id: '../x' })).rejects.toThrow(/invalid/);
    expect(calls.length).toBe(0);
    expect(getEntryError('../x')).toMatch(/invalid/);
  });
});
