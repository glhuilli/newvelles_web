import * as d3 from 'd3';

export const html = `
  <p class="panel-note">Every story is a dot: when it was born vs how many days it ran
  (log scale); size is peak outlet count. Gray is context; labeled blue dots are the
  longest, loudest stories of the archive.</p>
  <div class="chart-box">
    <div class="box-head"><span class="box-title" id="lifetimes-title"></span></div>
    <div id="lifetimes"></div>
  </div>`;

export function mount(section, ctx) {
  const { D, $, P, fmtD, T0, T1, showTip, hideTip, svgIn } = ctx;
  section.innerHTML = html;

  function renderLifetimes() {
    const L = D.lifetimes;
    $('lifetimes-title').textContent =
      `${L.shown.toLocaleString()} of ${L.total.toLocaleString()} stories drawn ` +
      `(long-running and high-coverage stories kept preferentially; the rest sampled)`;
    const W = 1180, H = 460, M = { l: 52, r: 14, t: 12, b: 26 };
    const svg = svgIn($('lifetimes'), W, H);
    const x = d3.scaleTime().domain([T0, T1]).range([M.l, W - M.r]);
    const ymax = d3.max(L.base.concat(L.named), (r) => r.span);
    const y = d3.scaleLog().domain([1, ymax * 1.3]).range([H - M.b, M.t]);
    const r = d3.scaleSqrt().domain([2, d3.max(L.base.concat(L.named), (p) => p.peak)]).range([1.6, 11]);
    const ticks = [1, 7, 30, 90, 365].filter((t) => t <= ymax * 1.3);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('class', 'gridline').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', M.l - 8).attr('y', (t) => y(t) + 4).attr('text-anchor', 'end')
      .style('font-size', '11px').style('fill', 'var(--muted)')
      .text((t) => (t === 1 ? '1 day' : t === 365 ? '1 year' : t + 'd'));
    svg.append('g').selectAll('circle').data(L.base).join('circle')
      .attr('cx', (p) => x(P(p.d))).attr('cy', (p) => y(Math.max(1, p.span))).attr('r', (p) => r(p.peak))
      .style('fill', 'var(--muted)').style('opacity', 0.22)
      .on('mousemove', (ev, p) => showTip(`<div class="t-date">${fmtD(P(p.d))}</div>
        <div>ran <span class="t-strong">${p.span}d</span> · peak ${p.peak} outlets</div>`, ev))
      .on('mouseleave', hideTip);
    svg.append('g').selectAll('circle').data(L.named).join('circle')
      .attr('cx', (p) => x(P(p.d))).attr('cy', (p) => y(Math.max(1, p.span))).attr('r', (p) => r(p.peak))
      .style('fill', 'var(--s1)').style('stroke', 'var(--surface)').style('stroke-width', 2)
      .on('mousemove', (ev, p) => showTip(`<div class="t-strong">${p.label}</div>
        <div>${p.linked ? `event cluster: ${p.linked} linked stories · ` : ''}ran ${p.span}d · peak ${p.peak} outlets${p.cat ? ` · ${p.cat}` : ''}</div>`, ev))
      .on('mouseleave', hideTip);
    svg.append('g').selectAll('text.nl').data(L.named).join('text')
      .attr('x', (p) => { const cx = x(P(p.d)); return cx > W * 0.75 ? cx - r(p.peak) - 5 : cx + r(p.peak) + 5; })
      .attr('y', (p) => y(Math.max(1, p.span)) + 4)
      .attr('text-anchor', (p) => (x(P(p.d)) > W * 0.75 ? 'end' : 'start'))
      .style('font-size', '11px').style('font-weight', 600).style('fill', 'var(--ink)')
      .style('paint-order', 'stroke').style('stroke', 'var(--surface)').style('stroke-width', 3)
      .text((p) => p.label);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - M.b})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickSizeOuter(0)).select('.domain').remove();
  }

  renderLifetimes();
}
