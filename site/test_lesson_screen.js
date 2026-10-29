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
  fs.writeFileSync(path.join(screensDir, '04-built.html'), '<!doctype html><html><head><title>Built page</title></head><body><h1></h1></body></html>');
  const list = JSON.parse((await get(`${origin}/screens`, { Cookie: cookie })).body);
  assert.equal(list.screens.find((r) => r.name === '04-built.html').title, 'Built page');
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
