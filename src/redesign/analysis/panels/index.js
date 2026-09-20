/**
 * Panel registry. Each panel module exports mount(section, ctx). Names come
 * from the entry's `panels` list; an unknown name gets a placeholder so the
 * index can add or drop panels without a code change here.
 */
import * as timeline from './timeline.js';
import * as archetypes from './archetypes.js';
import * as stats from './stats.js';
import * as categories from './categories.js';
import * as topstories from './topstories.js';

export const PANEL_LABELS = {
  timeline: 'Timeline',
  topstories: 'Top stories',
  archetypes: 'Archetypes',
  stats: 'Stats',
  categories: 'Categories',
};

const PANELS = {};

export function registerPanel(name, mod) {
  PANELS[name] = mod;
}

export function mountPanel(name, section, ctx) {
  const mod = PANELS[name];
  if (!mod) {
    section.innerHTML = `<p class="an-stub">The “${PANEL_LABELS[name] || name}” panel is not available in this build.</p>`;
    return;
  }
  mod.mount(section, ctx);
}

registerPanel('timeline', timeline);
registerPanel('topstories', topstories);
registerPanel('archetypes', archetypes);
registerPanel('stats', stats);
registerPanel('categories', categories);
