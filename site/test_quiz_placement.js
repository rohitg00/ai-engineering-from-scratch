const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseMd, headingIds, sectionIds, quizPlacement, quizPanelQuestions } = require('./lesson-markdown.js');

const ROOT = path.join(__dirname, '..');

function lessonsWithQuiz() {
  const lessons = [];
  for (const phase of fs.readdirSync(path.join(ROOT, 'phases'))) {
    const phaseDir = path.join(ROOT, 'phases', phase);
    if (!fs.statSync(phaseDir).isDirectory()) continue;
    for (const lesson of fs.readdirSync(phaseDir)) {
      const quizPath = path.join(phaseDir, lesson, 'quiz.json');
      const mdPath = path.join(phaseDir, lesson, 'docs', 'en.md');
      if (!fs.existsSync(quizPath) || !fs.existsSync(mdPath)) continue;
      const quiz = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
      const markdown = fs.readFileSync(mdPath, 'utf8');
      lessons.push({ name: phase + '/' + lesson, quiz, markdown, ids: headingIds(parseMd(markdown)) });
    }
  }
  return lessons;
}

const LESSONS = lessonsWithQuiz();

function stages(quiz) {
  const questions = quiz.questions || quiz;
  return new Set(questions.map((q) => q.stage).filter(Boolean));
}

function translatedIds(lesson) {
  return sectionIds(lesson.markdown).map((_, i) => (i % 2 ? '' : 'secao-' + i));
}

function assertPlaced(place, count, name) {
  for (const stage of ['pre', 'check', 'post']) {
    assert.ok(place[stage] >= 0 && place[stage] <= count, `${name}: ${stage} index ${place[stage]} outside 0..${count}`);
  }
  assert.ok(place.pre <= place.check && place.check <= place.post, `${name}: stages out of order ${JSON.stringify(place)}`);
}

test('every lesson quiz reaches a placement before the footer panels', () => {
  assert.ok(LESSONS.length > 300);
  for (const lesson of LESSONS) {
    assertPlaced(quizPlacement(lesson.ids), lesson.ids.length, lesson.name);
  }
});

test('translated headings keep the English placement', () => {
  for (const lesson of LESSONS) {
    const english = quizPlacement(lesson.ids);
    const reference = sectionIds(lesson.markdown);
    const translated = translatedIds(lesson);
    const place = quizPlacement(translated, reference);
    assertPlaced(place, translated.length, lesson.name);
    const shift = reference.length - lesson.ids.length;
    for (const stage of ['pre', 'check', 'post']) {
      if (english[stage] < lesson.ids.length) assert.equal(place[stage], english[stage] + shift, `${lesson.name}: ${stage}`);
    }
  }
});

test('a Chinese translation that lacks a later English section keeps each quiz at its section', () => {
  const english = ['learning-objectives', 'before-you-start', 'the-problem', 'tables', 'section-headers', 'symbols', 'relocations', 'program-headers', 'mach-o', 'build-it', 'use-it', 'interactive-lab', 'practice-lab', 'graded-lab', 'lesson-artifact', 'verify-it', 'production-failure-modes', 'operational-rule', 'further-reading'];
  const chinese = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  const place = quizPlacement(chinese, english);
  assert.equal(place.pre, 9);
  assert.equal(place.check, 10);
  assert.equal(place.post, chinese.length);
});

test('a Portuguese translation keeps the pre, mid and post quizzes at their sections', () => {
  const english = ['learning-objectives', 'the-problem', 'the-concept', 'build-it', 'use-it', 'ship-it', 'exercises', 'key-terms', 'further-reading'];
  const portuguese = ['objetivos-de-aprendizagem', 'o-problema', 'o-conceito', 'construa', 'us-lo', 'entregue', 'exerc-cios', 'termos-chave', 'leitura-adicional'];
  const place = quizPlacement(portuguese, english);
  assert.deepEqual([place.pre, place.check, place.post], [2, 4, 7]);
});

test('without Key Terms the post quiz closes the lesson content, after any exercises', () => {
  const place = quizPlacement(['the-problem', 'the-concept', 'build-it', 'exercises', 'stretch-goals']);
  assert.equal(place.post, 5);
  assert.equal(place.check, 4);
});

test('the pre-lesson check is placed when a lesson has no Concept or Build heading', () => {
  const place = quizPlacement(['the-problem', 'the-system', 'how-it-runs', 'key-terms']);
  assert.equal(place.pre, 1);
  assert.equal(place.post, 3);
  assert.equal(place.check, 2);
});

test('headings with extra words still match their stage', () => {
  const place = quizPlacement(['the-problem', 'the-concept', 'build-it', 'use-it-in-a-real-repository', 'ship-it', 'key-terms']);
  assert.deepEqual([place.pre, place.check, place.post], [1, 3, 5]);
});

test('a lesson with only Key Terms keeps the mid-lesson check apart from the post quiz', () => {
  const place = quizPlacement(['the-problem', 'the-concept', 'build-it', 'exercises', 'key-terms']);
  assert.equal(place.post, 4);
  assert.equal(place.check, 3);
});

test('a lesson quiz never appears twice on one page', () => {
  for (const lesson of LESSONS) {
    assert.deepEqual(quizPanelQuestions(lesson.quiz), [], `${lesson.name}: the panel would repeat inline questions`);
  }
  assert.equal(quizPanelQuestions(null), null);
});

test('quizzes without a post stage still place every stage they have', () => {
  const noPost = LESSONS.filter((lesson) => !stages(lesson.quiz).has('post'));
  for (const lesson of noPost) {
    assertPlaced(quizPlacement(lesson.ids), lesson.ids.length, lesson.name);
  }
});

test('the fallback quiz marks the Ship answer correctly', () => {
  const html = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const line = html.split('\n').find((l) => l.includes('What is the "Ship" step'));
  const opts = JSON.parse('[' + line.match(/opts: \[(.*?)\], answer/)[1].replace(/'/g, '"') + ']');
  const answer = Number(line.match(/answer: (\d)/)[1]);
  assert.match(opts[answer], /reusable artifact/);
});
