/**
 * Progress: what has actually stuck, not what has been opened.
 */

import { h, icon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { pct, phaseNumber, shortDate } from '../lib/format.js';

function heatmap() {
  const state = store.getState();
  const weeks = 15;
  const cells = [];
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday - (weeks - 1) * 7);

  for (let week = 0; week < weeks; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + week * 7 + day);
      const key = store.dayKey(date);
      const xp = state.days[key] || 0;
      const level = xp === 0 ? 0 : xp < 20 ? 1 : xp < 60 ? 2 : 3;
      cells.push(
        h('span', {
          class: 'heat',
          'data-level': String(level),
          title: `${key} · ${xp} XP`,
        }),
      );
    }
  }
  return h('div', { class: 'heatmap', role: 'img', 'aria-label': 'Learning activity by day' }, cells);
}

function tile(name, label, value, sub) {
  return h(
    'div',
    { class: 'tile' },
    h('div', { class: 'tile-label' }, icon(name, 13), label),
    h('div', { class: 'tile-value' }, value),
    h('div', { class: 'tile-sub' }, sub),
  );
}

export function progressView(catalog) {
  const state = store.getState();
  const level = store.levelInfo();
  const done = store.completedCount();
  const cards = store.cardCounts();
  const week = store.weeklyXp(7);
  const weekXp = week.reduce((sum, day) => sum + day.xp, 0);
  const weekLessons = Object.values(state.lessons).filter((lesson) => {
    if (!lesson.completedAt) return false;
    return Date.now() - new Date(lesson.completedAt).getTime() < 7 * 86_400_000;
  }).length;

  const rows = catalog.phases.map((phase) => {
    const progress = store.phaseProgress(phase);
    const percent = pct(progress.done, progress.total);
    return h(
      'a',
      { class: 'phase-bar', href: `#/phase/${phase.id}` },
      h(
        'span',
        null,
        h('span', { class: 'phase-bar-name' }, `${phaseNumber(phase.number)} · ${phase.title}`),
        h('small', null, `${progress.done} of ${progress.total} lessons`),
      ),
      h('div', { class: 'meter meter--thin' }, h('span', { style: `width:${percent}%` })),
      h('span', { class: 'phase-bar-num' }, `${percent}%`),
    );
  });

  const resetButton = h(
    'button',
    {
      class: 'btn btn--sm',
      type: 'button',
      onclick: () => {
        if (confirm('Erase all XP, lesson progress, cards, and notes in this browser?')) {
          store.reset();
          location.hash = '#/';
          location.reload();
        }
      },
    },
    icon('refresh', 13),
    'Reset progress',
  );

  return h(
    'div',
    { class: 'page' },
    h('span', { class: 'eyebrow' }, 'Progress'),
    h('h1', { class: 'h1', style: 'margin:8px 0 10px' }, 'What stuck'),
    h(
      'p',
      { class: 'lede' },
      'XP measures effort. The heatmap measures consistency. The review queue measures whether the ideas are still there.',
    ),
    h(
      'section',
      { class: 'stats' },
      tile('bolt', 'Experience', state.xp.toLocaleString(), `Level ${level.level} · ${level.toNext} to next`),
      tile('book', 'Lessons done', String(done), `of ${catalog.totals.lessons}`),
      tile('flame', 'Current streak', String(store.streak()), `${weekXp} XP this week`),
      tile('layers', 'Cards', String(cards.total), `${cards.due} due now`),
    ),
    h(
      'section',
      { class: 'section' },
      h(
        'div',
        { class: 'section-head' },
        h('div', null, h('h2', null, 'Last fifteen weeks'), h('p', null, 'One square per day. Darker means more XP.')),
        h('span', { class: 'meta' }, `${weekLessons} ${weekLessons === 1 ? 'lesson' : 'lessons'} finished this week`),
      ),
      h('div', { class: 'card' }, heatmap()),
    ),
    h(
      'section',
      { class: 'section' },
      h(
        'div',
        { class: 'section-head' },
        h('div', null, h('h2', null, 'Phase by phase'), h('p', null, 'Click a row to jump back in.')),
      ),
      h('div', { class: 'phase-bars' }, rows),
    ),
    h(
      'section',
      { class: 'section' },
      h(
        'div',
        { class: 'section-head' },
        h('div', null, h('h2', null, 'Recently finished')),
        h(
          'div',
          { class: 'row', style: 'gap:14px' },
          h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => {
              const data = JSON.stringify(store.getState(), null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = h('a', { href: url, download: 'workbench-progress.json' });
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            },
          }, 'Export JSON'),
          resetButton,
        ),
      ),
      (() => {
        const recent = store.recentLessons(8);
        if (!recent.length) {
          return h(
            'div',
            { class: 'empty' },
            h('h3', null, 'Nothing finished yet'),
            h('p', null, 'Your first completed lesson will appear here.'),
            h('a', { class: 'btn btn--primary', href: '#/library' }, 'Pick a phase'),
          );
        }
        return h(
          'div',
          { class: 'lessons' },
          recent.map((entry) =>
            h(
              'a',
              { class: 'lesson-row done', href: `#/lesson/${entry.id}` },
              h('span', { class: 'lesson-row-num' }, '✓'),
              h(
                'span',
                null,
                h('span', { class: 'lesson-row-title' }, entry.id.split('/')[1].replace(/-/g, ' ')),
                h(
                  'span',
                  { class: 'lesson-row-sub' },
                  h('span', null, entry.id.split('/')[0].replace(/-/g, ' ')),
                  h('span', null, shortDate(entry.completedAt)),
                  entry.recall ? h('span', null, entry.recall === 'solid' ? 'could teach it' : 'still shaky') : null,
                ),
              ),
              h('span', { class: 'lesson-row-cta' }, 'Open →'),
            ),
          ),
        );
      })(),
    ),
  );
}
