import * as d3 from 'd3';

export const html = `
  <p class="panel-note">The validation ledger: top stories by peak outlet count, each
  with its coverage curve. Click a column header to sort. If these rows contradict
  remembered reality, the pipeline — not the chart — is wrong.</p>
  <div class="chart-box ledger-wrap"><div id="ledger"></div></div>`;

export function mount(section, ctx) {
  const { D, $, P, fmtD, SCOLOR } = ctx;
  section.innerHTML = html;
  let sortKey = 'peak_outlets', sortDir = -1;

  function renderLedger() {
    const cols = [
      ['headline', 'Story'], ['section', 'Section'], ['peak_day', 'Broke'],
      ['peak_outlets', 'Peak outlets'], ['days', 'Days seen'], ['span', 'Span'],
      ['curve', 'Coverage curve'], ['why', 'Why flagged']];
    const wrap = d3.select($('ledger'));
    wrap.selectAll('*').remove();
    const table = wrap.append('table').attr('class', 'ledger');
    table.append('thead').append('tr').selectAll('th').data(cols).join('th')
      .classed('sorted', ([k]) => k === sortKey)
      .text(([, label]) => label)
      .on('click', (ev, [k]) => {
        if (k === 'curve') return;
        sortDir = k === sortKey ? -sortDir : (k === 'headline' || k === 'section' ? 1 : -1);
        sortKey = k; renderLedger();
      });
    const rows = [...D.ledger].sort((p, q) =>
      (p[sortKey] < q[sortKey] ? -1 : p[sortKey] > q[sortKey] ? 1 : 0) * sortDir);
    const tr = table.append('tbody').selectAll('tr').data(rows).join('tr');
    tr.append('td').attr('class', 'headline').text((r) => r.headline);
    tr.append('td').html((r) =>
      `<span class="sec-chip"><span class="sw" style="background:${SCOLOR[r.section] || 'var(--muted)'}"></span>${r.section}</span>` +
      (r.cat ? `<div class="why" style="margin-top:2px">${r.cat}</div>` : ''));
    tr.append('td').text((r) => fmtD(P(r.peak_day)));
    tr.append('td').attr('class', 'num').text((r) => r.peak_outlets);
    tr.append('td').attr('class', 'num').text((r) => r.days);
    tr.append('td').attr('class', 'num').text((r) => r.span + 'd');
    tr.append('td').each(function (r) {
      const s = d3.select(this).append('svg').attr('viewBox', '0 0 120 24').style('width', '120px');
      const sx = d3.scaleLinear().domain([0, r.curve.length - 1]).range([2, 118]);
      const sy = d3.scaleLinear().domain([0, d3.max(r.curve)]).range([21, 3]);
      s.append('path').datum(r.curve)
        .attr('d', d3.line().x((v, i) => sx(i)).y((v) => sy(v)).curve(d3.curveMonotoneX))
        .style('fill', 'none').style('stroke', 'var(--s1)').style('stroke-width', 1.5);
    });
    tr.append('td').attr('class', 'why').text((r) => r.why);
  }

  renderLedger();
}
