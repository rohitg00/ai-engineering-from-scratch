/**
 * Review: the spaced repetition queue.
 */

import { h, clear } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { GRADES, preview, schedule } from '../lib/scheduler.js';

export function reviewView(catalog) {
  const queue = store.dueCards().slice(0, 40);
  let index = 0;
  let flipped = false;
  let graded = 0;
  let again = 0;

  const stage = h('div', { class: 'review-stage' });
  const grades = h('div', { class: 'grades' });
  const progress = h('div', { class: 'meter mt-4' }, h('span', { style: 'width:0%' }));
  const counter = h('span', { class: 'meta tabular' });
  let hintEl = null;

  if (!queue.length) {
    const due = store.cardCounts();
    return h(
      'div',
      { class: 'page page--narrow' },
      h('span', { class: 'eyebrow' }, 'Review'),
      h('h1', { class: 'h1', style: 'margin:8px 0 10px' }, 'Queue clear'),
      h(
        'p',
        { class: 'lede' },
        due.total
          ? `All ${due.total} cards are scheduled for later. Finish another lesson to add more, or come back when the next batch is due.`
          : 'No cards yet. Every lesson you finish adds its key terms and quiz answers to this queue.',
      ),
      h(
        'div',
        { class: 'btn-row mt-4' },
        h('a', { class: 'btn btn--primary', href: '#/' }, 'Back to today'),
        h('a', { class: 'btn', href: '#/library' }, 'Start a lesson'),
      ),
    );
  }

  function finish() {
    clear(stage);
    stage.append(
      h(
        'div',
        { class: 'card', style: 'max-width:620px;width:100%;text-align:center;padding:36px' },
        h('div', { class: 'done-mark', style: 'margin:0 auto 18px' }, '✓'),
        h('h2', { class: 'h2' }, 'Review done'),
        h(
          'p',
          { class: 'lede', style: 'margin:8px auto 0' },
          `${graded} ${graded === 1 ? 'card' : 'cards'} graded. ${again} ${again === 1 ? 'needs' : 'need'} another pass in ten minutes.`,
        ),
        h(
          'div',
          { class: 'btn-row mt-4', style: 'justify-content:center' },
          h('a', { class: 'btn btn--primary', href: '#/' }, 'Back to today'),
          h('a', { class: 'btn', href: '#/progress' }, 'See progress'),
        ),
      ),
    );
    grades.replaceChildren();
    progress.firstElementChild.style.width = '100%';
    counter.textContent = `${graded} graded`;
  }

  function paintGrades(card) {
    clear(grades);
    if (hintEl) hintEl.textContent = 'Grade it · 1 again · 2 hard · 3 good · 4 easy';
    for (const grade of GRADES) {
      grades.append(
        h(
          'button',
          {
            class: 'grade',
            type: 'button',
            onclick: () => {
              const next = schedule(card, grade.id);
              store.updateCard(card.id, next);
              graded += 1;
              if (grade.id === 'again') again += 1;
              index += 1;
              flipped = false;
              if (index >= queue.length) finish();
              else paint();
            },
          },
          h('b', null, grade.label),
          h('span', null, preview(card, grade.id)),
        ),
      );
    }
  }

  function paint() {
    const card = queue[index];
    counter.textContent = `${index + 1} / ${queue.length}`;
    progress.firstElementChild.style.width = `${Math.round((index / queue.length) * 100)}%`;

    const front = h(
      'div',
      { class: 'face face--front' },
      h('span', { class: 'label' }, card.kind === 'quiz' ? 'Quiz recall' : 'Key term'),
      h('div', { class: 'face-front-text' }, card.front),
      h('span', { class: 'meta' }, 'Click to reveal'),
    );

    const back = h(
      'div',
      { class: 'face face--back' },
      h('span', { class: 'eyebrow' }, card.kind === 'quiz' ? 'Answer' : 'Meaning'),
      h('div', { class: 'face-back-text' }, card.back),
      card.context ? h('p', { class: 'meta', style: 'margin-top:10px' }, card.context) : null,
    );

    const cardEl = h(
      'button',
      {
        class: `flashcard${flipped ? ' is-flipped' : ''}`,
        type: 'button',
        'aria-label': 'Reveal answer',
        onclick: () => {
          if (flipped) return;
          flipped = true;
          cardEl.classList.add('is-flipped');
          paintGrades(card);
        },
      },
      h('div', { class: 'flashcard-inner' }, front, back),
    );

    clear(stage);
    stage.append(cardEl);

    if (flipped) paintGrades(card);
    else {
      hintEl = h(
        'p',
        { class: 'meta review-hint' },
        'Reveal the answer, then grade yourself honestly.',
      );
      stage.append(hintEl);
    }
  }

  /* Keyboard: space reveals, 1-4 grade. */
  function onKey(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!flipped) {
        flipped = true;
        paint();
      }
    }
    if (flipped && ['1', '2', '3', '4'].includes(event.key)) {
      const grade = GRADES[Number(event.key) - 1];
      if (grade) grades.querySelectorAll('.grade')[Number(event.key) - 1]?.click();
    }
  }

  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), {
    once: true,
  });

  paint();

  const due = store.cardCounts();

  return h(
    'div',
    { class: 'page page--narrow' },
    h(
      'div',
      { class: 'spread' },
      h(
        'div',
        null,
        h('span', { class: 'eyebrow' }, 'Review'),
        h('h1', { class: 'h1', style: 'margin:8px 0 6px' }, 'Bring it back'),
        h(
          'p',
          { class: 'meta' },
          `${due.due} due now · ${due.total} cards total · space to flip, 1-4 to grade`,
        ),
      ),
      counter,
    ),
    progress,
    h('section', { class: 'review-stage' }, stage),
    h('div', { style: 'display:flex;justify-content:center' }, grades),
  );
}
