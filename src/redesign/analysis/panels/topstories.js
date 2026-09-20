import * as d3 from 'd3';

export const html = `
  <p class="panel-note">The 20 curated landmark events, plus each major category's top
  stories. <b>Selection:</b> relevance = peak outlet count relative to that year's
  median (so a 12-outlet 2022 peak can outrank a 15-outlet 2026 peak from a bigger
  pipeline). <b>Top 25</b> is the pure relevance ranking across all five years — some
  years may be absent. <b>5 per year</b> guarantees every year its five biggest
  stories. Click any column header to sort.</p>
  <div class="controls" id="ts-chips" style="margin-bottom:8px;flex-wrap:wrap"></div>
  <div class="controls" id="ts-mode" style="margin-bottom:12px"></div>
  <div class="chart-box ledger-wrap"><div id="ts-table"></div></div>`;

export function mount(section, ctx) {
  const { D, $, P, fmtD, EVENTS } = ctx;
  section.innerHTML = html;

  let tsSelected = '__landmark__';
  let tsMode = 'top';                       // "top" (25 by relevance) | "top_yearly"
  let tsSort = { key: 'n', dir: 1 };
  const TS_COLS = [['n', '#'], ['event', 'Event'], ['title', 'Anchor story'],
                   ['first', 'Broke'], ['pd', 'Peak day'], ['sub', 'Category'],
                   ['tags', 'Tags'], ['outlets', 'Outlets'], ['days', 'Days'], ['linked', 'Linked'],
                   ['curve', 'Coverage curve']];
  const withCluster = (e) => {
    const C = (D.clusters || {})[e.uid] || {};
    return { ...e, event: C.t || e.event, first: C.b || e.first || e.d,
             pd: C.p || e.pd || e.d, days: C.d ?? e.days, linked: C.n || 1 };
  };
  // Same drawing as the retired ledger: outlets per day over the story's
  // life, resampled to 24 points by the builder (story_curve).
  const sparkline = (curve) => {
    if (!curve || curve.length < 2) return '<span class="why">—</span>';
    const sx = d3.scaleLinear().domain([0, curve.length - 1]).range([2, 118]);
    const sy = d3.scaleLinear().domain([0, d3.max(curve) || 1]).range([21, 3]);
    const d = d3.line().x((v, i) => sx(i)).y((v) => sy(v)).curve(d3.curveMonotoneX)(curve);
    return `<svg viewBox="0 0 120 24" style="width:120px;display:inline-block" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.5"/></svg>`;
  };

  function renderTopStories() {
    const groups = [['__landmark__', 'Landmark events'],
                    ...Object.keys(D.drill || {}).map((m) => [m, m])];
    d3.select($('ts-chips')).selectAll('button').data(groups).join('button')
      .attr('aria-pressed', ([k]) => String(k === tsSelected))
      .text(([, label]) => label)
      .on('click', (ev, [k]) => { tsSelected = k; renderTopStories(); });

    const landmark = tsSelected === '__landmark__';
    $('ts-mode').hidden = landmark;
    d3.select($('ts-mode')).selectAll('button')
      .data([['top', 'top 25 · relevance'], ['top_yearly', '5 per year']]).join('button')
      .attr('aria-pressed', ([k]) => String(k === tsMode))
      .text(([, label]) => label)
      .on('click', (ev, [k]) => { tsMode = k; renderTopStories(); });

    const list = (landmark ? EVENTS : D.drill[tsSelected][tsMode]).map(withCluster);
    const { key, dir } = tsSort;
    list.sort((p, q) => {
      let a = p[key] ?? p.d, b = q[key] ?? q.d;
      if (key === 'tags') { a = (p.tags || []).join(); b = (q.tags || []).join(); }
      if (key === 'first' || key === 'pd') { a = a || p.d; b = b || q.d; }
      return (a < b ? -1 : a > b ? 1 : 0) * dir;
    });
    $('ts-table').innerHTML = `
      <table class="ledger"><thead><tr>${TS_COLS.map(([k, label]) =>
        `<th data-k="${k}" class="${k === key ? 'sorted' : ''}">${label}${k === key ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}
      </tr></thead>
      <tbody>${list.map((e) => `
        <tr><td class="num" style="color:var(--s8);font-weight:700">${e.n}</td>
        <td class="headline" style="max-width:180px">${e.event || ''}</td>
        <td class="why" style="max-width:300px">${e.title}</td>
        <td style="white-space:nowrap">${fmtD(P(e.first || e.d))}</td>
        <td style="white-space:nowrap">${fmtD(P(e.pd || e.d))}</td>
        <td class="why">${e.sub || '—'}</td>
        <td class="why">${(e.tags || []).join(', ')}</td>
        <td class="num">${e.outlets}</td>
        <td class="num">${e.days}</td>
        <td class="num">${e.linked}</td>
        <td>${sparkline(e.curve)}</td></tr>`).join('')}
      </tbody></table>`;
    $('ts-table').querySelectorAll('th').forEach((th) => {
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        if (k === 'curve') return;
        tsSort = { key: k, dir: k === tsSort.key ? -tsSort.dir : 1 };
        renderTopStories();
      });
    });
  }

  renderTopStories();
}
