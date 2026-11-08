const assert = require('node:assert/strict');
const test = require('node:test');
const walk = require('./lesson-walkthrough.js');

const { DAY, INTERVAL_DAYS, sectionIndexAt, stepAt, nextRevisit, recordRevisit, daysAgo } = walk;
const T0 = Date.UTC(2026, 9, 21);

test('the current section is the last heading above the reading line', () => {
  const tops = [100, 600, 1400];
  assert.equal(sectionIndexAt(tops, 50), -1);
  assert.equal(sectionIndexAt(tops, 100), 0);
  assert.equal(sectionIndexAt(tops, 900), 1);
  assert.equal(sectionIndexAt(tops, 9000), 2);
});

test('a step is lit only between its heading and the end of its section', () => {
  const tops = [1000, 1400, 1900];
  assert.equal(stepAt(tops, 2600, 900), -1);
  assert.equal(stepAt(tops, 2600, 1500), 1);
  assert.equal(stepAt(tops, 2600, 2599), 2);
  assert.equal(stepAt(tops, 2600, 2600), -1);
  assert.equal(stepAt(tops, null, 99999), 2);
});

test('a lesson is due one day after completion, never before', () => {
  const lessons = { 'phases/a/b': { completedAt: T0 } };
  assert.equal(nextRevisit(lessons, {}, T0 + DAY - 1, ''), null);
  assert.equal(nextRevisit(lessons, {}, T0 + DAY, ''), 'phases/a/b');
});

test('the lesson on screen and unfinished lessons are never suggested', () => {
  const lessons = { 'phases/a/b': { completedAt: T0 }, 'phases/a/c': { completedAt: null } };
  assert.equal(nextRevisit(lessons, {}, T0 + 10 * DAY, 'phases/a/b'), null);
});

test('the most overdue lesson comes first', () => {
  const lessons = { 'phases/a/new': { completedAt: T0 + 5 * DAY }, 'phases/a/old': { completedAt: T0 } };
  assert.equal(nextRevisit(lessons, {}, T0 + 7 * DAY, ''), 'phases/a/old');
});

test('recall widens the interval, forgetting resets it, later keeps it', () => {
  let state = recordRevisit({}, 'p', 'recalled', T0);
  assert.deepEqual(state.p, { step: 1, at: T0 });
  const lessons = { p: { completedAt: T0 - 10 * DAY } };
  assert.equal(nextRevisit(lessons, state, T0 + INTERVAL_DAYS[1] * DAY - 1, ''), null);
  assert.equal(nextRevisit(lessons, state, T0 + INTERVAL_DAYS[1] * DAY, ''), 'p');
  state = recordRevisit(state, 'p', 'later', T0 + DAY);
  assert.deepEqual(state.p, { step: 1, at: T0 + DAY });
  state = recordRevisit(state, 'p', 'forgot', T0 + 2 * DAY);
  assert.deepEqual(state.p, { step: 0, at: T0 + 2 * DAY });
});

test('a lesson recalled at every interval retires from review', () => {
  let state = {};
  for (let i = 0; i < INTERVAL_DAYS.length; i++) state = recordRevisit(state, 'p', 'recalled', T0);
  assert.equal(nextRevisit({ p: { completedAt: T0 } }, state, T0 + 1000 * DAY, ''), null);
});

test('a retired lesson completed again starts a fresh schedule', () => {
  let state = {};
  for (let i = 0; i < INTERVAL_DAYS.length; i++) state = recordRevisit(state, 'p', 'recalled', T0);
  const again = { p: { completedAt: T0 + 30 * DAY } };
  assert.equal(nextRevisit(again, state, T0 + 31 * DAY - 1, ''), null);
  assert.equal(nextRevisit(again, state, T0 + 31 * DAY, ''), 'p');
});

test('recordRevisit does not mutate its input', () => {
  const before = { p: { step: 2, at: T0 } };
  recordRevisit(before, 'p', 'recalled', T0 + DAY);
  assert.deepEqual(before, { p: { step: 2, at: T0 } });
});

test('ages read as plain words', () => {
  assert.equal(daysAgo(T0, T0 + 1000), 'today');
  assert.equal(daysAgo(T0, T0 + DAY), 'yesterday');
  assert.equal(daysAgo(T0, T0 + 6 * DAY), '6 days ago');
});

const { autoPinTarget } = walk;

test('an automatic pin never replaces a figure the reader pinned by hand', () => {
  const manual = { auto: false };
  const candidate = { auto: false };
  assert.equal(autoPinTarget([{ entry: candidate, bottom: 10 }], manual), null);
});

test('only the closest of several figures in view is pinned automatically', () => {
  const far = {};
  const near = {};
  assert.equal(autoPinTarget([{ entry: far, bottom: -400 }, { entry: near, bottom: 20 }], null), near);
  assert.equal(autoPinTarget([{ entry: near, bottom: 20 }, { entry: far, bottom: -400 }], { auto: true }), near);
  assert.equal(autoPinTarget([], null), null);
});

function fakeElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    children: [],
    parentNode: null,
    listeners: {},
    attributes: {},
    style: {},
    dataset: {},
    hidden: false,
    textContent: '',
    className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    insertBefore(child) { return this.appendChild(child); },
    remove() {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); },
    click() { (this.listeners.click || []).slice().forEach(fn => fn({ type: 'click', target: this, preventDefault() {} })); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function findByText(node, text) {
  if (node.textContent === text) return node;
  for (const child of node.children) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

function mountRevisitCard() {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const store = new Map();
  const now = Date.now();
  store.set('aifs:progress:v2', JSON.stringify({ lessons: { 'phases/a/old': { completedAt: now - 10 * DAY } } }));
  const doc = fakeElement('document');
  doc.body = fakeElement('body');
  doc.documentElement = fakeElement('html');
  doc.createElement = fakeElement;
  const window = {
    document: doc,
    innerWidth: 1000,
    innerHeight: 800,
    localStorage: { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)) },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    PHASES: [{ name: 'Phase A', lessons: [{ name: 'Old lesson', url: 'old', summary: 'A summary.' }] }],
    AIFSProgress: { extractPath: () => 'phases/a/old' },
  };
  const context = vm.createContext({ window, Node: { DOCUMENT_POSITION_FOLLOWING: 4 }, CustomEvent: function () {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'lesson-walkthrough.js'), 'utf8'), context);
  const article = fakeElement('article');
  window.AIFSWalkthrough.mount(article, { path: 'phases/a/current' });
  const card = article.children[0];
  return {
    store,
    window,
    status: card.children[card.children.length - 1],
    actions: findByText(card, 'I could explain it').parentNode,
    recalled: findByText(card, 'I could explain it'),
    open: findByText(card, 'Not yet. Open the lesson'),
  };
}

test('opening the lesson from the revisit prompt records one outcome and closes the choice', () => {
  const card = mountRevisitCard();
  card.open.click();
  assert.equal(card.actions.hidden, true);
  assert.equal(JSON.parse(card.store.get('aifs:revisit:v1'))['phases/a/old'].step, 0);
  card.recalled.click();
  assert.equal(JSON.parse(card.store.get('aifs:revisit:v1'))['phases/a/old'].step, 0);
});

test('a recalled revisit cannot also be recorded as forgotten', () => {
  const card = mountRevisitCard();
  card.recalled.click();
  card.open.click();
  assert.equal(JSON.parse(card.store.get('aifs:revisit:v1'))['phases/a/old'].step, 1);
});

test('a revisit answer that storage refuses keeps the choice open for a retry', () => {
  const card = mountRevisitCard();
  const setItem = card.window.localStorage.setItem;
  card.window.localStorage.setItem = () => { throw new Error('quota'); };
  card.recalled.click();
  assert.equal(card.actions.hidden, false);
  assert.equal(card.store.has('aifs:revisit:v1'), false);
  assert.match(card.status.textContent, /did not save/);
  card.window.localStorage.setItem = setItem;
  card.recalled.click();
  assert.equal(card.actions.hidden, true);
  assert.equal(JSON.parse(card.store.get('aifs:revisit:v1'))['phases/a/old'].step, 1);
});
