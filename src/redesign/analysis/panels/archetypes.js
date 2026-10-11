import * as d3 from 'd3';

export const html = `
  <p class="panel-note" id="arch-note"></p>
  <div class="arch-grid" id="arch-grid"></div>
  <div class="discord-title">Days that resemble no other days</div>
  <p class="panel-note">Matrix-profile discords over the daily volume series — the
  14-day windows farthest from every other window in five years.</p>
  <div class="discord-row" id="discords"></div>`;

export function mount(section, ctx) {
  const { D, $, P, fmtD } = ctx;
  section.innerHTML = html;

  function renderArchetypes() {
    const A = D.archetypes;
    $('arch-note').innerHTML =
      `<b>${A.n.toLocaleString()} stories</b> that ran ≥ 5 distinct days, each coverage curve ` +
      `normalized to unit time and clustered by shape (k-means, k=${A.clusters.length}; ` +
      `silhouette ${A.silhouette}). Thin lines are individual stories; the heavy line is each ` +
      `cluster's medoid.`;
    const grid = d3.select($('arch-grid'));
    for (const c of A.clusters) {
      const cell = grid.append('div').attr('class', 'arch-cell');
      cell.append('div').attr('class', 'arch-name').text(c.name);
      cell.append('div').attr('class', 'arch-meta')
        .text(`${c.size.toLocaleString()} stories · ${(c.share * 100).toFixed(1)}%`);
      const svg = cell.append('svg').attr('viewBox', '0 0 300 110');
      const sx = d3.scaleLinear().domain([0, c.medoid.length - 1]).range([4, 296]);
      const sy = d3.scaleLinear().domain([0, 1.05]).range([104, 6]);
      const line = d3.line().x((v, i) => sx(i)).y((v) => sy(v)).curve(d3.curveBasis);
      for (const m of c.members) {
        svg.append('path').datum(m).attr('d', line).style('fill', 'none')
          .style('stroke', 'var(--muted)').style('opacity', 0.3).style('stroke-width', 1);
      }
      svg.append('path').datum(c.medoid).attr('d', line).style('fill', 'none')
        .style('stroke', 'var(--s1)').style('stroke-width', 2.4);
    }
    const dr = d3.select($('discords'));
    for (const w of D.discords) {
      const cell = dr.append('div').attr('class', 'discord-cell');
      cell.append('div').attr('class', 'arch-meta')
        .text(`${fmtD(P(w.start))} – ${fmtD(P(w.end))} · score ${w.score}`);
      const svg = cell.append('svg').attr('viewBox', '0 0 200 74');
      const sx = d3.scaleLinear().domain([0, w.curve.length - 1]).range([3, 197]);
      const sy = d3.scaleLinear().domain([0, d3.max(w.curve)]).range([70, 6]);
      svg.append('path').datum(w.curve)
        .attr('d', d3.area().x((v, i) => sx(i)).y0(70).y1((v) => sy(v)).curve(d3.curveMonotoneX))
        .style('fill', 'var(--s8)').style('opacity', 0.22);
      svg.append('path').datum(w.curve)
        .attr('d', d3.line().x((v, i) => sx(i)).y((v) => sy(v)).curve(d3.curveMonotoneX))
        .style('fill', 'none').style('stroke', 'var(--s8)').style('stroke-width', 1.8);
    }
  }

  renderArchetypes();
}
