const assert = require('node:assert/strict');
const test = require('node:test');
const Store = require('./practice-store');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
}

function clock(start) {
  let time = start;
  return { now: () => time, advance: ms => { time += ms; } };
}

const DAY = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 9, 20, 12, 0, 0).getTime();

test('a new problem starts as not started and a failed submit marks it attempted', () => {
  const storage = memoryStorage();
  const store = Store.create({ localStorage: storage, now: () => NOON });
  assert.equal(store.status('softmax-cross-entropy'), 'new');
  store.record('softmax-cross-entropy', 'submit', 3, 13);
  assert.equal(store.status('softmax-cross-entropy'), 'attempted');
  const saved = JSON.parse(storage.getItem(Store.STORAGE_KEY));
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.problems['softmax-cross-entropy'].best, 3);
});

test('only a full submit solves a problem, and a later failure keeps it solved', () => {
  const store = Store.create({ localStorage: memoryStorage(), now: () => NOON });
  store.record('rope', 'run', 3, 3);
  assert.equal(store.status('rope'), 'attempted');
  store.record('rope', 'submit', 12, 12);
  assert.equal(store.status('rope'), 'solved');
  const solvedAt = store.problem('rope').solvedAt;
  store.record('rope', 'submit', 2, 12);
  assert.equal(store.status('rope'), 'solved');
  assert.equal(store.problem('rope').solvedAt, solvedAt);
  assert.equal(store.problem('rope').submits, 2);
});

test('the streak counts days with practice that end today or yesterday', () => {
  const time = clock(NOON - 3 * DAY);
  const store = Store.create({ localStorage: memoryStorage(), now: time.now });
  store.record('bm25', 'run', 0, 1);
  time.advance(DAY);
  store.record('bm25', 'run', 0, 1);
  time.advance(DAY);
  store.record('bm25', 'submit', 1, 1);
  assert.equal(store.streak(time.now()), 3);
  assert.equal(store.streak(time.now() + DAY), 3);
  assert.equal(store.streak(time.now() + 2 * DAY), 0);
});

test('code is saved for each problem and a reset removes it', () => {
  const storage = memoryStorage();
  const store = Store.create({ localStorage: storage, now: () => NOON });
  store.saveCode('kmeans-step', 'def assign():\n    return 1\n');
  assert.equal(store.loadCode('kmeans-step'), 'def assign():\n    return 1\n');
  assert.equal(store.loadCode('bm25'), null);
  const reopened = Store.create({ localStorage: storage, now: () => NOON });
  assert.equal(reopened.loadCode('kmeans-step'), 'def assign():\n    return 1\n');
  reopened.clearCode('kmeans-step');
  assert.equal(reopened.loadCode('kmeans-step'), null);
});

test('hints only grow and are kept across reloads', () => {
  const storage = memoryStorage();
  const store = Store.create({ localStorage: storage, now: () => NOON });
  assert.equal(store.revealHint('bm25', 2), 2);
  assert.equal(store.revealHint('bm25', 1), 2);
  assert.equal(Store.create({ localStorage: storage, now: () => NOON }).problem('bm25').hints, 2);
});

test('unreadable storage is backed up once and the store starts empty', () => {
  const storage = memoryStorage({ [Store.STORAGE_KEY]: '{not json' });
  const store = Store.create({ localStorage: storage, now: () => NOON });
  assert.equal(store.status('rope'), 'new');
  assert.equal(storage.getItem(Store.BACKUP_KEY), '{not json');
  store.record('rope', 'run', 0, 1);
  assert.equal(storage.getItem(Store.BACKUP_KEY), '{not json');
  assert.equal(store.status('rope'), 'attempted');
});

test('a newer schema is not overwritten blindly and bad records are dropped', () => {
  const raw = { schemaVersion: 1, problems: { rope: { status: 'solved' }, 'Bad Id': { status: 'solved' }, bm25: { status: 'hacked', runs: -4 } }, days: { 'not-a-day': 3, '2026-10-20': 2 } };
  const store = Store.create({ localStorage: memoryStorage({ [Store.STORAGE_KEY]: JSON.stringify(raw) }), now: () => NOON });
  const state = store.state();
  assert.deepEqual(Object.keys(state.problems).sort(), ['bm25', 'rope']);
  assert.equal(state.problems.bm25.status, 'new');
  assert.equal(state.problems.bm25.runs, 0);
  assert.ok(state.problems.rope.solvedAt > 0);
  assert.deepEqual(Object.keys(state.days), ['2026-10-20']);
  const future = memoryStorage({ [Store.STORAGE_KEY]: JSON.stringify({ schemaVersion: 9, problems: {} }) });
  Store.create({ localStorage: future, now: () => NOON }).status('rope');
  assert.equal(future.getItem(Store.BACKUP_KEY), JSON.stringify({ schemaVersion: 9, problems: {} }));
});

test('storage that throws keeps working in memory for the page', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const store = Store.create({ localStorage: broken, now: () => NOON });
  store.record('rope', 'submit', 5, 5);
  assert.equal(store.writable(), false);
  assert.equal(store.saveCode('rope', 'x = 1'), false);
  assert.equal(store.loadCode('rope'), 'x = 1');
  const none = Store.create({});
  assert.equal(none.status('rope'), 'new');
});

test('an invalid problem id is refused', () => {
  const store = Store.create({ localStorage: memoryStorage() });
  assert.throws(() => store.record('../x', 'run', 0, 1), /invalid problem id/);
  assert.throws(() => store.saveCode('__proto__', 'x'), /invalid problem id/);
});

test('continue picks the last open unsolved problem, then the newest attempt, then the first unsolved', () => {
  const time = clock(NOON);
  const store = Store.create({ localStorage: memoryStorage(), now: time.now });
  const ids = ['a-one', 'b-two', 'c-three'];
  assert.equal(store.continueTarget(ids), '');
  store.record('b-two', 'run', 0, 1);
  time.advance(1000);
  store.open('c-three');
  assert.equal(store.continueTarget(ids), 'c-three');
  store.record('c-three', 'submit', 4, 4);
  assert.equal(store.continueTarget(ids), 'b-two');
  store.record('b-two', 'submit', 4, 4);
  assert.equal(store.continueTarget(ids), 'a-one');
});

test('random unsolved prefers problems not started and never picks a solved one', () => {
  const store = Store.create({ localStorage: memoryStorage(), now: () => NOON });
  const ids = ['a-one', 'b-two', 'c-three'];
  store.record('a-one', 'submit', 1, 1);
  store.record('b-two', 'run', 0, 1);
  for (const value of [0, 0.5, 0.99]) assert.equal(store.randomUnsolved(ids, () => value), 'c-three');
  store.record('c-three', 'submit', 1, 1);
  assert.equal(store.randomUnsolved(ids, () => 0.3), 'b-two');
  store.record('b-two', 'submit', 1, 1);
  assert.equal(store.randomUnsolved(ids, () => 0.3), '');
});

test('counts report solved and attempted problems of a list', () => {
  const store = Store.create({ localStorage: memoryStorage(), now: () => NOON });
  store.record('a-one', 'submit', 1, 1);
  store.record('b-two', 'run', 0, 1);
  assert.deepEqual(store.counts(['a-one', 'b-two', 'c-three']), { solved: 1, attempted: 1, total: 3 });
});

test('dayKey uses the local calendar day', () => {
  assert.equal(Store.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(Store.dayKey(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('a full storage keeps the newest progress and code in memory', () => {
  const storage = memoryStorage();
  const store = Store.create({ localStorage: storage, now: () => NOON });
  store.saveCode('rope', 'old');
  store.record('rope', 'run', 0, 1);
  storage.setItem = () => { throw new Error('quota'); };
  store.record('rope', 'submit', 5, 5);
  assert.equal(store.writable(), false);
  assert.equal(store.status('rope'), 'solved');
  assert.equal(store.saveCode('rope', 'new'), false);
  assert.equal(store.loadCode('rope'), 'new');
});

test('a storage getter that throws falls back to memory', () => {
  const env = { now: () => NOON };
  Object.defineProperty(env, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const store = Store.create(env);
  store.record('rope', 'submit', 2, 2);
  assert.equal(store.status('rope'), 'solved');
});

test('a later code save does not bring back a stale progress record', () => {
  const storage = memoryStorage();
  const store = Store.create({ localStorage: storage, now: () => NOON });
  store.record('rope', 'run', 0, 1);
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === Store.STORAGE_KEY) throw new Error('quota');
    setItem(key, value);
  };
  store.record('rope', 'submit', 3, 3);
  assert.equal(store.saveCode('rope', 'x = 1'), true);
  assert.equal(store.status('rope'), 'solved');
  assert.equal(store.writable(), false);
});

test('a changed task version asks for a new pass', () => {
  const store = Store.create({ localStorage: memoryStorage(), now: () => NOON });
  store.open('rope', 'v1');
  store.record('rope', 'submit', 4, 4);
  store.open('rope', 'v1');
  assert.equal(store.status('rope'), 'solved');
  store.open('rope', 'v2');
  assert.equal(store.status('rope'), 'attempted');
  store.record('rope', 'submit', 5, 5);
  assert.equal(store.status('rope'), 'solved');
});

test('the browser start-up survives a localStorage getter that throws', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const window = {};
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'practice-store.js'), 'utf8'), { window });
  assert.ok(window.AIFSPracticeStore);
  window.AIFSPracticeStore.record('rope', 'submit', 1, 1);
  assert.equal(window.AIFSPracticeStore.status('rope'), 'solved');
});

test('a solved record without a version asks for a new pass when a version arrives', () => {
  const store = Store.create({ localStorage: memoryStorage(), now: () => NOON });
  store.record('rope', 'submit', 1, 1);
  store.open('rope', 'v1');
  assert.equal(store.status('rope'), 'attempted');
});

test('progress saved by a newer schema stays intact and the page does not write over it', () => {
  const text = JSON.stringify({ schemaVersion: 2, problems: { rope: { status: 'solved', extra: true } } });
  const storage = memoryStorage({ [Store.STORAGE_KEY]: text });
  const store = Store.create({ localStorage: storage, now: () => NOON });
  assert.equal(store.status('rope'), 'new');
  store.record('rope', 'submit', 1, 1);
  store.open('bm25', 'v1');
  assert.equal(store.status('rope'), 'solved');
  assert.equal(store.writable(), false);
  assert.equal(storage.getItem(Store.STORAGE_KEY), text);
  assert.equal(storage.getItem(Store.BACKUP_KEY), text);
});

test('after a failed write the store still reads other tabs and merges before it writes again', () => {
  const storage = memoryStorage();
  const tab = Store.create({ localStorage: storage, now: () => NOON });
  tab.record('rope', 'run', 0, 1);
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  tab.record('rope', 'submit', 4, 4);
  assert.equal(tab.writable(), false);
  storage.setItem = setItem;
  const other = Store.create({ localStorage: storage, now: () => NOON + 1000 });
  other.record('bm25', 'submit', 2, 2);
  assert.equal(tab.status('bm25'), 'solved');
  assert.equal(tab.status('rope'), 'solved');
  tab.record('kmeans-step', 'run', 0, 1);
  assert.equal(tab.writable(), true);
  const saved = JSON.parse(storage.getItem(Store.STORAGE_KEY));
  assert.equal(saved.problems.bm25.status, 'solved');
  assert.equal(saved.problems.rope.status, 'solved');
  assert.equal(saved.problems['kmeans-step'].status, 'attempted');
});

test('a solve kept in memory survives another tab opening the same problem later', () => {
  const storage = memoryStorage();
  const tab = Store.create({ localStorage: storage, now: () => NOON });
  tab.record('rope', 'run', 0, 1);
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  tab.record('rope', 'submit', 4, 4);
  storage.setItem = setItem;
  const other = Store.create({ localStorage: storage, now: () => NOON + 1000 });
  other.open('rope');
  assert.equal(JSON.parse(storage.getItem(Store.STORAGE_KEY)).problems.rope.status, 'attempted');
  tab.record('kmeans-step', 'run', 0, 1);
  const saved = JSON.parse(storage.getItem(Store.STORAGE_KEY));
  assert.equal(saved.problems.rope.status, 'solved');
  assert.equal(saved.problems.rope.openedAt, NOON + 1000);
});

test('an attempt kept in memory survives another tab opening the same problem later', () => {
  const storage = memoryStorage();
  const tab = Store.create({ localStorage: storage, now: () => NOON });
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  tab.record('rope', 'run', 0, 1);
  storage.setItem = setItem;
  const other = Store.create({ localStorage: storage, now: () => NOON + 1000 });
  other.open('rope');
  assert.equal(JSON.parse(storage.getItem(Store.STORAGE_KEY)).problems.rope.status, 'new');
  tab.record('kmeans-step', 'run', 0, 1);
  const saved = JSON.parse(storage.getItem(Store.STORAGE_KEY));
  assert.equal(saved.problems.rope.status, 'attempted');
  assert.equal(saved.problems.rope.attemptedAt, NOON);
  assert.equal(saved.problems.rope.openedAt, NOON + 1000);
});
