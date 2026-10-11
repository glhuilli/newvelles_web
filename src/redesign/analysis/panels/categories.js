export const html = `
  <p class="panel-note" id="cat-note"></p>
  <div class="chart-box ledger-wrap"><div id="cat-table"></div></div>`;

export function mount(section, ctx) {
  const { D, $ } = ctx;
  section.innerHTML = html;

  function renderCategories() {
    const C = D.categories;
    const note = $('cat-note');
    if (!C) {
      note.textContent = 'Categories need story_labels.parquet — run the classification and rebuild.';
      return;
    }
    note.innerHTML = `Every story classified into a 3-level taxonomy (major → sub-category → meta
      tags) by Claude Haiku on Bedrock, validated against a Fable-labeled golden set.
      <b>${C.labeled.toLocaleString()}</b> stories labeled (${(100 * C.coverage).toFixed(1)}% of the archive).
      Ranked by distinct stories.`;
    const majorColor = Object.fromEntries(C.majors_order.map((mj, i) => [mj, `var(--s${(i % 8) + 1})`]));
    const maxShare = Math.max(...C.subs.map((s) => s.share));
    $('cat-table').innerHTML = `
      <table class="ledger"><thead><tr>
        <th>Sub-category</th><th>Major</th><th>Stories</th><th>Share</th>
        <th>Story-days</th><th>Median distinct/day</th><th>Top tags</th><th>Exemplar story</th></tr></thead>
      <tbody>${C.subs.map((s) => `
        <tr><td class="headline">${s.sub}</td>
        <td><span class="sec-chip"><span class="sw" style="background:${majorColor[s.major]}"></span>${s.major}</span></td>
        <td class="num">${s.stories.toLocaleString()}</td>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div style="height:8px;border-radius:4px;background:${majorColor[s.major]};width:${Math.max(2, Math.round(110 * s.share / maxShare))}px"></div>
          <span style="font-variant-numeric:tabular-nums">${(100 * s.share).toFixed(1)}%</span></div></td>
        <td class="num">${s.story_days.toLocaleString()}</td>
        <td class="num">${s.median_per_day}</td>
        <td class="why">${s.top_tags.join(', ')}</td>
        <td class="why">${s.exemplar}</td></tr>`).join('')}
      </tbody></table>`;
  }

  renderCategories();
}
