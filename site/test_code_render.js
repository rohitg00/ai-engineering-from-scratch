'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const markdown = require('./lesson-markdown');
const code = require('./lib/code');
const { buildPractice, checkPractice, pageText } = require('./build-practice');
const { buildCheatsheets } = require('./build-cheatsheets');
const { pathToFileURL } = require('node:url');
const { buildSearchIndex, collectPages, interviewRecord, lessonRecord, lessonSearchRecords, searchHtml } = require('./build-search');
const palette = require('./cmdpalette.js');

const SESSION = '$ pip install numpy \\\n    --quiet\nInstalled numpy\n\n$ python3 main.py --steps 3\nloss 0.25';

function renderers() {
  const list = [{ name: 'regex', render: markdown.renderCodeBlock }];
  if (code.engine() === 'shiki') list.push({ name: 'shiki', render: code.render });
  return list;
}

function headOf(html) {
  return /<div class="cb-head">([\s\S]*?)<\/div>/.exec(html)[1];
}

test.before(async () => {
  await code.init();
});

test('code blocks carry their kind, a label and one Copy button', () => {
  for (const { name, render } of renderers()) {
    const html = render('def f(x):\n    return x + 1', 'python');
    assert.match(html, /^<div class="cb" data-kind="code" data-lang="python"><div class="cb-head"><span class="cb-label">python<\/span><button type="button" class="cb-copy">Copy<\/button><\/div><pre><code>/, name);
    assert.equal((html.match(/class="cb-copy"/g) || []).length, 1, name);
    assert.equal(pageText(html).replace(/^pythonCopy/, ''), 'def f(x):\n    return x + 1', name);
  }
});

test('console blocks split the prompt, the commands and the output', () => {
  for (const { name, render } of renderers()) {
    const html = render(SESSION, 'console');
    assert.match(html, /data-kind="terminal"/, name);
    assert.match(headOf(html), /<span class="cb-label">terminal<\/span><button type="button" class="cb-copy">Copy<\/button>/, name);
    assert.equal((html.match(/<span class="cb-p">\$ <\/span>/g) || []).length, 2, name);
    const commands = [...html.matchAll(/<span class="cb-ln">((?:(?!<span class="cb-ln">)[\s\S])*?)<\/span>(?=\n|<\/code>)/g)].map(match => pageText(match[1]));
    assert.deepEqual(commands, ['pip install numpy \\', '    --quiet', 'python3 main.py --steps 3'], name);
    const output = [...html.matchAll(/<span class="cb-o">([^<]*)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(output, ['Installed numpy', 'loss 0.25'], name);
    assert.equal(pageText(html.replace(/<div class="cb-head">[\s\S]*?<\/div>/, '')), SESSION, name);
  }
});

test('a console block without a prompt has no Copy button', () => {
  for (const { name, render } of renderers()) {
    const html = render('Installed numpy', 'console');
    assert.doesNotMatch(html, /cb-copy/, name);
    assert.match(html, /<span class="cb-o">Installed numpy<\/span>/, name);
  }
});

test('python REPL sessions copy the input lines', () => {
  const parts = markdown.splitSession('>>> for i in range(2):\n...     print(i)\n0\n1');
  assert.deepEqual(parts.map(part => [part.cmd, part.prompt || '', part.text]), [
    [true, '>>> ', 'for i in range(2):'],
    [true, '... ', '    print(i)'],
    [false, '', '0'],
    [false, '', '1'],
  ]);
});

test('text blocks are plain output with no Copy button', () => {
  for (const { name, render } of renderers()) {
    for (const lang of ['text', 'plaintext', 'output']) {
      const html = render('loss 0.25 < 0.5', lang);
      assert.match(html, /data-kind="output"/, name);
      assert.match(headOf(html), /^<span class="cb-label">output<\/span>$/, name);
      assert.match(html, /<pre><code>loss 0\.25 &lt; 0\.5<\/code><\/pre>/, name);
    }
  }
});

test('ansi blocks are logs with no escape codes and no Copy button', () => {
  const log = '\u001b[31mERROR\u001b[0m disk full\n\u001b[1;32mPASS\u001b[0m retry';
  for (const { name, render } of renderers()) {
    const html = render(log, 'ansi');
    assert.match(html, /data-kind="output" data-lang="ansi"/, name);
    assert.match(headOf(html), /^<span class="cb-label">log<\/span>$/, name);
    assert.doesNotMatch(html, /\u001b|\[31m/, name);
    assert.equal(pageText(html.replace(/<div class="cb-head">[\s\S]*?<\/div>/, '')), 'ERROR disk full\nPASS retry', name);
  }
  if (code.engine() === 'shiki') {
    const html = code.render(log, 'ansi');
    assert.match(html, /<span class="a-red">ERROR<\/span>/);
    assert.match(html, /<span class="a-green b">PASS<\/span>/);
  }
});

test('shiki output uses short token classes and no inline styles', t => {
  if (code.engine() !== 'shiki') return t.skip('shiki is not installed');
  const html = code.render('def f(x):\n    return "a"  # note', 'python');
  assert.match(html, /<span class="k">def<\/span>/);
  assert.match(html, /<span class="s">"a"<\/span>/);
  assert.match(html, /<span class="c"># note<\/span>/);
  assert.doesNotMatch(html, /style=|shiki|--sh-/);
  assert.equal(code.render('a <b> & "c"', 'unknown-lang').includes('a &lt;b&gt; &amp; "c"'), true);
});

test('no rendered block repeats its code in a data attribute', () => {
  const md = '```python\nx = "<tag>"\n```\n\n```console\n$ echo hi\nhi\n```\n\n```text\nhi\n```';
  for (const html of [markdown.parseMd(md), markdown.parseMd(md, { renderCode: code.render })]) {
    assert.doesNotMatch(html, /data-code|data-copy/);
    assert.equal((html.match(/<div class="cb" /g) || []).length, 3);
  }
});

test('the Copy handler copies commands only from a terminal block and the code from a code block', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'code-copy.js'), 'utf8');
  assert.ok(Buffer.byteLength(source) <= 512, 'the handler stays near 400 bytes');
  let listener = null;
  const copied = [];
  const sandbox = {
    document: { addEventListener: (type, fn) => { if (type === 'click') listener = fn; } },
    navigator: { clipboard: { writeText: text => { copied.push(text); return Promise.resolve(); } } },
    setTimeout: () => 0,
  };
  new Function('document', 'navigator', 'setTimeout', source)(sandbox.document, sandbox.navigator, sandbox.setTimeout);
  assert.equal(typeof listener, 'function');
  const node = text => ({ textContent: text });
  function block(lines, codeText) {
    const root = { querySelectorAll: selector => (selector === '.cb-ln' ? lines.map(node) : []), querySelector: () => node(codeText) };
    const button = { textContent: 'Copy', closest: selector => (selector === '.cb-copy' ? button : root) };
    return button;
  }
  const terminal = block(['pip install numpy \\', '    --quiet', 'python3 main.py'], '$ pip install numpy \\\n    --quiet\nInstalled\n$ python3 main.py');
  listener({ target: terminal });
  const plain = block([], 'x = 1\nprint(x)');
  listener({ target: plain });
  listener({ target: { closest: () => null } });
  await Promise.resolve();
  assert.deepEqual(copied, ['pip install numpy \\\n    --quiet\npython3 main.py', 'x = 1\nprint(x)']);
  assert.equal(terminal.textContent, 'Copied');
});

test('practice pages render code at build time and leak no answers', () => {
  const built = buildPractice();
  assert.deepEqual(checkPractice(built), []);
  for (const page of built.pages) {
    assert.doesNotMatch(page.html, /data-code=|class="code-copy"/, page.href);
    assert.match(page.html, /\/code\.css\?v=[a-f0-9]{16}/, page.href);
  }
  for (const problem of built.problems) {
    const page = built.pages.find(item => item.href === problem.href);
    const text = pageText(page.html);
    const starter = new Set(problem.files['starter.py'].split('\n').map(line => line.trim()));
    for (const line of problem.files['solution.py'].split('\n').map(item => item.trim())) {
      if (line.length < 18 || starter.has(line) || /^(?:def |import |from |raise NotImplementedError)/.test(line)) continue;
      assert.equal(text.includes(line), false, `${problem.id} shows a solution line: ${line}`);
    }
    assert.match(page.html, /<div class="cb" data-kind="code" data-lang="bash">/, problem.id);
  }
});

test('cheat sheet annotated code copies the code parts without data attributes', () => {
  const built = buildCheatsheets({ edition: '2026-01-01' });
  const pages = built.pages.filter(page => page.html.includes('class="cs-ann"'));
  assert.ok(pages.length > 0);
  for (const page of pages) {
    assert.doesNotMatch(page.html, /data-copy=/, page.file);
    const block = /<div class="cs-ann" data-lang="[^"]*"><button type="button" class="cb-copy" aria-label="Copy code">Copy<\/button>([\s\S]*?)<\/div><\/div><\/section>/.exec(page.html);
    assert.ok(block, page.file);
    assert.match(block[1], /<code class="cb-ln">/, page.file);
  }
});

test('the search helper builds filtered records and indexes the main content', () => {
  const record = interviewRecord({ url: '/interviews/kv-cache', title: 'KV cache', content: 'Why the cache grows.', topic: 'inference', level: 2, role: ['inference-engineer'] });
  assert.deepEqual(record, { url: '/interviews/kv-cache', content: 'Why the cache grows.', language: 'en', meta: { title: 'KV cache' }, filters: { type: ['Interview'], topic: ['inference'], level: ['2'], role: ['inference-engineer'] } });
  assert.throws(() => interviewRecord({ url: '/x', title: 't', content: 'c', topic: 'a', level: 5, role: 'r' }), /level/);
  assert.throws(() => interviewRecord({ url: 'https://example.com', title: 't', content: 'c', topic: 'a', level: 1, role: 'r' }), /site path/);
  const html = searchHtml('<header>nav</header><main id="main"><h1>Title</h1><script>x()</script><p>Body</p><textarea>starter</textarea></main>', 'Practice');
  assert.match(html, /<main data-pagefind-body data-pagefind-filter="type:Practice">/);
  assert.doesNotMatch(html, /nav|x\(\)|starter/);
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-search-'));
  try {
    fs.mkdirSync(path.join(site, 'practice', 'tracks'), { recursive: true });
    fs.mkdirSync(path.join(site, 'manual', 'manual-demo-101'), { recursive: true });
    fs.writeFileSync(path.join(site, 'practice', 'index.html'), '<main><h1>Practice</h1></main>');
    fs.writeFileSync(path.join(site, 'practice', 'adam.html'), '<main><h1>Adam</h1></main>');
    fs.writeFileSync(path.join(site, 'manual', 'manual-demo-101', 'start.html'), '<main><h1>Start</h1></main>');
    assert.deepEqual(collectPages(site).map(page => [page.url, page.type]), [['/practice/adam', 'Practice'], ['/practice', 'Practice'], ['/manual-demo-101/start', 'Manual']]);
  } finally {
    fs.rmSync(site, { recursive: true, force: true });
  }
});

const LESSON_MD = [
  '---',
  'draft: false',
  '---',
  '# The `Perceptron` Lesson',
  '',
  '> A **weighted** sum and a [decision](https://example.com/decision).',
  '',
  '![diagram](figures/perceptron.png)',
  '',
  '## Step 1: Weights',
  '',
  'Call `np.dot` to add the <span class="hl">zorbification</span> term. See https://example.com/raw for more.',
  '',
  '```python',
  'secret_fence_token = 42',
  '```',
  '',
  '~~~',
  'another_fence_token',
  '~~~',
  '',
  '$$',
  'tex_block_token',
  '$$',
  '',
  '| Name | Value |',
  '| --- | --- |',
  '| bias | `b` |',
].join('\n');

test('lesson search records use the lesson route, the lesson name, type and phase filters and plain text', () => {
  const record = lessonRecord({ lessonPath: 'phases/03-deep-learning-core/01-the-perceptron', title: 'From data', phase: 'Deep Learning Core', markdown: LESSON_MD });
  const fenced = lessonRecord({ lessonPath: 'phases/03-deep-learning-core/01-the-perceptron', title: 'From data', phase: 'P', markdown: '```bash\n# not a title\n```\n\n# Real Title\n\nBody.' });
  assert.equal(fenced.meta.title, 'Real Title');
  assert.equal(record.url, '/lesson?path=phases%2F03-deep-learning-core%2F01-the-perceptron');
  assert.deepEqual(record.meta, { title: 'The Perceptron Lesson' });
  assert.deepEqual(record.filters, { type: ['Lesson'], phase: ['Deep Learning Core'] });
  assert.equal(record.language, 'en');
  assert.match(record.content, /^The Perceptron Lesson\nA weighted sum and a decision\.\nStep 1: Weights\n/);
  assert.match(record.content, /Call np\.dot to add the zorbification term/);
  assert.match(record.content, /bias · b/);
  for (const gone of ['secret_fence_token', 'another_fence_token', 'tex_block_token', 'example.com', 'perceptron.png', 'diagram', '<span', 'draft:', '```', '**', '---']) {
    assert.equal(record.content.includes(gone), false, gone);
  }
  const capped = lessonRecord({ lessonPath: 'phases/03-deep-learning-core/01-the-perceptron', title: 'T', phase: 'P', markdown: `# T\n\n${'word '.repeat(500)}`, limit: 100 });
  assert.ok(capped.content.length <= 100 && /word$/.test(capped.content));
  assert.throws(() => lessonRecord({ lessonPath: 'certifications/x/lessons/y', title: 't', phase: 'p', markdown: '# t\n\nbody' }), /phases/);
});

test('lesson search records read only English docs of published lessons', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-lessons-'));
  try {
    const write = (lesson, lang, text) => {
      fs.mkdirSync(path.join(repo, 'phases', '01-math', lesson, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'phases', '01-math', lesson, 'docs', `${lang}.md`), text);
    };
    write('01-vectors', 'en', '# Vectors\n\nEnglish body.');
    write('01-vectors', 'es', '# Vectores\n\nTexto traducido.');
    write('02-planned', 'en', '# Planned\n\nNot yet.');
    const base = 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math/';
    const phases = [{ id: 1, name: 'Math', lessons: [
      { name: 'Vectors', status: 'complete', url: `${base}01-vectors/` },
      { name: 'Vectors again', status: 'complete', url: `${base}01-vectors/` },
      { name: 'Planned', status: 'planned', url: `${base}02-planned/` },
      { name: 'Missing', status: 'complete', url: `${base}03-missing/` },
      { name: 'No path', status: 'complete', url: '' },
    ] }];
    const records = lessonSearchRecords({ repoRoot: repo, phases });
    assert.deepEqual(records.map(record => [record.url, record.meta.title, record.filters.phase[0]]), [['/lesson?path=phases%2F01-math%2F01-vectors', 'Vectors', 'Math']]);
    assert.equal(records[0].content.includes('traducido'), false);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('a term found only in a lesson body returns that lesson from a built index', async t => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-index-'));
  const saved = { fetch: globalThis.fetch, window: globalThis.window, location: globalThis.location };
  try {
    const records = [
      lessonRecord({ lessonPath: 'phases/03-deep-learning-core/01-the-perceptron', title: 'The Perceptron', phase: 'Deep Learning Core', markdown: LESSON_MD }),
      lessonRecord({ lessonPath: 'phases/01-math/01-vectors', title: 'Vectors', phase: 'Math', markdown: '# Vectors\n\nA vector has a size and a direction.' }),
    ];
    const built = await buildSearchIndex({ siteDir: site, records });
    if (built.skipped) return t.skip('pagefind is not installed');
    fs.writeFileSync(path.join(site, 'package.json'), '{"type":"module"}');
    const dir = pathToFileURL(path.join(site, 'pagefind') + '/');
    globalThis.window = globalThis;
    globalThis.location = new URL(dir.href);
    globalThis.fetch = async url => new Response(fs.readFileSync(new URL(String(url), dir)));
    const pagefind = await import(new URL('pagefind.js', dir).href);
    await pagefind.options({ basePath: dir.href, baseUrl: '/' });
    await pagefind.init();
    const found = await pagefind.search('zorbification');
    const data = await Promise.all(found.results.map(result => result.data()));
    assert.deepEqual(data.map(item => [item.url, item.meta.title, item.filters.type[0]]), [['/lesson?path=phases%2F03-deep-learning-core%2F01-the-perceptron', 'The Perceptron Lesson', 'Lesson']]);
    assert.equal((await pagefind.search('secret_fence_token')).results.length, 0);
    await pagefind.destroy();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test('the palette turns Pagefind lesson records into lessons and shows each lesson once', () => {
  const lessonPath = 'phases/03-deep-learning-core/01-the-perceptron';
  const local = [{ kind: 'lesson', name: 'The Perceptron', phaseId: 3, lessonPath, url: `https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/${lessonPath}/` }];
  const record = { url: `/lesson?path=${encodeURIComponent(lessonPath)}`, meta: { title: 'The Perceptron, renamed' }, excerpt: 'a <mark>weighted</mark> sum', filters: { type: ['Lesson'], phase: ['Deep Learning Core'] } };
  const other = { url: '/lesson?path=phases%2F01-math%2F01-vectors', meta: { title: 'Vectors' }, excerpt: 'size', filters: { type: ['Lesson'], phase: ['Math'] } };
  const sheet = { url: '/cheatsheets/perceptron', meta: { title: 'Perceptron' }, excerpt: '', filters: { type: ['Cheat sheet'] } };
  const item = palette.pageItem(record);
  assert.equal(item.kind, 'lesson');
  assert.equal(item.lessonPath, lessonPath);
  assert.equal(item.pageType, 'Lesson');
  assert.equal(item.phaseName, 'Deep Learning Core');
  assert.equal(palette.pageItem(sheet).kind, 'page');
  const merged = palette.mergePages(local, [record, other, other, sheet]);
  assert.deepEqual(merged.map(entry => [entry.kind, entry.lessonPath || entry.url]), [
    ['lesson', lessonPath],
    ['lesson', 'phases/01-math/01-vectors'],
    ['page', '/cheatsheets/perceptron'],
  ]);
  assert.equal(merged[0], local[0]);
  assert.equal(palette.lessonPathFromUrl('/lesson?path=..%2Fsecret'), '');
  assert.equal(palette.lessonChip(item), 'Lesson');
  assert.deepEqual(palette.lessonMeta(item), ['Deep Learning Core']);
  assert.equal(palette.lessonChip(local[0]), 'Phase 03');
  assert.deepEqual(palette.lessonMeta({ ...local[0], type: 'Build', lang: 'Python', phaseName: 'Deep Learning Core' }), ['Build', 'Python']);
  const many = Array.from({ length: 8 }, (_, index) => ({ url: `/practice/p${index}`, meta: { title: `P${index}` }, excerpt: '', filters: { type: ['Practice'] } }));
  const limited = palette.mergePages(local, [record].concat(many), 6);
  assert.equal(limited.length, 7);
  assert.deepEqual(limited.slice(1).map(entry => entry.url), many.slice(0, 6).map(entry => entry.url));
});

test('the palette loads Pagefind hits in batches until the extra results are full', async () => {
  const lessonPath = 'phases/01-math/01-vectors';
  const local = [{ kind: 'lesson', name: 'Vectors', phaseId: 1, lessonPath, url: '' }];
  const hit = data => ({ loaded: 0, data() { this.loaded += 1; return Promise.resolve(data); } });
  const dupes = Array.from({ length: 7 }, () => hit({ url: `/lesson?path=${encodeURIComponent(lessonPath)}`, meta: { title: 'Vectors' }, excerpt: '', filters: { type: ['Lesson'], phase: ['Math'] } }));
  const unique = Array.from({ length: 9 }, (_, index) => hit({ url: `/practice/p${index}`, meta: { title: `P${index}` }, excerpt: '', filters: { type: ['Practice'] } }));
  const results = dupes.concat(unique);
  const pages = await palette.loadPageBatches(results, local, 3, () => true);
  assert.equal(pages.length, 12);
  assert.deepEqual(palette.mergePages(local, pages, 3).slice(1).map(entry => entry.url), ['/practice/p0', '/practice/p1', '/practice/p2']);
  assert.equal(results.slice(12).some(result => result.loaded), false);
  assert.deepEqual(await palette.loadPageBatches(results, local, 3, () => false), []);
});
