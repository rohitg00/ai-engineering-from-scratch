/**
 * Today: the one screen that answers "what do I do next?".
 */

import { h, icon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { greeting, longDate, pct, phaseNumber } from '../lib/format.js';
import { flatLessons, nextLesson } from '../lib/content.js';

function lessonLink(lesson, label) {
  return `#/lesson/${lesson.id}`;
}

function nextUnfinished(catalog) {
  const all = flatLessons(catalog);
  return all.find((lesson) => !store.lessonState(lesson.id)?.done) ?? null;
}

function resumeTarget(catalog) {
  const all = flatLessons(catalog);
  const last = store.lastLesson();
  if (last) {
    const found = all.find((lesson) => lesson.id === last);
    if (found && !store.lessonState(found.id)?.done) return found;
    // The last lesson is finished: continue the path where that lesson sits.
    if (found) {
      const after = nextLesson(catalog, last);
      if (after && !store.lessonState(after.id)?.done) return after;
    }
  }
  const started = all
    .filter((lesson) => {
      const state = store.lessonState(lesson.id);
      return state && !state.done;
    })
    .sort((a, b) => {
      const sa = store.lessonState(a.id)?.startedAt ?? '';
      const sb = store.lessonState(b.id)?.startedAt ?? '';
      return sa < sb ? 1 : -1;
    });
  return started[0] ?? nextUnfinished(catalog);
}

function continueCard(catalog, lesson) {
  if (!lesson) {
    return h(
      'div',
      { class: 'continue' },
      h('span', { class: 'eyebrow' }, 'You finished the path'),
      h('div', { class: 'continue-title' }, 'Nothing left'),
      h(
        'p',
        { class: 'continue-hook' },
        'Every lesson is marked done. Go back to a phase and re-read the ones that matter now.',
      ),
      h('a', { class: 'btn btn--primary btn--wide', href: '#/library' }, 'Open the library'),
    );
  }

  const state = store.lessonState(lesson.id);
  const total = Math.max(1, lesson.steps);
  const current = state ? Math.min(state.furthest + 1, total) : 1;
  const percent = pct(current - 1, total);
  const phase = catalog.phases.find((p) => p.id === lesson.phaseId);

  return h(
    'div',
    { class: 'continue' },
    h(
      'div',
      { class: 'spread' },
      h('span', { class: 'eyebrow' }, state ? 'Pick up where you left off' : 'Start here'),
      h('span', { class: 'meta' }, `${phaseNumber(phase?.number ?? 0)} · ${phase?.title ?? ''}`),
    ),
    h('div', { class: 'continue-title' }, lesson.title),
    h('p', { class: 'continue-hook' }, lesson.hook),
    h(
      'div',
      { class: 'continue-meta' },
      h('span', { class: 'chip' }, `Lesson ${lesson.number}`),
      h('span', { class: 'chip' }, `${lesson.minutes} min`),
      h('span', { class: 'chip' }, lesson.type),
    ),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'spread', style: 'margin-bottom:6px' },
        h('span', { class: 'meta' }, state ? `Step ${current} of ${total}` : 'Not started'),
        h('span', { class: 'meta tabular' }, `${percent}%`),
      ),
      h('div', { class: 'meter' }, h('span', { style: `width:${percent}%` })),
    ),
    h(
      'a',
      { class: 'btn btn--primary', href: lessonLink(lesson) },
      icon('play', 14),
      state ? 'Resume lesson' : 'Start lesson',
    ),
  );
}

function statTile(name, label, value, sub, href) {
  const tile = h(
    href ? 'a' : 'div',
    { class: 'tile', href },
    h('div', { class: 'tile-label' }, icon(name, 13), label),
    h('div', { class: 'tile-value' }, value),
    h('div', { class: 'tile-sub' }, sub),
  );
  if (href) tile.style.textDecoration = 'none';
  return tile;
}

function planRow(index, title, sub, href, cta) {
  return h(
    'a',
    { class: 'plan-row', href },
    h('span', { class: 'plan-num' }, String(index).padStart(2, '0')),
    h('span', null, h('span', { class: 'plan-title' }, title), h('div', { class: 'plan-sub' }, sub)),
    h('span', { class: 'lesson-row-cta' }, cta, ' →'),
  );
}

export function todayView(catalog) {
  const state = store.getState();
  const due = store.cardCounts();
  const level = store.levelInfo();
  const done = store.completedCount();
  const totalLessons = catalog.totals.lessons;
  const streak = store.streak();
  const resume = resumeTarget(catalog);
  const nextNew = nextUnfinished(catalog);

  const plan = [
    resume && {
      title: resume.title,
      sub: `Phase ${phaseNumber(catalog.phases.find((p) => p.id === resume.phaseId)?.number ?? 0)} · ${resume.minutes} min · ${store.lessonState(resume.id) ? 'in progress' : 'new'}`,
      href: lessonLink(resume),
      cta: store.lessonState(resume.id) ? 'Resume' : 'Start',
    },
    {
      title: due.due > 0 ? `Clear ${due.due} ${due.due === 1 ? 'card' : 'cards'}` : 'Review queue is clear',
      sub: due.total
        ? `${due.learned} of ${due.total} cards have been reviewed at least once`
        : 'Finish a lesson to add its key terms to the queue',
      href: '#/review',
      cta: due.due > 0 ? 'Review' : 'Open',
    },
  ].filter(Boolean);

  if (nextNew && nextNew.id !== resume?.id) {
    plan.push({
      title: nextNew.title,
      sub: `Next new lesson · ${nextNew.minutes} min · ${nextNew.type}`,
      href: lessonLink(nextNew),
      cta: 'Start',
    });
  }

  const recent = store.recentLessons(4);

  return h(
    'div',
    { class: 'page' },
    h(
      'section',
      { class: 'hero' },
      h(
        'div',
        null,
        h('span', { class: 'eyebrow' }, longDate()),
        h('h1', { class: 'h1' }, `${greeting()}.`),
        h(
          'p',
          { class: 'lede' },
          'One lesson at a time. Read a short section, build the idea by hand, answer a few questions, then try to explain it without looking.',
        ),
        h(
          'div',
          { class: 'hero-actions' },
          resume
            ? h(
                'a',
                { class: 'btn btn--primary', href: lessonLink(resume) },
                icon('play', 14),
                'Continue learning',
              )
            : null,
          h('a', { class: 'btn', href: '#/library' }, 'Browse 20 phases'),
        ),
      ),
      continueCard(catalog, resume),
    ),

    h(
      'section',
      { class: 'stats' },
      statTile('flame', 'Day streak', streak, streak ? 'Keep it alive today' : 'One lesson starts it', null),
      statTile('bolt', 'Experience', state.xp.toLocaleString(), `Level ${level.level} · ${level.toNext} to next`, null),
      statTile('book', 'Lessons done', `${done}`, `of ${totalLessons} in the path`, '#/progress'),
      statTile('layers', 'Cards due', due.due, due.due ? 'Clear them today' : 'Queue is clear', '#/review'),
    ),

    h(
      'section',
      { class: 'section' },
      h('div', { class: 'section-head' }, h('div', null, h('h2', null, "Today's plan"), h('p', null, 'Three moves, about fifteen minutes.'))),
      h('div', { class: 'plan' }, plan.map((row, index) => planRow(index + 1, row.title, row.sub, row.href, row.cta))),
    ),

    h(
      'section',
      { class: 'section' },
      h(
        'div',
        { class: 'section-head' },
        h('div', null, h('h2', null, 'Your path'), h('p', null, 'Twenty phases. Start anywhere, and keep the order when a lesson builds on the last.')),
        h('a', { href: '#/library' }, 'Full library →'),
      ),
      h(
        'div',
        { class: 'grid grid--3' },
        catalog.phases.map((phase) => {
          const progress = store.phaseProgress(phase);
          const percent = pct(progress.done, progress.total);
          return h(
            'a',
            { class: 'phase-card', href: `#/phase/${phase.id}` },
            h(
              'div',
              { class: 'phase-card-top' },
              h('span', { class: 'phase-num' }, `PHASE ${phaseNumber(phase.number)}`),
              h('span', { class: 'meta tabular' }, `${percent}%`),
            ),
            h('h3', null, phase.title),
            h('div', { class: 'meter meter--thin' }, h('span', { style: `width:${percent}%` })),
            h(
              'div',
              { class: 'phase-card-foot' },
              h('span', { class: 'meta' }, `${progress.done}/${progress.total} lessons`),
              h('span', { class: 'meta' }, `${phase.hours ?? '—'} h`),
            ),
          );
        }),
      ),
    ),

    recent.length
      ? h(
          'section',
          { class: 'section' },
          h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Recently finished'))),
          h(
            'div',
            { class: 'lessons' },
            recent.map((entry) => {
              const found = flatLessons(catalog).find((l) => l.id === entry.id);
              if (!found) return null;
              return h(
                'a',
                { class: 'lesson-row done', href: lessonLink(found) },
                h('span', { class: 'lesson-row-num' }, String(found.number).padStart(2, '0')),
                h(
                  'span',
                  null,
                  h('span', { class: 'lesson-row-title' }, found.title, h('span', { class: 'chip chip--done' }, 'done')),
                  h(
                    'span',
                    { class: 'lesson-row-sub' },
                    h('span', null, found.phaseTitle),
                    h('span', null, `${found.minutes} min`),
                  ),
                ),
                h('span', { class: 'lesson-row-cta' }, 'Review →'),
              );
            }),
          ),
        )
      : null,
  );
}
