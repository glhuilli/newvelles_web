export const html = `
  <p class="panel-note"><b>Definitions.</b> A <b>run</b> is one pipeline execution
  (median 5 per day). An <b>observation</b> is a story seen in one run. <b>Distinct</b>
  counts unique stories in the window. <b>New</b> counts stories on the first day they
  ever appeared. A <b>source</b> is an outlet as resolved by the source table.</p>
  <div class="chart-box" style="margin-bottom:12px">
    <div class="box-head"><span class="box-title">Core stats · median (p25–p75)</span></div>
    <div id="stats-core"></div>
  </div>
  <div class="chart-box">
    <div class="box-head"><span class="box-title" id="stats-src-title"></span></div>
    <div id="stats-sources"></div>
  </div>`;

export function mount(section, ctx) {
  const { D, $ } = ctx;
  section.innerHTML = html;

  function renderStats() {
    const S = D.stats;
    if (!S) {
      $('stats-core').innerHTML =
        "<p class='panel-note'>Stats need the outlets-enabled dataset (parquet v2). Rebuild the payload after the v2 backfill.</p>";
      return;
    }
    const fmt = (m) => (m ? `<b>${m.median.toLocaleString()}</b> <span style="color:var(--muted)">(${m.p25}–${m.p75})</span>` : '—');
    const g = S.grains;
    $('stats-core').innerHTML = `
      <table class="ledger"><thead><tr>
        <th>Metric</th><th>Per run</th><th>Per day</th><th>Per week</th></tr></thead>
      <tbody>
        <tr><td>Story observations</td><td class="num">${fmt(g.run.observations)}</td><td class="num">${fmt(g.day.observations)}</td><td class="num">${fmt(g.week.observations)}</td></tr>
        <tr><td>Distinct stories</td><td class="num">${fmt(g.run.distinct)}</td><td class="num">${fmt(g.day.distinct)}</td><td class="num">${fmt(g.week.distinct)}</td></tr>
        <tr><td>New stories</td><td class="num">${fmt(g.run.new)}</td><td class="num">${fmt(g.day.new)}</td><td class="num">${fmt(g.week.new)}</td></tr>
        <tr><td>Distinct stories per source, per active day</td><td class="num" colspan="3">${fmt(g.per_source.distinct_per_day)} <span style="color:var(--muted)">· ${g.per_source.note}</span></td></tr>
      </tbody></table>`;
    $('stats-src-title').textContent =
      `Top 10 of ${S.n_sources} sources by distinct stories`;
    const maxShare = Math.max(...S.top_sources.map((s) => s.share));
    $('stats-sources').innerHTML = `
      <table class="ledger"><thead><tr>
        <th>Source</th><th>Distinct stories</th><th>Story-days</th><th>Active days</th>
        <th>Median distinct/day</th><th>Share of story-days</th></tr></thead>
      <tbody>${S.top_sources.map((s) => `
        <tr><td class="headline">${s.source}</td>
        <td class="num">${s.stories.toLocaleString()}</td>
        <td class="num">${s.story_days.toLocaleString()}</td>
        <td class="num">${s.active_days.toLocaleString()}</td>
        <td class="num">${s.median_per_day}</td>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div style="height:8px;border-radius:4px;background:var(--s1);width:${Math.round(120 * s.share / maxShare)}px"></div>
          <span class="num" style="font-variant-numeric:tabular-nums">${(100 * s.share).toFixed(1)}%</span></div></td></tr>`).join('')}
      </tbody></table>`;
  }

  renderStats();
}
