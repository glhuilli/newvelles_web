/**
 * Integration tests: render the redesign against the contract fixtures in
 * jsdom and drive the interactions from the handoff README.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { joinMomentum, buildBoardModel } from '../../src/redesign/data.js';
import { attachHandlers, render } from '../../src/redesign/render.js';
import { getState, setState, subscribe } from '../../src/redesign/state.js';

const storiesDoc = JSON.parse(readFileSync('data/fixtures/stories_v0.3.0.json', 'utf-8'));
const momentumDoc = JSON.parse(readFileSync('data/fixtures/momentum_v0.3.0.json', 'utf-8'));
const data = { doc: storiesDoc, stories: joinMomentum(storiesDoc, momentumDoc) };
const board = buildBoardModel(data.stories);

let container;

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  container = document.getElementById('app');
  attachHandlers(container);
  subscribe(() => render(container, data));
  render(container, data);
}

beforeEach(() => {
  setState({ view: 'board', query: '', cat: 'All', keyword: null, sort: 'rank', open: {} });
  mount();
});

describe('board', () => {
  it('renders the lead story, cards, rails and section pills', () => {
    expect(container.querySelector('.nv-lead-headline').textContent).toBe(board.lead.headline);
    expect(container.querySelectorAll('.nv-card').length).toBe(board.cards.length);
    expect(container.querySelectorAll('.nv-covered-row').length).toBe(4);
    expect(container.querySelectorAll('.nv-thin-row').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-section]')).not.toBeNull();
  });

  it('shows only kind == "story" content', () => {
    const text = container.textContent;
    const deal = data.stories.find((s) => s.kind === 'deal');
    expect(text).not.toContain(deal.headline);
  });

  it('clicking the lead dives to the wire with that story expanded and filters reset', () => {
    container.querySelector('.nv-lead').click();
    const state = getState();
    expect(state.view).toBe('wire');
    expect(state.open[board.lead.id]).toBe(true);
    expect(state.cat).toBe('All');
    // the expanded row shows its article list
    const expanded = container.querySelector('.nv-expanded');
    expect(expanded).not.toBeNull();
    expect(expanded.querySelectorAll('a.nv-article').length).toBe(board.lead.articles.length);
  });

  it('a section pill dives to the wire filtered to that section', () => {
    const pill = container.querySelector('[data-section]');
    const section = pill.getAttribute('data-section');
    pill.click();
    expect(getState().view).toBe('wire');
    expect(getState().cat).toBe(section);
  });
});

describe('wire', () => {
  beforeEach(() => setState({ view: 'wire' }));

  it('renders every story as a ranked row', () => {
    expect(container.querySelectorAll('.nv-row').length).toBe(data.stories.length);
    expect(container.querySelector('.nv-rank').textContent).toBe('01');
  });

  it('expand toggles in place and multiple rows can be open', () => {
    const rows = container.querySelectorAll('[data-toggle]');
    rows[0].click();
    rows[2] && container.querySelectorAll('[data-toggle]')[2].click();
    expect(container.querySelectorAll('.nv-expanded').length).toBe(2);
    // clicking again closes
    container.querySelectorAll('[data-toggle]')[0].click();
    expect(container.querySelectorAll('.nv-expanded').length).toBe(1);
  });

  it('article links open in a new tab with rel=noopener', () => {
    container.querySelector('[data-toggle]').click();
    const link = container.querySelector('.nv-expanded a.nv-article');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it('search narrows rows AND the filter counts (the review bug)', () => {
    const target = data.stories.find((s) => s.kind === 'story');
    const input = container.querySelector('[data-wire-search]');
    input.value = target.headline.slice(0, 20);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const rows = container.querySelectorAll('.nv-row').length;
    expect(rows).toBeLessThan(data.stories.length);
    const allPill = container.querySelector('[data-cat="All"]');
    expect(allPill.textContent.trim()).toBe(`All ${rows}`);
    expect(container.querySelector('.nv-footer').textContent).toContain(
      `${rows} of ${data.stories.length} stories`
    );
  });

  it('nonsense query shows the empty state with a clear affordance', () => {
    const input = container.querySelector('[data-wire-search]');
    input.value = 'zzzz-no-such-story-zzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(container.querySelector('.nv-empty')).not.toBeNull();
    container.querySelector('[data-reset]').click();
    expect(container.querySelector('.nv-empty')).toBeNull();
    expect(container.querySelectorAll('.nv-row').length).toBe(data.stories.length);
  });

  it('keyword pill filters and clicking again clears', () => {
    container.querySelector('[data-toggle]').click();
    const pill = container.querySelector('.nv-expanded [data-keyword]');
    const keyword = pill.getAttribute('data-keyword');
    pill.click();
    expect(getState().keyword).toBe(keyword);
    const visible = container.querySelectorAll('.nv-row').length;
    expect(visible).toBeLessThanOrEqual(data.stories.length);
    expect(container.querySelector('.nv-keywordbar-term').textContent).toBe(keyword);
    // clear via the keyword bar
    container.querySelector('[data-clear-keyword]').click();
    expect(getState().keyword).toBeNull();
  });

  it('sort switches reorder rows', () => {
    container.querySelector('[data-sort="outlets"]').click();
    const counts = [...container.querySelectorAll('.nv-row-meta span:first-child')].map((el) =>
      parseInt(el.textContent, 10)
    );
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });

  it('deals & roundups stay reachable behind their pill', () => {
    container.querySelector(`[data-cat="Roundups & deals"]`).click();
    const rows = container.querySelectorAll('.nv-row').length;
    const commerce = data.stories.filter((s) => s.kind !== 'story').length;
    expect(rows).toBe(commerce);
  });

  it('← Today returns to the board and clears query, filter and keyword', () => {
    setState({ query: 'x', cat: 'Tech', keyword: 'pixel' });
    container.querySelector('[data-go-board]').click();
    const state = getState();
    expect(state.view).toBe('board');
    expect(state.query).toBe('');
    expect(state.cat).toBe('All');
    expect(state.keyword).toBeNull();
  });

  it('every headline and title renders escaped (no raw HTML injection)', () => {
    setState({ view: 'wire' });
    expect(container.querySelector('script:not([type])')).toBeNull();
    expect(container.innerHTML).not.toContain('<img src=x');
  });
});

describe('credit', () => {
  it('both views credit the developer with a link to glhuilli.github.io', () => {
    // board
    let credit = container.querySelector('.nv-credit a');
    expect(credit.getAttribute('href')).toBe('https://glhuilli.github.io/');
    expect(credit.getAttribute('target')).toBe('_blank');
    expect(credit.getAttribute('rel')).toBe('noopener');
    expect(container.querySelector('.nv-credit').textContent).toContain('developed by @glhuilli');
    // wire
    setState({ view: 'wire' });
    credit = container.querySelector('.nv-credit a');
    expect(credit.getAttribute('href')).toBe('https://glhuilli.github.io/');
  });
});

describe('board search handoff', () => {
  it('typing in the board search switches to the wire with the query applied', () => {
    const input = container.querySelector('[data-board-search]');
    input.value = 'google';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const state = getState();
    expect(state.view).toBe('wire');
    expect(state.query).toBe('google');
    expect(container.querySelector('[data-wire-search]').value).toBe('google');
  });
});
