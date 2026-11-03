/**
 * Library: 20 phases, searchable, filterable.
 */

import { h, icon, clear } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { phaseNumber, pct, typeTone, typeLabel } from '../lib/format.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'Not started' },
  { id: 'progress', label: 'In progress' },
  { id: 'done', label: 'Finished' },
];

function phaseStatus(phase) {
  const progress = store.phaseProgress(phase);
  if (progress.done === progress.total) return 'done';
  if (progress.started > 0) return 'progress';
  return 'new';
}

function phaseCard(phase) {
  const progress = store.phaseProgress(phase);
  const percent = pct(progress.done, progress.total);
  return h(
    'a',
    { class: 'phase-card', href: `#/phase/${phase.id}` },
    h(
      'div',
      { class: 'phase-card-top' },
      h('span', { class: 'phase-num' }, `PHASE ${phaseNumber(phase.number)}`),
      h(
        'span',
        { class: 'meta tabular' },
        progress.done === progress.total ? 'complete' : `${percent}%`,
      ),
    ),
    h('h3', null, phase.title),
    h('p', null, phase.summary || `${phase.lessonCount} lessons.`),
    h('div', { class: 'meter meter--thin' }, h('span', { style: `width:${percent}%` })),
    h(
      'div',
      { class: 'phase-card-foot' },
      h('span', { class: 'meta' }, `${progress.done}/${progress.total} lessons`),
      h('span', { class: 'meta' }, `${phase.hours ?? '—'} h`),
    ),
  );
}

function lessonResult(lesson, phase) {
  const state = store.lessonState(lesson.id);
  return h(
    'a',
    { class: 'lesson-row', href: `#/lesson/${lesson.id}` },
    h('span', { class: 'lesson-row-num' }, String(lesson.number).padStart(2, '0')),
    h(
      'span',
      null,
      h(
        'span',
        { class: 'lesson-row-title' },
        lesson.title,
        h('span', { class: `chip ${typeTone(lesson.type)}` }, typeLabel(lesson.type)),
      ),
      h(
        'span',
        { class: 'lesson-row-sub' },
        h('span', null, `Phase ${phaseNumber(phase.number)} · ${phase.title}`),
        h('span', null, `${lesson.minutes} min`),
        state?.done ? h('span', { class: 'chip chip--done' }, 'done') : null,
      ),
    ),
    h('span', { class: 'lesson-row-cta' }, state?.done ? 'Revisit →' : state ? 'Resume →' : 'Open →'),
  );
}

export function libraryView(catalog) {
  let query = '';
  let filter = 'all';

  const results = h('div');

  const search = h('input', {
    type: 'search',
    placeholder: 'Search 542 lessons, terms, phases',
    'aria-label': 'Search lessons',
    oninput: (event) => {
      query = event.target.value.trim().toLowerCase();
      paint();
    },
  });

  const filters = h(
    'div',
    { class: 'filters' },
    FILTERS.map((entry) =>
      h(
        'button',
        {
          class: 'filter',
          type: 'button',
          'aria-pressed': entry.id === filter ? 'true' : 'false',
          'data-filter': entry.id,
          onclick: (event) => {
            filter = entry.id;
            for (const button of filters.querySelectorAll('.filter')) {
              button.setAttribute('aria-pressed', button.dataset.filter === filter ? 'true' : 'false');
            }
            paint();
          },
        },
        entry.label,
      ),
    ),
  );

  function paint() {
    clear(results);

    if (query.length >= 2) {
      const matches = [];
      for (const phase of catalog.phases) {
        for (const lesson of phase.lessons) {
          const title = (lesson.title ?? '').toLowerCase();
          const hook = (lesson.hook ?? '').toLowerCase();
          const terms = (lesson.search ?? '').toLowerCase();
          const phaseTitle = phase.title.toLowerCase();
          let rank = -1;
          if (title.includes(query)) rank = 0;
          else if (hook.includes(query)) rank = 1;
          else if (terms.includes(query)) rank = 2;
          else if (phaseTitle.includes(query)) rank = 3;
          if (rank >= 0) matches.push({ lesson, phase, rank });
        }
      }
      matches.sort(
        (a, b) =>
          a.rank - b.rank ||
          a.lesson.title.length - b.lesson.title.length ||
          a.lesson.number - b.lesson.number,
      );

      results.appendChild(
        h(
          'div',
          { class: 'section', style: 'margin-top:24px' },
          h(
            'div',
            { class: 'section-head' },
            h(
              'div',
              null,
              h('h2', null, `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`),
              h('p', null, `Lessons that mention “${query}”`),
            ),
          ),
          matches.length
            ? h(
                'div',
                { class: 'lessons' },
                matches
                  .slice(0, 40)
                  .map(({ lesson, phase }) => lessonResult(lesson, phase)),
              )
            : h(
                'div',
                { class: 'empty' },
                h('h3', null, 'No match'),
                h('p', null, 'Try a shorter term, a phase name, or a concept such as “attention” or “reward”.'),
              ),
        ),
      );
      return;
    }

    const phases = catalog.phases.filter((phase) => filter === 'all' || phaseStatus(phase) === filter);

    results.appendChild(
      h(
        'div',
        { class: 'grid grid--3', style: 'margin-top:24px' },
        phases.map((phase) => phaseCard(phase)),
      ),
    );
  }

  const el = h(
    'div',
    { class: 'page' },
    h(
      'div',
      { class: 'spread', style: 'align-items:flex-end' },
      h(
        'div',
        null,
        h('span', { class: 'eyebrow' }, `${catalog.totals.lessons} lessons · ${catalog.phases.length} phases`),
        h('h1', { class: 'h1', style: 'margin-top:8px' }, 'Library'),
        h(
          'p',
          { class: 'lede', style: 'margin-top:8px' },
          'Every phase is a course. Every lesson is a short loop: predict, read, build, answer, explain. Pick a phase and go in order, or search for the idea you need today.',
        ),
      ),
    ),
    h(
      'div',
      { class: 'mt-4', style: 'display:grid;gap:12px' },
      h('div', { class: 'searchbar' }, icon('search', 16), search),
      filters,
    ),
    results,
  );

  paint();
  return el;
}
