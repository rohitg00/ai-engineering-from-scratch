const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'projects.js'), 'utf8');
const PROGRESS_KEY = 'aifs.projects.progress.v1';

function element(id, onHtml) {
  const attributes = {};
  const events = {};
  const classes = new Set();
  const node = {
    id,
    hidden: false,
    disabled: false,
    checked: false,
    title: '',
    value: '',
    textContent: '',
    renders: 0,
    style: {},
    classList: {
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
      contains: name => classes.has(name),
      add: name => classes.add(name),
    },
    getAttribute: name => (name in attributes ? attributes[name] : null),
    setAttribute: (name, value) => { attributes[name] = String(value); },
    addEventListener: (type, fn) => (events[type] = events[type] || []).push(fn),
    fire: (type, event = {}) => (events[type] || []).forEach(fn => fn(event)),
    insertAdjacentElement() {},
    querySelector: () => null,
  };
  let html = '';
  Object.defineProperty(node, 'innerHTML', {
    get: () => html,
    set: value => {
      html = String(value);
      node.renders += 1;
      if (onHtml) onHtml(html);
    },
  });
  return node;
}

function page(kind, search, storage = new Map()) {
  const nodes = {};
  const get = id => (nodes[id] = nodes[id] || element(id));
  const windowEvents = {};
  let fetches = 0;
  nodes.pjStage = element('pjStage', value => {
    const match = /id="pjToggleDone" data-done="(true|false)">([^<]*)</.exec(value);
    const toggle = element('pjToggleDone');
    toggle.setAttribute('data-done', match[1]);
    toggle.textContent = match[2];
    nodes.pjToggleDone = toggle;
  });
  const localStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  const location = { search, href: 'https://example.test/' + kind + '.html' + search, pathname: '/' + kind + '.html', hash: '' };
  const project = {
    id: 'mini-rag',
    title: 'Mini RAG',
    level: 1,
    source: 'core',
    languages: ['Python'],
    stages: [
      { id: 'ingest', number: 1, title: 'Ingest', doc: 'projects/mini-rag/stages/ingest/docs/en.md' },
      { id: 'search', number: 2, title: 'Search', doc: 'projects/mini-rag/stages/search/docs/en.md' },
    ],
  };
  const window = {
    AIFS_PROJECTS: {
      levels: [{ level: 1, name: 'One', summary: '' }],
      projects: [project],
      planned: [{ id: 'later', title: 'Later', level: 1, source: 'core' }],
      roles: [{ id: 'builder', title: 'Builder', projects: ['mini-rag'] }],
    },
    location,
    addEventListener: (type, fn) => (windowEvents[type] = windowEvents[type] || []).push(fn),
    matchMedia: () => ({ matches: false }),
    history: { replaceState() {}, pushState: (state, title, href) => { location.search = href.slice(href.indexOf('?')); } },
  };
  const document = {
    documentElement: element('html'),
    body: { getAttribute: () => kind },
    currentScript: null,
    title: '',
    getElementById: get,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => element(''),
    head: { appendChild() {} },
  };
  get('pjShowPlanned').checked = true;
  const context = {
    window, document, localStorage, location, history: window.history, URL, URLSearchParams, console, Promise, setTimeout, clearTimeout,
    fetch: () => {
      fetches += 1;
      return Promise.reject(new Error('offline'));
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    nodes,
    document,
    storage,
    fetches: () => fetches,
    fire: (type, event = {}) => (windowEvents[type] || []).forEach(fn => fn(event)),
    location,
  };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('the done button applies what its label says even when another tab changed the stage', async () => {
  const view = page('project', '?id=mini-rag&stage=ingest');
  await settle();
  assert.equal(view.nodes.pjToggleDone.textContent, 'Mark stage complete');
  view.storage.set(PROGRESS_KEY, JSON.stringify({ 'mini-rag': { ingest: '2026-11-01' } }));
  view.nodes.pjToggleDone.fire('click');
  assert.ok(JSON.parse(view.storage.get(PROGRESS_KEY))['mini-rag'].ingest);
  assert.equal(view.nodes.pjToggleDone.textContent, 'Mark as not done');
});

test('a progress change in another tab redraws the rail and the done button', async () => {
  const view = page('project', '?id=mini-rag&stage=ingest');
  await settle();
  view.storage.set(PROGRESS_KEY, JSON.stringify({ 'mini-rag': { ingest: '2026-11-01' } }));
  view.fire('storage', { key: PROGRESS_KEY });
  assert.equal(view.nodes.pjToggleDone.textContent, 'Mark as not done');
  assert.match(view.nodes.pjProgress.innerHTML, /<strong>1 \/ 2<\/strong>/);
});

test('a progress change in another tab keeps focus on the stage link the reader was on', async () => {
  const view = page('project', '?id=mini-rag&stage=ingest');
  await settle();
  const list = view.nodes.pjStageList;
  const before = element('');
  before.setAttribute('data-stage-index', '1');
  const after = element('');
  let focused = before;
  after.focus = () => { focused = after; };
  let selector = '';
  list.contains = node => node === before;
  list.querySelector = value => { selector = value; return after; };
  view.document.activeElement = before;
  view.storage.set(PROGRESS_KEY, JSON.stringify({ 'mini-rag': { ingest: '2026-11-01' } }));
  view.fire('storage', { key: PROGRESS_KEY });
  assert.equal(selector, '[data-stage-index="1"]');
  assert.equal(focused, after);
});

test('a fragment link does not reload the stage, a stage change does', async () => {
  const view = page('project', '?id=mini-rag');
  await settle();
  const renders = view.nodes.pjStage.renders;
  const fetches = view.fetches();
  view.fire('popstate');
  assert.equal(view.nodes.pjStage.renders, renders);
  assert.equal(view.fetches(), fetches);
  view.location.search = '?id=mini-rag&stage=search';
  view.fire('popstate');
  assert.equal(view.nodes.pjStage.renders, renders + 1);
  assert.match(view.nodes.pjStage.innerHTML, /<h2 id="pjStageTitle">Search<\/h2>/);
});

test('the planned toggle is disabled while a role hides planned projects', () => {
  const withRole = page('catalog', '?role=builder');
  assert.equal(withRole.nodes.pjShowPlanned.disabled, true);
  assert.equal(withRole.nodes.pjShowPlanned.checked, true);
  assert.equal(/is-planned/.test(withRole.nodes.pjLadder.innerHTML), false);
  const all = page('catalog', '');
  assert.equal(all.nodes.pjShowPlanned.disabled, false);
  assert.match(all.nodes.pjLadder.innerHTML, /is-planned/);
});
