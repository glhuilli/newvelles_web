/**
 * DOM rendering for the redesign. Two views — board and wire — rendered from
 * (state, data) on every state change. Interaction handlers are delegated via
 * data-* attributes; all dynamic text is escaped.
 */
import {
  ageLabel,
  buildBoardModel,
  categoryList,
  filterStories,
  momentumSeries,
  outletBars,
  rampColor,
  sectionCounts,
  sortStories,
  sparklinePoints,
  storyMeta,
  trendLabel,
  COMMERCE_CAT,
} from './data.js';
import {
  diveToStory,
  diveToSection,
  getState,
  goAnalysis,
  goBoard,
  goWire,
  resetFilters,
  retryAnalysis,
  searchFromBoard,
  selectEntry,
  selectPanel,
  setCat,
  setQuery,
  setSort,
  toggleKeyword,
  toggleStory,
} from './state.js';
import { mountAnalysis, renderAnalysis } from './analysis/view.js';

export function esc(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sparkSvg(story, width, height, { stroke, strokeWidth = 1.6, fullWidth = false } = {}) {
  const series = momentumSeries(story);
  if (!series.length) return '';
  const points = sparklinePoints(series, width, height);
  const color = stroke || rampColor(story.outlet_count);
  const widthAttr = fullWidth ? 'width="100%"' : `width="${width}"`;
  return `<svg ${widthAttr} height="${height}" viewBox="0 0 ${width} ${height}" fill="none" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function articleLink(article, { withAge = false } = {}) {
  const source = withAge && article.published
    ? `${esc(article.outlet)} · ${esc(ageLabelSafe(article.published))}`
    : esc(article.outlet);
  return `<a class="nv-article" href="${esc(article.link)}" target="_blank" rel="noopener">
    <span class="nv-article-title">${esc(article.title)}</span>
    <span class="nv-article-source">${source}</span>
  </a>`;
}

// small local wrapper so render never throws on odd dates
function ageLabelSafe(iso) {
  try {
    return ageLabel(iso) || '';
  } catch {
    return '';
  }
}

function formatDateline(doc) {
  const generated = new Date(doc.generated);
  const date = Number.isNaN(generated.getTime())
    ? ''
    : generated.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = Number.isNaN(generated.getTime())
    ? ''
    : generated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

function seriesRange(story) {
  const series = (story.momentum && story.momentum.series) || [];
  if (series.length < 2) return '';
  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  return `${fmt(series[0].date)} – ${fmt(series[series.length - 1].date)}`;
}

function renderCredit() {
  return `<div class="nv-credit">developed by <a href="https://glhuilli.github.io/" target="_blank" rel="noopener">@glhuilli</a></div>`;
}

function formatAnalysisDateline(data) {
  const { date } = formatDateline(data.doc);
  return `${esc(date)} · the archive since 2021, in numbers`;
}

/**
 * Brand block + tab strip + view-specific actions. One header for all three
 * views so the strip never moves.
 */
export function renderHeader(state, data, { dateline, actions }) {
  const { view } = state;
  const storyCount = data.stories.filter((s) => s.kind === 'story').length;
  const tab = (attr, label, key, count) =>
    `<button class="nv-tab" role="tab" ${attr} aria-selected="${view === key}">${label}${
      count ? `<span class="nv-tab-count">${esc(count)}</span>` : ''
    }</button>`;
  return `
  <header class="nv-header">
    <div class="nv-brand-block">
      <div class="nv-brand">newvelles</div>
      <div class="nv-dateline">${dateline}</div>
    </div>
    <nav class="nv-tabs" role="tablist" aria-label="Views">
      ${tab('data-go-board', 'Today', 'board')}
      ${tab('data-go-wire', 'Wire', 'wire', storyCount)}
      ${tab('data-go-analysis', 'Analysis', 'analysis')}
    </nav>
    <div class="nv-header-actions">${actions}</div>
  </header>`;
}

/* ---------------- board ---------------- */

function renderBoard(data, state) {
  const { stories, doc } = data;
  const board = buildBoardModel(stories);
  const { date, time } = formatDateline(doc);
  const newsCount = stories.filter((s) => s.kind === 'story').length;

  const lead = board.lead;
  const leadHtml = lead
    ? `<article class="nv-lead" data-dive="${esc(lead.id)}" role="link" tabindex="0" aria-label="Open ${esc(lead.headline)}">
        <div class="nv-kicker">Biggest story today</div>
        <h1 class="nv-lead-headline">${esc(lead.headline)}</h1>
        <div class="nv-lead-stats">
          <div class="nv-stat"><span class="nv-stat-value">${lead.outlet_count}</span><span class="nv-stat-label">outlets</span></div>
          <div class="nv-stat"><span class="nv-stat-value">${lead.article_count}</span><span class="nv-stat-label">articles</span></div>
          <div class="nv-stat"><span class="nv-stat-value">${lead.days_running}</span><span class="nv-stat-label">days running</span></div>
          <div class="nv-lead-spark">
            ${sparkSvg(lead, 190, 42, { stroke: '#9184d9', strokeWidth: 1.8 })}
            <span class="nv-stat-label">${esc(seriesRange(lead))}</span>
          </div>
        </div>
        <div class="nv-lead-articles">
          ${lead.articles.slice(0, 3).map((a) => articleLink(a)).join('')}
        </div>
        <div class="nv-open-all">Open all ${lead.article_count} articles</div>
      </article>`
    : '';

  const cardsHtml = board.cards
    .map(
      (s) => `<article class="nv-card" data-dive="${esc(s.id)}" role="link" tabindex="0">
        <div class="nv-card-headline">${esc(s.headline)}</div>
        <div class="nv-card-meta">${s.outlet_count} outlets · ${
          s.days_running === 1 ? 'new today' : `${s.days_running} days`
        }</div>
        ${sparkSvg(s, 240, 22, { strokeWidth: 2, fullWidth: true })}
      </article>`
    )
    .join('');

  const coveredHtml = board.mostCovered
    .map(
      (m) => `<div class="nv-covered-row nv-clickable" data-dive="${esc(m.id)}" role="link" tabindex="0">
        <div class="nv-covered-top">
          <span class="nv-covered-label">${esc(m.label)}</span>
          <span class="nv-covered-count">${m.outlet_count} outlets</span>
        </div>
        <div class="nv-covered-track"><div class="nv-covered-fill" style="width:${m.pct}%;background:${m.color}"></div></div>
      </div>`
    )
    .join('');

  const thinHtml = board.thinCoverage
    .map(
      (t) => `<div class="nv-thin-row nv-clickable" data-dive="${esc(t.id)}" role="link" tabindex="0">
        <span class="nv-thin-headline">${esc(t.headline)}</span>
        <span class="nv-thin-meta">${esc((t.outlets[0] || {}).outlet || '')} · ${
          t.outlet_count === 1 ? 'single outlet' : `${t.outlet_count} outlets`
        }</span>
      </div>`
    )
    .join('');

  const sectionPills = board.sections
    .map(
      (s) =>
        `<button class="nv-pill" data-section="${esc(s.section)}">${esc(s.section)} ${s.count}</button>`
    )
    .join('');

  return `
  ${renderHeader(state, data, {
    dateline: `${esc(date)} · updated ${esc(time)} · ${newsCount} stories from ${doc.feeds} feeds`,
    actions: `<div class="nv-search">
        <span class="nv-icon" aria-hidden="true">⌕</span>
        <input type="search" data-board-search name="board-search" id="board-search" placeholder="Search all stories" value="" aria-label="Search all stories">
      </div>`,
  })}
  <div class="nv-board">
    <div class="nv-board-main">
      ${leadHtml}
      <div class="nv-cards">${cardsHtml}</div>
    </div>
    <aside class="nv-rail">
      <div class="nv-rail-block">
        <div class="nv-rail-label">Covered by everyone</div>
        <div class="nv-covered-rows">${coveredHtml}</div>
      </div>
      <div class="nv-rail-block">
        <div class="nv-rail-label">Barely covered</div>
        <p class="nv-rail-sub">Three outlets or fewer picked these up.</p>
        <div class="nv-thin-rows">${thinHtml}</div>
      </div>
      <div class="nv-rail-block nv-rail-block--bordered">
        <div class="nv-rail-label">By section</div>
        <div class="nv-pills">${sectionPills}</div>
      </div>
    </aside>
  </div>
  ${renderCredit()}`;
}

/* ---------------- wire ---------------- */

function renderWireRow(story, index, isOpen, isLead) {
  const bars = outletBars(story);
  const totalWeight = bars.reduce((sum, b) => sum + b.weight, 0) || 1;
  const barsHtml = bars
    .map(
      (b) =>
        `<div class="nv-bar" style="flex:${Math.max(b.weight / totalWeight, 0.02)};background:${b.color}"></div>`
    )
    .join('');
  const sourceLine = bars
    .map((b) => (b.label.startsWith('+') ? b.label : `${esc(b.label)} ${b.weight}`))
    .join(' · ');
  const trend = story.momentum ? trendLabel(story.momentum.trend) : '';

  const expanded = isOpen
    ? `<div class="nv-expanded">
        <div class="nv-pills">
          ${(story.keywords || [])
            .map((k) => `<button class="nv-pill" data-keyword="${esc(k)}">${esc(k)}</button>`)
            .join('')}
        </div>
        <div class="nv-expanded-articles">
          ${(story.articles || []).map((a) => articleLink(a, { withAge: true })).join('')}
        </div>
      </div>`
    : '';

  return `<div class="nv-rowwrap${isLead ? ' nv-rowwrap--lead' : ''}">
    <div class="nv-row" data-toggle="${esc(story.id)}" role="button" tabindex="0" aria-expanded="${isOpen}">
      <div class="nv-rank${isLead ? ' nv-rank--accent' : ''}">${String(index + 1).padStart(2, '0')}</div>
      <div class="nv-story-cell">
        <div class="nv-row-headline${isOpen ? ' nv-row-headline--open' : ''}">${esc(story.headline)}</div>
        <div class="nv-row-meta">
          <span>${esc(storyMeta(story))}</span>
          <span class="nv-caret${isOpen ? ' nv-caret--open' : ''}" aria-hidden="true">▾</span>
        </div>
      </div>
      <div class="nv-momentum-cell">
        ${sparkSvg(story, 132, 34)}
        <div class="nv-trend">${esc(trend)}</div>
      </div>
      <div class="nv-sources-cell">
        <div class="nv-bars">${barsHtml}</div>
        <div class="nv-source-line">${sourceLine}</div>
      </div>
    </div>
    ${expanded}
  </div>`;
}

function renderWire(data, state) {
  const { stories, doc } = data;
  const { query, cat, keyword, sort, open } = state;
  const { date } = formatDateline(doc);

  const visible = sortStories(filterStories(stories, { query, cat, keyword }), sort);
  const counts = sectionCounts(stories, { query, keyword });
  const cats = categoryList(stories);

  const pills = cats
    .map((c) => {
      const active = cat === c;
      const dimmed = counts[c] === 0 && !active;
      return `<button class="nv-pill nv-pill--filter${active ? ' nv-pill--active' : ''}${
        dimmed ? ' nv-pill--dimmed' : ''
      }" data-cat="${esc(c)}">${esc(c)} ${counts[c]}</button>`;
    })
    .join('');

  const keywordBar = keyword
    ? `<div class="nv-keywordbar">
        <div class="nv-keywordbar-info">
          <span>Showing only stories tagged</span>
          <span class="nv-keywordbar-term">${esc(keyword)}</span>
          <span class="nv-keywordbar-count">· ${visible.length} ${visible.length === 1 ? 'story' : 'stories'}</span>
        </div>
        <button class="nv-ghost" data-clear-keyword>× Show all stories</button>
      </div>`
    : '';

  const rows = visible
    .map((s, i) => renderWireRow(s, i, !!open[s.id], i === 0 && sort === 'rank'))
    .join('');

  const empty =
    visible.length === 0
      ? `<div class="nv-empty">
          <div class="nv-empty-title">Nothing matches ${
            query.trim() ? `“${esc(query.trim())}”` : 'these filters'
          }</div>
          <div class="nv-empty-sub">Search covers story headlines, article titles, sources and keywords.</div>
          <button class="nv-ghost" data-reset>Clear filters</button>
        </div>`
      : '';

  const footerLine =
    visible.length === stories.length
      ? `${stories.length} stories`
      : `${visible.length} of ${stories.length} stories`;

  const sortButton = (key, label) =>
    `<button data-sort="${key}" class="${sort === key ? 'nv-sort--active' : ''}">${label}</button>`;

  return `
  ${renderHeader(state, data, {
    dateline: `${esc(date)} · ${stories.length} stories · ${doc.article_count} articles · ${doc.feeds} feeds · click a story to open its coverage`,
    actions: `<div class="nv-search nv-search--wire">
        <span class="nv-icon" aria-hidden="true">⌕</span>
        <input type="search" data-wire-search name="wire-search" id="wire-search" placeholder="Filter stories, sources, headlines" value="${esc(query)}" aria-label="Filter stories">
        ${query ? '<button class="nv-clear" data-clear-query aria-label="Clear search">×</button>' : ''}
      </div>
      <div class="nv-sort" role="group" aria-label="Sort stories">
        ${sortButton('rank', 'Ranked')}
        ${sortButton('newest', 'Newest')}
        ${sortButton('outlets', 'Most covered')}
      </div>`,
  })}
  <div class="nv-wire">
    ${keywordBar}
    <div class="nv-filterbar"><div class="nv-pills">${pills}</div></div>
    <div class="nv-rows" aria-live="polite">${rows}</div>
    ${empty}
    <div class="nv-footer">
      <div>${footerLine}</div>
      <div class="nv-footer-note">Momentum reads the last 14 days of coverage.</div>
    </div>
    ${renderCredit()}
  </div>`;
}

/* ---------------- app shell ---------------- */

export function renderLoading(container) {
  container.innerHTML = `<div class="nv-shell"><div class="nv-page">
    <header class="nv-header"><div class="nv-brand-block"><div class="nv-brand">newvelles</div></div></header>
    <div class="nv-skeleton" aria-busy="true"></div>
  </div></div>`;
}

export function renderError(container, onRetry) {
  container.innerHTML = `<div class="nv-shell"><div class="nv-page">
    <header class="nv-header"><div class="nv-brand-block"><div class="nv-brand">newvelles</div></div></header>
    <div class="nv-retry">Couldn’t load today’s stories. <button data-retry>Retry</button></div>
  </div></div>`;
  container.querySelector('[data-retry]').addEventListener('click', onRetry);
}

export function render(container, data) {
  const state = getState();

  // Preserve search focus + caret across re-render (repo lesson: typing must
  // never lose focus mid-word).
  const active = document.activeElement;
  const restore =
    active && (active.hasAttribute('data-wire-search') || active.hasAttribute('data-board-search'))
      ? {
          selector: active.hasAttribute('data-wire-search')
            ? '[data-wire-search]'
            : '[data-board-search]',
          start: active.selectionStart,
          end: active.selectionEnd,
        }
      : null;

  const body =
    state.view === 'board'
      ? renderBoard(data, state)
      : state.view === 'wire'
        ? renderWire(data, state)
        : `${renderHeader(state, data, { dateline: formatAnalysisDateline(data), actions: '' })}${renderAnalysis(state)}`;
  container.innerHTML = `<div class="nv-shell"><div class="nv-page">${body}</div></div>`;
  if (state.view === 'analysis') mountAnalysis(container.querySelector('[data-analysis-root]'), state);

  if (restore) {
    const input = container.querySelector(restore.selector);
    if (input) {
      input.focus();
      try {
        input.setSelectionRange(restore.start, restore.end);
      } catch {
        /* search inputs on some browsers disallow selection APIs */
      }
    }
  }
}

/** One delegated listener set on the container; survives re-renders. */
export function attachHandlers(container) {
  container.addEventListener('click', (event) => {
    const on = (attr) => event.target.closest(`[${attr}]`);

    const article = event.target.closest('a.nv-article');
    if (article) return; // let article links navigate; don't toggle the row

    let el;
    if ((el = on('data-keyword'))) {
      event.stopPropagation();
      toggleKeyword(el.getAttribute('data-keyword'));
    } else if ((el = on('data-dive'))) {
      diveToStory(el.getAttribute('data-dive'));
    } else if ((el = on('data-section'))) {
      diveToSection(el.getAttribute('data-section'));
    } else if ((el = on('data-cat'))) {
      setCat(el.getAttribute('data-cat'));
    } else if ((el = on('data-sort'))) {
      setSort(el.getAttribute('data-sort'));
    } else if (on('data-go-analysis')) {
      goAnalysis();
    } else if ((el = on('data-entry'))) {
      selectEntry(el.getAttribute('data-entry'));
    } else if ((el = on('data-panel'))) {
      selectPanel(el.getAttribute('data-panel'));
    } else if (on('data-analysis-retry')) {
      retryAnalysis();
    } else if (on('data-go-wire')) {
      goWire();
    } else if (on('data-go-board')) {
      goBoard();
    } else if (on('data-clear-query')) {
      setQuery('');
    } else if (on('data-clear-keyword')) {
      toggleKeyword(getState().keyword);
    } else if (on('data-reset')) {
      resetFilters();
    } else if ((el = on('data-toggle'))) {
      toggleStory(el.getAttribute('data-toggle'));
    }
  });

  container.addEventListener('input', (event) => {
    if (event.target.hasAttribute('data-wire-search')) {
      setQuery(event.target.value);
    } else if (event.target.hasAttribute('data-board-search')) {
      searchFromBoard(event.target.value);
    }
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-toggle],[data-dive]');
    if (!target || event.target.closest('a,button,input')) return;
    event.preventDefault();
    if (target.hasAttribute('data-toggle')) toggleStory(target.getAttribute('data-toggle'));
    else diveToStory(target.getAttribute('data-dive'));
  });
}
