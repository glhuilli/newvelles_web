import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../../src/redesign/hash.js';

describe('parseHash', () => {
  it('maps an empty hash to the board', () => {
    expect(parseHash('')).toEqual({ view: 'board' });
    expect(parseHash('#')).toEqual({ view: 'board' });
    expect(parseHash('#/')).toEqual({ view: 'board' });
  });

  it('maps #wire to the wire', () => {
    expect(parseHash('#wire')).toEqual({ view: 'wire' });
  });

  it('maps #analysis to the newest entry and the first panel', () => {
    expect(parseHash('#analysis')).toEqual({ view: 'analysis', entry: null, panel: 'timeline' });
  });

  it('reads a bare panel name as a panel, not an entry', () => {
    expect(parseHash('#analysis/topstories')).toEqual({ view: 'analysis', entry: null, panel: 'topstories' });
  });

  it('reads an unknown second segment as an entry id', () => {
    expect(parseHash('#analysis/five-years')).toEqual({ view: 'analysis', entry: 'five-years', panel: 'timeline' });
  });

  it('reads entry and panel together', () => {
    expect(parseHash('#analysis/five-years/categories')).toEqual({
      view: 'analysis', entry: 'five-years', panel: 'categories',
    });
  });

  it('ignores an unrecognised hash so an unrelated anchor cannot change the view', () => {
    expect(parseHash('#footnote-3')).toBeNull();
  });
});

describe('formatHash', () => {
  const base = { view: 'board', entry: null, panel: 'timeline' };

  it('writes no hash for the board', () => {
    expect(formatHash(base)).toBe('');
  });

  it('writes #wire for the wire', () => {
    expect(formatHash({ ...base, view: 'wire' })).toBe('#wire');
  });

  it('writes #analysis for the default entry and panel', () => {
    expect(formatHash({ ...base, view: 'analysis' })).toBe('#analysis');
  });

  it('writes the panel alone when no entry is pinned', () => {
    expect(formatHash({ ...base, view: 'analysis', panel: 'archetypes' })).toBe('#analysis/archetypes');
  });

  it('writes entry and panel once an entry is pinned', () => {
    expect(formatHash({ ...base, view: 'analysis', entry: 'five-years', panel: 'archetypes' })).toBe(
      '#analysis/five-years/archetypes'
    );
  });

  it('round-trips every form it writes', () => {
    for (const state of [
      { ...base },
      { ...base, view: 'wire' },
      { ...base, view: 'analysis' },
      { ...base, view: 'analysis', panel: 'categories' },
      { ...base, view: 'analysis', entry: 'five-years', panel: 'categories' },
    ]) {
      const parsed = parseHash(formatHash(state));
      expect(parsed.view).toBe(state.view);
      if (state.view === 'analysis') {
        expect(parsed.entry).toBe(state.entry);
        expect(parsed.panel).toBe(state.panel);
      }
    }
  });
});
