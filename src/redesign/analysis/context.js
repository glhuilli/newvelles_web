/**
 * Shared helpers the dashboard renderers used from the top of the old
 * single-file script (analysis/site/template.html lines 405–430), built once
 * per mount. `$` resolves ids inside the analysis root only.
 */
import * as d3 from 'd3';

export function buildContext(payload, root) {
  const D = payload;
  const $ = (id) => root.querySelector('#' + id);
  const P = (d) => d3.timeParse('%Y-%m-%d')(d);
  const fmtD = d3.timeFormat('%b %d, %Y');
  const fmtMo = d3.timeFormat('%b %Y');
  const SECTIONS = D.sections;
  const SCOLOR = Object.fromEntries(SECTIONS.map((s, i) => [s, `var(--s${(i % 8) + 1})`]));
  const daily = D.daily.map((r) => ({ d: P(r.d), a: r.a, s: r.s, x: r.x ?? 1 }));
  const weekly = D.weekly.map((r) => ({ ...r, d: P(r.d) }));
  const EVENTS = (D.events || []).map((e) => ({ ...e, dd: P(e.d) }));
  const T0 = daily[0].d;
  const T1 = daily[daily.length - 1].d;

  const tip = $('tooltip');
  function showTip(html, ev) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  const hideTip = () => (tip.style.display = 'none');
  function showTipAt(html, cx, cy) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    let x = cx - tip.offsetWidth / 2, y = cy;
    x = Math.max(8, Math.min(x, innerWidth - tip.offsetWidth - 8));
    if (y + tip.offsetHeight > innerHeight - 8) y = cy - tip.offsetHeight - 32;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  const svgIn = (el, w, h) => d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`);

  return { D, root, $, P, fmtD, fmtMo, SECTIONS, SCOLOR, daily, weekly, EVENTS, T0, T1, tip, showTip, hideTip, showTipAt, svgIn };
}
