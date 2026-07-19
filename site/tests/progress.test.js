const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const values = new Map();
const localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
const window = { addEventListener() {} };

vm.runInNewContext(fs.readFileSync('site/progress.js', 'utf8'), {
  Date,
  JSON,
  Number,
  String,
  localStorage,
  window,
});

const progress = window.AIFSProgress;
const lesson = 'phases/00-setup-and-tooling/01-dev-environment';

progress.recordVisit(lesson);
progress.recordPosition(lesson, 42.5, 900);
assert.equal(progress.getMostRecentLesson().path, lesson);
assert.equal(progress.getLessonProgress(lesson).scrollPercent, 42.5);
assert.equal(progress.getLessonProgress(lesson).scrollY, 900);

progress.recordPosition(lesson, 120, -1);
assert.equal(progress.getLessonProgress(lesson).scrollPercent, 100);
assert.equal(progress.getLessonProgress(lesson).scrollY, 0);

progress.markLessonComplete(lesson);
assert.equal(progress.isLessonComplete(lesson), true);
assert.equal(progress.totalCompleted(), 1);
assert.equal(progress.extractPath(`https://github.com/example/repo/tree/main/${lesson}`), lesson);

progress.reset();
assert.deepEqual(JSON.parse(JSON.stringify(progress.getState())), { lessons: {}, updatedAt: 0 });

console.log('progress tracker: ok');
