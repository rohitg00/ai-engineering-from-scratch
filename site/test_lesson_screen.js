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
const specModule = path.join(skillDir, 'scripts', 'machine-spec.mjs');
const EXAMPLES = ['transformer-block', 'agent-loop'];

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-screen-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function baseSpec() {
  return {
    title: 'Tiny machine',
    question: 'What moves?',
    bigIdea: 'One part feeds another.',
    parts: [
      { id: 'a', label: 'Part A', explain: 'first', shape: 'box', size: [1, 1, 1], at: [0, 0, 0], material: 'metal' },
      { id: 'b', label: 'Part B', explain: 'second', shape: 'sphere', size: [1], at: [2, 0, 0], material: 'plastic' },
    ],
    steps: [{ title: 'Go', say: 'it moves' }],
  };
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

test('checkMachine accepts both shipped examples and fills defaults', async (t) => {
  const { checkMachine } = await import(specModule);
  for (const name of EXAMPLES) {
    const spec = JSON.parse(fs.readFileSync(path.join(skillDir, 'examples', `${name}.json`), 'utf8'));
    const result = checkMachine(spec);
    assert.ok(result.ok, `${name}: ${result.errors.join(', ')}`);
  }
  const metal = checkMachine(baseSpec());
  assert.equal(metal.spec.parts[0].tone, 'steel');
  assert.equal(metal.spec.parts[1].tone, 'ink');
  assert.deepEqual(metal.spec.parts[0].rotate, [0, 0, 0]);
  assert.deepEqual(metal.spec.parts[0].explode, [0, 0, 0]);
  assert.equal(metal.spec.steps[0].view, 'iso');
  assert.equal(metal.spec.steps[0].explode, 0);
  assert.deepEqual(metal.spec.flows, []);
  assert.deepEqual(metal.spec.readouts, []);
  const glass = checkMachine({
    ...baseSpec(),
    parts: [{ id: 'g', label: 'G', explain: 'e', shape: 'slab', size: [1, 1, 1], at: [0, 0, 0], material: 'glass' }],
  });
  assert.equal(glass.spec.parts[0].tone, 'paper');
  const glow = checkMachine({
    ...baseSpec(),
    parts: [{ id: 'g', label: 'G', explain: 'e', shape: 'slab', size: [1, 1, 1], at: [0, 0, 0], material: 'glow' }],
  });
  assert.equal(glow.spec.parts[0].tone, 'accent');
});

test('checkMachine reports precise paths for each failure', async (t) => {
  const { checkMachine } = await import(specModule);
  const cases = [
    [{ ...baseSpec(), parts: [baseSpec().parts[0], baseSpec().parts[0]] }, 'parts[1].id', 'already used'],
    [{ ...baseSpec(), flows: [{ id: 'f', from: 'a', to: 'zzz' }] }, 'flows[0].to', 'not a part id'],
    [{ ...baseSpec(), flows: [{ id: 'f', from: 'a', to: 'a' }] }, 'flows[0].to', 'same part'],
    [{ ...baseSpec(), steps: [{ title: 's', say: 's', focus: ['ghost'] }] }, 'steps[0].focus[0]', 'not a part id'],
    [{ ...baseSpec(), steps: [{ title: 's', say: 's', readouts: { ghost: '1' } }] }, 'steps[0].readouts.ghost', 'not a readout id'],
    [{ ...baseSpec(), parts: [{ ...baseSpec().parts[0], size: [1, 1] }] }, 'parts[0].size', '3 numbers'],
    [{ ...baseSpec(), parts: [{ ...baseSpec().parts[0], size: [1, 30, 1] }] }, 'parts[0].size[1]', 'between 0.02 and 20'],
    [{ ...baseSpec(), parts: [{ ...baseSpec().parts[0], shape: 'torus', size: [1, 1] }] }, 'parts[0].size', 'smaller than radius'],
    [{ ...baseSpec(), parts: [{ ...baseSpec().parts[0], colour: 'red' }] }, 'parts[0].colour', 'unknown key'],
    [{ ...baseSpec(), parts: Array.from({ length: 49 }, (_, i) => ({ ...baseSpec().parts[0], id: `p${i}` })) }, 'parts', '48'],
    [{ ...baseSpec(), steps: [] }, 'steps', '1 to 10'],
    [{ ...baseSpec(), parts: [{ ...baseSpec().parts[0], tone: 'pink' }] }, 'parts[0].tone', 'not a tone'],
    [{ ...baseSpec(), parts: [{ ...baseSpec().parts[0], label: 'x'.repeat(33) }] }, 'parts[0].label', '32'],
  ];
  for (const [spec, prefix, phrase] of cases) {
    const result = checkMachine(spec);
    assert.ok(!result.ok, `${prefix} should fail`);
    assert.ok(
      result.errors.some((e) => e.startsWith(`${prefix}:`) && e.includes(phrase)),
      `${prefix} ~ ${phrase} in ${JSON.stringify(result.errors)}`,
    );
  }
});

test('the CLI checks and writes machine screens', (t) => {
  const cwd = tmpdir(t);
  const specFile = path.join(cwd, 'ok.json');
  fs.writeFileSync(specFile, JSON.stringify(baseSpec()));

  const bad = path.join(cwd, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ ...baseSpec(), parts: [] }));
  let threw = null;
  try {
    execFileSync(process.execPath, [script, 'check', bad], { cwd, encoding: 'utf8' });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.status, 1);
  const err = JSON.parse(threw.stderr);
  assert.equal(err.type, 'invalid');
  assert.ok(Array.isArray(err.errors) && err.errors.length > 0);

  const okOut = execFileSync(process.execPath, [script, 'check', specFile], { cwd, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(okOut), { type: 'valid' });

  const m1 = JSON.parse(execFileSync(process.execPath, [script, 'machine', specFile, '--name', 'First Machine!'], { cwd, encoding: 'utf8' }));
  const m2 = JSON.parse(execFileSync(process.execPath, [script, 'machine', specFile], { cwd, encoding: 'utf8' }));
  assert.match(m1.name, /^01-first-machine\.html$/);
  assert.match(m2.name, /^02-tiny-machine\.html$/);
  assert.ok(fs.existsSync(m1.file));
  assert.ok(fs.existsSync(m2.file));
});

test('machine screens escape the spec inside the script block', (t) => {
  const cwd = tmpdir(t);
  const spec = baseSpec();
  spec.parts[0].label = 'a</script><b>x</script>';
  const specFile = path.join(cwd, 'evil.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const out = JSON.parse(execFileSync(process.execPath, [script, 'machine', specFile], { cwd, encoding: 'utf8' }));
  const html = fs.readFileSync(out.file, 'utf8');
  assert.ok(!html.includes('__MACHINE_SPEC__'));
  const block = /<script id="machine-spec"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(block, 'spec block found');
  assert.ok(!block[1].includes('</script>'), 'no script closer inside the JSON');
  assert.ok(block[1].includes('\\u003c/script>'), 'angle bracket escaped');
  const parsed = JSON.parse(block[1]);
  assert.equal(parsed.parts[0].label, 'a</script><b>x</script>');
  assert.ok(html.includes('<title>Tiny machine</title>'));
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
  const { writeMachineScreen } = await import(script);
  writeMachineScreen(dir, baseSpec(), 'machine-one');
  const list = JSON.parse((await get(`${origin}/screens`, { Cookie: cookie })).body);
  const row = list.screens.find((r) => r.name.includes('machine-one'));
  assert.equal(row.title, 'Tiny machine');
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
      reject(new Error('no screens update within 3s'));
    }, 3000).unref();
  });
  assert.ok(sse.includes('01-new.html'));
});

test('the server idles out and stops on demand', async (t) => {
  const { createServer } = await import(script);
  const dirA = tmpdir(t);
  const idleSrv = await createServer({ dir: dirA, idleMs: 300 });
  await new Promise((r) => setTimeout(r, 1200));
  const stopped = JSON.parse(fs.readFileSync(path.join(dirA, 'state', 'stopped'), 'utf8'));
  assert.equal(stopped.reason, 'idle');
  const health = await get(`${idleSrv.origin}/health`).then(() => 'up').catch(() => 'down');
  assert.equal(health, 'down');

  const dirB = tmpdir(t);
  const srv = await createServer({ dir: dirB });
  t.after(() => srv.close());
  const res = await post(`${srv.origin}/shutdown`, { headers: { 'x-lesson-screen-key': srv.key } });
  assert.equal(res.status, 204);
  await new Promise((r) => setTimeout(r, 400));
  const after = await get(`${srv.origin}/health`).then(() => 'up').catch(() => 'down');
  assert.equal(after, 'down');
});

test('templates pin the exact CDN versions and define every token', (t) => {
  const machine = fs.readFileSync(path.join(skillDir, 'templates', 'machine.html'), 'utf8');
  const frame = fs.readFileSync(path.join(skillDir, 'templates', 'frame.html'), 'utf8');

  const threeRefs = machine.match(/three@[0-9a-z.^~*x-]+/gi) || [];
  assert.ok(threeRefs.length > 0);
  for (const ref of threeRefs) assert.equal(ref, 'three@0.186.1');
  assert.equal(machine.split('__MACHINE_SPEC__').length - 1, 1);
  assert.ok(frame.includes('mermaid@11.17.2'));

  const tokens = ['--bg', '--bg-surface', '--ink', '--ink-soft', '--ink-mute', '--rule-soft', '--blueprint', '--blueprint-tint', '--blueprint-tint-strong', '--warn'];
  for (const [name, text] of [['frame.html', frame], ['machine.html', machine]]) {
    const light = /:root\s*\{([\s\S]*?)\}/.exec(text)[1];
    const dark = /\[data-theme="dark"\]\s*\{([\s\S]*?)\}/.exec(text)[1];
    for (const token of tokens) {
      assert.ok(light.includes(`${token}:`), `${name} light ${token}`);
      assert.ok(dark.includes(`${token}:`), `${name} dark ${token}`);
    }
  }
});

test('the tutor skills point at the lesson screen', () => {
  const tutors = ['learn', 'learn-mcp', 'learn-agent-skills', 'learn-reverse-engineering', 'claude-certification', 'mcpa-certification'];
  for (const name of tutors) {
    const text = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.ok(text.includes('lesson-screen'), name);
    assert.ok(text.includes('never count as quiz answers'), name);
  }
});
