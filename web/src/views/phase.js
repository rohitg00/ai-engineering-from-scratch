/**
 * Phase = one course. Lessons in order, with the next action pinned.
 */

import { h, icon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { phaseNumber, pct, typeTone, typeLabel } from '../lib/format.js';

export function phaseView(catalog, phaseId) {
  const phase = catalog.phases.find((entry) => entry.id === phaseId);
  if (!phase) {
    return h(
      'div',
      { class: 'page' },
      h('div', { class: 'empty' }, h('h3', null, 'Phase not found'), h('p', null, 'That path does not exist.'),
        h('a', { class: 'btn', href: '#/library' }, 'Back to the library')),
    );
  }

  const progress = store.phaseProgress(phase);
  const percent = pct(progress.done, progress.total);
  const next =
    phase.lessons.find((lesson) => !store.lessonState(lesson.id)?.done) ?? phase.lessons[0];

  const rows = phase.lessons.map((lesson) => {
    const state = store.lessonState(lesson.id);
    const done = Boolean(state?.done);
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
          h('span', { class: `chip ${typeTone(lesson.type)}` }, typeLabel(lesson.type)),
          done ? h('span', { class: 'chip chip--done' }, 'done') : null,
        ),
        h(
          'span',
          { class: 'lesson-row-sub' },
          h('span', null, `${lesson.minutes} min`),
          h('span', null, `${lesson.steps} steps`),
          lesson.languages?.length ? h('span', null, lesson.languages.join(' · ')) : null,
        ),
      ),
      h(
        'span',
        { class: 'lesson-row-cta' },
        done ? 'Revisit →' : state ? 'Resume →' : 'Start →',
      ),
    );
  });

  return h(
    'div',
    { class: 'page' },
    h(
      'a',
      { class: 'lesson-back', href: '#/library', style: 'display:inline-flex;margin-bottom:18px' },
      icon('arrowLeft', 14),
      'Library',
    ),
    h(
      'div',
      { class: 'phase-head' },
      h(
        'div',
        null,
        h('span', { class: 'eyebrow' }, `Phase ${phaseNumber(phase.number)} · ${phase.lessonCount} lessons · ${phase.hours ?? '—'} hours`),
        h('h1', { class: 'h1', style: 'margin:8px 0 10px' }, phase.title),
        h('p', { class: 'lede' }, phase.summary || 'A phase from the AI Engineering from Scratch curriculum.'),
      ),
      h(
        'div',
        { class: 'phase-progress-card' },
        h(
          'div',
          { class: 'spread', style: 'margin-bottom:8px' },
          h('span', { class: 'label' }, 'Progress'),
          h('span', { class: 'meta tabular' }, `${progress.done} / ${progress.total}`),
        ),
        h('div', { class: 'meter' }, h('span', { style: `width:${percent}%` })),
        h(
          'div',
          { class: 'mt-2', style: 'display:grid;gap:10px' },
          h(
            'p',
            { class: 'meta' },
            percent === 100 ? 'Phase complete' : `${percent}% complete · ${progress.total - progress.done} to go`,
          ),
          h(
            'a',
            { class: 'btn btn--primary btn--wide', href: `#/lesson/${next.id}` },
            icon('play', 14),
            progress.done === progress.total ? 'Revisit first lesson' : progress.started ? 'Continue phase' : 'Start phase',
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'section' },
      h(
        'div',
        { class: 'section-head' },
        h('div', null, h('h2', null, 'Lessons'), h('p', null, 'In the order the curriculum builds them.')),
      ),
      h('div', { class: 'lessons' }, rows),
    ),
  );
}
