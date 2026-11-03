/**
 * Roadmap: the official curriculum order with ROADMAP.md status merged
 * against this browser's local completion.
 *
 * Glyphs come straight from ROADMAP.md (✅ complete, 🚧 in progress,
 * ⬚ planned) and are always paired with a text label for contrast.
 */

import { h } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { phaseNumber, pct } from '../lib/format.js';

const STATUS = {
  '✅': { label: 'Complete', cls: 'chip--road-done' },
  '🚧': { label: 'In progress', cls: 'chip--road-active' },
  '⬜': { label: 'Planned', cls: 'chip--road-planned' },
  '⬚': { label: 'Planned', cls: 'chip--road-planned' },
};

function statusInfo(glyph) {
  return STATUS[glyph] ?? STATUS['⬚'];
}

function statusChip(glyph) {
  const info = statusInfo(glyph);
  return h('span', { class: `chip ${info.cls}` }, `${glyph} ${info.label}`);
}

function lessonRow(lesson) {
  const state = store.lessonState(lesson.id);
  const done = Boolean(state?.done);
  const info = statusInfo(lesson.status);
  return h(
    'a',
    { class: `lesson-row${done ? ' done' : ''}`, href: `#/lesson/${lesson.id}` },
    h('span', { class: 'lesson-row-num' }, String(lesson.number).padStart(2, '0')),
    h(
      'span',
      null,
      h(
        'span',
        { class: 'lesson-row-title' },
        lesson.title,
        h('span', { class: `chip ${info.cls}` }, `${lesson.status} ${info.label}`),
        done ? h('span', { class: 'chip chip--done' }, 'done') : null,
      ),
      h(
        'span',
        { class: 'lesson-row-sub' },
        h('span', null, `${lesson.minutes} min`),
      ),
    ),
    h('span', { class: 'lesson-row-cta' }, done ? 'Revisit →' : 'Open →'),
  );
}

function phaseSection(phase) {
  const progress = store.phaseProgress(phase);
  const percent = pct(progress.done, progress.total);

  return h(
    'section',
    { class: 'section', id: `phase-${phase.number}` },
    h(
      'div',
      { class: 'section-head', style: 'display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap' },
      h(
        'div',
        null,
        h('h2', null, `Phase ${phaseNumber(phase.number)}: ${phase.title}`),
        h('p', null, `${phase.lessonCount} lessons · ${phase.hours ?? '—'} hours`),
      ),
      h(
        'div',
        { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
        statusChip(phase.status),
        h('span', { class: 'meta tabular' }, `${progress.done}/${progress.total} done`),
        h(
          'div',
          { class: 'meter meter--thin', style: 'width:130px' },
          h('span', { style: `width:${percent}%` }),
        ),
      ),
    ),
    h('div', { class: 'lessons' }, phase.lessons.map(lessonRow)),
  );
}

export function roadmapView(catalog) {
  const counts = { '✅': 0, '🚧': 0, '⬜': 0 };
  let hours = 0;
  for (const phase of catalog.phases) {
    const key = phase.status === '✅' ? '✅' : phase.status === '🚧' ? '🚧' : '⬜';
    counts[key] += 1;
    hours += phase.hours ?? 0;
  }

  const localDone = Object.values(store.getState().lessons ?? {}).filter(
    (state) => state?.done,
  ).length;

  return h(
    'div',
    { class: 'page' },
    h(
      'div',
      null,
      h('span', { class: 'eyebrow' }, `ROADMAP.md · ${catalog.phases.length} phases · ~${hours} hours`),
      h('h1', { class: 'h1', style: 'margin-top:8px' }, 'Roadmap'),
      h(
        'p',
        { class: 'lede', style: 'margin-top:8px' },
        'The official build order of the curriculum. Status comes from ROADMAP.md. The “done” chip is what you finished in this browser.',
      ),
    ),
    h(
      'div',
      {
        class: 'filters',
        style: 'margin-top:18px',
        role: 'list',
        'aria-label': 'Roadmap status summary',
      },
      h('span', { class: 'chip chip--road-done', role: 'listitem' }, `✅ ${counts['✅']} complete`),
      h('span', { class: 'chip chip--road-active', role: 'listitem' }, `🚧 ${counts['🚧']} in progress`),
      h('span', { class: 'chip chip--road-planned', role: 'listitem' }, `⬚ ${counts['⬜']} planned`),
      h('span', { class: 'chip chip--done', role: 'listitem' }, `${localDone} done by you`),
    ),
    ...catalog.phases.map(phaseSection),
  );
}
