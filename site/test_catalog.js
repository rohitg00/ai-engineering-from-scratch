#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const catalog = require('./catalog.js');

const LESSON_URL = 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/04-apis-and-keys/';
const LESSON_PATH = 'phases/00-setup-and-tooling/04-apis-and-keys';

function loadProgress(seed = {}) {
  const storage = new Map(Object.entries(seed));
  const context = {
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'progress.js'), 'utf8'), context);
  return { api: context.window.AIFSProgress, storage };
}

test('lesson numbers come from the lesson directory as phase.lesson', () => {
  assert.deepEqual(catalog.lessonNumber(0, LESSON_URL, 9), { phase: 0, lesson: 4, label: '00.04' });
  assert.equal(catalog.lessonNumber(19, 'https://x/tree/main/phases/19-capstone-projects/82-jailbreak-taxonomy', 70).label, '19.82');
  assert.equal(catalog.lessonNumber(10, 'phases/10-llms/134-long-run/', 1).label, '10.134');
  assert.equal(catalog.lessonNumber(3, '', 7).label, '03.07');
});

test('lesson numbers sort by phase, then numerically by lesson', () => {
  const labels = ['10.02', '02.10', '02.09', '00.04', '10.134', '10.34']
    .map(label => {
      const [phase, lesson] = label.split('.').map(Number);
      return { phase, lesson, label };
    })
    .sort(catalog.compareLessonNumbers)
    .map(number => number.label);
  assert.deepEqual(labels, ['00.04', '02.09', '02.10', '10.02', '10.34', '10.134']);
});

test('catalog paths match the progress tracker path for the same lesson URL', () => {
  const { api } = loadProgress();
  assert.equal(catalog.lessonPathFromUrl(LESSON_URL), LESSON_PATH);
  assert.equal(catalog.lessonPathFromUrl(LESSON_URL), api.extractPath(LESSON_URL));
  assert.equal(catalog.lessonPathFromUrl(''), '');
});

test('catalog checkboxes write the same progress key and record the lesson page reads', () => {
  const { api, storage } = loadProgress();
  catalog.setLessonDone(api, LESSON_PATH, true);
  const stored = JSON.parse(storage.get('aifs:progress:v2'));
  assert.equal(stored.schemaVersion, 2);
  assert.ok(stored.lessons[LESSON_PATH].completedAt > 0);
  assert.equal(stored.lessons[LESSON_PATH].completionSource, 'learner');
  assert.equal(api.isLessonComplete(LESSON_PATH), true);
  assert.deepEqual(Array.from(storage.keys()), ['aifs:progress:v2']);

  catalog.setLessonDone(api, LESSON_PATH, false);
  assert.equal(api.isLessonComplete(LESSON_PATH), false);
  assert.equal(JSON.parse(storage.get('aifs:progress:v2')).lessons[LESSON_PATH].completedAt, null);
});

test('lessons completed on the lesson page show as done in the catalog', () => {
  const { api, storage } = loadProgress();
  const other = 'phases/00-setup-and-tooling/05-jupyter-notebooks';
  api.markLessonComplete(LESSON_PATH, 'learner');
  api.recordVisit(other);
  const fromState = catalog.completedPaths(JSON.parse(storage.get('aifs:progress:v2')));
  assert.deepEqual(Object.keys(fromState), [LESSON_PATH]);
  const fromApi = catalog.readCompletedPaths(api);
  assert.deepEqual(Object.keys(fromApi), [LESSON_PATH]);
  assert.deepEqual(Object.keys(catalog.completedPaths(null)), []);
});

test('legacy v1 completions appear as done in the catalog', () => {
  const { api } = loadProgress({
    'aifs:progress:v1': JSON.stringify({ lessons: { [LESSON_PATH]: { completedAt: 1700000000000 } } }),
  });
  assert.deepEqual(Object.keys(catalog.readCompletedPaths(api)), [LESSON_PATH]);
  assert.deepEqual(Object.keys(catalog.readCompletedPaths(null)), []);
});

test('catalog page loads the shared progress runtime before the catalog helpers', () => {
  const html = fs.readFileSync(path.join(__dirname, 'catalog.html'), 'utf8');
  const progressAt = html.indexOf('<script src="progress.js?v=');
  const catalogAt = html.indexOf('<script src="catalog.js?v=');
  assert.ok(progressAt > 0 && catalogAt > progressAt);
  assert.match(html, /data-sort="number"[^>]*>No\./);
  assert.match(html, /data-sort="status"[^>]*>Content /);
  assert.match(html, /id="catalogProgress"/);
  assert.doesNotMatch(html, /aifs:progress/);
});
