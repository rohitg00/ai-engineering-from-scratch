const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const page = path.join(__dirname, 'inside-an-ai-agent.html');
const load = () => import(path.join(root, 'scripts', 'agent-machine', 'model.mjs'));
const types = (run) => run.events.map((event) => event.type).join(' ');

test('a healthy run retrieves both invoices, calls the calculator once and verifies 25.0%', async () => {
  const M = await load();
  const run = M.simulate();
  assert.equal(types(run), 'intake memory retrieve model schema permit execute observe model verify exit');
  assert.deepEqual(run.events[2].docs, ['inv-2026-04', 'inv-2026-05']);
  const execute = run.events.find((event) => event.type === 'execute');
  assert.deepEqual(execute.result, { diff: 3100, pct: 25 });
  assert.equal(run.outcome.status, 'verified');
  assert.equal(run.outcome.correct, true);
  assert.match(run.outcome.text, /\$3,100/);
  assert.match(run.outcome.text, /25\.0%/);
  assert.deepEqual(run.totals, { steps: 11, turns: 2, calls: 1, attempts: 1, laps: 1, clock: run.events.at(-1).clock });
});

test('the calculator and the verifier use real arithmetic', async () => {
  const M = await load();
  assert.deepEqual(M.calculate({ from: 12400, to: 15500 }), { diff: 3100, pct: 25 });
  assert.deepEqual(M.calculate({ from: 15500, to: 12400 }), { diff: -3100, pct: -20 });
  const context = [{ kind: 'doc', id: 'inv-2026-04', month: 'april', total: 12400 }, { kind: 'doc', id: 'inv-2026-05', month: 'may', total: 15500 }];
  const answer = (pct) => ({ claims: [{ type: 'money', value: 3100 }, { type: 'pct', value: pct }], cites: ['inv-2026-04', 'inv-2026-05'] });
  assert.equal(M.check(answer(25), context).ok, true);
  const wrong = M.check(answer(20), context);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.code, 'wrong-base');
  assert.equal(M.check({ claims: [{ type: 'pct', value: 15 }], cites: [] }, []).code, 'unsupported');
  assert.equal(M.check({ claims: [], cites: [] }, []).ok, true);
});

test('retrieval only returns the invoices the request names', async () => {
  const M = await load();
  assert.deepEqual(M.retrieve(M.REQUEST.text).map((doc) => doc.id), ['inv-2026-04', 'inv-2026-05']);
  assert.deepEqual(M.retrieve('travel policy'), []);
});

test('without retrieval the guess is rejected and the run declines honestly', async () => {
  const M = await load();
  const run = M.simulate({ retrieval: false });
  assert.equal(types(run), 'intake memory retrieve-off model verify observe model verify exit');
  assert.equal(run.events[4].verdict.code, 'unsupported');
  assert.equal(run.outcome.status, 'declined');
  assert.equal(run.outcome.proposal.claims.length, 0);
});

test('without retrieval or verification the unsupported guess leaves unchecked', async () => {
  const M = await load();
  const run = M.simulate({ retrieval: false, verification: false });
  assert.equal(types(run), 'intake memory retrieve-off model bypass exit');
  assert.equal(run.outcome.status, 'unchecked');
  assert.equal(run.outcome.correct, false);
});

test('a denied tool makes the model do the arithmetic, and the verifier catches the wrong base', async () => {
  const M = await load();
  const run = M.simulate({ tools: false });
  assert.equal(types(run), 'intake memory retrieve model schema permit observe model verify observe model verify exit');
  assert.equal(run.events.find((event) => event.type === 'permit').ok, false);
  const rejected = run.events.find((event) => event.type === 'verify' && !event.verdict.ok);
  assert.equal(rejected.verdict.code, 'wrong-base');
  assert.equal(run.outcome.status, 'verified');
  assert.equal(run.outcome.correct, true);
});

test('verification off is unchecked, not automatically wrong', async () => {
  const M = await load();
  const right = M.simulate({ verification: false });
  assert.equal(right.outcome.status, 'unchecked');
  assert.equal(right.outcome.correct, true);
  const wrong = M.simulate({ verification: false, fault: 'timeout-always' });
  assert.equal(wrong.outcome.status, 'unchecked');
  assert.equal(wrong.outcome.correct, false);
  assert.match(wrong.outcome.text, /20\.0%/);
});

test('timeouts retry with bounded backoff', async () => {
  const M = await load();
  const once = M.simulate({ fault: 'timeout-once' });
  assert.equal(types(once), 'intake memory retrieve model schema permit timeout backoff execute observe model verify exit');
  assert.equal(once.totals.attempts, 2);
  const always = M.simulate({ fault: 'timeout-always' });
  assert.equal(always.events.filter((event) => event.type === 'timeout').length, M.LIMITS.attempts);
  assert.equal(always.events.filter((event) => event.type === 'backoff').length, M.LIMITS.attempts - 1);
  assert.deepEqual(always.events.filter((event) => event.type === 'backoff').map((event) => event.cost), M.LIMITS.backoff);
  assert.equal(always.outcome.status, 'verified');
});

test('a malformed call fails the schema check, then a typed call passes', async () => {
  const M = await load();
  const run = M.simulate({ fault: 'malformed' });
  const checks = run.events.filter((event) => event.type === 'schema');
  assert.deepEqual(checks.map((event) => event.ok), [false, true]);
  assert.match(checks[0].errors[0], /from must be a number/);
  assert.equal(run.totals.calls, 2);
  assert.equal(run.outcome.status, 'verified');
});

test('every switch combination ends inside the turn limit with a status and a trace', async () => {
  const M = await load();
  for (const retrieval of [true, false]) {
    for (const tools of [true, false]) {
      for (const verification of [true, false]) {
        for (const fault of M.FAULTS) {
          const run = M.simulate({ retrieval, tools, verification, fault });
          assert.ok(['verified', 'declined', 'unchecked', 'failed'].includes(run.outcome.status));
          assert.ok(run.totals.turns <= M.LIMITS.turns);
          assert.equal(run.events.at(-1).type, 'exit');
          assert.ok(run.events.every((event, index) => event.index === index && typeof event.trace === 'string'));
          assert.ok(run.events.every((event, index) => index === 0 || event.clock >= run.events[index - 1].clock));
          assert.ok(run.events.every((event) => event.context.length <= M.LIMITS.slots));
          assert.deepEqual(M.simulate({ retrieval, tools, verification, fault }), run);
        }
      }
    }
  }
});

test('the share URL round-trips every setting', async () => {
  const M = await load();
  assert.equal(M.encode(M.DEFAULTS), '');
  const config = { retrieval: false, tools: false, verification: false, fault: 'timeout-once' };
  assert.deepEqual(M.decode('?' + M.encode(config)), config);
  assert.deepEqual(M.decode('?fault=nonsense'), M.DEFAULTS);
});

test('the published page is the output of the build script', () => {
  const before = fs.readFileSync(page, 'utf8');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'agent-machine', 'build.mjs')], { stdio: 'pipe' });
  assert.equal(fs.readFileSync(page, 'utf8'), before);
});

test('the page carries every control, readout and social tag', () => {
  const html = fs.readFileSync(page, 'utf8');
  for (const hook of ['data-am-run', 'data-am-step', 'data-am-break', 'data-am-repair', 'data-am-explode', 'data-am-reset', 'id="am-retrieval"', 'id="am-tools"', 'id="am-verify"', 'id="am-fault"', 'data-am-speed', 'data-am-stage-name', 'data-am-evidence', 'data-am-calls', 'data-am-verdict', 'data-am-steps', 'data-am-clock', 'data-am-trace']) {
    assert.ok(html.includes(hook), hook);
  }
  assert.match(html, /This is a simulation\./);
  assert.ok(!html.includes('GifWriter') && !html.includes('data-am-export=') && !html.includes('MediaRecorder'), 'export tools stay out of the public page');
  assert.match(html, /<meta property="og:image" content="https:\/\/aiengineeringfromscratch\.com\/og\/page\/inside-an-ai-agent\.png">/);
  assert.match(html, /role="img" aria-label="A card-processing machine/);
  assert.ok(fs.existsSync(path.join(__dirname, 'anatomy', 'inside-an-ai-agent-og.png')));
  assert.ok(fs.existsSync(path.join(__dirname, 'anatomy', 'inside-an-ai-agent-poster.png')));
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.match(homepage, /href="inside-an-ai-agent\.html"/);
});

test('every lesson the inspector links to exists', async () => {
  const { INFO } = await import(path.join(root, 'scripts', 'agent-machine', 'content.mjs'));
  for (const [part, info] of Object.entries(INFO)) {
    const lesson = decodeURIComponent(info.lesson.href.split('path=')[1]);
    assert.ok(fs.existsSync(path.join(root, lesson, 'docs', 'en.md')), `${part}: ${lesson}`);
  }
});
