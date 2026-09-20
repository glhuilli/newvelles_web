/**
 * Panel registry. Each panel module exports mount(section, ctx). Names come
 * from the entry's `panels` list; an unknown name gets a placeholder so the
 * index can add or drop panels without a code change here.
 */
export const PANEL_LABELS = {
  timeline: 'Timeline',
  ledger: 'Ledger',
  lifetimes: 'Lifetimes',
  archetypes: 'Archetypes',
  stats: 'Stats',
  categories: 'Categories',
  topstories: 'Top stories',
  learnings: 'Learnings',
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
