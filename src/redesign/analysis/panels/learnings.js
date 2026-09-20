import html from './learnings.html?raw';

export function mount(section) {
  section.innerHTML = html;
}
