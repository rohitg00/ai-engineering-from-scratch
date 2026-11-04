'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const markdown = require('./lesson-markdown');
const code = require('./lib/code');
const { buildLessonCode, writeLessonCode, lessonBlocks } = require('./build-lessons');
const { pageText } = require('./build-practice');
const lessonApi = require('../api/lesson');

const LESSON = 'phases/01-demo/01-blocks';
const CERT_LESSON = 'certifications/demo/lessons/01-intro';
const PYTHON = 'def f(x):\n    return "a"  # note';
const SESSION = '$ pip install numpy \\\n    --quiet\nInstalled numpy\n\n$ python3 main.py --steps 3\nloss 0.25';
const MD = [
  '# Blocks',
  '',
  '> Motto.',
  '',
  '```python',
  PYTHON,
  '```',
  '',
  '```console',
  SESSION,
  '```',
  '',
  '```mermaid',
  'graph LR; A-->B',
  '```',
  '',
  '```text',
  'loss 0.25',
  '```',
].join('\n');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-lesson-code-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [lessonPath, body] of [[LESSON, MD], [CERT_LESSON, '# Intro\n\n```bash\necho hi\n```\n'], ['phases/01-demo/02-draft', null]]) {
    fs.mkdirSync(path.join(root, lessonPath, 'docs'), { recursive: true });
    if (body) fs.writeFileSync(path.join(root, lessonPath, 'docs', 'en.md'), body);
  }
  return root;
}

function blocksOf(built, lessonPath) {
  return JSON.parse(built.files.get(`${lessonPath}.json`)).blocks;
}

function blockFor(blocks, source, lang) {
  return blocks[markdown.codeKey(source, lang)];
}

test.before(async () => {
  await code.init();
});

test('a lesson fragment is built for every lesson with an English doc', t => {
  const built = buildLessonCode({ root: fixture(t) });
  assert.deepEqual([...built.files.keys()], [`${LESSON}.json`, `${CERT_LESSON}.json`]);
  const data = JSON.parse(built.files.get(`${LESSON}.json`));
  assert.equal(data.engine, code.engine());
  assert.equal(data.lang, 'en');
  assert.deepEqual(Object.keys(data.blocks), [
    markdown.codeKey(PYTHON, 'python'),
    markdown.codeKey(SESSION, 'console'),
    markdown.codeKey('loss 0.25', 'text'),
  ]);
  for (const html of Object.values(data.blocks)) assert.match(html, /^<div class="cb" data-kind="(?:code|terminal|output)"/);
  assert.equal(built.blocks, 4);
});

test('code keys depend on the code and the language', () => {
  assert.equal(markdown.codeKey(PYTHON, 'python'), markdown.codeKey(PYTHON, 'Python'));
  assert.notEqual(markdown.codeKey(PYTHON, 'python'), markdown.codeKey(PYTHON, 'py'));
  assert.notEqual(markdown.codeKey('x = 1', 'python'), markdown.codeKey('x = 2', 'python'));
  assert.match(markdown.codeKey('', ''), /^[a-z0-9]+-[a-z0-9]+$/);
});

test('a python block gets Shiki token classes', t => {
  if (code.engine() !== 'shiki') return t.skip('shiki is not installed');
  const html = blockFor(lessonBlocks(MD), PYTHON, 'python');
  assert.match(html, /^<div class="cb" data-kind="code" data-lang="python">/);
  assert.match(html, /<span class="k">def<\/span>/);
  assert.match(html, /<span class="s">"a"<\/span>/);
  assert.match(html, /<span class="c"># note<\/span>/);
  assert.doesNotMatch(html, /syn-|style=|data-code/);
});

test('a console block is a terminal block whose Copy copies only the commands', () => {
  const html = blockFor(lessonBlocks(MD), SESSION, 'console');
  assert.match(html, /^<div class="cb" data-kind="terminal" data-lang="console"><div class="cb-head"><span class="cb-label">terminal<\/span><button type="button" class="cb-copy">Copy<\/button><\/div>/);
  const commands = [...html.matchAll(/<span class="cb-ln">((?:(?!<span class="cb-ln">)[\s\S])*?)<\/span>(?=\n|<\/code>)/g)].map(match => pageText(match[1]));
  assert.deepEqual(commands, ['pip install numpy \\', '    --quiet', 'python3 main.py --steps 3']);
  const output = [...html.matchAll(/<span class="cb-o">([^<]*)<\/span>/g)].map(match => match[1]);
  assert.deepEqual(output, ['Installed numpy', 'loss 0.25']);
});

test('lessons render the fragments and fall back to the regex highlighter', () => {
  const blocks = lessonBlocks(MD);
  const expected = markdown.parseMd(MD, { renderCode: code.render });
  assert.equal(markdown.parseMd(MD, { renderCode: markdown.prerenderedCode(blocks) }), expected);
  const regex = markdown.parseMd(MD);
  assert.equal(markdown.parseMd(MD, { renderCode: markdown.prerenderedCode(null) }), regex);
  assert.equal(markdown.parseMd(MD, { renderCode: markdown.prerenderedCode({}) }), regex);
  const translated = MD.replace('# note', '# nota');
  const mixed = markdown.parseMd(translated, { renderCode: markdown.prerenderedCode(blocks) });
  assert.ok(mixed.includes(blockFor(blocks, SESSION, 'console')));
  assert.ok(mixed.includes(markdown.renderCodeBlock(PYTHON.replace('# note', '# nota'), 'python')));
  const poisoned = { [markdown.codeKey(PYTHON, 'python')]: 42 };
  assert.equal(markdown.parseMd(MD, { renderCode: markdown.prerenderedCode(poisoned) }), regex);
});

test('the lesson page uses fragments when present and the regex highlighter when they are missing', async () => {
  const lessonPath = 'phases/03-deep-learning-core/01-the-perceptron';
  const entry = { path: lessonPath, title: 'The Perceptron', context: { kind: 'course', phaseId: 3, phaseName: 'Deep Learning Core' } };
  const source = fs.readFileSync(path.join(__dirname, '..', lessonPath, 'docs', 'en.md'), 'utf8');
  const assets = {
    template: fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8'),
    manifest: { lessons: { [lessonPath]: entry } },
    lessonTerms: {},
    cheatsheets: {},
    practice: {},
    readMarkdown: () => source,
    languageCodes: ['en'],
  };
  const fenced = /^```(\w*)\n([\s\S]*?)\n```$/m.exec(source.replace(/^```(?:mermaid|math|figure)\n[\s\S]*?\n```$/gm, ''));
  assert.ok(fenced, entry.path);
  const marker = '<div class="cb" data-kind="code" data-lang="marker">MARKER</div>';
  const render = readCode => new Promise(resolve => {
    const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body) { resolve(String(body)); } };
    const handler = lessonApi.createHandler({ loadAssets: () => Object.assign({}, assets, { readCode }) });
    handler({ method: 'GET', url: `/lesson?path=${encodeURIComponent(lessonPath)}`, headers: {} }, response);
  });
  const withCode = await render(() => ({ [markdown.codeKey(fenced[2], fenced[1])]: marker }));
  assert.match(withCode, /data-server-rendered="true"/);
  assert.ok(withCode.includes(marker));
  const missing = await render(() => { throw new Error('ENOENT'); });
  assert.ok(!missing.includes(marker));
  assert.ok(missing.includes(markdown.renderCodeBlock(fenced[2], fenced[1])));
});

function lessonCodeRuntime(template, fetch, timer = () => 0) {
  const start = template.indexOf('var lessonCodeRequests');
  const end = template.indexOf('var lessonFetchSequence');
  assert.ok(start > 0 && end > start);
  const context = { fetch, setTimeout: timer, Promise, Object };
  vm.runInNewContext(template.slice(start, end), context);
  return context.fetchLessonCode;
}

test('the browser fetches a lesson fragment and returns null when it cannot', async () => {
  const template = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const blocks = lessonBlocks(MD);
  const urls = [];
  const ok = lessonCodeRuntime(template, url => {
    urls.push(url);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ engine: 'shiki', lang: 'en', blocks }) });
  });
  const fetched = await ok(LESSON);
  assert.deepEqual(urls, [`lesson-code/${LESSON}.json`]);
  assert.deepEqual(fetched, blocks);
  assert.equal(markdown.parseMd(MD, { renderCode: markdown.prerenderedCode(fetched) }), markdown.parseMd(MD, { renderCode: code.render }));
  await ok(LESSON);
  assert.equal(urls.length, 1);
  assert.equal(await ok('../secrets'), null);
  assert.equal(urls.length, 1);
  const missing = lessonCodeRuntime(template, () => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) }));
  assert.equal(await missing(LESSON), null);
  const broken = lessonCodeRuntime(template, () => Promise.resolve({ ok: true, json: () => Promise.resolve({ blocks: 'x' }) }));
  assert.equal(await broken(LESSON), null);
  const offline = lessonCodeRuntime(template, () => Promise.reject(new Error('offline')));
  assert.equal(await offline(CERT_LESSON), null);
});

test('the browser falls back when the fragment request outlasts its timeout', async () => {
  const template = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const delays = [];
  const pending = lessonCodeRuntime(template, () => new Promise(() => {}), (callback, delay) => {
    delays.push(delay);
    callback();
    return 0;
  });
  assert.equal(await pending(LESSON), null);
  assert.deepEqual(delays, [1500]);
  const output = markdown.parseMd(MD, { renderCode: markdown.prerenderedCode(await pending(LESSON)) });
  assert.equal(output, markdown.parseMd(MD));
  assert.deepEqual(delays, [1500, 1500]);
});

test('the lesson template fetches fragments and keeps the browser fallback', () => {
  const template = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  assert.match(template, /fetch\('lesson-code\/' \+ path \+ '\.json'\)/);
  assert.match(template, /parseMd\(md, \{ renderCode: window\.AIFSLessonMarkdown\.prerenderedCode\(codeBlocks\) \}\)/);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.match(config.functions['api/lesson.js'].includeFiles, /site\/lesson\{[^{}]*,-code\/\*\*\}/);
  for (const [name, settings] of Object.entries(config.functions)) assert.ok(String(settings.includeFiles || '').length <= 256, name);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8'), /^site\/lesson-code\/$/m);
});

test('two builds give the same bytes', t => {
  const root = fixture(t);
  const first = buildLessonCode({ root });
  const second = buildLessonCode({ root });
  assert.deepEqual([...first.files.keys()], [...second.files.keys()]);
  for (const [file, body] of first.files) assert.ok(Buffer.from(body).equals(Buffer.from(second.files.get(file))), file);
});

test('written fragments keep their bytes and stale fragments are removed', t => {
  if (code.engine() !== 'shiki') return t.skip('shiki is not installed');
  const root = fixture(t);
  const site = path.join(root, 'site');
  const read = () => {
    const out = {};
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else out[path.relative(site, full)] = fs.readFileSync(full);
      }
    };
    walk(path.join(site, 'lesson-code'));
    return out;
  };
  writeLessonCode({ root, siteDir: site });
  const first = read();
  fs.mkdirSync(path.join(site, 'lesson-code', 'phases', 'gone'), { recursive: true });
  fs.writeFileSync(path.join(site, 'lesson-code', 'phases', 'gone', 'old.json'), '{}');
  writeLessonCode({ root, siteDir: site });
  const second = read();
  assert.deepEqual(Object.keys(second).sort(), [`lesson-code/${CERT_LESSON}.json`, `lesson-code/${LESSON}.json`]);
  for (const file of Object.keys(first)) assert.ok(first[file].equals(second[file]), file);
  assert.equal(fs.existsSync(path.join(site, 'lesson-code', 'phases', 'gone')), false);
});
