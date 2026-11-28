/**
 * App shell: header, navigation, footer.
 */

import { h, icon } from './lib/dom.js';
import * as store from './lib/store.js';
import { renderMermaid } from './lib/mermaid.js';

const NAV = [
  { href: '#/', label: 'Today', match: (p) => p === '/' },
  { href: '#/library', label: 'Library', match: (p) => p.startsWith('/library') },
  { href: '#/roadmap', label: 'Roadmap', match: (p) => p.startsWith('/roadmap') },
  { href: '#/review', label: 'Review', match: (p) => p.startsWith('/review'), badge: true },
  { href: '#/progress', label: 'Progress', match: (p) => p.startsWith('/progress') },
];

function isActive(item, path) {
  return item.match(path);
}

export function header(path) {
  const streak = store.streak();
  const level = store.levelInfo();
  const due = store.cardCounts().due;

  const streakValue = h('strong', null, String(streak));
  const xpValue = h('strong', null, store.getState().xp.toLocaleString());

  const nav = h(
    'nav',
    { class: 'nav', 'aria-label': 'Primary' },
    NAV.map((item) => {
      const link = h(
        'a',
        {
          href: item.href,
          'aria-current': isActive(item, path) ? 'page' : null,
          dataset: { label: item.label, nav: '' },
        },
        item.label,
      );
      if (item.badge && due > 0) {
        link.appendChild(h('span', { class: 'nav-badge' }, due > 99 ? '99+' : String(due)));
      }
      return link;
    }),
  );

  const themeButton = h(
    'button',
    {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Toggle theme',
      onclick: () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        store.setTheme(next);
        renderMermaid(document).catch(() => {});
        themeButton.replaceChildren(
          icon(next === 'dark' ? 'sun' : 'moon'),
        );
      },
    },
    icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'),
  );

  const el = h(
    'header',
    { class: 'header' },
    h(
      'div',
      { class: 'header-inner' },
      h(
        'a',
        { class: 'brand', href: '#/' },
        h('span', { class: 'brand-mark' }, 'workbench'),
        h('span', { class: 'brand-sub' }, 'AI engineering from scratch'),
      ),
      nav,
      h(
        'div',
        { class: 'header-meta' },
        h(
          'span',
          { class: 'meta-stat', title: 'Day streak' },
          icon('flame', 14),
          streakValue,
        ),
        h(
          'span',
          { class: 'meta-stat', title: 'Experience points' },
          icon('bolt', 14),
          xpValue,
          h('span', { class: 'muted' }, `· L${level.level}`),
        ),
        themeButton,
      ),
    ),
  );

  return {
    el,
    refresh() {
      const state = store.getState();
      streakValue.textContent = String(store.streak());
      xpValue.textContent = state.xp.toLocaleString();
      const levelNow = store.levelInfo();
      const muted = xpValue.parentElement?.querySelector('.muted');
      if (muted) muted.textContent = `· L${levelNow.level}`;

      const current = NAV.find((item) => isActive(item, path));
      for (const link of nav.querySelectorAll('a')) {
        link.removeAttribute('aria-current');
      }
      if (current) {
        const active = [...nav.querySelectorAll('a')].find(
          (a) => a.dataset.label === current.label,
        );
        if (active) active.setAttribute('aria-current', 'page');
      }

      const dueNow = store.cardCounts().due;
      const reviewLink = [...nav.querySelectorAll('a')].find((a) => a.dataset.label === 'Review');
      if (reviewLink) {
        reviewLink.querySelector('.nav-badge')?.remove();
        if (dueNow > 0) {
          reviewLink.appendChild(
            h('span', { class: 'nav-badge' }, dueNow > 99 ? '99+' : String(dueNow)),
          );
        }
      }
    },
  };
}

export function footer() {
  return h(
    'footer',
    { class: 'footer' },
    h(
      'div',
      { class: 'footer-inner' },
      h('span', null, 'Workbench · 542 lessons · built from the repo, not a PDF'),
      h(
        'span',
        { class: 'row', style: 'gap:18px' },
        h(
          'a',
          { href: 'https://aiengineeringfromscratch.com/', target: '_blank', rel: 'noreferrer' },
          'Course site',
        ),
        h(
          'a',
          {
            href: 'https://github.com/rohitg00/ai-engineering-from-scratch',
            target: '_blank',
            rel: 'noreferrer',
          },
          'Repository',
        ),
        h('span', null, 'Progress stays in this browser'),
      ),
    ),
  );
}
