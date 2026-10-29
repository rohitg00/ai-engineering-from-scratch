'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const skillDir = path.join(root, 'skills', 'lesson-screen');
const script = path.join(skillDir, 'scripts', 'lesson-screen.mjs');

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-screen-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
  });
}

function post(url, { headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

test('publish copies a built page as the next screen and keeps its title', (t) => {
  const cwd = tmpdir(t);
  const page = path.join(cwd, 'build.html');
  fs.writeFileSync(page, '<!doctype html><html><head><title>Speculative decoding machine</title></head><body><h1></h1><p>x</p></body></html>');
  const first = JSON.parse(execFileSync(process.execPath, [script, 'publish', page], { cwd, encoding: 'utf8' }));
  assert.equal(first.type, 'screen');
  assert.equal(first.name, '01-speculative-decoding-machine.html');
  assert.equal(fs.readFileSync(first.file, 'utf8'), fs.readFileSync(page, 'utf8'));
  const second = JSON.parse(execFileSync(process.execPath, [script, 'publish', page, '--name', 'Draft Verify!'], { cwd, encoding: 'utf8' }));
  assert.equal(second.name, '02-draft-verify.html');
  let threw = null;
  try {
    execFileSync(process.execPath, [script, 'publish', path.join(cwd, 'missing.html')], { cwd, encoding: 'utf8' });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.status, 1);
  assert.equal(JSON.parse(threw.stderr).type, 'error');
});

test('findChrome honours an explicit path and fails with a clear message', async (t) => {
  const { findChrome } = await import(script);
  const dir = tmpdir(t);
  const fake = path.join(dir, 'chrome');
  fs.writeFileSync(fake, '');
  assert.equal(findChrome({ chrome: fake }), fake);
  assert.equal(findChrome({ env: { CHROME_PATH: fake } }), fake);
  assert.throws(() => findChrome({ chrome: path.join(dir, 'nope') }), /no browser at/);
  assert.throws(() => findChrome({ env: { PATH: dir + '-empty' }, platform: 'linux' }), /no Chrome, Chromium, or Edge found/);
});

test('the server gates, serves, records events and shuts down', async (t) => {
  const dir = tmpdir(t);
  const { createServer, readEvents } = await import(script);
  const srv = await createServer({ dir });
  t.after(() => srv.close());
  const { port, key, origin } = srv;
  const cookie = `lesson_screen_${port}=${key}`;

  const noKey = [
    await get(`${origin}/`),
    await get(`${origin}/screens`),
    await get(`${origin}/s/x.html`),
    await post(`${origin}/event`, { headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  ];
  for (const res of noKey) assert.equal(res.status, 403);
  assert.equal((await get(`${origin}/health`)).status, 200);
  assert.equal((await get(`${origin}/live`)).status, 403);

  const home = await get(`${origin}/?key=${key}`);
  assert.equal(home.status, 200);
  const setCookie = (home.headers['set-cookie'] || []).join('; ');
  assert.match(setCookie, new RegExp(`lesson_screen_${port}=`));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(home.headers['content-security-policy'], /connect-src 'self'/);

  const viaCookie = await get(`${origin}/screens`, { Cookie: cookie });
  assert.equal(viaCookie.status, 200);
  const viaHeader = await get(`${origin}/screens`, { 'x-lesson-screen-key': key });
  assert.equal(viaHeader.status, 200);

  const screensDir = path.join(dir, 'screens');
  fs.writeFileSync(path.join(screensDir, '01-frag.html'), '<p class="ls-eyebrow">Phase 00</p><h2>Fragment title</h2><p>fragment body text</p>');
  const frag = await get(`${origin}/s/01-frag.html`, { Cookie: cookie });
  assert.equal(frag.status, 200);
  const fragKeyed = await get(`${origin}/s/01-frag.html?key=${key}`);
  assert.match((fragKeyed.headers['set-cookie'] || []).join('; '), new RegExp(`lesson_screen_${port}=`));
  assert.match(frag.headers['content-security-policy'], /connect-src 'self'/);
  assert.ok(frag.body.includes('--blueprint'), 'frame tokens present');
  assert.ok(frag.body.includes('fragment body text'));
  assert.ok(frag.body.includes('/helper.js'));
  assert.ok(frag.body.includes('<title>Fragment title</title>'));

  fs.writeFileSync(path.join(screensDir, '02-full.html'), '<!doctype html><html><head><title>Full</title></head><body><p>full page</p></body></html>');
  const full = await get(`${origin}/s/02-full.html`, { Cookie: cookie });
  assert.equal(full.status, 200);
  assert.ok(full.body.includes('<p>full page</p>'));
  assert.equal(full.body.split('/helper.js').length - 1, 1);

  assert.equal((await get(`${origin}/s/..%2Fstate%2Fserver.json`, { Cookie: cookie })).status, 404);
  assert.equal((await get(`${origin}/s/.hidden.html`, { Cookie: cookie })).status, 404);
  const outside = path.join(dir, 'outside.html');
  fs.writeFileSync(outside, '<p>secret</p>');
  fs.symlinkSync(outside, path.join(screensDir, '03-link.html'));
  assert.equal((await get(`${origin}/s/03-link.html`, { Cookie: cookie })).status, 404);

  const goodEvent = await post(`${origin}/event`, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'choice', screen: '01-frag.html', question: 'q', choice: 'A', text: 'A option', extra: 'dropped' }),
  });
  assert.equal(goodEvent.status, 204);
  const events = readEvents(dir, {});
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'choice');
  assert.equal(events[0].screen, '01-frag.html');
  assert.equal(events[0].question, 'q');
  assert.equal(events[0].choice, 'A');
  assert.equal(events[0].text, 'A option');
  assert.ok(events[0].at);
  assert.ok(!('extra' in events[0]));
  assert.equal(readEvents(dir, {}).length, 0);
  assert.ok(readEvents(dir, { all: true }).length >= 1);

  const badOrigin = await post(`${origin}/event`, {
    headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example', Cookie: cookie },
    body: JSON.stringify({ type: 'note', text: 'x' }),
  });
  assert.equal(badOrigin.status, 403);
  const badType = await post(`${origin}/event`, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'nope' }),
  });
  assert.equal(badType.status, 400);
  const nonJson = await post(`${origin}/event`, {
    headers: { 'Content-Type': 'text/plain', Cookie: cookie },
    body: 'hello',
  });
  assert.equal(nonJson.status, 400);
  const tooBig = await post(`${origin}/event`, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'note', text: 'x'.repeat(9000) }),
  });
  assert.equal(tooBig.status, 413);

  for (const assetPath of ['/figures-transformers.js', '/s/figures-transformers.js', '/lesson-figures.js']) {
    const res = await get(`${origin}${assetPath}`, { Cookie: cookie });
    assert.equal(res.status, 302, assetPath);
    const file = assetPath.split('/').pop();
    assert.equal(res.headers.location, `https://aiengineeringfromscratch.com/${file}`);
  }
  assert.equal((await get(`${origin}/figures-../x.js`, { Cookie: cookie })).status, 404);
  assert.equal((await get(`${origin}/favicon.ico`)).status, 204);
  const crossStop = await post(`${origin}/shutdown`, { headers: { Origin: 'http://127.0.0.1:1', Cookie: cookie } });
  assert.equal(crossStop.status, 403);
  assert.equal((await get(`${origin}/health`)).status, 200);
  fs.writeFileSync(path.join(screensDir, '05-résumé.html'), '<h2>Bad name</h2>');
  fs.writeFileSync(path.join(screensDir, '04-built.html'), '<!doctype html><html><head><title>Built page</title></head><body><h1></h1></body></html>');
  const list = JSON.parse((await get(`${origin}/screens`, { Cookie: cookie })).body);
  assert.equal(list.screens.find((r) => r.name === '04-built.html').title, 'Built page');
  assert.ok(!list.screens.some((r) => r.name.startsWith('05-')), 'names the server cannot serve are not listed');
});

test('the server lists screens over SSE and honours local assets', async (t) => {
  const dir = tmpdir(t);
  const repo = path.join(dir, 'clone');
  fs.mkdirSync(path.join(repo, 'site'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'site', 'lesson-figures.js'), 'window.lessonFiguresLocal = true;');

  const { createServer } = await import(script);
  const srv = await createServer({ dir: path.join(dir, 'ls'), assets: 'local', repo });
  t.after(() => srv.close());
  const { port, key, origin } = srv;
  const cookie = `lesson_screen_${port}=${key}`;

  const local = await get(`${origin}/lesson-figures.js`, { Cookie: cookie });
  assert.equal(local.status, 200);
  assert.ok(local.body.includes('lessonFiguresLocal'));
  assert.equal((await get(`${origin}/figure-manifest.js`, { Cookie: cookie })).status, 404);

  const sse = await new Promise((resolve, reject) => {
    const req = http.get(`${origin}/live`, { headers: { Cookie: cookie } }, (res) => {
      let buf = '';
      let wrote = false;
      res.on('data', (c) => {
        buf += c.toString('utf8');
        if (!wrote && buf.includes('event: screens')) {
          wrote = true;
          fs.writeFileSync(path.join(dir, 'ls', 'screens', '01-new.html'), '<h2>Late screen</h2>');
        }
        if (buf.includes('01-new.html')) {
          req.destroy();
          resolve(buf);
        }
      });
      res.on('end', () => reject(new Error('stream ended early')));
    });
    req.on('error', (e) => {
      if (e.code === 'ECONNRESET') return;
      reject(e);
    });
    setTimeout(() => {
      req.destroy();
      reject(new Error('no screens update within 8s'));
    }, 8000).unref();
  });
  assert.ok(sse.includes('01-new.html'));
});

test('the server idles out and stops on demand', async (t) => {
  const { createServer } = await import(script);
  const dirA = tmpdir(t);
  const idleSrv = await createServer({ dir: dirA, idleMs: 300 });
  const stoppedFile = path.join(dirA, 'state', 'stopped');
  for (let waited = 0; !fs.existsSync(stoppedFile) && waited < 8000; waited += 100) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 100));
  const stopped = JSON.parse(fs.readFileSync(stoppedFile, 'utf8'));
  assert.equal(stopped.reason, 'idle');
  const health = await get(`${idleSrv.origin}/health`).then(() => 'up').catch(() => 'down');
  assert.equal(health, 'down');

  const dirB = tmpdir(t);
  const srv = await createServer({ dir: dirB });
  t.after(() => srv.close());
  const res = await post(`${srv.origin}/shutdown`, { headers: { 'x-lesson-screen-key': srv.key } });
  assert.equal(res.status, 204);
  let after = 'up';
  for (let waited = 0; after === 'up' && waited < 5000; waited += 100) {
    await new Promise((r) => setTimeout(r, 100));
    after = await get(`${srv.origin}/health`).then(() => 'up').catch(() => 'down');
  }
  assert.equal(after, 'down');
});

test('the frame pins mermaid, defines every token, and styles every documented class', () => {
  const frame = fs.readFileSync(path.join(skillDir, 'templates', 'frame.html'), 'utf8');
  assert.ok(frame.includes('mermaid@11.17.2'));
  const tokens = ['--bg', '--bg-surface', '--ink', '--ink-soft', '--ink-mute', '--rule-soft', '--blueprint', '--blueprint-tint', '--blueprint-tint-strong', '--warn'];
  const light = /:root\s*\{([\s\S]*?)\}/.exec(frame)[1];
  const dark = /\[data-theme="dark"\]\s*\{([\s\S]*?)\}/.exec(frame)[1];
  for (const token of tokens) {
    assert.ok(light.includes(`${token}:`), `light ${token}`);
    assert.ok(dark.includes(`${token}:`), `dark ${token}`);
  }
  const doc = fs.readFileSync(path.join(skillDir, 'references', 'screens.md'), 'utf8');
  const classes = [...doc.matchAll(/^\| `(ls-[a-z-]+)` \|/gm)].map((m) => m[1]);
  assert.ok(classes.length >= 15);
  for (const name of classes) assert.ok(frame.includes(`.${name}`), `frame styles .${name}`);
});

test('the shot command captures a real page when a browser is installed', async (t) => {
  const { findChrome, takeShot } = await import(script);
  try {
    findChrome({});
  } catch {
    t.skip('no Chrome, Chromium, or Edge on this machine');
    return;
  }
  const dir = tmpdir(t);
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, '<!doctype html><html><head><title>t</title><script>document.documentElement.dataset.theme = localStorage.getItem("theme");</script></head><body><p>shot</p><script>console.error("boom")</script></body></html>');
  const out = path.join(dir, 'page.png');
  const result = await takeShot({ url: `file://${page}`, out, width: 400, height: 300, theme: 'dark', wait: 100 });
  const png = fs.readFileSync(out);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(png.readUInt32BE(16), 400);
  assert.equal(png.readUInt32BE(20), 300);
  assert.ok(result.errors.some((e) => e.includes('boom')), JSON.stringify(result.errors));
});

test('the tutor skills point at the lesson screen', () => {
  const tutors = ['learn', 'learn-mcp', 'learn-agent-skills', 'learn-reverse-engineering', 'claude-certification', 'mcpa-certification'];
  for (const name of tutors) {
    const text = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.ok(text.includes('lesson-screen'), name);
    assert.ok(text.includes('never count as quiz answers'), name);
  }
});

test('redact hides session keys and IPv6 hosts get brackets', async () => {
  const { redact, urlHost } = await import(script);
  assert.equal(redact('http://127.0.0.1:4777/s/a.html?key=d90f3dccaed5eca0a89d47d69d2a384655e5ce3bd1b23b15'), 'http://127.0.0.1:4777/s/a.html?key=...');
  assert.equal(urlHost('::1'), '[::1]');
  assert.equal(urlHost('[::1]'), '[::1]');
  assert.equal(urlHost('127.0.0.1'), '127.0.0.1');
});

test('the CLI starts, reports, and stops a background server', (t) => {
  const cwd = tmpdir(t);
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' }));
  t.after(() => {
    try {
      execFileSync(process.execPath, [script, 'stop'], { cwd, encoding: 'utf8' });
    } catch {}
  });
  const started = run('start');
  assert.equal(started.type, 'started');
  assert.match(started.url, /^http:\/\/127\.0\.0\.1:\d+\/\?key=[0-9a-f]{48}$/);
  assert.equal(run('start').type, 'running');
  const status = run('status');
  assert.equal(status.running, true);
  assert.equal(status.next, '01');
  assert.deepEqual(run('stop'), { type: 'stopped', running: true });
  assert.equal(run('status').running, false);
});

test('shot captures a full page in a folder that has no session yet', async (t) => {
  const { findChrome } = await import(script);
  try {
    findChrome({});
  } catch {
    t.skip('no Chrome, Chromium, or Edge on this machine');
    return;
  }
  const cwd = tmpdir(t);
  fs.writeFileSync(path.join(cwd, 'page.html'), '<!doctype html><html><head><title>p</title></head><body><p>alone</p></body></html>');
  const result = JSON.parse(execFileSync(process.execPath, [script, 'shot', 'page.html?step=2', '--width', '320', '--height', '240', '--wait', '50'], { cwd, encoding: 'utf8' }));
  assert.equal(result.type, 'shot');
  assert.ok(result.url.endsWith('page.html?step=2'));
  assert.ok(fs.existsSync(result.file));
});

const LESSON_MD = [
  '# Tiny Lesson',
  '',
  '> A hook with $\\alpha$ and `code`.',
  '',
  '**Type:** Build',
  '**Languages:** Python',
  '',
  '## Learning Objectives',
  '- Explain why scaling by $\\sqrt{d_k}$ helps',
  '- Build the thing',
  '',
  '## Exercises',
  '',
  '1. **Easy.** Run `code/main.py` and read the output.',
  '',
  '## Key Terms',
  '',
  '| Term | What people say | What it actually means |',
  '|------|-----------------|------------------------|',
  '| Alpha | "the rate" | Chance that a draft is kept |',
  '| Beta | "the other" | A pipe `a|b` inside code |',
  '| Gamma | "third" | The third meaning |',
  '| Delta | "fourth" | The fourth meaning |',
  '| Epsilon | "fifth" | The fifth meaning |',
  '',
  '## Further Reading',
  '',
  '- [A paper](https://arxiv.org/abs/1) and notes',
  '- No link here',
  '',
].join('\n');

test('parseLesson reads the parts a practice page needs', async () => {
  const { parseLesson } = await import(script);
  const info = parseLesson(LESSON_MD);
  assert.equal(info.title, 'Tiny Lesson');
  assert.equal(info.hook, 'A hook with α and code.');
  assert.deepEqual(info.languages, ['python']);
  assert.deepEqual(info.objectives, ['Explain why scaling by sqrt(d_k) helps', 'Build the thing']);
  assert.equal(info.terms.length, 5);
  assert.deepEqual(info.terms[1], { term: 'Beta', means: 'A pipe a|b inside code' });
  assert.equal(info.exercise, 'Run code/main.py and read the output.');
  assert.deepEqual(info.reading, [{ text: 'A paper', url: 'https://arxiv.org/abs/1' }]);
});

test('quiz questions accept the course schema and term questions are stable', async () => {
  const { quizQuestions, termQuestions, parseLesson } = await import(script);
  const one = { stage: 'post', question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 2, explanation: 'because' };
  assert.equal(quizQuestions({ questions: [one] }).length, 1);
  assert.equal(quizQuestions([one]).length, 1);
  assert.equal(quizQuestions({ questions: [{ q: 'old', choices: ['a'], answer: 0 }] }).length, 0);
  assert.equal(quizQuestions({ questions: [{ ...one, correct: 9 }] }).length, 0);
  const terms = parseLesson(LESSON_MD).terms;
  const a = termQuestions(terms, 'phases/99-x/01-y');
  assert.deepEqual(a, termQuestions(terms, 'phases/99-x/01-y'));
  assert.equal(a.length, 4);
  for (const q of a) {
    assert.equal(q.options.length, 4);
    assert.ok(q.q.includes(terms.find((t) => t.term === q.options[q.correct]).means));
  }
  assert.deepEqual(termQuestions(terms.slice(0, 3), 'x'), []);
});

test('the practice command writes a self-graded page from a clone', (t) => {
  const cwd = tmpdir(t);
  const lesson = 'phases/99-test-phase/01-tiny-lesson';
  fs.mkdirSync(path.join(cwd, lesson, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, lesson, 'docs', 'en.md'), LESSON_MD.replace('Tiny Lesson', 'Tiny </script> Lesson').replace('**Languages:** Python', '**Languages:** Python (stdlib)'));
  fs.mkdirSync(path.join(cwd, lesson, 'code'), { recursive: true });
  fs.writeFileSync(path.join(cwd, lesson, 'code', 'main.py'), 'print(1)\n');
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [script, 'practice', ...args], { cwd, encoding: 'utf8' }));
  const fromTerms = run(lesson);
  assert.equal(fromTerms.source, 'terms');
  assert.equal(fromTerms.from, 'clone');
  assert.equal(fromTerms.name, '01-practice-tiny-lesson.html');
  fs.writeFileSync(path.join(cwd, lesson, 'quiz.json'), JSON.stringify({ lesson: '01-tiny-lesson', title: 'Tiny', questions: [{ stage: 'pre', question: 'Q1?', options: ['a', 'b', 'c', 'd'], correct: 1, explanation: 'e' }] }));
  const fromQuiz = run(lesson + '/', '--name', 'Practice Tiny');
  assert.equal(fromQuiz.source, 'quiz');
  assert.equal(fromQuiz.questions, 1);
  assert.equal(fromQuiz.name, '02-practice-tiny.html');
  const html = fs.readFileSync(fromQuiz.file, 'utf8');
  assert.ok(html.includes('<title>Practice: Tiny &lt;/script&gt; Lesson</title>'));
  const block = /<script id="practice-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.ok(!block.includes('</script>'));
  const data = JSON.parse(block);
  assert.equal(data.run, `cd "${path.join(fs.realpathSync(cwd), lesson, 'code')}" && python3 main.py`);
  assert.equal(data.runFrom, 'clone');
  assert.ok(data.questions.every((q) => q.id.startsWith(lesson + '#')));
  assert.equal(data.web, `https://aiengineeringfromscratch.com/lesson?path=${lesson}`);
  let threw = null;
  try {
    execFileSync(process.execPath, [script, 'practice', 'not/a/lesson'], { cwd, encoding: 'utf8' });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(JSON.parse(threw.stderr).type, 'error');
});

test('the practice page reads a real lesson and never reports answers to the tutor', (t) => {
  const cwd = tmpdir(t);
  const out = JSON.parse(execFileSync(process.execPath, [script, 'practice', 'phases/07-transformers-deep-dive/02-self-attention-from-scratch', '--repo', root], { cwd, encoding: 'utf8' }));
  assert.equal(out.source, 'quiz');
  assert.ok(out.questions >= 4);
  const template = fs.readFileSync(path.join(skillDir, 'templates', 'practice.html'), 'utf8');
  assert.ok(!template.includes('lessonScreen'), 'practice answers stay in the browser');
  assert.ok(!template.includes('/event'));
  assert.equal(template.split('__PRACTICE_DATA__').length - 1, 1);
});

test('practice text keeps math relations, distinct options, and masks the term', async () => {
  const { parseLesson, quizQuestions, termQuestions } = await import(script);
  const info = parseLesson('# T\n\n## Learning Objectives\n- Compare $a \\le b$ with $a \\ge b$ and $x \\neq y$ using $\\text{softmax}$ and $\\foo$\n');
  assert.deepEqual(info.objectives, ['Compare a ≤ b with a ≥ b and x ≠ y using softmax and foo']);
  assert.deepEqual(quizQuestions([{ question: 'q', options: ['**MCP**', 'MCP'], correct: 0 }])[0].options, ['**MCP**', 'MCP']);
  const terms = [{ term: 'KV cache', means: 'The KV cache stores keys' }, { term: 'B', means: 'b' }, { term: 'C', means: 'c' }, { term: 'D', means: 'd' }];
  const kv = termQuestions(terms, 'phases/99-x/01-y').find((q) => q.id === 'phases/99-x/01-y#term:KV cache');
  assert.equal(kv.q, 'The ____ stores keys');
});
