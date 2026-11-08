const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const page = require('./highlights-page.js');
const storeModule = require('./highlights-store.js');

const root = path.resolve(__dirname, '..');
const DAY = 86400000;
const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime();

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.key = init.key;
    this.defaultPrevented = false;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
}

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.parentNode = null;
    this.data = String(text);
  }
  get textContent() {
    return this.data;
  }
}

class FakeElement {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.indeterminate = false;
    this.value = '';
    this.className = '';
    this.files = null;
    this.clicks = 0;
  }
  get children() {
    return this.childNodes.filter(node => node.nodeType === 1);
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get id() {
    return this.getAttribute('id') || '';
  }
  get textContent() {
    return this.childNodes.map(node => node.textContent).join('');
  }
  set textContent(value) {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = [];
    if (value !== '' && value !== null && value !== undefined) this.appendChild(new FakeText(value));
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, init) {
    const event = new FakeEvent(type, init);
    event.target = this;
    let node = this;
    const results = [];
    while (node) {
      event.currentTarget = node;
      for (const listener of node.listeners.get(type) || []) results.push(listener.call(node, event));
      node = type === 'keydown' || type === 'submit' ? node.parentNode : null;
    }
    return results;
  }
  click() {
    this.clicks++;
    if (this.disabled) return [];
    return this.dispatch('click');
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  walk(visit) {
    visit(this);
    for (const child of this.children) child.walk(visit);
  }
  find(predicate) {
    let found = null;
    this.walk(node => { if (!found && predicate(node)) found = node; });
    return found;
  }
  findAll(predicate) {
    const out = [];
    this.walk(node => { if (predicate(node)) out.push(node); });
    return out;
  }
  byId(id) {
    return this.find(node => node.id === id);
  }
  hasClass(name) {
    return this.className.split(/\s+/).includes(name);
  }
  isShown() {
    let node = this;
    while (node) {
      if (node.hidden) return false;
      node = node.parentNode;
    }
    return true;
  }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
  }
  createElement(tag) {
    return new FakeElement(this, tag);
  }
  createTextNode(text) {
    return new FakeText(text);
  }
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
    data,
  };
}

function item(id, fields = {}) {
  return Object.assign({
    id,
    lang: 'en',
    color: 'yellow',
    note: '',
    quote: { exact: 'Quote ' + id, prefix: '', suffix: '' },
    originalExact: '',
    position: { start: 10, end: 20, length: 10 },
    section: 'intro',
    sectionTitle: 'Introduction',
    status: 'anchored',
    review: '',
    confidence: null,
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
  }, fields);
}

const LESSON = 'phases/01-math-foundations/01-vectors';
const LESSON_B = 'phases/14-agent-engineering/02-agent-loop';
const MANUAL = 'manuals/a2a-101';

function fixturePages() {
  return {
    [LESSON]: {
      title: 'Vectors and Spaces',
      items: [
        item('a1', { color: 'yellow', note: 'Remember the caf\u00e9 example', quote: { exact: 'A vector is an ordered list of numbers.', prefix: '', suffix: '' }, position: { start: 1, end: 2, length: 1 } }),
        item('a2', { color: 'green', status: 'moved', review: 'pending', confidence: 0.874, quote: { exact: 'See [diagram 9f3ab2] for the dot product.', prefix: '', suffix: '' }, originalExact: 'See the diagram for the dot product.', createdAt: NOW - 20 * DAY, position: { start: 5, end: 6, length: 1 } }),
      ],
    },
    [LESSON_B]: {
      title: 'The Agent Loop',
      items: [
        item('b1', { color: 'blue', status: 'orphaned', sectionTitle: 'Gr\u00f6\u00dfe des Kontexts', quote: { exact: 'Na\u00efve loops run forever. [figure agent-loop]', prefix: '', suffix: '' }, createdAt: NOW - 60 * DAY }),
        item('b2', { color: 'pink', review: 'conflict', note: '\u65e5\u672c\u8a9e\u306e\u30e1\u30e2 about retries', createdAt: NOW - 2 * DAY, position: { start: 30, end: 40, length: 10 } }),
      ],
    },
    [MANUAL]: {
      title: 'A2A 101',
      items: [
        item('m1', { color: 'yellow', note: 'R\u00e9sum\u00e9 of the task lifecycle', lang: 'hi', createdAt: NOW - 3 * DAY }),
      ],
    },
  };
}

function makeStore(pages = fixturePages()) {
  const storage = memoryStorage({
    'aifs:highlights:v2': JSON.stringify({ schemaVersion: 2, pages, updatedAt: NOW }),
  });
  const listeners = [];
  const win = {
    localStorage: storage,
    addEventListener(type, fn) { if (type === 'storage') listeners.push(fn); },
  };
  const store = storeModule.create(win);
  return { store, storage, fireStorage: event => listeners.forEach(fn => fn(event)) };
}

function setup(pages, envOverrides = {}) {
  const doc = new FakeDocument();
  const container = doc.createElement('div');
  const downloads = [];
  const { store, storage, fireStorage } = makeStore(pages);
  const controller = page.mount(container, store, Object.assign({
    document: doc,
    now: () => NOW,
    download: (name, text, type) => downloads.push({ name, text, type }),
  }, envOverrides));
  const $ = id => container.byId(id);
  const items = () => container.findAll(node => node.tagName === 'LI' && node.hasClass('hlp-item'));
  const keys = () => items().map(node => node.getAttribute('data-key').split('\n')[1]);
  const change = (control, value) => {
    if (value !== undefined) control.value = value;
    control.dispatch(control.tagName === 'INPUT' && control.getAttribute('type') === 'search' ? 'input' : 'change');
  };
  return { doc, container, store, storage, fireStorage, controller, downloads, $, items, keys, change };
}

function criteria(fields) {
  return Object.assign(page.defaultCriteria(), fields);
}

function storePages() {
  return makeStore().store.pages();
}

test('search folds case and accents and matches quotes, notes, original text, titles and sections', () => {
  const pages = storePages();
  const ids = query => page.filterPages(pages, criteria({ query }), NOW).groups.flatMap(group => group.items.map(entry => entry.id));
  assert.equal(page.fold('  Caf\u00e9   NA\u00cfVE  '), 'cafe naive');
  assert.deepEqual(ids('CAFE'), ['a1']);
  assert.deepEqual(ids('cafe ordered'), ['a1']);
  assert.deepEqual(ids('naive'), ['b1']);
  assert.deepEqual(ids('grosse'), []);
  assert.deepEqual(ids('gr\u00f6\u00dfe'), ['b1']);
  assert.deepEqual(ids('GRO\u1e9eE'.toLowerCase()), ['b1']);
  assert.deepEqual(ids('resume lifecycle'), ['m1']);
  assert.deepEqual(ids('\u65e5\u672c\u8a9e'), ['b2']);
  assert.deepEqual(ids('the diagram for'), ['a2']);
  assert.deepEqual(ids('agent loop'), ['b1', 'b2']);
  assert.deepEqual(ids('a2a'), ['m1']);
  assert.deepEqual(ids('introduction'), ['m1', 'a1', 'a2', 'b2']);
  assert.deepEqual(ids('9f3ab2'), []);
  assert.deepEqual(ids('cafe nothing-like-this'), []);
  assert.deepEqual(ids('   '), ['m1', 'a1', 'a2', 'b1', 'b2']);
});

test('quote tokens for diagrams and figures display without their ids', () => {
  assert.equal(page.displayText('See [diagram 9f3ab2] and [figure agent-loop] and [figure]'), 'See [diagram] and [figure] and [figure]');
  assert.equal(page.displayText('[diagrams are] [figure-like]'), '[diagrams are] [figure-like]');
});

test('colour, page, kind and status filters each narrow the results', () => {
  const pages = storePages();
  const ids = fields => page.filterPages(pages, criteria(fields), NOW).groups.flatMap(group => group.items.map(entry => entry.id));
  assert.deepEqual(ids({ colors: ['yellow'] }), ['m1', 'a1']);
  assert.deepEqual(ids({ colors: ['green', 'pink'] }), ['a2', 'b2']);
  assert.deepEqual(ids({ page: LESSON_B }), ['b1', 'b2']);
  assert.deepEqual(ids({ kind: 'manual' }), ['m1']);
  assert.deepEqual(ids({ kind: 'lesson' }), ['a1', 'a2', 'b1', 'b2']);
  assert.deepEqual(ids({ status: 'anchored' }), ['m1', 'a1', 'b2']);
  assert.deepEqual(ids({ status: 'moved' }), ['a2']);
  assert.deepEqual(ids({ status: 'orphaned' }), ['b1']);
  assert.deepEqual(ids({ status: 'conflict' }), ['b2']);
  assert.deepEqual(ids({ status: 'pending' }), ['a2']);
  assert.deepEqual(ids({ kind: 'lesson', colors: ['yellow'], query: 'vector' }), ['a1']);
  assert.equal(page.isFiltered(criteria({})), false);
  assert.equal(page.isFiltered(criteria({ query: '  ' })), false);
  assert.equal(page.isFiltered(criteria({ colors: ['blue'] })), true);
});

test('date presets and custom ranges filter on the saved time', () => {
  const pages = storePages();
  const ids = fields => page.filterPages(pages, criteria(fields), NOW).groups.flatMap(group => group.items.map(entry => entry.id));
  assert.deepEqual(ids({ date: '7' }), ['m1', 'a1', 'b2']);
  assert.deepEqual(ids({ date: '30' }), ['m1', 'a1', 'a2', 'b2']);
  const day = offset => page.dayStamp(NOW - offset * DAY);
  assert.deepEqual(ids({ date: 'custom', from: day(3), to: day(2) }), ['m1', 'b2']);
  assert.deepEqual(ids({ date: 'custom', from: day(2), to: day(3) }), ['m1', 'b2']);
  assert.deepEqual(ids({ date: 'custom', to: day(30) }), ['b1']);
  assert.deepEqual(ids({ date: 'custom', from: day(1) }), ['a1']);
  assert.deepEqual(ids({ date: 'custom', from: 'not-a-date' }).length, 5);
  assert.deepEqual(ids({ date: 'any', from: day(1) }).length, 5);
  assert.equal(page.parseDay('2026-02-30'), null);
  assert.equal(page.dayStamp(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
});

test('results group by page in store order and count everything shown', () => {
  const result = page.filterPages(storePages(), criteria({}), NOW);
  assert.deepEqual(result.groups.map(group => group.page.path), [MANUAL, LESSON, LESSON_B]);
  assert.equal(result.total, 5);
  assert.equal(result.shown, 5);
  assert.equal(page.countLabel(result), 'Showing all 5 highlights from 3 pages.');
  const narrowed = page.filterPages(storePages(), criteria({ colors: ['blue'] }), NOW);
  assert.equal(page.countLabel(narrowed), 'Showing 1 of 5 highlights from 1 page.');
  assert.equal(page.countLabel(page.filterPages(storePages(), criteria({ query: 'zzz' }), NOW)), 'No highlights match these filters. 5 highlights saved in all.');
  assert.equal(page.countLabel(page.filterPages([], criteria({}), NOW)), 'No highlights saved in this browser yet.');
  const keys = page.shownKeys(narrowed);
  assert.deepEqual(page.selectionFrom(keys), { [LESSON_B]: ['b1'] });
  assert.deepEqual(page.selectionFrom([page.keyOf(LESSON, 'a1'), page.keyOf(LESSON, 'a2'), page.keyOf(MANUAL, 'm1')]), { [LESSON]: ['a1', 'a2'], [MANUAL]: ['m1'] });
});

test('status badges follow the labels the lesson page uses', () => {
  const label = fields => page.badges(item('x', fields)).map(badge => badge.label);
  assert.deepEqual(label({}), []);
  assert.deepEqual(label({ status: 'moved', confidence: 0.874, review: 'pending' }), ['Re-anchored 87% \u00b7 needs review']);
  assert.deepEqual(label({ status: 'moved', confidence: null, review: 'confirmed' }), ['Re-anchored']);
  assert.deepEqual(label({ status: 'orphaned' }), ['Orphaned']);
  assert.deepEqual(label({ review: 'conflict' }), ['Conflict copy']);
  assert.deepEqual(label({ review: 'pending' }), ['Needs review']);
});

test('the page renders groups, escaped text, open links and badges', () => {
  const hostile = fixturePages();
  hostile[LESSON].title = '<img src=x onerror=alert(1)>';
  hostile[LESSON].items[0].note = '<script>alert(1)</script>';
  const { container, keys, $ } = setup(hostile);
  assert.deepEqual(keys(), ['m1', 'a1', 'a2', 'b1', 'b2']);
  assert.equal($('hlpCount').textContent, 'Showing all 5 highlights from 3 pages.');
  assert.equal($('hlpCount').getAttribute('aria-live'), 'polite');
  const links = container.findAll(node => node.tagName === 'A' && node.hasClass('hlp-open'));
  assert.deepEqual(links.map(link => link.getAttribute('href')), [
    'manual-a2a-101.html#hl-m1',
    'lesson.html?path=phases%2F01-math-foundations%2F01-vectors&lang=en#hl-a1',
    'lesson.html?path=phases%2F01-math-foundations%2F01-vectors&lang=en#hl-a2',
    'lesson.html?path=phases%2F14-agent-engineering%2F02-agent-loop&lang=en#hl-b1',
    'lesson.html?path=phases%2F14-agent-engineering%2F02-agent-loop&lang=en#hl-b2',
  ]);
  const title = container.find(node => node.tagName === 'H2' && node.hasClass('hlp-group-title') && node.textContent.includes('img'));
  assert.equal(title.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(title.children[0].getAttribute('href'), 'lesson.html?path=phases%2F01-math-foundations%2F01-vectors');
  assert.ok(container.textContent.includes('<script>alert(1)</script>'));
  assert.ok(container.textContent.includes('See [diagram] for the dot product.'));
  assert.ok(container.textContent.includes('Originally: See the diagram for the dot product.'));
  assert.ok(container.textContent.includes('Re-anchored 87% \u00b7 needs review'));
  assert.ok(container.textContent.includes('Conflict copy'));
  assert.ok(container.textContent.includes('Orphaned'));
  assert.equal($('hlpResults').hasAttribute('data-i18n-skip'), true);
  for (const control of container.findAll(node => ['INPUT', 'SELECT'].includes(node.tagName) && node.getAttribute('type') !== 'file')) {
    const labelled = control.getAttribute('aria-label') || container.find(node => node.tagName === 'LABEL' && node.getAttribute('for') === control.id);
    assert.ok(labelled, `control ${control.id} has no label`);
  }
});

test('filter controls drive the rendered list and clear filters restores it', () => {
  const { $, keys, change, container, doc } = setup();
  change($('hlpSearch'), 'CAF\u00c9');
  assert.deepEqual(keys(), ['a1']);
  change($('hlpSearch'), '');
  container.find(node => node.getAttribute('data-color') === 'pink').click();
  assert.deepEqual(keys(), ['b2']);
  assert.equal(container.find(node => node.getAttribute('data-color') === 'pink').getAttribute('aria-pressed'), 'true');
  container.find(node => node.getAttribute('data-color') === 'pink').click();
  assert.equal(keys().length, 5);
  change($('hlpPage'), MANUAL);
  assert.deepEqual(keys(), ['m1']);
  change($('hlpPage'), '');
  change($('hlpKind'), 'lesson');
  change($('hlpStatus'), 'moved');
  assert.deepEqual(keys(), ['a2']);
  change($('hlpStatus'), '');
  change($('hlpKind'), '');
  change($('hlpDate'), '7');
  assert.deepEqual(keys(), ['m1', 'a1', 'b2']);
  change($('hlpFrom'), page.dayStamp(NOW - DAY));
  assert.equal($('hlpDate').value, 'custom');
  assert.deepEqual(keys(), ['a1']);
  change($('hlpDate'), '30');
  assert.equal($('hlpFrom').value, '');
  change($('hlpSearch'), 'no such text anywhere');
  assert.equal(keys().length, 0);
  assert.ok($('hlpResults').textContent.includes('No highlights match these filters.'));
  assert.equal($('hlpClear').disabled, false);
  $('hlpClear').click();
  assert.equal(keys().length, 5);
  assert.equal($('hlpSearch').value, '');
  assert.equal($('hlpDate').value, 'any');
  assert.equal($('hlpClear').disabled, true);
  assert.equal(doc.activeElement, $('hlpSearch'));
  const pageOptions = $('hlpPage').children.map(option => option.value);
  assert.deepEqual(pageOptions, ['', MANUAL, LESSON, LESSON_B]);
});

test('selection, select all shown, and exports of the selection or of everything shown', () => {
  const { $, items, change, downloads, controller } = setup(undefined, { origin: 'https://example.test' });
  assert.equal($('hlpDelete').disabled, true);
  assert.equal($('hlpSelected').textContent, 'None selected. Exports include all 5 highlights shown.');
  $('hlpExportJson').click();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'highlights-2026-10-18.json');
  const all = JSON.parse(downloads[0].text);
  assert.deepEqual(Object.keys(all.pages).sort(), [LESSON, LESSON_B, MANUAL].sort());
  assert.match($('hlpMessage').textContent, /Exported 5 highlights as JSON/);

  change($('hlpKind'), 'lesson');
  $('hlpSelectAll').checked = true;
  change($('hlpSelectAll'));
  assert.equal(controller.selected().length, 4);
  assert.ok(items().every(node => node.find(child => child.getAttribute('type') === 'checkbox').checked));
  const first = items()[0].find(child => child.getAttribute('type') === 'checkbox');
  first.checked = false;
  change(first);
  assert.equal(controller.selected().length, 3);
  assert.equal($('hlpSelectAll').checked, false);
  assert.equal($('hlpSelectAll').indeterminate, true);
  assert.equal($('hlpSelected').textContent, '3 highlights selected.');
  $('hlpExportMd').click();
  const markdown = downloads[1];
  assert.equal(markdown.name, 'highlights-2026-10-18.md');
  assert.match(markdown.text, /^# Highlights/);
  assert.ok(markdown.text.includes('Source: https://example.test/lesson.html?path='));
  assert.ok(!markdown.text.includes('A vector is an ordered list'));
  assert.ok(markdown.text.includes('Na\u00efve loops run forever.'));
  assert.ok(!markdown.text.includes('A2A 101'));

  change($('hlpKind'), 'manual');
  assert.equal(controller.selected().length, 0);
  assert.equal($('hlpDelete').disabled, true);
});

test('delete asks for confirmation inside the page, can be cancelled, and removes only the selection', () => {
  const { $, store, items, change, doc, keys } = setup();
  const boxes = () => items().map(node => node.find(child => child.getAttribute('type') === 'checkbox'));
  boxes()[1].checked = true;
  change(boxes()[1]);
  boxes()[3].checked = true;
  change(boxes()[3]);
  assert.equal($('hlpDelete').disabled, false);
  assert.equal($('hlpConfirm').hidden, true);
  $('hlpDelete').click();
  assert.equal($('hlpConfirm').hidden, false);
  assert.equal(doc.activeElement, $('hlpConfirm'));
  assert.match($('hlpConfirmText').textContent, /^Delete 2 highlights\? This cannot be undone\./);
  assert.equal($('hlpConfirm').getAttribute('aria-labelledby'), 'hlpConfirmText');
  $('hlpConfirmNo').click();
  assert.equal($('hlpConfirm').hidden, true);
  assert.equal(doc.activeElement, $('hlpDelete'));
  assert.equal(keys().length, 5);

  $('hlpDelete').click();
  $('hlpConfirmYes').dispatch('keydown', { key: 'Escape' });
  assert.equal($('hlpConfirm').hidden, true);
  assert.equal(keys().length, 5);

  $('hlpDelete').click();
  $('hlpConfirmYes').click();
  assert.equal($('hlpConfirm').hidden, true);
  assert.deepEqual(keys(), ['m1', 'a2', 'b2']);
  assert.equal($('hlpMessage').textContent, 'Deleted 2 highlights.');
  assert.equal(doc.activeElement, $('hlpCount'));
  assert.equal($('hlpDelete').disabled, true);
  assert.deepEqual(store.pages().flatMap(entry => entry.items.map(entry2 => entry2.id)).sort(), ['a2', 'b2', 'm1']);
});

test('sync file downloads everything and import reports counts and conflict copies', async () => {
  const { $, store, downloads, keys } = setup();
  $('hlpSyncDownload').click();
  assert.equal(downloads[0].name, 'highlights-sync-2026-10-18.json');
  const exported = JSON.parse(downloads[0].text);
  assert.equal(exported.format, 'aifs-highlights');
  assert.equal(Object.values(exported.pages).reduce((sum, entry) => sum + entry.items.length, 0), 5);

  const incoming = JSON.parse(store.exportJson(null));
  incoming.pages[LESSON].items[0].note = 'A different note written on the laptop';
  incoming.pages[LESSON].items[0].updatedAt = NOW + 1000;
  incoming.pages['phases/02-ml/03-new'] = { title: 'New lesson', items: [item('n1', { color: 'blue' })] };
  const input = $('hlpSyncFile');
  assert.equal(input.hidden, true);
  $('hlpSyncImport').click();
  assert.equal(input.clicks, 1);
  input.files = [{ name: 'highlights-sync.json', size: 100, text: async () => JSON.stringify(incoming) }];
  await Promise.all(input.dispatch('change'));
  const summary = $('hlpSyncResult').textContent;
  assert.match(summary, /1 added, 1 updated, 4 unchanged, 1 conflict, 0 skipped/);
  assert.match(summary, /Conflict copy/);
  assert.equal(keys().length, 7);
  assert.ok($('hlpResults').textContent.includes('Conflict copy'));

  input.files = [{ name: 'bad.json', size: 10, text: async () => '{not json' }];
  await Promise.all(input.dispatch('change'));
  assert.equal($('hlpSyncResult').textContent, 'That file is not valid JSON. Nothing was imported.');
  input.files = [{ name: 'other.json', size: 10, text: async () => JSON.stringify({ format: 'something-else', pages: {} }) }];
  await Promise.all(input.dispatch('change'));
  assert.match($('hlpSyncResult').textContent, /not a highlights sync file/);
  input.files = [{ name: 'huge.json', size: 6 * 1024 * 1024, text: async () => '{}' }];
  input.dispatch('change');
  assert.match($('hlpSyncResult').textContent, /more highlights than this browser can store/);
  assert.match(page.importSummary({ ok: false, error: 'newer-schema' }), /newer version/);
  assert.match(page.importSummary({ ok: false, error: 'too-large' }), /Nothing was imported/);
});

test('empty state, storage notices, and re-render when another tab writes', () => {
  const empty = setup({});
  assert.ok(empty.$('hlpResults').textContent.includes('No highlights yet'));
  assert.equal(empty.container.find(node => node.tagName === 'FORM').hidden, true);
  assert.equal(empty.$('hlpSyncImport').isShown(), true);

  const { $, storage, fireStorage, keys } = setup();
  const state = JSON.parse(storage.getItem('aifs:highlights:v2'));
  delete state.pages[MANUAL];
  storage.setItem('aifs:highlights:v2', JSON.stringify(state));
  fireStorage({ key: 'aifs:highlights:v2' });
  assert.deepEqual(keys(), ['a1', 'a2', 'b1', 'b2']);
  assert.equal($('hlpCount').textContent, 'Showing all 4 highlights from 2 pages.');

  assert.deepEqual(page.storageNotices({ persistent: true, readOnly: false, lastError: '' }), []);
  assert.match(page.storageNotices({ persistent: false, readOnly: false, lastError: '' })[0], /not keeping highlights/);
  assert.match(page.storageNotices({ persistent: false, readOnly: false, lastError: 'quota' })[0], /storage is full/);
  assert.equal(page.storageNotices({ persistent: false, readOnly: false, lastError: 'quota' }).length, 1);
  assert.match(page.storageNotices({ persistent: true, readOnly: true, lastError: 'newer-schema' })[0], /newer version/);

  const readOnly = setup(undefined);
  readOnly.storage.setItem('aifs:highlights:v2', JSON.stringify({ schemaVersion: 99, pages: fixturePages() }));
  readOnly.fireStorage({ key: 'aifs:highlights:v2' });
  assert.match(readOnly.$('hlpNotices').textContent, /newer version/);
  const box = readOnly.items()[0].find(child => child.getAttribute('type') === 'checkbox');
  box.checked = true;
  box.dispatch('change');
  assert.equal(readOnly.$('hlpDelete').disabled, true);
  assert.equal(readOnly.$('hlpSyncImport').disabled, true);
});

test('the page is noindex, wired into routes, navigation and cards, and kept out of the sitemap', () => {
  const html = fs.readFileSync(path.join(__dirname, 'highlights.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/aiengineeringfromscratch\.com\/og\/page\/highlights\.png">/);
  for (const asset of ['highlights-store.js', 'highlights-page.js', 'highlights-page.css', 'header.js', 'style.css', 'progress.js', 'cmdpalette.js']) {
    assert.match(html, new RegExp(`${asset.replace('.', '\\.')}\\?v=`), asset);
  }
  assert.ok(html.indexOf('highlights-store.js') < html.indexOf('highlights-page.js'));
  assert.match(html, /id="highlightsApp"/);
  assert.doesNotMatch(html, /\bon[a-z]+="/);

  const pageSource = fs.readFileSync(path.join(__dirname, 'highlights-page.js'), 'utf8');
  assert.doesNotMatch(pageSource, /innerHTML|insertAdjacentHTML|document\.write|fetch\(|XMLHttpRequest|window\.confirm|\bconfirm\(/);
  assert.doesNotMatch(pageSource, /^\s*\/\/|\/\*/m);

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/highlights' && !rule.has && rule.destination === '/highlights.html'));
  assert.ok(vercel.redirects.some(rule => rule.permanent && rule.source.includes(':page(') && new RegExp('^' + rule.source.replace(':page(', '(?:') + '$').test('/highlights.html')));
  for (const source of ['/highlights', '/highlights.html']) {
    const rule = vercel.headers.find(entry => entry.source === source);
    assert.ok(rule, source);
    assert.deepEqual(rule.headers.find(header => header.key === 'X-Robots-Tag'), { key: 'X-Robots-Tag', value: 'noindex' });
  }

  const header = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');
  assert.ok(header.includes("ensureNavigationLink(nav, 'highlights.html', 'My Highlights', '');"));
  assert.ok(header.indexOf("'skills.html', 'Skills'") < header.indexOf("ensureNavigationLink(nav, 'highlights.html'"));
  assert.ok(header.includes("ensureNavigationLink(footers[j], 'highlights.html', 'My Highlights', '');"));
  assert.match(header, /\|how-to-learn\|highlights\)'/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(__dirname, 'ui-strings.json'), 'utf8')).keys.includes('My Highlights'));

  const { PAGES } = require('../lib/og-cards');
  assert.equal(PAGES.highlights[1], 'My Highlights');
  assert.equal(PAGES.highlights[3], '/highlights');

  const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  assert.doesNotMatch(build, /highlights\.html/);
  const sitemap = path.join(__dirname, 'sitemap.xml');
  if (fs.existsSync(sitemap)) assert.doesNotMatch(fs.readFileSync(sitemap, 'utf8'), /highlights/);

  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'curriculum.yml'), 'utf8');
  assert.match(workflow, /node --test site\/test_highlights_page\.js/);
});

test('a back/forward cache restore reloads the list from storage', () => {
  const handlers = {};
  const fakeWin = { addEventListener: (type, fn) => { handlers[type] = fn; } };
  const ctx = setup(undefined, { window: fakeWin });
  const before = ctx.items().length;
  const state = JSON.parse(ctx.storage.getItem('aifs:highlights:v2'));
  const first = Object.keys(state.pages)[0];
  state.pages[first].items = state.pages[first].items.slice(1);
  ctx.storage.setItem('aifs:highlights:v2', JSON.stringify(state));
  handlers.pageshow({ persisted: false });
  assert.equal(ctx.items().length, before);
  handlers.pageshow({ persisted: true });
  assert.equal(ctx.items().length, before - 1);
});
