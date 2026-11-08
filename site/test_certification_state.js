#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const PROGRESS_SOURCE = fs.readFileSync(path.join(__dirname, 'certification-progress.js'), 'utf8');
const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, 'certifications.js'), 'utf8');
const MINUTE = 60000;
const START = Date.UTC(2026, 10, 6, 12, 0, 0);

function sharedStorage() {
  const data = new Map();
  const storage = {
    data,
    failWrites: false,
    failReads: false,
    get length() {
      if (storage.failReads) throw new Error('blocked');
      return data.size;
    },
    key(index) {
      if (storage.failReads) throw new Error('blocked');
      return Array.from(data.keys())[index] ?? null;
    },
    getItem(key) {
      if (storage.failReads) throw new Error('blocked');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (storage.failWrites) throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem(key) {
      if (storage.failWrites) throw new Error('blocked');
      data.delete(key);
    },
  };
  return storage;
}

function makeClock(start) {
  const clock = { time: start };
  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock.time]));
    }
    static now() {
      return clock.time;
    }
  }
  clock.Date = FakeDate;
  return clock;
}

function fakeElement(id) {
  const listeners = {};
  return {
    id,
    innerHTML: '',
    textContent: '',
    hidden: false,
    listeners,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    focus() {},
    dispatch(type, event) { (listeners[type] || []).forEach(fn => fn(event)); },
  };
}

function loadTab({ storage, clock, page, search, certifications }) {
  const elements = new Map();
  const windowListeners = {};
  const intervals = new Map();
  let intervalId = 0;
  const historyUrls = [];
  const document = {
    readyState: 'complete',
    title: '',
    documentElement: fakeElement('html'),
    body: { getAttribute: name => (name === 'data-cert-page' ? page : null) },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, fakeElement(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    createElement() {
      let text = '';
      return {
        set textContent(value) { text = String(value); },
        get innerHTML() { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
      };
    },
    addEventListener() {},
  };
  const location = { search, pathname: '/assessment.html', hash: '' };
  const context = {
    document,
    localStorage: storage,
    location,
    Date: clock.Date,
    URLSearchParams,
    URL,
    CERTIFICATIONS: certifications,
    console,
    setInterval(fn) { intervalId += 1; intervals.set(intervalId, fn); return intervalId; },
    clearInterval(id) { intervals.delete(id); },
    scrollTo() {},
    matchMedia: () => ({ matches: false }),
    history: {
      replaceState(_state, _title, url) {
        historyUrls.push(url);
        location.search = url.slice(url.indexOf('?'));
      },
    },
    addEventListener(type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn); },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(PROGRESS_SOURCE, context);
  if (page) vm.runInContext(PAGE_SOURCE, context);
  return {
    context,
    api: context.AIFSCertProgress,
    el: id => document.getElementById(id),
    historyUrls,
    tick() { Array.from(intervals.values()).forEach(fn => fn()); },
    activeTimers: () => intervals.size,
    storageEvent(key) { (windowListeners.storage || []).forEach(fn => fn({ key })); },
    answer(questionId, value) {
      const form = document.getElementById('assessmentForm');
      form.dispatch('change', {
        target: {
          value: String(value),
          checked: true,
          matches: selector => selector === 'input[data-question]',
          getAttribute: name => (name === 'data-question' ? questionId : null),
        },
      });
    },
    submit() {
      document.getElementById('assessmentForm').dispatch('submit', { preventDefault() {} });
    },
  };
}

function certificationData(timeLimitMinutes) {
  const assessment = {
    id: 'mock-a',
    title: 'Mock A',
    version: 1,
    timeLimitMinutes,
    questions: [
      { id: 'q1', domain: 'd1', prompt: 'One?', options: ['a', 'b'], correct: 0 },
      { id: 'q2', domain: 'd1', prompt: 'Two?', options: ['a', 'b'], correct: 1 },
    ],
  };
  return {
    programs: [{ id: 'p', name: 'Program' }],
    tracks: [{ id: 't1', programId: 'p', lessons: [], domains: [], assessments: [{ id: 'mock-a', title: 'Mock A' }] }],
    lessonsByPath: {},
    assessmentsById: { 'mock-a': assessment },
  };
}

function storedAttempts(storage) {
  return Array.from(storage.data.keys()).filter(key => key.includes(':attempt:')).map(key => JSON.parse(storage.data.get(key)));
}

function storedMeta(storage) {
  const raw = storage.data.get('aifs:cert-progress:v2:' + encodeURIComponent('mock-a@1'));
  return raw ? JSON.parse(raw) : null;
}

function validAttempt(overrides = {}) {
  return Object.assign({
    answers: { q1: [0] },
    correct: 1,
    total: 2,
    percent: 50,
    domains: { d1: { correct: 1, total: 2 } },
    startedAt: START,
    submittedAt: START + MINUTE,
    durationMs: MINUTE,
    version: 1,
  }, overrides);
}

test('viewing a timed assessment does not save a draft or start a deadline', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  assert.equal(storedMeta(storage), null);
  assert.equal(tab.activeTimers(), 0);
  assert.match(tab.el('assessmentMount').innerHTML, /<strong id="assessmentTimerValue">30:00<\/strong>/);
});

test('returning after the limit without answering records no attempt', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  clock.time += 45 * MINUTE;
  const back = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  back.tick();
  assert.equal(storedAttempts(storage).length, 0);
  assert.match(back.el('assessmentMount').innerHTML, /assessmentForm/);
});

test('an expired legacy draft with no answers is discarded instead of submitted', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  storage.data.set('aifs:cert-progress:v2:' + encodeURIComponent('mock-a@1'), JSON.stringify({
    schemaVersion: 2,
    draft: { answers: { q1: [] }, startedAt: START, deadlineAt: START + 30 * MINUTE, version: 1 },
    updatedAt: START,
  }));
  clock.time += 45 * MINUTE;
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tab.tick();
  assert.equal(storedAttempts(storage).length, 0);
  assert.equal(storedMeta(storage).draft, null);
  assert.equal(tab.activeTimers(), 0);
});

test('the deadline starts at the first answer and an answered sitting still times out', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  clock.time += 10 * MINUTE;
  tab.answer('q1', 0);
  const draft = storedMeta(storage).draft;
  assert.equal(draft.startedAt, START + 10 * MINUTE);
  assert.equal(draft.deadlineAt, START + 40 * MINUTE);
  assert.equal(tab.activeTimers(), 1);
  clock.time += 31 * MINUTE;
  tab.tick();
  const attempts = storedAttempts(storage);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].timedOut, true);
  assert.equal(attempts[0].correct, 1);
  assert.match(tab.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
});

test('a second tab cannot resurrect or resubmit a sitting already submitted elsewhere', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(0);
  const tabA = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tabA.answer('q1', 0);
  const tabB = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  clock.time += MINUTE;
  tabA.submit();
  assert.equal(storedAttempts(storage).length, 1);
  assert.equal(storedMeta(storage).draft, null);

  tabB.answer('q2', 1);
  assert.equal(storedMeta(storage).draft, null);
  assert.match(tabB.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
  tabB.submit();
  assert.equal(storedAttempts(storage).length, 1);
});

test('a storage event from another tab switches a stale sitting to the stored result', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  const tabA = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tabA.answer('q1', 0);
  const tabB = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  assert.equal(tabB.activeTimers(), 1);
  clock.time += MINUTE;
  tabA.submit();
  tabB.storageEvent('aifs:cert-progress:v2:' + encodeURIComponent('mock-a@1'));
  assert.match(tabB.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
  assert.equal(tabB.activeTimers(), 0);
  clock.time += 60 * MINUTE;
  tabB.tick();
  assert.equal(storedAttempts(storage).length, 1);
});

test('a failed write does not hide attempts that are still readable', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const tab = loadTab({ storage, clock });
  assert.equal(tab.api.recordAttempt('mock-a', 1, validAttempt()), true);
  storage.failWrites = true;
  tab.api.saveDraft('mock-a', 1, { answers: {}, startedAt: START, deadlineAt: 0, version: 1 });
  assert.equal(tab.api.isPersistent(), false);
  assert.equal(tab.api.getAttempts('mock-a', 1).length, 1);
  assert.equal(tab.api.getBest('mock-a', 1).percent, 50);
  assert.equal(tab.api.getDraft('mock-a', 1).startedAt, START);

  storage.failWrites = false;
  tab.api.saveDraft('mock-a', 1, { answers: { q1: [1] }, startedAt: START + 1, deadlineAt: 0, version: 1 });
  assert.equal(tab.api.isPersistent(), true);
  assert.equal(storedMeta(storage).draft.startedAt, START + 1);
});

test('an attempt that cannot be stored stays visible this session and returns false', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const tab = loadTab({ storage, clock });
  tab.api.recordAttempt('mock-a', 1, validAttempt({ submittedAt: START + 2 * MINUTE, durationMs: 2 * MINUTE }));
  storage.failWrites = true;
  assert.equal(tab.api.recordAttempt('mock-a', 1, validAttempt({ percent: 100, correct: 2, submittedAt: START + 5 * MINUTE, durationMs: 5 * MINUTE })), false);
  const attempts = tab.api.getAttempts('mock-a', 1);
  assert.deepEqual(Array.from(attempts, attempt => attempt.percent), [100, 50]);
  assert.equal(tab.api.getBest('mock-a', 1).percent, 100);
});

test('a failed attempt write shows the result without a resumable latest-result URL', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tab.answer('q1', 0);
  storage.failWrites = true;
  tab.submit();
  assert.match(tab.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
  assert.ok(!tab.historyUrls.some(url => url.includes('result=latest')));
  assert.doesNotMatch(tab.el('assessmentMount').innerHTML, /Revisit latest result/);
  assert.match(tab.el('assessmentMount').innerHTML, /Result not saved/);
});

test('a saved attempt keeps the revisit link and shows no unsaved warning', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tab.answer('q1', 0);
  tab.submit();
  assert.match(tab.el('assessmentMount').innerHTML, /Revisit latest result/);
  assert.doesNotMatch(tab.el('assessmentMount').innerHTML, /Result not saved/);
});

test('track progress refreshes the attempted count when an attempt is recorded', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(0);
  const tab = loadTab({ storage, clock, page: 'track', search: '?id=t1', certifications });
  assert.match(tab.el('trackProgress').innerHTML, /0 of 1 assessment attempted/);
  tab.api.recordAttempt('mock-a', 1, validAttempt());
  assert.match(tab.el('trackProgress').innerHTML, /1 of 1 assessment attempted/);
});

test('legacy v1 attempts are still migrated and read', () => {
  const storage = sharedStorage();
  storage.data.set('aifs:cert-progress:v1', JSON.stringify({
    drafts: {},
    attempts: { 'mock-a@1': [validAttempt()] },
    bests: {},
    updatedAt: START,
  }));
  const tab = loadTab({ storage, clock: makeClock(START) });
  assert.equal(tab.api.getAttempts('mock-a', 1).length, 1);
  assert.equal(tab.api.getBest('mock-a', 1).percent, 50);
});

test('a draft held in memory after a failed write does not overwrite a newer sitting from another tab', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(0);
  const tabA = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  storage.failWrites = true;
  tabA.answer('q1', 0);
  assert.equal(storedMeta(storage), null);
  storage.failWrites = false;
  clock.time += MINUTE;
  const tabB = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tabB.answer('q1', 1);
  assert.equal(storedMeta(storage).draft.startedAt, START + MINUTE);
  tabA.answer('q2', 1);
  assert.equal(storedMeta(storage).draft.startedAt, START + MINUTE);
  assert.deepEqual(storedMeta(storage).draft.answers.q1, [1]);
  tabA.answer('q2', 1);
  assert.deepEqual(storedMeta(storage).draft.answers, { q1: [1], q2: [1] });
});

test('a retake after failed writes does not restore the submitted sitting', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(0);
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tab.answer('q1', 0);
  storage.failWrites = true;
  clock.time += MINUTE;
  tab.submit();
  assert.match(tab.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
  const form = tab.el('assessmentForm');
  Object.keys(form.listeners).forEach(type => { form.listeners[type] = []; });
  tab.el('assessmentRetake').dispatch('click', {});
  assert.doesNotMatch(tab.el('assessmentMount').innerHTML, / checked/);
  clock.time += MINUTE;
  tab.answer('q2', 1);
  assert.doesNotMatch(tab.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
  assert.equal(tab.api.getDraft('mock-a', 1).startedAt, START + 2 * MINUTE);
});

test('legacy v1 history stays visible when migration writes fail', () => {
  const storage = sharedStorage();
  storage.data.set('aifs:cert-progress:v1', JSON.stringify({
    drafts: {},
    attempts: { 'mock-a@1': [validAttempt()] },
    bests: {},
    updatedAt: START,
  }));
  storage.failWrites = true;
  const tab = loadTab({ storage, clock: makeClock(START) });
  assert.equal(tab.api.getAttempts('mock-a', 1).length, 1);
  assert.equal(tab.api.getBest('mock-a', 1).percent, 50);
  storage.failWrites = false;
  assert.equal(tab.api.getAttempts('mock-a', 1).length, 1);
  assert.equal(storedAttempts(storage).length, 1);
  assert.equal(tab.api.getAttempts('mock-a', 1).length, 1);
});

test('an untouched draft from before the upgrade is reset even before its deadline', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  storage.data.set('aifs:cert-progress:v2:' + encodeURIComponent('mock-a@1'), JSON.stringify({
    schemaVersion: 2,
    draft: { answers: {}, startedAt: START, deadlineAt: START + 30 * MINUTE, version: 1 },
    updatedAt: START,
  }));
  clock.time += 20 * MINUTE;
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  assert.equal(storedMeta(storage).draft, null);
  assert.equal(tab.activeTimers(), 0);
  assert.match(tab.el('assessmentMount').innerHTML, /<strong id="assessmentTimerValue">30:00<\/strong>/);
  tab.answer('q1', 0);
  assert.equal(storedMeta(storage).draft.deadlineAt, START + 50 * MINUTE);
});

test('a started sitting whose answers were all cleared still records a timeout after reload', () => {
  const storage = sharedStorage();
  const clock = makeClock(START);
  const certifications = certificationData(30);
  certifications.assessmentsById['mock-a'].questions.push({ id: 'q3', domain: 'd1', type: 'multiple', prompt: 'Three?', options: ['a', 'b', 'c'], correct: [0, 1] });
  const tab = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  tab.answer('q3', 0);
  assert.deepEqual(storedMeta(storage).draft.answers, { q3: [] });
  clock.time += 31 * MINUTE;
  const back = loadTab({ storage, clock, page: 'assessment', search: '?id=mock-a', certifications });
  back.tick();
  const attempts = storedAttempts(storage);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].timedOut, true);
  assert.match(back.el('assessmentMount').innerHTML, /PRACTICE RESULT/);
});
