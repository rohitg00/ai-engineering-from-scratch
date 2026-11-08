const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sheets = require('./build-cheatsheets');

const root = path.resolve(__dirname, '..');

const TOPIC = [
  '---',
  'id: demo',
  'title: Demo Topic',
  'subtitle: A small topic for the tests.',
  'hue: 120',
  'sources: phases/demo/01-lesson',
  '---',
  '',
  '## Start a server',
  'type: task-table',
  'from: phases/demo/01-lesson/docs/en.md',
  '',
  '| Task | Code |',
  '|---|---|',
  '| Start | `serve --port <port>` |',
  '| Probe | `GET /health` |',
  '',
  '## Run it',
  'type: annotated-code',
  'lang: bash',
  'from: phases/demo/01-lesson/docs/en.md',
  '',
  '```bash',
  '# Start',
  'serve --port 30000 \\  # HTTP port',
  '  --enable-metrics      # turn on metrics',
  '```',
  '',
  '## Parts',
  'type: architecture',
  'from: phases/demo/01-lesson/docs/en.md',
  '',
  '```arch',
  'node | api | 1,1 | HTTP server | tokenizer',
  'node | sched | 2,1 | Scheduler |',
  'edge | api | sched | ZMQ',
  '```',
  '',
  '## One request',
  'type: flow',
  'from: phases/demo/01-lesson/docs/en.md',
  '',
  '1. **Client**: sends a request.',
  '2. **Scheduler**: admits it.',
  '',
  '## Defaults',
  'type: defaults',
  'from: phases/demo/01-lesson/docs/en.md',
  '',
  '| Setting | Default | Note |',
  '|---|---|---|',
  '| `--port` | 30000 | HTTP port |',
  '',
].join('\n');

function fixtureRoot(lessonText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));
  fs.mkdirSync(path.join(dir, 'phases', 'demo', '01-lesson', 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'phases', 'demo', '01-lesson', 'docs', 'en.md'), lessonText);
  return dir;
}

test('a topic file parses into typed blocks', () => {
  const topic = sheets.parseTopic(TOPIC, 'cheatsheets/demo.md');
  assert.deepEqual(topic.errors, []);
  assert.equal(topic.id, 'demo');
  assert.equal(topic.hue, 120);
  assert.equal(topic.code, 'DT');
  assert.deepEqual(topic.blocks.map(block => [block.type, block.span]), [['task-table', 1], ['annotated-code', 2], ['architecture', 2], ['flow', 1], ['defaults', 2]]);
  assert.deepEqual(topic.blocks[0].rows[0], ['Start', '`serve --port <port>`']);
  assert.deepEqual(topic.blocks[2].nodes.map(node => node.id), ['api', 'sched']);
  assert.deepEqual(topic.blocks[2].edges, [{ from: 'api', to: 'sched', label: 'ZMQ' }]);
  assert.deepEqual(topic.blocks[3].items.map(item => item.lead), ['Client', 'Scheduler']);
});

test('bad blocks are reported', () => {
  const broken = TOPIC.replace('type: flow', 'type: story').replace('| Start | `serve --port <port>` |', '| Start |').replace('edge | api | sched | ZMQ', 'edge | api | nowhere | ZMQ');
  const errors = sheets.parseTopic(broken, 'cheatsheets/demo.md').errors.join('\n');
  assert.match(errors, /unknown type "story"/);
  assert.match(errors, /needs 2 cells/);
  assert.match(errors, /names a missing node/);
  assert.match(sheets.parseTopic(TOPIC, 'cheatsheets/other.md').errors.join('\n'), /must match the file name/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-broken-'));
  fs.mkdirSync(path.join(root, 'cheatsheets'));
  fs.writeFileSync(path.join(root, 'cheatsheets', 'demo.md'), broken);
  assert.throws(() => sheets.buildCheatsheets({ root, edition: '2026-01-01' }), /cheatsheets\/demo\.md: .*unknown type "story"/s);
});

test('every flag, name and default must appear in the from files', () => {
  const grounded = fixtureRoot('Run serve --port 30000 --enable-metrics. GET /health.');
  const topic = sheets.parseTopic(TOPIC, path.join(grounded, 'cheatsheets', 'demo.md'));
  topic.file = 'cheatsheets/demo.md';
  assert.deepEqual(sheets.checkTopic(topic, grounded), []);
  const thin = fixtureRoot('Run serve --port 8080.');
  const problems = sheets.checkTopic(topic, thin).join('\n');
  assert.match(problems, /"--enable-metrics" is not in its from files/);
  assert.match(problems, /"30000" is not in its from files/);
  assert.doesNotMatch(problems, /<port>/);
});

test('diagrams render from the block data', () => {
  const topic = sheets.parseTopic(TOPIC, 'cheatsheets/demo.md');
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  assert.ok(built.pages.length >= 1);
  const html = require('./build-cheatsheets').architectureSvg(topic.blocks[2]);
  assert.match(html, /<svg class="cs-arch cs-arch-wide" viewBox="0 0 614 \d+"/);
  assert.match(html, />HTTP server</);
  assert.match(html, />ZMQ</);
  const narrow = sheets.architectureSvg(topic.blocks[2], true);
  assert.match(narrow, /<svg class="cs-arch cs-arch-narrow" viewBox="0 0 300 \d+"/);
  const flow = sheets.flowSvg(topic.blocks[3]);
  assert.match(flow, />1</);
  assert.match(flow, />Scheduler</);
});

test('maintainer-only content and incomplete rows fail the rubric', () => {
  const learner = sheets.parseTopic(TOPIC, 'cheatsheets/demo.md');
  assert.deepEqual(sheets.maintainerContent(learner), []);
  assert.deepEqual(sheets.incompleteRows(learner), []);
  for (const text of ['`python capture/run.py --check`', '`python3 run.py`', '`python capture/gpu/run.py --only 2-1`', '`--build-fixtures`', '`node site/build-manuals.js`', '`python scripts/audit_manuals.py`', '`manuals/demo/manual.json`']) {
    const topic = sheets.parseTopic(TOPIC.replace('`GET /health`', text), 'cheatsheets/demo.md');
    assert.deepEqual(sheets.maintainerContent(topic), ['Start a server'], text);
    const report = sheets.qualityReport(topic);
    assert.ok(report.failures.some(failure => failure.startsWith('reader:')), text);
  }
  const fixtures = sheets.parseTopic(TOPIC.replace('`GET /health`', '`python code/main.py fixtures/sample.bin`'), 'cheatsheets/demo.md');
  assert.deepEqual(sheets.maintainerContent(fixtures), []);
  for (const cell of ['-', 'TBD', '...']) {
    const topic = sheets.parseTopic(TOPIC.replace('| 30000 | HTTP port |', `| 30000 | ${cell} |`), 'cheatsheets/demo.md');
    assert.deepEqual(sheets.incompleteRows(topic), ['Defaults: --port'], cell);
    assert.ok(sheets.qualityReport(topic).failures.some(failure => failure.startsWith('complete:')), cell);
  }
  const compare = sheets.parseTopic(TOPIC.replace('| `--port` | 30000 | HTTP port |', '| `--port` | 30000 | HTTP port |\n\n## Engines\ntype: comparison\nfrom: phases/demo/01-lesson/docs/en.md\n\n| | A | B |\n|---|---|---|\n| Port | 30000 | ... |\n| Metrics | yes | no |'), 'cheatsheets/demo.md');
  assert.deepEqual(sheets.incompleteRows(compare), ['Engines: Port']);
});

test('diagram edges go around nodes and labels do not overlap', () => {
  const arch = [
    '```arch',
    'node | cli | 1,1 | rea CLI | one question per call',
    'node | mcp | 2,1 | rea MCP server | 207 tools',
    'node | session | 3,1 | BinarySession | one active target',
    'node | art | 1,2 | rea-artifact-graph | no Ghidra needed',
    'node | prov | 2,2 | GhidraProvider | a socket',
    'edge | cli | session | one question',
    'edge | mcp | session | one session',
    'edge | session | art | inspect',
    'edge | session | prov | bind Ghidra',
    '```',
  ].join('\n');
  const topic = sheets.parseTopic(TOPIC.replace(/```arch[\s\S]*?```/, arch), 'cheatsheets/demo.md');
  const block = topic.blocks.find(item => item.type === 'architecture');
  for (const narrow of [false, true]) {
    assert.deepEqual(sheets.architectureOverlaps(block, narrow), [], narrow ? 'narrow' : 'wide');
    const { edges } = sheets.architectureLayout(block, narrow);
    const spanning = edges.find(edge => edge.from === 'cli' && edge.to === 'session');
    assert.ok(spanning.points.length > 2 || narrow);
  }
  assert.match(sheets.architectureSvg(block), /<polyline class="cs-arch-edge"/);
  const topics = sheets.loadTopics(root);
  const problems = topics.flatMap(item => item.blocks.filter(entry => entry.type === 'architecture').flatMap(entry => [false, true].flatMap(narrow => sheets.architectureOverlaps(entry, narrow).map(problem => `${item.id}: ${problem}`))));
  assert.deepEqual(problems, []);
});

test('posters do not print source lines', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  for (const page of built.pages) assert.doesNotMatch(page.html, /class="cs-from"/, page.file);
});

test('the real topics pass every check and fit two pages', () => {
  const topics = sheets.loadTopics(root);
  assert.ok(topics.length >= 3);
  const cache = new Map();
  for (const topic of topics) {
    assert.deepEqual(sheets.checkTopic(topic, root, cache), [], topic.file);
    assert.ok(sheets.layout(topic).pages <= 2, topic.file);
  }
});

test('the same topics give the same bytes and no broken links', () => {
  const first = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const second = sheets.buildCheatsheets({ edition: '2026-01-01' });
  assert.equal(first.pages.length, first.topics.length + 1);
  for (let i = 0; i < first.pages.length; i++) assert.equal(first.pages[i].html, second.pages[i].html, first.pages[i].href);
  assert.equal(first.search, second.search);
  assert.deepEqual(sheets.checkLinks(first), []);
  const ids = [];
  for (const page of first.pages) {
    const found = [...page.html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(found).size, found.length, page.href);
    ids.push(...found);
  }
});

test('blocks are placed on the grid without overlap', () => {
  for (const topic of sheets.loadTopics(root)) {
    const { places } = sheets.layout(topic);
    const cells = new Set();
    for (const place of places) {
      for (let c = place.col; c < place.col + place.span; c++) {
        for (let r = place.row; r < place.row + place.rows; r++) {
          const key = `${place.page}:${c}:${r}`;
          assert.ok(!cells.has(key), `${topic.id} overlaps at ${key}`);
          cells.add(key);
        }
      }
      assert.ok(place.col + place.span - 1 <= 4);
    }
  }
});

test('lesson and phase pages learn which topics cover them', () => {
  const topics = sheets.loadTopics(root);
  const map = sheets.coverage(topics, root);
  const harness = topics.find(topic => topic.id === 'agent-harness');
  assert.ok(harness);
  assert.ok(map.lessons['phases/14-agent-engineering/01-the-agent-loop'].some(item => item.id === 'agent-harness'));
  assert.ok(map.phases['agent-engineering'].some(item => item.href === '/cheatsheets/agent-harness'));
  for (const lesson of Object.keys(map.lessons)) assert.ok(fs.existsSync(path.join(root, lesson, 'docs', 'en.md')), lesson);
  const source = fs.readFileSync(path.join(root, 'api', 'lesson.js'), 'utf8');
  assert.match(source, /cheatsheet-map\.json/);
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrites = new Map(vercel.rewrites.map(rule => [rule.source, rule.destination]));
  assert.equal(rewrites.get('/cheatsheets'), '/cheatsheets/index.html');
  assert.equal(rewrites.get('/cheatsheets/:topic([a-z0-9-]+)'), '/cheatsheets/:topic.html');
  assert.ok(vercel.functions && JSON.stringify(vercel.functions).includes('site/cheatsheet-map.json'));
});

test('search covers every table row and term', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const index = JSON.parse(built.search);
  assert.equal(index.length, built.topics.length);
  for (const topic of built.topics) {
    const entry = index.find(item => item.i === topic.id);
    const rows = topic.blocks.filter(block => block.rows).reduce((sum, block) => sum + block.rows.length, 0);
    assert.ok(entry.r.length >= rows, topic.id);
    for (const row of entry.r) assert.ok(topic.blocks[row[2]] && entry.b[row[2]] === topic.blocks[row[2]].id);
  }
});

test('the search index stays small and still finds flags in long cells', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const gzipped = require('node:zlib').gzipSync(built.search).length;
  assert.ok(gzipped < 200000, `search.json is ${gzipped} bytes gzipped`);
  const index = JSON.parse(built.search);
  const sglang = index.find(item => item.i === 'sglang-serving');
  assert.ok(sglang.r.some(row => row.join(' ').includes('--mem-fraction-static')));
});

test('the print edition carries the attribution and renders math ahead of time', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-10-01' });
  const html = sheets.printHtml(built);
  assert.match(html, /<meta name="author" content="Rohit Ghumare">/);
  assert.match(html, /<meta name="subject" content="[^"]+edition 2026-10-01">/);
  assert.match(html, /<meta name="keywords" content="[^"]+">/);
  assert.match(html, /class="cs-cover-copy">© 2026 Rohit Ghumare · MIT license</);
  const printer = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'print_cheatsheets.js'), 'utf8');
  assert.match(printer, /querySelector\('\.cs-cover-copy'\)/);
  assert.match(html, /Keep this page and the copyright line with them/);
  const fake = { renderToString: (tex, options) => `<span class="katex">${options.displayMode ? 'D' : 'I'}:${tex}</span>` };
  const rendered = sheets.prerenderMath('<head></head><span class="math-inline" data-math="inline">a &lt; b</span>', fake);
  assert.match(rendered, /katex\.min\.css/);
  assert.match(rendered, /data-math-rendered><span class="katex">I:a < b<\/span>/);
});
