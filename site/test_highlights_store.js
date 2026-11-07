'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const StoreModule = require('./highlights-store');

const KEY = 'aifs:highlights:v2';
const LESSON_PATH = 'phases/01-math-foundations/04-gradient-descent';
const MANUAL_PATH = 'manuals/a2a-101';

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
}

function fakeWindow(storage) {
  const listeners = {};
  return {
    localStorage: storage,
    addEventListener: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
    dispatch: (name, event) => (listeners[name] || []).forEach(fn => fn(event)),
  };
}

function sampleItem(overrides = {}) {
  return {
    lang: 'en',
    color: 'green',
    note: '',
    quote: { exact: 'steepest increase', prefix: 'direction of ', suffix: ', so we step' },
    position: { start: 120, end: 137, length: 600 },
    section: 'the-problem',
    sectionTitle: 'The Problem',
    sectionIndex: 1,
    sectionOffset: 0.4,
    sectionSpan: 0.1,
    ...overrides,
  };
}

function storeWith(seed) {
  const storage = memoryStorage(seed);
  const win = fakeWindow(storage);
  return { storage, win, store: StoreModule.create(win) };
}

test('the store keeps a version 2 record under its own key with page kind and url', () => {
  const { storage, store } = storeWith();
  const item = store.add(LESSON_PATH, sampleItem(), { title: 'Gradient Descent' });
  store.add(MANUAL_PATH, sampleItem(), { title: 'A2A 101' });
  const saved = JSON.parse(storage.getItem(KEY));
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.pages[LESSON_PATH].kind, 'lesson');
  assert.equal(saved.pages[LESSON_PATH].url, 'lesson.html?path=phases%2F01-math-foundations%2F04-gradient-descent');
  assert.equal(saved.pages[MANUAL_PATH].kind, 'manual');
  assert.equal(saved.pages[MANUAL_PATH].url, 'manual-a2a-101.html');
  assert.equal(saved.pages[LESSON_PATH].items[0].sectionOffset, 0.4);
  const updated = store.update(LESSON_PATH, item.id, { color: 'pink', note: 'Sign matters.' });
  assert.equal(updated.color, 'pink');
  assert.equal(updated.createdAt, item.createdAt);
  assert.equal(store.remove(LESSON_PATH, item.id), true);
  assert.deepEqual(store.pages().map(page => page.path), [MANUAL_PATH]);
});

test('version 1 data migrates to version 2 and the version 1 copy is kept', () => {
  const v1 = JSON.stringify({
    schemaVersion: 1,
    pages: { [LESSON_PATH]: { title: 'GD', items: [{ id: 'old1', color: 'blue', quote: { exact: 'kept text' }, status: 'moved' }, { id: 'old2', quote: { exact: 'second' } }] } },
    updatedAt: 5,
  });
  const { storage, store } = storeWith({ 'aifs:highlights:v1': v1 });
  const items = store.items(LESSON_PATH);
  assert.deepEqual(items.map(item => item.id), ['old1', 'old2']);
  assert.equal(items[0].review, 'pending');
  assert.equal(items[1].review, '');
  assert.equal(items[0].sectionIndex, -1);
  assert.equal(items[0].confidence, null);
  const migrated = JSON.parse(storage.getItem(KEY));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.pages[LESSON_PATH].kind, 'lesson');
  assert.equal(storage.getItem('aifs:highlights:v1'), v1);
  assert.equal(StoreModule.migrate({ schemaVersion: 2, pages: {} }).schemaVersion, 2);
});

test('the store rejects unknown colours, bad paths and empty quotes', () => {
  const { store } = storeWith();
  assert.equal(store.add(LESSON_PATH, sampleItem({ color: 'purple' })).color, 'yellow');
  assert.equal(store.add('../etc/passwd', sampleItem()), null);
  assert.equal(store.add(LESSON_PATH, sampleItem({ quote: { exact: '   ' } })), null);
  assert.equal(store.add(LESSON_PATH, sampleItem({ note: 'x'.repeat(5000) })).note.length, 2000);
  assert.equal(store.add(LESSON_PATH, sampleItem({ lang: 'pt-BR' })).lang, 'pt-br');
  assert.equal(store.add(LESSON_PATH, sampleItem({ confidence: 7 })).confidence, 1);
});

test('corrupt storage starts empty and keeps the unreadable original', () => {
  const { storage, store } = storeWith({ [KEY]: '{not json' });
  assert.deepEqual(store.pages(), []);
  assert.equal(store.info().lastError, 'unreadable');
  assert.equal(storage.getItem('aifs:highlights:v2:unreadable'), '{not json');
  store.add(LESSON_PATH, sampleItem());
  assert.equal(storage.getItem('aifs:highlights:v2:unreadable'), '{not json');
  assert.equal(JSON.parse(storage.getItem(KEY)).pages[LESSON_PATH].items.length, 1);
});

test('invalid items are skipped but the original payload is backed up', () => {
  const raw = JSON.stringify({ schemaVersion: 2, pages: { [LESSON_PATH]: { items: [{ id: 'good1', quote: { exact: 'kept' } }, { id: 'bad1', quote: {} }, 'junk'] } } });
  const { storage, store } = storeWith({ [KEY]: raw });
  assert.deepEqual(store.items(LESSON_PATH).map(item => item.id), ['good1']);
  assert.equal(store.info().lastError, 'skipped-invalid');
  assert.equal(storage.getItem('aifs:highlights:v2:unreadable'), raw);
});

test('data from a newer schema is read-only and never overwritten or changed in memory', () => {
  const raw = JSON.stringify({ schemaVersion: 3, pages: { [LESSON_PATH]: { items: [{ id: 'future', color: 'blue', quote: { exact: 'from the future' } }] } } });
  const { storage, store } = storeWith({ [KEY]: raw });
  assert.equal(store.info().readOnly, true);
  assert.equal(store.add(LESSON_PATH, sampleItem()), null);
  assert.equal(store.add('phases/09-new/01-page', sampleItem()), null);
  assert.equal(store.update(LESSON_PATH, 'future', { color: 'pink' }), null);
  assert.equal(store.updateMany(LESSON_PATH, { future: { status: 'orphaned' } }, true), false);
  assert.equal(store.remove(LESSON_PATH, 'future'), false);
  assert.equal(store.importJson(JSON.stringify({ format: 'aifs-highlights', schemaVersion: 2, pages: {} })).error, 'newer-schema');
  assert.equal(store.items(LESSON_PATH)[0].color, 'blue');
  assert.deepEqual(store.pages().map(page => page.path), [LESSON_PATH]);
  assert.equal(storage.getItem(KEY), raw);
});

test('blocked storage (private mode) falls back to memory for the session', () => {
  const win = fakeWindow(null);
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const store = StoreModule.create(win);
  assert.ok(store.add(LESSON_PATH, sampleItem()));
  assert.equal(store.items(LESSON_PATH).length, 1);
  assert.equal(store.info().persistent, false);

  const throwing = memoryStorage();
  throwing.getItem = () => { throw new Error('denied'); };
  const second = StoreModule.create(fakeWindow(throwing));
  assert.ok(second.add(LESSON_PATH, sampleItem()));
  assert.ok(second.add(LESSON_PATH, sampleItem({ color: 'blue' })));
  assert.equal(second.items(LESSON_PATH).length, 2);
  assert.equal(second.info().persistent, false);
});

test('a full quota keeps the highlight for this tab and reports the reason', () => {
  const storage = memoryStorage();
  storage.setItem = () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; };
  const store = StoreModule.create(fakeWindow(storage));
  assert.ok(store.add(LESSON_PATH, sampleItem()));
  assert.ok(store.add(LESSON_PATH, sampleItem({ color: 'pink' })));
  assert.equal(store.items(LESSON_PATH).length, 2);
  assert.equal(store.info().lastError, 'quota');
  assert.equal(store.info().persistent, false);
});

test('the store refuses new highlights past its total size budget without creating pages', () => {
  const { store } = storeWith();
  const big = 'x'.repeat(19000);
  let added = 0;
  for (let i = 0; i < 200; i++) {
    if (store.add(`phases/0${i % 9}-a/${i}-b`, sampleItem({ quote: { exact: big + i } }))) added++;
    else break;
  }
  assert.ok(added > 20 && added < 200, String(added));
  assert.equal(store.info().lastError, 'full');
  const pagesBefore = store.pages().length;
  assert.equal(store.add('phases/09-new/01-page', sampleItem({ quote: { exact: big } })), null);
  assert.equal(store.pages().length, pagesBefore);
});

test('two tabs writing at once both keep their highlights because every write reads storage first', () => {
  const storage = memoryStorage();
  const first = StoreModule.create(fakeWindow(storage));
  const second = StoreModule.create(fakeWindow(storage));
  assert.equal(first.items(LESSON_PATH).length, 0);
  assert.equal(second.items(LESSON_PATH).length, 0);
  const a = first.add(LESSON_PATH, sampleItem({ note: 'from tab one' }));
  const b = second.add(LESSON_PATH, sampleItem({ note: 'from tab two' }));
  second.update(LESSON_PATH, a.id, { color: 'blue' });
  first.remove(LESSON_PATH, b.id);
  const final = StoreModule.create(fakeWindow(storage)).items(LESSON_PATH);
  assert.deepEqual(final.map(item => [item.note, item.color]), [['from tab one', 'blue']]);
});

test('a storage event from another tab reloads, notifies and is flagged so the page does not write back', () => {
  const storage = memoryStorage();
  const win = fakeWindow(storage);
  const store = StoreModule.create(win);
  const metas = [];
  assert.equal(store.items(LESSON_PATH).length, 0);
  store.onChange((_, meta) => metas.push(meta.external === true));
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem());
  assert.equal(store.items(LESSON_PATH).length, 0);
  win.dispatch('storage', { key: KEY });
  assert.equal(store.items(LESSON_PATH).length, 1);
  win.dispatch('storage', { key: 'unrelated' });
  win.dispatch('storage', { key: null });
  assert.deepEqual(metas, [true, true]);
});

test('anchor refreshes can update quotes without bumping the edit time and keep the original text', () => {
  const { store } = storeWith();
  const item = store.add(LESSON_PATH, sampleItem(), { title: 'GD' });
  store.updateMany(LESSON_PATH, { [item.id]: { status: 'moved', review: 'pending', confidence: 0.82, originalExact: 'steepest increase', quote: { exact: 'steepest ascent', prefix: '', suffix: '' } } }, true);
  const saved = store.items(LESSON_PATH)[0];
  assert.equal(saved.updatedAt, item.updatedAt);
  assert.equal(saved.originalExact, 'steepest increase');
  const md = store.exportMarkdown();
  assert.match(md, /Originally highlighted: steepest increase/);
  assert.match(md, /Status: re-anchored \(82% match\)/);
});

test('a sync file round-trips every page with unicode intact', () => {
  const { store } = storeWith();
  store.add(LESSON_PATH, sampleItem({ note: 'emoji \ud83d\ude80 and \u4e2d\u6587 and \u0639\u0631\u0628\u064a', quote: { exact: '\u68af\u5ea6\u4e0b\u964d \ud83e\udde0 caf\u00e9' } }), { title: '\u68af\u5ea6 Gradient' });
  store.add(MANUAL_PATH, sampleItem({ note: 'manual note' }), { title: 'A2A 101' });
  const file = store.exportJson();
  const target = storeWith().store;
  const result = target.importJson(file);
  assert.deepEqual([result.ok, result.added], [true, 2]);
  const item = target.items(LESSON_PATH)[0];
  assert.equal(item.note, 'emoji \ud83d\ude80 and \u4e2d\u6587 and \u0639\u0631\u0628\u064a');
  assert.equal(item.quote.exact, '\u68af\u5ea6\u4e0b\u964d \ud83e\udde0 caf\u00e9');
  assert.equal(target.page(LESSON_PATH).title, '\u68af\u5ea6 Gradient');
  assert.equal(target.page(MANUAL_PATH).kind, 'manual');
});

test('sync import dedupes by id, lets the newer edit win and keeps a conflicting note as a review copy', () => {
  const source = storeWith().store;
  const first = source.add(LESSON_PATH, sampleItem({ note: 'shared note' }), { title: 'GD' });
  const target = storeWith().store;
  target.importJson(source.exportJson());
  assert.deepEqual(Object.values(target.importJson(source.exportJson())).slice(2, 5), [0, 0, 1]);

  const exported = JSON.parse(source.exportJson());
  exported.pages[LESSON_PATH].items[0].color = 'pink';
  exported.pages[LESSON_PATH].items[0].updatedAt = first.updatedAt + 1000;
  let result = target.importJson(JSON.stringify(exported));
  assert.deepEqual([result.updated, result.conflicts], [1, 0]);
  assert.equal(target.items(LESSON_PATH)[0].color, 'pink');

  target.update(LESSON_PATH, first.id, { note: 'my local rewrite' });
  exported.pages[LESSON_PATH].items[0].note = 'their rewrite';
  exported.pages[LESSON_PATH].items[0].updatedAt = Date.now() + 60000;
  result = target.importJson(JSON.stringify(exported));
  assert.deepEqual([result.updated, result.conflicts], [1, 1]);
  const items = target.items(LESSON_PATH);
  const winner = items.find(item => item.id === first.id);
  const copy = items.find(item => item.review === 'conflict');
  assert.equal(winner.note, 'their rewrite');
  assert.equal(copy.note, 'my local rewrite');
  assert.equal(copy.conflictOf, first.id);
  result = target.importJson(JSON.stringify(exported));
  assert.equal(result.conflicts, 0);
  assert.equal(target.items(LESSON_PATH).filter(item => item.review === 'conflict').length, 1);

  exported.pages[LESSON_PATH].items.push({ id: 'broken', quote: {} });
  assert.equal(target.importJson(JSON.stringify(exported)).skipped, 1);
});

test('an older local edit loses to the import but a newer local note is kept and the import is the copy', () => {
  const source = storeWith().store;
  const item = source.add(LESSON_PATH, sampleItem({ note: 'old' }));
  const target = storeWith().store;
  target.importJson(source.exportJson());
  const exported = JSON.parse(source.exportJson());
  exported.pages[LESSON_PATH].items[0].note = 'stale remote note';
  exported.pages[LESSON_PATH].items[0].updatedAt = item.updatedAt - 10;
  target.update(LESSON_PATH, item.id, { note: 'fresh local note' });
  const result = target.importJson(JSON.stringify(exported));
  assert.deepEqual([result.updated, result.conflicts], [0, 1]);
  assert.equal(target.items(LESSON_PATH).find(entry => entry.id === item.id).note, 'fresh local note');
  assert.equal(target.items(LESSON_PATH).find(entry => entry.review === 'conflict').note, 'stale remote note');
});

test('import accepts version 1 exports and refuses files that are not highlight exports', () => {
  const { store } = storeWith();
  const v1 = { format: 'aifs-highlights', schemaVersion: 1, pages: { [LESSON_PATH]: { title: 'GD', items: [{ id: 'v1item', quote: { exact: 'from v1' } }] } } };
  assert.equal(store.importJson(JSON.stringify(v1)).added, 1);
  assert.equal(store.importJson('nope').error, 'not-json');
  assert.equal(store.importJson(JSON.stringify({ format: 'something-else', pages: {} })).error, 'wrong-format');
  assert.equal(store.importJson(JSON.stringify({ format: 'aifs-highlights', schemaVersion: 9, pages: {} })).error, 'newer-schema');
  assert.equal(store.importJson(JSON.stringify([1, 2])).error, 'wrong-format');
});

test('exports and bulk deletes work on a selection of ids across pages', () => {
  const { store } = storeWith();
  const a = store.add(LESSON_PATH, sampleItem({ note: 'a' }), { title: 'GD' });
  const b = store.add(LESSON_PATH, sampleItem({ note: 'b', quote: { exact: 'second quote' } }));
  const c = store.add(MANUAL_PATH, sampleItem({ note: 'c' }), { title: 'A2A 101' });
  const selection = { [LESSON_PATH]: [b.id], [MANUAL_PATH]: [c.id] };
  const exported = JSON.parse(store.exportJson(selection));
  assert.deepEqual(exported.pages[LESSON_PATH].items.map(item => item.id), [b.id]);
  assert.deepEqual(exported.pages[MANUAL_PATH].items.map(item => item.id), [c.id]);
  const md = store.exportMarkdown(selection, { origin: 'https://example.test' });
  assert.match(md, /Source: https:\/\/example\.test\/manual-a2a-101\.html/);
  assert.doesNotMatch(md, /Note: a\b/);
  assert.equal(store.removeMany(selection), 2);
  assert.deepEqual(store.pages().map(page => [page.path, page.items.map(item => item.id)]), [[LESSON_PATH, [a.id]]]);
});

test('share links carry one highlight or a page set in the fragment and decode with unicode intact', () => {
  const { store } = storeWith();
  const a = store.add(LESSON_PATH, sampleItem({ note: 'note \ud83d\ude80 \u4e2d\u6587', quote: { exact: '\u68af\u5ea6 caf\u00e9 \u0639\u0631\u0628\u064a', prefix: 'p', suffix: 's' } }), { title: 'Gradient \u68af\u5ea6' });
  store.add(LESSON_PATH, sampleItem({ color: 'blue', quote: { exact: 'second' } }));
  const one = store.share(LESSON_PATH, [a.id]);
  assert.match(one, /^[A-Za-z0-9_-]+$/);
  const decoded = store.decodeShare(one);
  assert.equal(decoded.path, LESSON_PATH);
  assert.equal(decoded.title, 'Gradient \u68af\u5ea6');
  assert.equal(decoded.items.length, 1);
  assert.equal(decoded.items[0].quote.exact, '\u68af\u5ea6 caf\u00e9 \u0639\u0631\u0628\u064a');
  assert.equal(decoded.items[0].note, 'note \ud83d\ude80 \u4e2d\u6587');
  assert.equal(store.decodeShare(store.share(LESSON_PATH)).items.length, 2);
  assert.equal(store.share('phases/none/x'), '');
  assert.equal(store.decodeShare('%%%'), null);
  assert.equal(store.decodeShare(StoreModule.encodeShare({ v: 1, k: '../x', i: [] })), null);
  assert.equal(store.decodeShare(StoreModule.encodeShare({ v: 2, k: LESSON_PATH, i: [{ q: 'x' }] })), null);
  assert.equal(store.decodeShare('a'.repeat(300000)), null);
});

test('adding shared highlights makes new local copies once', () => {
  const owner = storeWith().store;
  owner.add(LESSON_PATH, sampleItem({ note: 'from a friend' }), { title: 'GD' });
  owner.add(LESSON_PATH, sampleItem({ quote: { exact: 'another' }, position: { start: 300, end: 307, length: 600 } }));
  const shared = owner.decodeShare(owner.share(LESSON_PATH));
  const reader = storeWith().store;
  assert.equal(reader.addShared(shared, [1]), 1);
  assert.equal(reader.addShared(shared), 1);
  assert.equal(reader.addShared(shared), 0);
  const items = reader.items(LESSON_PATH);
  assert.equal(items.length, 2);
  assert.ok(items.every(item => /^h/.test(item.id)));
  assert.equal(reader.page(LESSON_PATH).title, 'GD');
});

test('highlights kept only in memory after a failed write survive a storage event from another tab', () => {
  const storage = memoryStorage();
  const win = fakeWindow(storage);
  const store = StoreModule.create(win);
  const realSet = storage.setItem;
  storage.setItem = () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; };
  const unsaved = store.add(LESSON_PATH, sampleItem({ note: 'only in this tab' }));
  storage.setItem = realSet;
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem({ note: 'from the other tab', quote: { exact: 'other' } }));
  win.dispatch('storage', { key: KEY });
  const notes = store.items(LESSON_PATH).map(item => item.note).sort();
  assert.deepEqual(notes, ['from the other tab', 'only in this tab']);
  assert.ok(store.items(LESSON_PATH).some(item => item.id === unsaved.id));
  store.add(LESSON_PATH, sampleItem({ note: 'third', quote: { exact: 'third' } }));
  const saved = JSON.parse(storage.getItem(KEY)).pages[LESSON_PATH].items.map(item => item.note).sort();
  assert.deepEqual(saved, ['from the other tab', 'only in this tab', 'third']);
});

test('note edits respect the size budget and leave the previous note in place', () => {
  const { store } = storeWith();
  const big = 'x'.repeat(19000);
  let i = 0;
  while (store.add(`phases/0${i % 9}-a/${i}-b`, sampleItem({ quote: { exact: big + i } }))) i++;
  const ids = store.pages().flatMap(page => page.items.map(item => [page.path, item.id]));
  let refusedAt = -1;
  for (let k = 0; k < ids.length; k++) {
    if (store.update(ids[k][0], ids[k][1], { note: 'n'.repeat(2000) }) === null) { refusedAt = k; break; }
  }
  assert.ok(refusedAt >= 0);
  assert.equal(store.info().lastError, 'full');
  assert.equal(store.items(ids[refusedAt][0]).find(item => item.id === ids[refusedAt][1]).note, '');
  assert.ok(store.update(ids[0][0], ids[0][1], { note: 'short' }));
});

test('an import that only fills a missing page title is saved', () => {
  const storage = memoryStorage();
  const store = StoreModule.create(fakeWindow(storage));
  const item = store.add(LESSON_PATH, sampleItem());
  const exported = JSON.parse(store.exportJson());
  exported.pages[LESSON_PATH].title = 'Gradient Descent';
  assert.equal(store.page(LESSON_PATH).title, '');
  const result = store.importJson(JSON.stringify(exported));
  assert.equal(result.unchanged, 1);
  assert.equal(StoreModule.create(fakeWindow(storage)).page(LESSON_PATH).title, 'Gradient Descent');
  assert.ok(item);
});

test('a page title imported while storage was full survives a reload from another tab', () => {
  const storage = memoryStorage();
  const win = fakeWindow(storage);
  const store = StoreModule.create(win);
  store.add(LESSON_PATH, sampleItem());
  const exported = JSON.parse(store.exportJson());
  exported.pages[LESSON_PATH].title = 'Gradient Descent';
  const realSet = storage.setItem;
  storage.setItem = () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; };
  store.importJson(JSON.stringify(exported));
  storage.setItem = realSet;
  StoreModule.create(fakeWindow(storage)).add(MANUAL_PATH, sampleItem({ note: 'other tab' }));
  win.dispatch('storage', { key: KEY });
  assert.equal(store.page(LESSON_PATH).title, 'Gradient Descent');
  store.add(LESSON_PATH, sampleItem({ quote: { exact: 'later' } }));
  assert.equal(JSON.parse(storage.getItem(KEY)).pages[LESSON_PATH].title, 'Gradient Descent');
});

test('markdown export escapes notes and quotes so they stay plain text', () => {
  const { store } = storeWith();
  store.add(LESSON_PATH, sampleItem({ note: '<img src=x onerror=alert(1)> [click](javascript:alert(1)) `code` *bold*', quote: { exact: '<script>x</script> & more' } }), { title: '<b>Title</b>' });
  const md = store.exportMarkdown();
  assert.doesNotMatch(md, /<img|<script|<b>|\]\(javascript/);
  assert.match(md, /&lt;img src=x onerror=alert\\\(1\\\)&gt;/);
  assert.match(md, /&amp; more/);
  assert.match(md, /## &lt;b&gt;Title&lt;\/b&gt;/);
});

test('open links carry the language a lesson highlight was made in', () => {
  assert.equal(StoreModule.itemUrl(LESSON_PATH, { id: 'h1', lang: 'zh-tw' }), 'lesson.html?path=phases%2F01-math-foundations%2F04-gradient-descent&lang=zh-tw#hl-h1');
  assert.equal(StoreModule.itemUrl(LESSON_PATH, { id: 'h1', lang: 'en' }), 'lesson.html?path=phases%2F01-math-foundations%2F04-gradient-descent&lang=en#hl-h1');
  assert.equal(StoreModule.itemUrl(MANUAL_PATH, { id: 'h2', lang: 'en' }), 'manual-a2a-101.html#hl-h2');
});

test('out-of-range timestamps are dropped instead of breaking date formatting', () => {
  const item = StoreModule.normalizeItem({ quote: { exact: 'x' }, createdAt: 9e15, updatedAt: 1e300 });
  assert.ok(Number.isFinite(new Date(item.createdAt).getTime()));
  assert.ok(Number.isFinite(new Date(item.updatedAt).getTime()));
});

test('a shared add that would exceed the budget keeps session-only highlights', () => {
  const win = fakeWindow(null);
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const store = StoreModule.create(win);
  const big = 'x'.repeat(19000);
  let i = 0;
  while (store.add(`phases/0${i % 9}-a/${i}-b`, sampleItem({ quote: { exact: big + i } }))) i++;
  const before = store.pages().reduce((n, page) => n + page.items.length, 0);
  const shared = { path: 'phases/09-new/01-page', title: 'New', items: [StoreModule.normalizeItem({ quote: { exact: big + 'shared' } })] };
  assert.equal(store.addShared(shared), 0);
  assert.equal(store.pages().reduce((n, page) => n + page.items.length, 0), before);
  assert.equal(store.page('phases/09-new/01-page'), null);
});

test('conflict copies never push a page past its item cap', () => {
  const { store } = storeWith();
  const ids = [];
  for (let i = 0; i < 500; i++) ids.push(store.add(LESSON_PATH, sampleItem({ note: 'local ' + i, quote: { exact: 'q' + i } })).id);
  const exported = JSON.parse(store.exportJson());
  exported.pages[LESSON_PATH].items.slice(0, 20).forEach(item => { item.note = 'remote ' + item.id; item.updatedAt += 1000; });
  const result = store.importJson(JSON.stringify(exported));
  assert.deepEqual([result.updated, result.conflicts, result.skipped], [20, 0, 20]);
  assert.equal(store.items(LESSON_PATH).length, 500);
  assert.equal(StoreModule.create(fakeWindow(memoryStorage({ [KEY]: JSON.stringify({ schemaVersion: 2, pages: { [LESSON_PATH]: store.page(LESSON_PATH) } }) }))).info().lastError, '');
});

test('each different unreadable payload gets its own backup', () => {
  const storage = memoryStorage({ [KEY]: '{first broken' });
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem());
  storage.setItem(KEY, '{second broken');
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem());
  const backups = [...storage.data.entries()].filter(([key]) => key.startsWith('aifs:highlights:v2:unreadable')).map(([, value]) => value).sort();
  assert.deepEqual(backups, ['{first broken', '{second broken']);
});

test('ids and quotes named like object prototype members are kept', () => {
  const raw = JSON.stringify({ schemaVersion: 2, pages: { [LESSON_PATH]: { items: [{ id: 'constructor', quote: { exact: 'a' } }, { id: 'toString', quote: { exact: 'b' } }, { id: '__proto__', quote: { exact: 'c' } }] } } });
  const { store } = storeWith({ [KEY]: raw });
  assert.deepEqual(store.items(LESSON_PATH).map(item => item.id).sort(), ['__proto__', 'constructor', 'toString']);
  const shared = { path: MANUAL_PATH, title: 'M', items: ['toString', '__proto__', 'constructor'].map(exact => StoreModule.normalizeItem({ quote: { exact } })) };
  assert.equal(store.addShared(shared), 3);
});

test('a share link does not rename an existing page, and oversized shares are refused', () => {
  const { store } = storeWith();
  store.add(LESSON_PATH, sampleItem(), { title: 'My title' });
  const shared = { path: LESSON_PATH, title: 'Their title', items: [StoreModule.normalizeItem({ quote: { exact: 'new text' } })] };
  assert.equal(store.addShared(shared), 1);
  assert.equal(store.page(LESSON_PATH).title, 'My title');
  for (let i = 0; i < 30; i++) store.add(MANUAL_PATH, sampleItem({ quote: { exact: 'z'.repeat(19000) + i } }));
  assert.equal(store.share(MANUAL_PATH), '');
  assert.equal(store.info().lastError, 'share-too-large');
});

test('the quote before a re-anchor is kept whole so a rejection can restore it', () => {
  const item = StoreModule.normalizeItem({ quote: { exact: 'now' }, originalQuote: { exact: 'before', prefix: 'p ', suffix: ' s', position: { start: 4, end: 10, length: 99 } } });
  assert.deepEqual(item.originalQuote, { exact: 'before', prefix: 'p ', suffix: ' s', position: { start: 4, end: 10, length: 99 } });
  assert.equal(StoreModule.normalizeItem({ quote: { exact: 'x' }, originalQuote: { exact: '' } }).originalQuote, null);
});

test('a tab that could not save merges the stored record before its next write', () => {
  const storage = memoryStorage();
  const tabA = StoreModule.create(fakeWindow(storage));
  const realSet = storage.setItem;
  storage.setItem = () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; };
  tabA.add(LESSON_PATH, sampleItem({ note: 'a1' }));
  storage.setItem = realSet;
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem({ note: 'b1', quote: { exact: 'b1' } }));
  tabA.add(LESSON_PATH, sampleItem({ note: 'a2', quote: { exact: 'a2' } }));
  const saved = JSON.parse(storage.getItem(KEY)).pages[LESSON_PATH].items.map(item => item.note).sort();
  assert.deepEqual(saved, ['a1', 'a2', 'b1']);
});

test('a deletion that could not be saved stays deleted after another tab writes', () => {
  const storage = memoryStorage();
  const win = fakeWindow(storage);
  const store = StoreModule.create(win);
  const doomed = store.add(LESSON_PATH, sampleItem({ note: 'delete me' }));
  const realSet = storage.setItem;
  storage.setItem = () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; };
  assert.equal(store.remove(LESSON_PATH, doomed.id), true);
  storage.setItem = realSet;
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem({ note: 'other tab', quote: { exact: 'other' } }));
  win.dispatch('storage', { key: KEY });
  assert.deepEqual(store.items(LESSON_PATH).map(item => item.note), ['other tab']);
  store.add(LESSON_PATH, sampleItem({ note: 'later', quote: { exact: 'later' } }));
  const saved = JSON.parse(storage.getItem(KEY)).pages[LESSON_PATH].items.map(item => item.note).sort();
  assert.deepEqual(saved, ['later', 'other tab']);
});

test('a share with the same words in two places keeps both notes, once', () => {
  const owner = storeWith().store;
  owner.add(LESSON_PATH, sampleItem({ note: 'first', quote: { exact: 'Try again', prefix: 'one ', suffix: ' two' } }));
  owner.add(LESSON_PATH, sampleItem({ note: 'second', quote: { exact: 'Try again', prefix: 'three ', suffix: ' four' }, position: { start: 400, end: 409, length: 600 } }));
  const shared = owner.decodeShare(owner.share(LESSON_PATH));
  const reader = storeWith().store;
  reader.add(LESSON_PATH, sampleItem({ note: '', quote: { exact: 'Try again', prefix: 'one ', suffix: ' two' } }));
  assert.equal(reader.addShared(shared), 2);
  assert.equal(reader.addShared(shared), 0);
  assert.deepEqual(reader.items(LESSON_PATH).map(item => item.note).sort(), ['', 'first', 'second']);
});

test('confirming or re-attaching a highlight clears its saved original quote', () => {
  const { store } = storeWith();
  const item = store.add(LESSON_PATH, sampleItem({ originalQuote: { exact: 'old text', prefix: '', suffix: '', position: { start: 1, end: 9, length: 99 } } }));
  assert.equal(store.items(LESSON_PATH)[0].originalQuote.exact, 'old text');
  store.update(LESSON_PATH, item.id, { status: 'anchored', review: 'confirmed', originalQuote: null });
  assert.equal(store.items(LESSON_PATH)[0].originalQuote, null);
});

test('the last error belongs to the latest operation and clears when an operation succeeds', () => {
  const { store } = storeWith();
  const big = 'x'.repeat(19000);
  let i = 0;
  while (store.add(`phases/0${i % 9}-a/${i}-b`, sampleItem({ quote: { exact: big + i } }))) i++;
  assert.equal(store.info().lastError, 'full');
  const first = store.pages()[0];
  assert.ok(store.update(first.path, first.items[0].id, { color: 'pink' }));
  assert.equal(store.info().lastError, '');
  assert.equal(store.info().operationError, '');
  const sharer = storeWith().store;
  for (let k = 0; k < 30; k++) sharer.add(MANUAL_PATH, sampleItem({ quote: { exact: 'z'.repeat(19000) + k } }));
  assert.equal(sharer.share(MANUAL_PATH), '');
  assert.equal(sharer.info().operationError, 'share-too-large');
  assert.equal(sharer.share('phases/none/x'), '');
  assert.equal(sharer.info().operationError, '');
});

test('a load warning stays visible while operation errors come and go', () => {
  const { store } = storeWith({ [KEY]: '{not json' });
  assert.ok(store.add(LESSON_PATH, sampleItem()));
  assert.equal(store.info().lastError, 'unreadable');
  assert.equal(store.info().operationError, '');
});

test('a tab with unsaved changes does not bring back highlights another tab deleted', () => {
  const storage = memoryStorage();
  const win = fakeWindow(storage);
  const store = StoreModule.create(win);
  const kept = store.add(LESSON_PATH, sampleItem({ note: 'kept' }));
  const doomed = store.add(LESSON_PATH, sampleItem({ note: 'deleted elsewhere', quote: { exact: 'doomed' } }));
  const realSet = storage.setItem;
  storage.setItem = () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; };
  const local = store.add(LESSON_PATH, sampleItem({ note: 'only here', quote: { exact: 'local' } }));
  store.update(LESSON_PATH, kept.id, { note: 'kept and edited here' });
  storage.setItem = realSet;
  StoreModule.create(fakeWindow(storage)).remove(LESSON_PATH, doomed.id);
  win.dispatch('storage', { key: KEY });
  assert.deepEqual(store.items(LESSON_PATH).map(item => item.note).sort(), ['kept and edited here', 'only here']);
  StoreModule.create(fakeWindow(storage)).add(LESSON_PATH, sampleItem({ note: 'other tab', quote: { exact: 'other' } }));
  win.dispatch('storage', { key: KEY });
  store.add(LESSON_PATH, sampleItem({ note: 'later', quote: { exact: 'later' } }));
  const saved = JSON.parse(storage.getItem(KEY)).pages[LESSON_PATH].items;
  assert.deepEqual(saved.map(item => item.note).sort(), ['kept and edited here', 'later', 'only here', 'other tab']);
  assert.ok(saved.some(item => item.id === local.id));
});
