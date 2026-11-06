const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const practice = require('./build-practice');

const root = path.resolve(__dirname, '..');
const built = practice.buildPractice();
const config = require('../vercel.json');

function page(href) {
  return built.pages.find(item => item.href === href);
}

test('every problem folder builds a page, a run file and a solution file', () => {
  assert.ok(built.problems.length >= 4, `only ${built.problems.length} problems`);
  for (const problem of built.problems) {
    assert.ok(page(problem.href), `${problem.id} has no page`);
    assert.ok(built.files.has(`data/${problem.id}.json`));
    assert.ok(built.files.has(`data/${problem.id}.solution.json`));
    const data = JSON.parse(built.files.get(`data/${problem.id}.json`));
    assert.equal(data.version, problem.version);
    assert.ok(data.hints.length >= 2 && data.hints.length <= 5);
    assert.ok(data.tests.includes('from practice_check import'));
    assert.deepEqual(Object.keys(JSON.parse(data.fixtures)).length > 0, true);
    assert.equal('solution' in data, false);
  }
});

test('no page and no run file shows the solution or the notes', () => {
  assert.deepEqual(practice.checkPractice(built), []);
  for (const problem of built.problems) {
    const html = page(problem.href).html;
    const solution = JSON.parse(built.files.get(`data/${problem.id}.solution.json`));
    assert.equal(html.includes(problem.files['solution.py'].trim()), false);
    assert.equal(html.includes('.solution.json'), false);
    assert.ok(solution.solution.length > 0 && solution.notes.length > 0);
  }
});

test('a problem page holds the statement, the starter, the source lesson and its links', () => {
  for (const problem of built.problems) {
    const html = page(problem.href).html;
    assert.match(html, new RegExp(`<link rel="canonical" href="https://aiengineeringfromscratch.com/practice/${problem.id}">`));
    assert.match(html, /<h2 id="task"/);
    assert.match(html, /data-editor-input/);
    assert.ok(html.includes(`/lesson?path=${encodeURIComponent(problem.meta.lesson)}`), `${problem.id} does not link its lesson`);
    if (problem.meta.cheatsheet) assert.ok(html.includes(`/cheatsheets/${problem.meta.cheatsheet}`));
    assert.match(html, /"@type":"LearningResource"/);
    assert.match(html, /data-pyodide="https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\/full\/"/);
    assert.match(html, /data-worker="\/practice-worker\.js\?v=[0-9a-f]{16}"/);
    assert.match(html, /\/practice\.js\?v=[0-9a-f]{16}/);
    assert.equal(/<script[^>]+pyodide/i.test(html), false, 'Pyodide must load only when the learner runs code');
  }
});

test('the list page has a row for each problem with the filter data', () => {
  const html = page('/practice').html;
  for (const problem of built.problems) {
    assert.ok(html.includes(`data-id="${problem.id}" data-kind="${problem.meta.kind}" data-difficulty="${problem.meta.difficulty}" data-phase="${problem.phase.number}"`), problem.id);
  }
  for (const name of ['q', 'kind', 'difficulty', 'status', 'phase', 'track', 'tag']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /data-random/);
  assert.match(html, /data-continue/);
  assert.match(html, /"@type":"ItemList"/);
});

test('tracks come from problem metadata and each track page lists its problems in order', () => {
  const ids = JSON.parse(fs.readFileSync(path.join(root, 'practice', 'collections.json'), 'utf8')).map(item => item.id);
  assert.ok(built.tracks.length >= 3);
  for (const track of built.tracks) {
    assert.ok(ids.includes(track.id));
    const html = page(track.href).html;
    let last = -1;
    for (const problem of track.problems) {
      assert.ok(problem.meta.collections.includes(track.id));
      const at = html.indexOf(`data-id="${problem.id}"`);
      assert.ok(at > last, `${track.id} order`);
      last = at;
    }
  }
});

test('the lesson map lists the practice problems of each lesson', () => {
  for (const problem of built.problems) {
    const items = built.map.lessons[problem.meta.lesson];
    assert.ok(items.some(item => item.id === problem.id && item.href === problem.href));
  }
});

test('the harness and each problem have the files that the validator needs', () => {
  assert.ok(built.files.get('practice_check.py').includes('def evaluate_json('));
  for (const problem of built.problems) {
    for (const name of ['problem.md', 'starter.py', 'solution.py', 'tests.py', 'hints.md', 'notes.md', 'fixtures.json']) {
      assert.ok(fs.existsSync(path.join(root, 'practice', problem.id, name)), `${problem.id}/${name}`);
    }
    const counts = practice.countChecks(problem.files['tests.py']);
    for (const layer of ['examples', 'properties', 'edge', 'reference']) assert.ok(counts[layer] > 0, `${problem.id} has no ${layer} check`);
  }
});

test('a broken problem folder stops the build with a clear message', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-practice-'));
  try {
    fs.mkdirSync(path.join(temp, 'practice', '_harness'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'practice', '_harness', 'practice_check.py'), 'def evaluate_json(): pass\n');
    fs.writeFileSync(path.join(temp, 'practice', 'collections.json'), '[]');
    fs.mkdirSync(path.join(temp, 'practice', 'demo'));
    fs.writeFileSync(path.join(temp, 'practice', 'demo', 'meta.json'), '{"id": "demo"}');
    assert.throws(() => practice.buildPractice({ root: temp }), /demo: missing problem\.md/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('hints split on level 2 headings', () => {
  assert.deepEqual(practice.hintList('## Hint 1\n\nOne.\n\n## Hint 2\n\nTwo.\n'), ['One.', 'Two.']);
});

test('two builds give the same bytes', () => {
  const again = practice.buildPractice();
  assert.deepEqual(Array.from(again.files.keys()), Array.from(built.files.keys()));
  for (const [file, body] of built.files) assert.equal(again.files.get(file), body, file);
});

test('clean URLs route to the practice pages and the run data is not indexed', () => {
  const rewrites = config.rewrites.map(rule => `${rule.source} ${rule.destination}`);
  assert.ok(rewrites.includes('/practice /practice/index.html'));
  assert.ok(rewrites.includes('/practice/:page([a-z0-9-]+) /practice/:page.html'));
  assert.ok(rewrites.includes('/practice/tracks/:page([a-z0-9-]+) /practice/tracks/:page.html'));
  const data = config.headers.find(rule => rule.source === '/practice/data/:path*');
  assert.ok(data.headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex'));
  assert.ok(config.functions['api/lesson.js'].includeFiles.includes('site/practice-map.json'));
});

test('the menu, the footers and the hub pages link to the practice pages', () => {
  assert.match(fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8'), /ensureNavigationLink\(nav, '\/practice', 'Practice', ''\)/);
  assert.match(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), /<a href="\/practice">Practice<\/a>/);
  assert.match(fs.readFileSync(path.join(__dirname, 'build-hubs.js'), 'utf8'), /\['\/practice', 'Practice'\]/);
});

test('the worker loads Pyodide as a module from the pinned version', () => {
  const worker = fs.readFileSync(path.join(__dirname, 'practice-worker.js'), 'utf8');
  assert.match(worker, /import\(indexURL \+ 'pyodide\.mjs'\)/);
  assert.equal(/importScripts/.test(worker), false);
  assert.match(fs.readFileSync(path.join(__dirname, 'practice.js'), 'utf8'), /new Worker\(workerUrl, \{ type: 'module' \}\)/);
  assert.equal(practice.PYODIDE_VERSION, '314.0.7');
});

test('each kind of task is present and every page carries its kind', () => {
  const kinds = new Set(built.problems.map(problem => problem.meta.kind));
  for (const kind of ['implement', 'research', 'train', 'lab']) assert.ok(kinds.has(kind), kind);
  for (const problem of built.problems) {
    const html = page(problem.href).html;
    assert.ok(html.includes(`data-kind="${problem.meta.kind}"`), problem.id);
    if (problem.meta.kind === 'train') assert.match(html, /data-curve/);
  }
});

test('only research pages link out, once, with nofollow and below the statement', () => {
  const allowed = /^https:\/\/(?:aiengineeringfromscratch\.com\/|github\.com\/rohitg00\/ai-engineering-from-scratch(?:\/|$)|fonts\.googleapis\.com\/)/;
  for (const item of built.pages) {
    const outbound = Array.from(item.html.matchAll(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>/g)).filter(match => !allowed.test(match[1]));
    const problem = built.problems.find(entry => entry.href === item.href);
    if (!problem || problem.meta.kind !== 'research') {
      assert.deepEqual(outbound.map(match => match[1]), [], item.href);
      continue;
    }
    assert.equal(outbound.length, 1, item.href);
    assert.match(outbound[0][1], /^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/);
    assert.match(outbound[0][0], /rel="nofollow noopener external"/);
    const statementEnd = item.html.indexOf('</section>', item.html.indexOf('class="pr-statement"'));
    assert.ok(item.html.indexOf(outbound[0][0]) > item.html.indexOf('<h2 id="task"') && item.html.indexOf(outbound[0][0]) < statementEnd, item.href);
    const head = item.html.slice(0, item.html.indexOf('</head>'));
    assert.equal(head.includes('arxiv.org'), item.html.includes('"citation"'), 'only the JSON-LD citation may name the paper url in the head');
    assert.equal(/<title>[^<]*arxiv/i.test(head) || /name="description" content="[^"]*arxiv/i.test(head), false);
  }
});

test('structured data describes each task and the list', () => {
  for (const problem of built.problems) {
    const ld = JSON.parse(page(problem.href).html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'LearningResource');
    assert.ok(ld.educationalLevel && Array.isArray(ld.teaches) && ld.teaches.length > 0, problem.id);
    assert.equal(ld.url, `https://aiengineeringfromscratch.com${problem.href}`);
    assert.equal(Boolean(ld.citation), problem.meta.kind === 'research');
  }
  const list = JSON.parse(page('/practice').html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(list['@type'], 'ItemList');
  assert.equal(list.itemListElement.length, built.problems.length);
});

test('answer engines get a Markdown page for the list, each track and each task, without the solution', () => {
  assert.ok(built.markdown.get('index.md').includes('## Research'));
  for (const track of built.tracks) assert.ok(built.markdown.has(`tracks/${track.id}.md`));
  for (const problem of built.problems) {
    const md = built.markdown.get(`${problem.id}.md`);
    assert.ok(md.startsWith(`# ${problem.meta.title}\n\nCanonical page: https://aiengineeringfromscratch.com${problem.href}`), problem.id);
    assert.ok(md.includes('## Task'));
    assert.equal(md.includes(problem.files['solution.py'].trim()), false);
    assert.equal(/\]\(https?:\/\/(?!aiengineeringfromscratch\.com)/.test(md), false, `${problem.id} links out`);
  }
  const markdownRule = config.rewrites.find(rule => rule.source === '/practice/:page([a-z0-9-]+)' && rule.has);
  const htmlRule = config.rewrites.findIndex(rule => rule.source === '/practice/:page([a-z0-9-]+)' && !rule.has);
  assert.equal(markdownRule.destination, '/agent-pages/practice/:page.md');
  assert.ok(config.rewrites.indexOf(markdownRule) < htmlRule);
});

function practicePage(options = {}) {
  const vm = require('node:vm');
  const Store = require('./practice-store');
  const nodes = {};
  const listeners = { window: {}, document: {} };
  const timers = new Map();
  let timerSeq = 0;
  const workers = [];
  function on(table, type, fn) {
    (table[type] = table[type] || []).push(fn);
  }
  function element(attributes = {}) {
    const own = { ...attributes };
    const events = {};
    return {
      value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, scrollTop: 0, scrollLeft: 0,
      parentNode: { scrollTop: 0, scrollLeft: 0 },
      classList: { contains: () => false, add() {} },
      style: {},
      getAttribute: name => (name in own ? own[name] : null),
      setAttribute: (name, value) => { own[name] = String(value); },
      hasAttribute: name => name in own,
      toggleAttribute: (name, force) => { if (force) own[name] = ''; else delete own[name]; },
      addEventListener: (type, fn) => on(events, type, fn),
      fire: (type, event = {}) => (events[type] || []).forEach(fn => fn(event)),
      querySelector: selector => nodes[selector] || null,
      querySelectorAll: selector => (selector === '[data-status-for]' && nodes.status ? [nodes.status] : []),
      focus() {},
    };
  }
  const main = element({ 'data-practice-problem': 'rope', 'data-version': options.version || 'v1', 'data-limit': '10', 'data-data': '/practice/data/rope.json', 'data-worker': '/practice-worker.js', 'data-pyodide': '/py/', 'data-harness': '/h.py' });
  for (const name of ['results', 'runtime', 'hints', 'hint-next', 'solution', 'lock', 'locked-note', 'run', 'submit', 'reset', 'editor', 'editor-view', 'editor-input']) nodes[`[data-${name}]`] = element();
  nodes['[data-editor-input]'].value = 'starter';
  nodes.status = element({ 'data-status-for': 'rope' });
  nodes.main = main;
  const storage = options.storage || new Map();
  const localStorage = { getItem: key => (storage.has(key) ? storage.get(key) : null), setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  class FakeWorker {
    constructor() {
      this.sent = [];
      workers.push(this);
    }
    postMessage(message) { this.sent.push(message); }
    terminate() { this.terminated = true; }
  }
  const window = {
    localStorage,
    confirm: () => true,
    addEventListener: (type, fn) => on(listeners.window, type, fn),
  };
  const document = {
    readyState: 'complete',
    visibilityState: 'visible',
    querySelector: selector => (selector === 'main' ? main : nodes[selector] || null),
    querySelectorAll: selector => main.querySelectorAll(selector),
    addEventListener: (type, fn) => on(listeners.document, type, fn),
  };
  const problem = { tests: 't', fixtures: '{}', support: '', limit: 10, hints: ['a', 'b'] };
  const context = {
    window, document, URLSearchParams, Promise, JSON, Math, String, Number, Array, Object, Error,
    Worker: FakeWorker,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    setTimeout: (fn, ms) => { timerSeq += 1; timers.set(timerSeq, { fn, ms }); return timerSeq; },
    clearTimeout: id => timers.delete(id),
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(problem) }),
  };
  window.window = window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'practice-store.js'), 'utf8'), context);
  if (options.before) options.before(context.window.AIFSPracticeStore);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'practice.js'), 'utf8'), context);
  return {
    nodes, main, storage, workers, timers, Store,
    store: context.window.AIFSPracticeStore,
    runTimers: ms => {
      for (const [id, timer] of Array.from(timers)) {
        if (timer.ms <= ms) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    type: text => {
      nodes['[data-editor-input]'].value = text;
      nodes['[data-editor-input]'].fire('input');
    },
  };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('reset cancels a pending save so the old code does not come back', () => {
  const page = practicePage();
  page.type('my code');
  page.nodes['[data-reset]'].fire('click');
  page.runTimers(250);
  assert.equal(page.nodes['[data-editor-input]'].value, 'starter');
  assert.equal(page.store.loadCode('rope'), null);
});

test('a second run while the first is starting is ignored and keeps the buttons busy', async () => {
  const page = practicePage();
  page.nodes['[data-run]'].fire('click');
  page.nodes['[data-submit]'].fire('click');
  await settle();
  assert.equal(page.workers.length, 1);
  const runs = page.workers[0].sent.filter(message => message.type === 'run');
  assert.equal(runs.length, 1);
  assert.equal(page.nodes['[data-run]'].disabled, true);
  assert.equal(page.main.hasAttribute('data-busy'), true);
  page.workers[0].onmessage({ data: { type: 'result', id: runs[0].id, report: { summary: { ok: true, passed: 3, total: 3 }, results: [] } } });
  await settle();
  assert.equal(page.nodes['[data-run]'].disabled, false);
  assert.equal(page.main.getAttribute('data-last'), 'run:pass');
});

test('a Python download failure shows on the label and the next run starts a new worker', async () => {
  const page = practicePage();
  page.nodes['[data-run]'].fire('click');
  await settle();
  page.workers[0].onmessage({ data: { type: 'status', phase: 'failed', message: 'The Python runtime did not download.' } });
  await settle();
  assert.equal(page.nodes['[data-runtime]'].getAttribute('data-phase'), 'failed');
  assert.equal(page.workers[0].terminated, true);
  assert.equal(page.nodes['[data-run]'].disabled, false);
  assert.match(page.nodes['[data-results]'].innerHTML, /did not download/);
  page.nodes['[data-run]'].fire('click');
  await settle();
  assert.equal(page.workers.length, 2);
  const worker = fs.readFileSync(path.join(__dirname, 'practice-worker.js'), 'utf8');
  assert.match(worker, /type: 'status', phase: 'failed'/);
});

test('a solved badge is repainted when a new task version asks for a new pass', () => {
  const page = practicePage({
    version: 'v2',
    before: store => {
      store.open('rope', 'v1');
      store.record('rope', 'submit', 2, 2);
    },
  });
  assert.equal(page.store.status('rope'), 'attempted');
  assert.equal(page.nodes.status.getAttribute('data-status'), 'attempted');
});
