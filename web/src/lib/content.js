/**
 * Content loader. The build script writes public/content/ from phases/.
 */

let catalogPromise = null;
const lessonCache = new Map();

function contentUrl(path) {
  return new URL(`content/${path}`, document.baseURI).href;
}

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(contentUrl('catalog.json'))
      .then((response) => {
        if (!response.ok) throw new Error(`catalog: ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}

export function loadLesson(id) {
  if (lessonCache.has(id)) return lessonCache.get(id);
  const promise = fetch(contentUrl(`lessons/${id}.json`))
    .then((response) => {
      if (!response.ok) throw new Error(`lesson: ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      lessonCache.delete(id);
      throw error;
    });
  lessonCache.set(id, promise);
  return promise;
}

export function findLesson(catalog, id) {
  for (const phase of catalog.phases) {
    const lesson = phase.lessons.find((entry) => entry.id === id);
    if (lesson) return { phase, lesson };
  }
  return null;
}

export function flatLessons(catalog) {
  return catalog.phases.flatMap((phase) =>
    phase.lessons.map((lesson) => ({ ...lesson, phaseId: phase.id, phaseTitle: phase.title })),
  );
}

/** Next lesson after `id`, wrapping into the next phase. */
export function nextLesson(catalog, id) {
  const all = flatLessons(catalog);
  const index = all.findIndex((lesson) => lesson.id === id);
  return index >= 0 ? all[index + 1] ?? null : null;
}

export function prevLesson(catalog, id) {
  const all = flatLessons(catalog);
  const index = all.findIndex((lesson) => lesson.id === id);
  return index > 0 ? all[index - 1] ?? null : null;
}

/**
 * Build the step script for one lesson. Every lesson gets the same loop:
 * pre-test, read, build, practice, check, recall, done.
 */
export function buildSteps(lesson) {
  const steps = [{ kind: 'intro' }];

  const pre = lesson.quiz.filter((q) => q.stage === 'pre');
  const post = lesson.quiz.filter((q) => q.stage !== 'pre');

  if (pre.length) steps.push({ kind: 'pre', questions: pre });

  lesson.reading.forEach((section, index) => {
    steps.push({ kind: 'read', section, index, total: lesson.reading.length });
  });

  if (lesson.build || lesson.code.files.length) steps.push({ kind: 'build' });
  if (lesson.exercises.length) steps.push({ kind: 'practice' });
  if (post.length) steps.push({ kind: 'quiz', questions: post });

  steps.push({ kind: 'recall' });
  steps.push({ kind: 'done' });

  return steps;
}

/** Canonical published page for a lesson on the course site. */
export function siteUrl(lesson) {
  return `https://aiengineeringfromscratch.com/lesson?path=${encodeURIComponent(`phases/${lesson.id}/`)}`;
}

/** Approximate the time for one reading step, from its word count. */
export function stepMinutes(blocks) {
  const words = blocks
    .map((block) => {
      if (block.kind === 'p') return block.text.split(/\s+/).length;
      if (block.kind === 'ul' || block.kind === 'ol') return block.items.join(' ').split(/\s+/).length;
      if (block.kind === 'table') return block.rows.length * 18;
      if (block.kind === 'code') return block.source.split('\n').length * 4;
      return 0;
    })
    .reduce((a, b) => a + b, 0);
  return Math.max(1, Math.round(words / 200));
}

export function lessonCards(lesson) {
  const cards = [];

  lesson.keyTerms.slice(0, 12).forEach((term, index) => {
    cards.push({
      id: `${lesson.id}#term-${index}`,
      lessonId: lesson.id,
      phaseId: lesson.phaseId,
      kind: 'term',
      front: term.term,
      back: term.means,
      context: term.said || '',
    });
  });

  lesson.quiz.forEach((question, index) => {
    cards.push({
      id: `${lesson.id}#quiz-${index}`,
      lessonId: lesson.id,
      phaseId: lesson.phaseId,
      kind: 'quiz',
      front: question.question,
      back: question.options[question.correct] ?? '',
      context: question.explanation,
    });
  });

  return cards;
}
