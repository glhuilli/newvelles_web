import * as d3 from 'd3';

export const html = `
  <p class="panel-note">Brush the strip to zoom. The river shows each week's share of
  stories per <b>major category</b> — <b>click a band to drill into its
  sub-categories</b>, where markers become that category's top 25 stories by relevance
  (era-relative peak coverage). The strip
  is era-normalized (volume vs a trailing 91-day baseline; 1.0 = a typical day).
  Numbered markers are landmark events — hover to expand the title in place. Read all
  top stories in the <b>Top stories</b> tab.</p>
  <div class="chart-box" style="margin-bottom:12px">
    <div id="strip"></div>
  </div>
  <div class="chart-box">
    <div id="drill-title" hidden
      style="font-size:21px;font-weight:500;letter-spacing:-0.01em;margin-bottom:2px"></div>
    <div class="box-head">
      <span class="box-title" id="stream-title">Stories per week by section</span>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <span class="legend" id="stream-legend"></span>
        <div class="controls" id="drill-mode" hidden></div>
        <div class="controls">
          <button id="stream-back" hidden>← all categories</button>
        </div>
      </div>
    </div>
    <div id="stream"></div>
  </div>`;

export function mount(section, ctx) {
  const { D, $, P, fmtD, fmtMo, SECTIONS, SCOLOR, daily, weekly, EVENTS, T0, T1, showTip, hideTip, showTipAt, svgIn } = ctx;
  section.innerHTML = html;

  const TL = { W: 1180, HS: 96, HD: 380, ML: 8, MR: 8 };
  let window0 = [d3.timeMonth.offset(T1, -18), T1];
  let drillTo = null;   // null = all majors; otherwise a major name
  let drillMode = 'top';   // marker list in drill view: "top" | "top_yearly"
  let pinnedCluster = null;

  const markerDate = (item) => {
    const C = (D.clusters || {})[item.uid];
    return C ? P(C.b) : item.dd;
  };

  /* numbered marker: hover = event info box; click = pin the linkage lane */
  function drawMarker(svg, cx, cy, item, hInner) {
    const C = (D.clusters || {})[item.uid];
    svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', cy + 8).attr('y2', hInner)
      .style('stroke', 'var(--s8)').style('stroke-width', 1).style('stroke-dasharray', '2,3')
      .style('opacity', 0.6).style('pointer-events', 'none');
    const g = svg.append('g').style('cursor', C ? 'pointer' : 'default');
    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 7)
      .style('fill', 'var(--s8)').style('stroke', 'var(--surface)')
      .style('stroke-width', pinnedCluster === item.uid ? 3 : 1.5);
    g.append('text').attr('x', cx).attr('y', cy + 3).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-weight', 700).style('fill', '#fff')
      .style('pointer-events', 'none').text(item.n);
    const name = (C && C.t) || item.event || item.title;
    g.on('mouseenter', function (ev) {
      d3.select(this).select('circle').attr('r', 9);
      const box = this.getBoundingClientRect();
      const body = C ? `
        <div style="margin-top:4px">broke <b>${fmtD(P(C.b))}</b> · peak <b>${fmtD(P(C.p))}</b> (${C.pa} articles)</div>
        <div><b>${C.d}</b> days continuous · ${C.cd} coverage days in ${C.eps.length} period${C.eps.length === 1 ? '' : 's'}</div>
        <div>${C.n} linked stories${item.sub ? ` · ${item.sub}` : ''}</div>
        <div style="color:var(--muted);margin-top:2px">click to ${pinnedCluster === item.uid ? 'hide' : 'show'} the linked stories</div>` : `
        <div style="margin-top:4px">broke <b>${fmtD(P(item.first || item.d))}</b> · peak <b>${fmtD(P(item.pd || item.d))}</b></div>
        <div>${item.outlets} outlets · ${item.days} day${item.days === 1 ? '' : 's'}</div>`;
      showTipAt(`
        <div class="t-strong">${item.n}. ${name}</div>
        ${item.title && item.title !== name
          ? `<div class="t-date" style="text-transform:none;font-size:11px;margin:2px 0">anchor: ${item.title.slice(0, 84)}${item.title.length > 84 ? '…' : ''}</div>` : ''}
        ${body}
        ${item.tags && item.tags.length ? `<div style="color:var(--muted);margin-top:2px">${item.tags.join(', ')}</div>` : ''}`,
        box.left + box.width / 2, box.bottom + 6);
    }).on('mouseleave', function () {
      d3.select(this).select('circle').attr('r', 7);
      hideTip();
    }).on('click', () => {
      if (!C) return;
      pinnedCluster = pinnedCluster === item.uid ? null : item.uid;
      hideTip(); renderStream();
    });
  }

  /* linkage lane: one dot per linked story at its first day + episode bars */
  function drawClusterLane(svg, x, a, b) {
    const C = (D.clusters || {})[pinnedCluster];
    if (!C) return;
    const laneY = TL.HD - 44;
    for (const ep of C.eps) {
      const x0 = Math.max(x(P(ep[0])), TL.ML), x1 = Math.min(x(P(ep[1])), TL.W - TL.MR);
      if (x1 < TL.ML || x0 > TL.W - TL.MR) continue;
      svg.append('line').attr('x1', x0).attr('x2', Math.max(x1, x0 + 2))
        .attr('y1', laneY + 12).attr('y2', laneY + 12)
        .style('stroke', 'var(--s8)').style('stroke-width', 4)
        .style('stroke-linecap', 'round').style('opacity', 0.5);
    }
    svg.append('text').attr('x', TL.ML + 2).attr('y', laneY - 10)
      .style('font-size', '10.5px').style('font-weight', 600).style('fill', 'var(--s8)')
      .text(`${C.t} — ${C.n} linked stories, coverage periods below`);
    for (const m of C.members) {
      const md = P(m.f);
      if (md < a || md > b) continue;
      svg.append('circle').attr('cx', x(md)).attr('cy', laneY).attr('r', 4)
        .style('fill', 'var(--surface)').style('stroke', 'var(--s8)').style('stroke-width', 2)
        .style('cursor', 'default')
        .on('mouseenter', function () {
          d3.select(this).attr('r', 5.5);
          const box = this.getBoundingClientRect();
          showTipAt(`
            <div class="t-strong">${m.t}</div>
            <div style="margin-top:3px">appeared <b>${fmtD(P(m.f))}</b> · ${m.days} day${m.days === 1 ? '' : 's'} in the news</div>
            <div>${m.a} articles · ${m.o} outlets</div>
            ${m.tags && m.tags.length ? `<div style="color:var(--muted);margin-top:2px">${m.tags.join(', ')}</div>` : ''}`,
            box.left + box.width / 2, box.bottom + 6);
        })
        .on('mouseleave', function () { d3.select(this).attr('r', 4); hideTip(); });
    }
  }

  function renderTimeline() {
    const xF = d3.scaleTime().domain([T0, T1]).range([TL.ML, TL.W - TL.MR]);
    const svg = svgIn($('strip'), TL.W, TL.HS + 30);
    // era-normalized volume index: 1.0 = a typical day for that era, so the
    // mid-2026 pipeline growth doesn't dwarf every earlier news cycle
    const y = d3.scaleLinear().domain([0, d3.max(daily, (r) => r.x)]).range([TL.HS, 20]);
    svg.append('line').attr('x1', TL.ML).attr('x2', TL.W - TL.MR)
      .attr('y1', y(1)).attr('y2', y(1)).attr('class', 'gridline');
    svg.append('path').datum(daily)
      .attr('d', d3.area().x((r) => xF(r.d)).y0(TL.HS).y1((r) => y(r.x)))
      .style('fill', 'var(--s1)').style('opacity', 0.25);
    svg.append('path').datum(daily)
      .attr('d', d3.line().x((r) => xF(r.d)).y((r) => y(r.x)))
      .style('stroke', 'var(--s1)').style('fill', 'none').style('stroke-width', 1);
    svg.append('text').attr('x', TL.ML + 4).attr('y', y(1) - 4)
      .style('font-size', '10px').style('fill', 'var(--muted)')
      .text('volume vs typical day (era-normalized) · 1.0 = baseline');
    for (const e of EVENTS) drawMarker(svg, xF(markerDate(e)), 10, e, TL.HS);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${TL.HS})`)
      .call(d3.axisBottom(xF).ticks(d3.timeYear.every(1)).tickSizeOuter(0))
      .select('.domain').remove();
    const brush = d3.brushX().extent([[TL.ML, 4], [TL.W - TL.MR, TL.HS]])
      .on('end', (ev) => {
        window0 = ev.selection ? ev.selection.map(xF.invert) : [T0, T1];
        renderStream();
      });
    svg.append('g').call(brush).call(brush.move, window0.map(xF));
    svg.selectAll('.selection').style('fill', 'var(--s1)').style('fill-opacity', 0.10).style('stroke', 'var(--s1)');

    $('stream-back').onclick = () => { drillTo = null; pinnedCluster = null; renderStream(); };
    renderStream();
  }

  function renderStream() {
    d3.select($('stream')).selectAll('*').remove();
    const [a, b] = window0;
    const view = drillTo ? D.drill[drillTo] : null;
    const keys = view ? view.order : SECTIONS;
    const color = view
      ? Object.fromEntries(keys.map((k, i) => [k, `var(--s${(i % 8) + 1})`]))
      : SCOLOR;
    const allRows = view
      ? view.weekly.map((r) => ({ ...r, d: P(r.d) }))
      : weekly;
    const markers = (view ? view[drillMode].map((t) => ({ ...t, dd: P(t.d) })) : EVENTS)
      .filter((m) => markerDate(m) >= a && markerDate(m) <= b);
    const rows = allRows.filter((r) => r.d >= d3.timeMonday.floor(a) && r.d <= b);
    $('stream-back').hidden = !drillTo;
    const dt = $('drill-title');
    dt.hidden = !drillTo;
    dt.textContent = drillTo || '';
    const dm = $('drill-mode');
    dm.hidden = !drillTo;
    d3.select(dm).selectAll('button')
      .data([['top', 'top 25'], ['top_yearly', '5 per year']]).join('button')
      .attr('aria-pressed', ([k]) => String(k === drillMode))
      .text(([, label]) => label)
      .on('click', (ev, [k]) => { drillMode = k; renderStream(); });
    d3.select($('stream-legend')).selectAll('span.li').data(keys).join('span').attr('class', 'li')
      .html((s) => `<span class="sw" style="background:${color[s]}"></span>${s}`);
    if (rows.length < 2) return;
    $('stream-title').textContent = drillTo
      ? `${drillTo} · weekly share by ${drillTo === 'Other' ? 'category' : 'sub-category'} · ${fmtMo(rows[0].d)} – ${fmtMo(rows[rows.length - 1].d)}`
      : `Weekly share by major category · click a band to drill in · ${fmtMo(rows[0].d)} – ${fmtMo(rows[rows.length - 1].d)}`;

    const svg = svgIn($('stream'), TL.W, TL.HD);
    // fixed order: bands keep their vertical position and color pairing across
    // every brushed window (keys arrive size-sorted from the payload)
    const series = d3.stack().keys(keys).offset(d3.stackOffsetExpand)
      .order(d3.stackOrderNone)(rows);
    const x = d3.scaleTime().domain([rows[0].d, rows[rows.length - 1].d]).range([TL.ML, TL.W - TL.MR]);
    const y = d3.scaleLinear()
      .domain([d3.min(series, (s) => d3.min(s, (p) => p[0])), d3.max(series, (s) => d3.max(s, (p) => p[1]))])
      .range([TL.HD - 24, 42]);
    const area = d3.area().x((p) => x(p.data.d)).y0((p) => y(p[0])).y1((p) => y(p[1])).curve(d3.curveBasis);
    const paths = svg.append('g').selectAll('path').data(series).join('path')
      .attr('d', area).style('fill', (s) => color[s.key])
      .style('stroke', 'var(--surface)').style('stroke-width', 1)
      .style('cursor', drillTo ? 'default' : 'pointer')
      .on('click', (ev, s) => {
        if (!drillTo && D.drill && D.drill[s.key]) { drillTo = s.key; pinnedCluster = null; hideTip(); renderStream(); }
      })
      .on('mousemove', function (ev, s) {
        paths.style('opacity', (p) => (p === s ? 1 : 0.35));
        const wi = d3.bisector((r) => r.d).center(rows, x.invert(d3.pointer(ev, svg.node())[0]));
        showTip(`<div class="t-date">week of ${fmtD(rows[wi].d)}</div>
          <div><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${color[s.key]}"></span>
          <span class="t-strong"> ${s.key}</span> · ${rows[wi][s.key]} stories</div>
          ${drillTo ? '' : "<div style='color:var(--muted)'>click to drill in</div>"}`, ev);
      })
      .on('mouseleave', () => { paths.style('opacity', 1); hideTip(); });
    for (const s of series) {
      let best = 0, bi = 0;
      s.forEach((p, i) => { const t = Math.abs(y(p[0]) - y(p[1])); if (t > best) { best = t; bi = i; } });
      if (best > 24) {
        svg.append('text').attr('x', x(s[bi].data.d)).attr('y', (y(s[bi][0]) + y(s[bi][1])) / 2 + 4)
          .attr('text-anchor', 'middle').style('font-size', '11.5px').style('font-weight', 600)
          .style('fill', 'var(--ink)').style('pointer-events', 'none')
          .style('paint-order', 'stroke').style('stroke', 'var(--surface)')
          .style('stroke-width', 3).style('stroke-opacity', 0.75).text(s.key);
      }
    }
    for (const m of markers) drawMarker(svg, x(markerDate(m)), 12, m, TL.HD - 24);
    drawClusterLane(svg, x, a, b);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${TL.HD - 24})`)
      .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0)).select('.domain').remove();
  }

  renderTimeline();
}
