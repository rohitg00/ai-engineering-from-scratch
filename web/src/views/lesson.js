/**
 * The lesson player.
 *
 * One loop for every lesson in the curriculum:
 *   intro -> pre-test -> read -> build -> practice -> check -> recall -> done
 */

import { h, icon, toast, clear, scrollTop } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { buildSteps, lessonCards, stepMinutes, siteUrl } from '../lib/content.js';
import { prose } from '../lib/markdown.js';
import { typeLabel, typeTone } from '../lib/format.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* --------------------------------------------------------------- quiz */

function quizRunner(questions, lessonId, { onChange, intro }) {
  let index = 0;
  let correct = 0;
  let chosen = null;
  let revealed = false;
  let finished = false;

  const root = h('div');

  function finish() {
    finished = true;
    onChange?.(correct, questions.length, true);
  }

  function paint() {
    clear(root);
    const question = questions[index];

    const options = h(
      'div',
      { class: 'options' },
      question.options.map((label, optionIndex) => {
        const isCorrect = optionIndex === question.correct;
        const isChosen = optionIndex === chosen;
        const classes = ['option'];
        if (revealed && isCorrect) classes.push('is-correct');
        if (revealed && isChosen && !isCorrect) classes.push('is-wrong');
        if (!revealed && isChosen) classes.push('is-picked');

        return h(
          'button',
          {
            class: classes.join(' '),
            type: 'button',
            disabled: revealed,
            onclick: () => {
              if (revealed) return;
              chosen = optionIndex;
              revealed = true;
              if (isCorrect) correct += 1;
              store.recordQuizAnswer(lessonId, question.id, isCorrect);
              onChange?.(correct, questions.length, false);
              paint();
            },
          },
          h('span', { class: 'option-key' }, revealed && isCorrect ? '✓' : LETTERS[optionIndex] ?? optionIndex + 1),
          h('span', null, label),
        );
      }),
    );

    root.append(
      h(
        'div',
        { class: 'quiz' },
        h(
          'div',
          { class: 'quiz-top' },
          h('span', { class: 'label' }, intro ?? 'Check your understanding'),
          h(
            'span',
            { class: 'meta tabular' },
            `${index + 1} / ${questions.length}`,
          ),
        ),
        h('h3', { class: 'quiz-q' }, question.question),
        options,
        revealed
          ? h(
              'div',
              { class: `feedback${chosen === question.correct ? '' : ' is-wrong'}` },
              h(
                'div',
                { class: 'feedback-title' },
                chosen === question.correct ? '+8 XP · correct' : 'Not quite',
              ),
              h('p', null, question.explanation || 'Compare your choice with the lesson above.'),
            )
          : null,
        h(
          'div',
          { class: 'quiz-foot' },
          h(
            'div',
            { class: 'dots' },
            questions.map((_, dotIndex) =>
              h('span', {
                class: `dot${dotIndex < index ? ' is-done' : dotIndex === index ? ' is-current' : ''}`,
              }),
            ),
          ),
          revealed
            ? h(
                'button',
                {
                  class: 'btn btn--sm',
                  type: 'button',
                  onclick: () => {
                    if (index + 1 >= questions.length) {
                      finish();
                      paint();
                      return;
                    }
                    index += 1;
                    chosen = null;
                    revealed = false;
                    paint();
                  },
                },
                index + 1 >= questions.length ? 'See score' : 'Next question',
                icon('arrow', 13),
              )
            : h('span', { class: 'meta' }, 'Pick one'),
        ),
      ),
    );

    if (finished) {
      clear(root);
      root.append(
        h(
          'div',
          { class: 'quiz' },
          h('span', { class: 'label' }, 'Round complete'),
          h('h3', { class: 'quiz-q' }, `${correct} of ${questions.length} on the first try`),
          h(
            'p',
            { class: 'muted', style: 'font-size:0.92rem' },
            correct === questions.length
              ? 'Clean sweep. The cards from this lesson will come back on a longer interval.'
              : 'The misses are the useful part. They become cards you will see again soon.',
          ),
          h(
            'div',
            { class: 'meter mt-3' },
            h('span', { style: `width:${Math.round((correct / Math.max(1, questions.length)) * 100)}%` }),
          ),
        ),
      );
    }
  }

  paint();

  return {
    el: root,
    get done() {
      return finished;
    },
  };
}

/* --------------------------------------------------------------- views */

export async function lessonView(catalog, lesson, handlers) {
  const steps = buildSteps(lesson);
  const published = siteUrl(lesson);
  const saved = store.lessonState(lesson.id);
  const startIndex = saved?.done ? 0 : Math.min(saved?.furthest ?? 0, steps.length - 1);

  const session = {
    index: startIndex,
    completed: Boolean(saved?.done),
    quiz: null,
    recallRated: false,
  };

  const stepBody = h('div');
  const stepFoot = h('div', { class: 'lesson-foot' });
  const counter = h('span', { class: 'lesson-counter' });
  const bar = h('span', { style: 'width:0%' });

  const phase = catalog.phases.find((entry) => entry.id === lesson.phaseId);

  function go(index) {
    session.index = Math.max(0, Math.min(steps.length - 1, index));
    if (!saved?.done) store.reachStep(lesson.id, session.index);
    paint();
    scrollTop();
  }

  function next() {
    go(session.index + 1);
  }

  function updateCounter() {
    const percent = Math.round(((session.index + 1) / steps.length) * 100);
    counter.textContent = `${session.index + 1} / ${steps.length}`;
    bar.style.width = `${percent}%`;
  }

  /* ------------------------------------------------------------ painters */

  function introStep() {
    const body = h(
      'div',
      { class: 'lesson-step' },
      h(
        'div',
        { class: 'step-label' },
        h('span', { class: 'chip' }, 'Lesson'),
        h('span', { class: 'meta' }, `${steps.length} steps · ~${lesson.minutes} min`),
      ),
      h('h1', { class: 'lesson-title' }, lesson.title),
      lesson.hook ? h('p', { class: 'lesson-hook' }, lesson.hook) : null,
      h(
        'div',
        { class: 'row wrap mt-3' },
        h('span', { class: `chip ${typeTone(lesson.type)}` }, typeLabel(lesson.type)),
        h('span', { class: 'chip' }, `${lesson.minutes} min`),
        lesson.languages?.length ? h('span', { class: 'chip' }, lesson.languages.join(' · ')) : null,
        h('span', { class: 'chip' }, `Phase ${phase?.number ?? '—'}`),
      ),
      lesson.objectives.length
        ? h(
            'div',
            null,
            h('div', { class: 'label mt-4' }, 'By the end you can'),
            h(
              'ul',
              { class: 'objectives' },
              lesson.objectives.map((objective) => h('li', null, objective)),
            ),
          )
        : null,
      h(
        'div',
        { class: 'card mt-4', style: 'border-left:3px solid var(--blueprint)' },
        h('div', { class: 'label' }, 'How this works'),
        h(
          'p',
          { class: 'mt-1', style: 'font-size:0.92rem;color:var(--ink-soft)' },
          'You will predict before reading, read one small section at a time, look at the real code, try the exercises, answer the quiz, then explain the idea in your own words. That last part is what makes it stick.',
        ),
        h(
          'a',
          { class: 'meta', href: published, target: '_blank', rel: 'noreferrer noopener', style: 'display:inline-block;margin-top:10px' },
          'Open the published lesson for its figures →',
        ),
      ),
    );

    const foot = h(
      'div',
      { class: 'spread' },
      h('span', { class: 'lesson-foot-note' }, 'Enter starts the loop'),
      h(
        'button',
        { class: 'btn btn--primary', type: 'button', onclick: next },
        'Start',
        icon('arrow', 14),
      ),
    );

    return { body, foot };
  }

  function readStep(step) {
    const body = h(
      'div',
      { class: 'lesson-step' },
      h(
        'div',
        { class: 'step-label' },
        h('span', { class: 'chip' }, step.index === 0 ? 'The problem' : `Concept ${step.index}`),
        h('span', { class: 'meta' }, `~${stepMinutes(step.section.blocks)} min read`),
      ),
      h('h2', { class: 'h2', style: 'margin-bottom:18px' }, step.section.title),
      prose(step.section.blocks, { lessonUrl: published }),
    );

    const foot = h(
      'div',
      { class: 'spread' },
      h('span', { class: 'lesson-foot-note' }, `${step.index + 1} of ${step.total} reading steps`),
      h(
        'button',
        { class: 'btn btn--primary', type: 'button', onclick: next },
        'Got it',
        icon('arrow', 14),
      ),
    );

    return { body, foot };
  }

  function buildStep() {
    const files = lesson.code.files ?? [];
    let active = 0;
    let revealed = files.length === 0;

    const codeHost = h('div');

    function paintCode() {
      clear(codeHost);
      if (!files.length) return;
      const file = files[active];
      const pre = h('pre', null, h('code', null, file.source));
      if (!revealed) {
        pre.style.filter = 'blur(5px)';
        pre.style.userSelect = 'none';
      }
      codeHost.append(
        h(
          'div',
          { class: 'code-block' },
          h(
            'div',
            { class: 'code-head' },
            h(
              'div',
              { class: 'row', style: 'gap:8px' },
              files.map((entry, index) =>
                h(
                  'button',
                  {
                    class: 'code-copy',
                    type: 'button',
                    'aria-pressed': index === active ? 'true' : 'false',
                    onclick: () => {
                      active = index;
                      paintCode();
                    },
                  },
                  entry.name,
                ),
              ),
            ),
            h('span', { class: 'code-lang' }, file.lang),
          ),
          pre,
        ),
        !revealed
          ? h(
              'button',
              {
                class: 'btn btn--sm mt-2',
                type: 'button',
                onclick: () => {
                  revealed = true;
                  paintCode();
                },
              },
              'Reveal the code',
            )
          : null,
        lesson.code.run
          ? h(
              'div',
              { class: 'card mt-2', style: 'padding:12px 14px' },
              h('div', { class: 'label' }, 'Run it from the repo root'),
              h('code', { class: 'mt-1', style: 'display:block;font-size:0.78rem' }, lesson.code.run),
            )
          : null,
      );
    }

    const body = h(
      'div',
      { class: 'lesson-step' },
      h(
        'div',
        { class: 'step-label' },
        h('span', { class: 'chip' }, 'Build it'),
        h('span', { class: 'meta' }, 'the real code'),
      ),
      h('h2', { class: 'h2', style: 'margin-bottom:16px' }, 'Read the machine'),
      lesson.build?.blocks?.length
        ? h('div', { style: 'margin-bottom:18px' }, prose(lesson.build.blocks, { lessonUrl: published }))
        : h(
            'p',
            { class: 'muted', style: 'margin-bottom:18px' },
            'This lesson ships code. Skim it before you run it: name the inputs, the state, and the exit.',
          ),
      files.length
        ? h(
            'div',
            { class: 'card mb-2' },
            h('div', { class: 'label' }, 'Predict first'),
            h(
              'p',
              { class: 'mt-1', style: 'font-size:0.9rem;color:var(--ink-soft)' },
              'Look at the file names and the first few lines. Write one sentence: what do you expect this program to print? Then reveal it.',
            ),
          )
        : null,
      codeHost,
      lesson.ship?.blocks?.length
        ? h(
            'div',
            { class: 'card mt-3' },
            h('div', { class: 'label' }, 'Ship it'),
            h('div', { class: 'mt-1', style: 'font-size:0.92rem' }, prose(lesson.ship.blocks, { lessonUrl: published })),
            lesson.outputs?.length
              ? h(
                  'div',
                  { class: 'row wrap mt-2' },
                  lesson.outputs.map((output) => h('span', { class: 'chip' }, output.name)),
                )
              : null,
          )
        : null,
    );

    paintCode();

    const foot = h(
      'div',
      { class: 'spread' },
      h('span', { class: 'lesson-foot-note' }, 'Reading code counts. Running it counts more.'),
      h(
        'button',
        { class: 'btn btn--primary', type: 'button', onclick: next },
        'I have seen the shape',
        icon('arrow', 14),
      ),
    );

    return { body, foot };
  }

  function practiceStep() {
    const doneTasks = store.taskSet(lesson.id);

    const list = h('div', { class: 'task-list' });
    const counterLabel = h('span', { class: 'lesson-foot-note' });

    function paintTasks() {
      clear(list);
      lesson.exercises.forEach((task, index) => {
        const done = doneTasks.has(index);
        list.append(
          h(
            'button',
            {
              class: `task${done ? ' is-done' : ''}`,
              type: 'button',
              'aria-pressed': done ? 'true' : 'false',
              onclick: () => {
                store.toggleTask(lesson.id, index);
                if (doneTasks.has(index)) doneTasks.delete(index);
                else doneTasks.add(index);
                paintTasks();
              },
            },
            h('span', { class: 'task-box' }, '✓'),
            h('span', { class: 'task-text' }, task),
          ),
        );
      });
      counterLabel.textContent = `${doneTasks.size} of ${lesson.exercises.length} ticked`;
    }

    const note = h('textarea', {
      class: 'note',
      placeholder: 'What did you try? What broke? Keep one line you can come back to.',
      'aria-label': 'Exercise notes',
      oninput: (event) => store.setNote(lesson.id, event.target.value),
    });
    note.value = store.getNote(lesson.id);

    const body = h(
      'div',
      { class: 'lesson-step' },
      h(
        'div',
        { class: 'step-label' },
        h('span', { class: 'chip' }, 'Practice'),
        h('span', { class: 'meta' }, 'pick one, not all of them'),
      ),
      h('h2', { class: 'h2', style: 'margin-bottom:8px' }, 'Make it yours'),
      h(
        'p',
        { class: 'muted', style: 'margin-bottom:18px;font-size:0.95rem' },
        'You do not have to finish the list. Pick the task that makes you uncomfortable and do that one. Tick what you actually did.',
      ),
      list,
      h('div', { class: 'label mt-3' }, 'Your notes'),
      note,
    );

    paintTasks();

    const foot = h(
      'div',
      { class: 'spread' },
      counterLabel,
      h(
        'button',
        { class: 'btn btn--primary', type: 'button', onclick: next },
        'Continue',
        icon('arrow', 14),
      ),
    );

    return { body, foot };
  }

  function quizStep(step, introLabel) {
    const continueButton = h(
      'button',
      { class: 'btn btn--primary', type: 'button', disabled: true, onclick: next },
      'Continue',
      icon('arrow', 14),
    );

    const runner = quizRunner(step.questions, lesson.id, {
      intro: introLabel,
      onChange: (_correct, _total, finished) => {
        continueButton.disabled = !finished;
      },
    });

    const body = h(
      'div',
      { class: 'lesson-step' },
      h(
        'div',
        { class: 'step-label' },
        h('span', { class: 'chip' }, step.kind === 'pre' ? 'Before you read' : 'Check yourself'),
        h('span', { class: 'meta' }, `${step.questions.length} questions`),
      ),
      h(
        'h2',
        { class: 'h2', style: 'margin-bottom:8px' },
        step.kind === 'pre' ? 'Guess first' : 'What stuck?',
      ),
      h(
        'p',
        { class: 'muted', style: 'margin-bottom:8px;font-size:0.95rem' },
        step.kind === 'pre'
          ? 'You are allowed to be wrong. A guess primes the reading that follows, even when it misses.'
          : 'Answer from memory. The explanation appears after each choice.',
      ),
      runner.el,
    );

    const foot = h(
      'div',
      { class: 'spread' },
      h('span', { class: 'lesson-foot-note' }, 'First try only. Retakes do not add XP.'),
      continueButton,
    );

    return { body, foot };
  }

  function recallStep() {
    const terms = lesson.keyTerms ?? [];
    const response = h('textarea', {
      class: 'note',
      style: 'min-height:150px',
      placeholder: `Explain ${lesson.title.toLowerCase()} to someone who has not read the lesson.`,
      'aria-label': 'Explain it back',
    });

    const readout = h('div', { class: 'mt-3' });

    const rateRow = h('div', { class: 'btn-row mt-3', style: 'display:none' });

    const compare = h(
      'button',
      { class: 'btn', type: 'button' },
      icon('sparkle', 14),
      'Compare with the source',
    );

    function compareNow() {
      const text = response.value.toLowerCase();
      const hits = terms.map((term) => ({
        ...term,
        hit: text.includes(term.term.toLowerCase().split(' ')[0]),
      }));
      const hitCount = hits.filter((entry) => entry.hit).length;
      const percent = terms.length ? Math.round((hitCount / terms.length) * 100) : 0;

      clear(readout);
      readout.append(
        h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'spread' },
            h('span', { class: 'label' }, 'Coverage'),
            h('span', { class: 'meta tabular' }, `${hitCount} / ${terms.length} terms`),
          ),
          h('div', { class: 'coverage' }, h('div', { class: 'meter' }, h('span', { style: `width:${percent}%` }))),
          h(
            'p',
            { class: 'meta', style: 'margin-bottom:10px' },
            hitCount === terms.length
              ? 'You named every term. Say it once more without the list.'
              : 'The missing terms are the ones to reread before you leave.',
          ),
          h(
            'div',
            { class: 'term-list' },
            hits.map((term) =>
              h(
                'div',
                { class: `term-row${term.hit ? ' is-hit' : ''}` },
                h('span', { class: 'term-name' }, term.hit ? `✓ ${term.term}` : term.term),
                h('span', { class: 'term-means' }, term.means),
              ),
            ),
          ),
        ),
      );

      rateRow.style.display = 'flex';
      compare.remove();

      if (!session.recallRated) {
        session.recallRated = true;
      }
    }

    compare.addEventListener('click', compareNow);

    const body = h(
      'div',
      { class: 'lesson-step' },
      h(
        'div',
        { class: 'step-label' },
        h('span', { class: 'chip' }, 'Recall'),
        h('span', { class: 'meta' }, 'no notes, no scrolling up'),
      ),
      h('h2', { class: 'h2', style: 'margin-bottom:8px' }, 'Explain it back'),
      h(
        'p',
        { class: 'muted', style: 'margin-bottom:14px;font-size:0.95rem' },
        'Write the idea in your own words. Three sentences is enough. Then compare against the key terms.',
      ),
      response,
      h('div', { class: 'mt-2' }, compare),
      rateRow,
      readout,
    );

    const continueButton = h(
      'button',
      { class: 'btn btn--primary', type: 'button', onclick: next },
      'Finish the lesson',
      icon('arrow', 14),
    );

    rateRow.append(
      h(
        'button',
        {
          class: 'btn btn--sm',
          type: 'button',
          onclick: () => {
            store.recordRecall(lesson.id, 'shaky');
            next();
          },
        },
        'Still shaky',
      ),
      h(
        'button',
        {
          class: 'btn btn--sm btn--primary',
          type: 'button',
          onclick: () => {
            store.recordRecall(lesson.id, 'solid');
            next();
          },
        },
        'I could teach this',
      ),
    );

    const foot = h(
      'div',
      { class: 'spread' },
      h('span', { class: 'lesson-foot-note' }, 'Writing the answer beats rereading it'),
      continueButton,
    );

    return { body, foot };
  }

  function doneStep() {
    let added = 0;
    if (!session.completed) {
      session.completed = true;
      store.completeLesson(lesson.id);
      added = store.addCards(lessonCards(lesson));
      toast(`+${store.lessonState(lesson.id)?.earned ?? 20} XP · lesson complete`);
    }

    const state = store.lessonState(lesson.id);
    const nextUp = handlers.nextLesson(lesson.id);
    const quizEntries = Object.values(state?.quiz ?? {});
    const quizCorrect = quizEntries.filter(Boolean).length;

    const body = h(
      'div',
      { class: 'lesson-step' },
      h('div', { class: 'done-mark' }, '✓'),
      h('span', { class: 'eyebrow' }, 'Lesson complete'),
      h('h1', { class: 'lesson-title', style: 'margin-top:8px' }, lesson.title),
      h(
        'p',
        { class: 'lede', style: 'margin-top:8px' },
        lesson.hook || 'One more loop closed.',
      ),
      h(
        'div',
        { class: 'done-grid' },
        h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, 'Earned'), h('div', { class: 'tile-value' }, `${state?.earned ?? 0}`), h('div', { class: 'tile-sub' }, 'XP this lesson')),
        h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, 'Quiz'), h('div', { class: 'tile-value' }, `${quizCorrect}`), h('div', { class: 'tile-sub' }, 'first-try correct')),
        h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, 'Cards'), h('div', { class: 'tile-value' }, `${added}`), h('div', { class: 'tile-sub' }, 'added to review')),
        h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, 'Streak'), h('div', { class: 'tile-value' }, `${store.streak()}`), h('div', { class: 'tile-sub' }, 'days in a row')),
      ),
      h(
        'div',
        { class: 'card', style: 'border-left:3px solid var(--blueprint)' },
        h('div', { class: 'label' }, 'Keep it'),
        h(
          'p',
          { class: 'mt-1', style: 'font-size:0.92rem;color:var(--ink-soft)' },
          added
            ? `${added} cards are due now. Open Review and clear them while the lesson is still warm.`
            : 'The cards from this lesson are already in the queue. A short review today is worth more than a long one next week.',
        ),
      ),
    );

    const foot = h(
      'div',
      { class: 'spread' },
      h('a', { class: 'btn btn--ghost', href: `#/phase/${lesson.phaseId}` }, 'Back to phase'),
      h(
        'div',
        { class: 'btn-row' },
        h('a', { class: 'btn', href: '#/review' }, 'Review cards'),
        nextUp
          ? h(
              'a',
              { class: 'btn btn--primary', href: `#/lesson/${nextUp.id}` },
              'Next lesson',
              icon('arrow', 14),
            )
          : null,
      ),
    );

    return { body, foot };
  }

  /* -------------------------------------------------------------- paint */

  function paint() {
    const step = steps[session.index];
    let painted;

    switch (step.kind) {
      case 'intro':
        painted = introStep();
        break;
      case 'pre':
        painted = quizStep(step, 'Guess before you read');
        break;
      case 'read':
        painted = readStep(step);
        break;
      case 'build':
        painted = buildStep();
        break;
      case 'practice':
        painted = practiceStep();
        break;
      case 'quiz':
        painted = quizStep(step, 'Check your understanding');
        break;
      case 'recall':
        painted = recallStep();
        break;
      case 'done':
        painted = doneStep();
        break;
      default:
        painted = { body: h('div'), foot: null };
    }

    clear(stepBody);
    stepBody.append(painted.body);
    clear(stepFoot);
    if (painted.foot) stepFoot.append(painted.foot);
    updateCounter();
  }

  const headerEl = h(
    'div',
    { class: 'lesson-header' },
    h(
      'div',
      { class: 'lesson-header-inner' },
      h(
        'a',
        { class: 'lesson-back', href: `#/phase/${lesson.phaseId}` },
        icon('arrowLeft', 14),
        h('span', { class: 'lesson-back-label' }, 'Phase'),
      ),
      h('span', { class: 'lesson-crumb' }, lesson.title),
      counter,
    ),
    h('div', { class: 'lesson-progress' }, bar),
  );

  paint();
  scrollTop();

  return h(
    'div',
    null,
    headerEl,
    h('div', { class: 'lesson-body' }, stepBody, stepFoot),
  );
}
