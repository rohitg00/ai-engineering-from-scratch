'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const generate = require('./generate');
const { report } = require('./report');

const REPO = path.resolve(__dirname, '..', '..');
const LESSON = 'phases/03-deep-learning-core/05-loss-functions';
const EXEMPLAR_DIR = path.join(REPO, 'practice', generate.EXEMPLAR);
const NEW_ID = 'softmax-xent-copy';
const PYTHON = process.env.PRACTICE_PYTHON || 'python3';
const HAS_NUMPY = spawnSync(PYTHON, ['-c', 'import numpy'], { encoding: 'utf8' }).status === 0;

function copy(root, rel) {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(REPO, rel), target, { recursive: true, filter: source => !/__pycache__/.test(source) });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'practice-test-'));
  for (const rel of ['scripts/practice/prompt.md', 'scripts/practice/validate.py', 'scripts/practice/run.py', 'practice/AUTHORING.md', 'practice/collections.json', 'practice/_harness/practice_check.py', `practice/${generate.EXEMPLAR}`, 'cheatsheets/deep-learning-training.md', `${LESSON}/docs/en.md`, `${LESSON}/code/main.py`]) copy(root, rel);
  fs.mkdirSync(path.join(root, LESSON, 'code', 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, LESSON, 'code', 'tests', 'test_main.py'), 'def test_secret_marker():\n    pass\n');
  return root;
}

function exemplarFiles(id = NEW_ID) {
  const files = {};
  for (const name of fs.readdirSync(EXEMPLAR_DIR)) {
    if (name === 'fixtures.json' || name === '__pycache__' || name === 'mutants') continue;
    files[name] = fs.readFileSync(path.join(EXEMPLAR_DIR, name), 'utf8');
  }
  for (const name of fs.readdirSync(path.join(EXEMPLAR_DIR, 'mutants'))) files[`mutants/${name}`] = fs.readFileSync(path.join(EXEMPLAR_DIR, 'mutants', name), 'utf8');
  const meta = JSON.parse(files['meta.json']);
  meta.id = id;
  files['meta.json'] = `${JSON.stringify(meta, null, 2)}\n`;
  return files;
}

function broken(files = exemplarFiles()) {
  return { ...files, 'notes.md': `${files['notes.md']}BROKEN\n` };
}

const USAGE = { input_tokens: 30000, output_tokens: 8000, cache_read_input_tokens: 12000, cache_creation_input_tokens: 0 };

function replyText(files) {
  return Object.entries(files).map(([file, text]) => `<file path="${file}">\n${text}</file>`).join('\n');
}

function reply(files = exemplarFiles()) {
  return { stop_reason: 'end_turn', usage: USAGE, content: [{ type: 'text', text: replyText(files) }] };
}

function critique(text = 'Add a check for the mutant in tests.py.') {
  return { stop_reason: 'end_turn', usage: { input_tokens: 31000, output_tokens: 500 }, content: [{ type: 'text', text }] };
}

function fakeClient(replies) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        stream(params) {
          calls.push(JSON.parse(JSON.stringify(params)));
          const next = replies.shift();
          return { finalMessage: async () => next };
        },
      },
    },
  };
}

function fakeGate({ files }) {
  if (files['notes.md'].includes('BROKEN')) return { ok: false, problems: ['mutant sum_not_mean passes every check. Add a check that rejects it'] };
  return { ok: true, problems: [], files: { ...files, 'fixtures.json': '{}\n' } };
}

const quiet = { log() {}, error() {} };

test('a draft that passes the gate is written with haiku, and the request has the right shape', async () => {
  const root = fixture();
  const client = fakeClient([reply()]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate: fakeGate });
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.equal(result.id, NEW_ID);
  assert.equal(result.model, 'claude-haiku-5-5');
  assert.deepEqual(result.steps, ['draft:claude-haiku-5-5']);
  const folder = path.join(root, 'practice', NEW_ID);
  assert.equal(fs.readFileSync(path.join(folder, 'fixtures.json'), 'utf8'), '{}\n');
  assert.ok(fs.existsSync(path.join(folder, 'mutants', 'sum_not_mean.py')));
  const params = client.calls[0];
  assert.equal(params.model, 'claude-haiku-5-5');
  assert.equal(params.max_tokens, 20000);
  assert.deepEqual(params.output_config, { effort: 'medium' });
  assert.equal(params.fallbacks, undefined);
  assert.equal(params.betas, undefined);
  assert.equal(params.system.length, 1);
  assert.equal(params.system[0].cache_control.type, 'ephemeral');
  const system = params.system[0].text;
  assert.match(system, /You write one practice problem/);
  assert.match(system, /## The authoring guide \(practice\/AUTHORING\.md\)/);
  assert.match(system, /<file path="solution\.py">/);
  assert.match(system, /<file path="mutants\/no_max_shift\.py">/);
  assert.doesNotMatch(system, /<file path="fixtures\.json">/);
  assert.match(system, /`deep-learning-core`/);
  assert.match(system, /`deep-learning-training`/);
  assert.match(system, /These ids are taken[^\n]*`softmax-cross-entropy`/);
  const user = params.messages[0].content;
  assert.match(user, new RegExp(`=== ${LESSON}/docs/en\\.md ===`));
  assert.match(user, new RegExp(`=== ${LESSON}/code/main\\.py ===`));
  assert.doesNotMatch(user, /test_secret_marker/);
});

test('a failing draft gets a critique and a revision with the validator problems', async () => {
  const root = fixture();
  const client = fakeClient([reply(broken()), critique(), reply()]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate: fakeGate });
  assert.equal(result.ok, true);
  assert.deepEqual(result.steps, ['draft:claude-haiku-5-5', 'critique:claude-haiku-5-5', 'revise:claude-haiku-5-5']);
  const feedback = client.calls[1].messages[2].content;
  assert.match(feedback, /The validator found these problems:/);
  assert.match(feedback, /- mutant sum_not_mean passes every check/);
  assert.match(feedback, /Critique your draft/);
  assert.match(client.calls[2].messages[4].content, /Apply every edit/);
});

test('a lesson that still fails after two rounds is escalated to sonnet once with the last draft', async () => {
  const root = fixture();
  const bad = () => reply(broken());
  const client = fakeClient([bad(), critique(), bad(), critique(), bad(), reply()]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate: fakeGate });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'claude-sonnet-5-5');
  assert.equal(client.calls.length, 6);
  const escalation = client.calls[5];
  assert.equal(escalation.model, 'claude-sonnet-5-5');
  assert.equal(escalation.fallbacks, 'default');
  assert.deepEqual(escalation.betas, ['server-side-fallback-2026-07-01']);
  assert.deepEqual(escalation.output_config, { effort: 'high' });
  assert.equal(escalation.messages.length, 1);
  assert.match(escalation.messages[0].content, /A smaller model wrote a draft that failed these checks/);
  assert.match(escalation.messages[0].content, /BROKEN/);
  assert.match(escalation.messages[0].content, /<file path="tests\.py">/);
  assert.ok(result.usage.cost > 0);
});

test('a lesson that fails after the escalation is not written', async () => {
  const root = fixture();
  const bad = () => reply(broken());
  const client = fakeClient([bad(), critique(), bad(), critique(), bad(), bad()]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate: fakeGate });
  assert.equal(result.ok, false);
  assert.equal(client.calls.length, 6);
  assert.ok(!fs.existsSync(path.join(root, 'practice', NEW_ID)));
  assert.ok(result.problems.some(problem => /passes every check/.test(problem)));
});

test('a refusal stops the lesson at once', async () => {
  const root = fixture();
  const client = fakeClient([{ stop_reason: 'refusal', usage: USAGE, content: [] }]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate: fakeGate });
  assert.equal(result.ok, false);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(result.problems, ['the model declined the request']);
});

test('the reply parser takes only the allowed paths inside the problem folder', () => {
  const files = exemplarFiles();
  const ok = generate.parseReply(replyText(files));
  assert.equal(ok.error, undefined);
  assert.equal(ok.files['solution.py'], files['solution.py']);
  assert.equal(Object.keys(ok.files).filter(file => file.startsWith('mutants/')).length, 5);
  for (const bad of ['../evil.py', '/etc/passwd', 'mutants/../../evil.py', 'mutants/sub/x.py', 'mutants/Bad.py', 'fixtures.json', 'other.py', './solution.py', 'mutants\\x.py', '']) {
    assert.equal(generate.safePath(bad), false, bad);
    const parsed = generate.parseReply(`${replyText(files)}\n<file path="${bad}">\nx = 1\n</file>`);
    assert.match(parsed.error, /The reply has the file/, bad);
  }
  assert.equal(generate.safePath('support.py'), true);
  assert.equal(generate.parseReply(`${replyText(files)}\n<file path="support.py">\nVALUE = 1\n</file>`).files['support.py'], 'VALUE = 1\n');
  assert.match(generate.parseReply(`${replyText(files)}\n<file path="hints.md">\nagain\n</file>`).error, /two times/);
  assert.match(generate.parseReply('Here is the problem.').error, /<file path="\.\.\."> part/);
  const { 'notes.md': dropped, ...noNotes } = files;
  assert.ok(dropped);
  assert.match(generate.parseReply(replyText(noNotes)).error, /has no notes\.md/);
  const few = Object.fromEntries(Object.entries(files).filter(([file]) => !/global_max|grad_missing|in_place/.test(file)));
  assert.match(generate.parseReply(replyText(few)).error, /has 2 mutants/);
  const fenced = generate.parseReply(replyText({ ...files, 'starter.py': '```python\nimport numpy as np\n```\n' }));
  assert.equal(fenced.files['starter.py'], 'import numpy as np\n');
});

test('meta.json must keep the lesson, a free id and the requested id', () => {
  const files = exemplarFiles();
  const taken = new Set(['softmax-cross-entropy']);
  assert.deepEqual(generate.metaProblems(files, { lesson: LESSON, id: '', taken }).problems, []);
  assert.match(generate.metaProblems(exemplarFiles('softmax-cross-entropy'), { lesson: LESSON, id: '', taken }).problems[0], /is taken/);
  assert.match(generate.metaProblems(files, { lesson: 'phases/01-x/01-y', id: '', taken }).problems[0], /lesson in meta.json must be/);
  assert.match(generate.metaProblems(files, { lesson: LESSON, id: 'other-id', taken }).problems[0], /must be "other-id"/);
  assert.match(generate.metaProblems(exemplarFiles('Bad_Id'), { lesson: LESSON, id: '', taken }).problems[0], /lower case words/);
  assert.match(generate.metaProblems({ ...files, 'meta.json': '{' }, { lesson: LESSON, id: '', taken }).problems[0], /not valid JSON/);
});

test('bad replies go back to the model before the gate runs', async () => {
  const root = fixture();
  let gateCalls = 0;
  const gate = args => {
    gateCalls += 1;
    return fakeGate(args);
  };
  const sneaky = { stop_reason: 'end_turn', usage: USAGE, content: [{ type: 'text', text: `${replyText(exemplarFiles())}<file path="../../escape.py">\nx = 1\n</file>` }] };
  const client = fakeClient([sneaky, critique(), reply(exemplarFiles('softmax-cross-entropy')), critique(), reply()]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate, escalation: '' });
  assert.equal(result.ok, true);
  assert.equal(gateCalls, 1);
  assert.match(client.calls[1].messages[2].content, /The reply has the file "\.\.\/\.\.\/escape\.py"/);
  assert.match(client.calls[3].messages[6].content, /the id "softmax-cross-entropy" is taken/);
  assert.ok(!fs.existsSync(path.join(root, '..', 'escape.py')));
});

test('the validator output is parsed into problem lines', () => {
  const output = 'FAIL softmax-xent-copy                5 mutants caught (a: edge) 0.1s\n       mutant a passes every check. Add a check\n       problem.md needs the section \'## Task\'\nFAIL unknown problem zzz\nChecked 1 problems. 3 problems found.\n';
  assert.deepEqual(generate.validatorProblems(output), ['mutant a passes every check. Add a check', "problem.md needs the section '## Task'", 'unknown problem zzz']);
});

test('the token budget stops retries, and the lesson cap leaves lessons for the next run', async () => {
  const root = fixture();
  const client = fakeClient([reply(broken()), critique(), reply()]);
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate: fakeGate, budgetLeft: 1000 });
  assert.equal(result.ok, false);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(result.problems, ['the token budget ran out before the next retry']);
  const summary = path.join(root, 'summary.json');
  const capped = fakeClient([reply()]);
  const code = await generate.main([LESSON, '--limit', '0', '--summary', summary], { client: capped, root, out: quiet, gate: fakeGate });
  assert.equal(code, 0);
  assert.equal(capped.calls.length, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(summary, 'utf8')).skipped, [LESSON]);
});

test('main honours --model and --id and writes a summary with tokens and cost', async () => {
  const root = fixture();
  const summary = path.join(root, 'summary.json');
  const client = fakeClient([reply()]);
  const lines = [];
  const code = await generate.main([`${LESSON}/`, '--id', NEW_ID, '--model', 'opus', '--summary', summary], { client, root, out: { log: line => lines.push(line), error: line => lines.push(line) }, gate: fakeGate });
  assert.equal(code, 0);
  assert.equal(client.calls[0].model, 'claude-opus-5-5');
  assert.match(client.calls[0].messages[0].content, new RegExp(`id: ${NEW_ID}\\n`));
  const written = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.deepEqual(Object.keys(written), ['model', 'escalation', 'budget', 'usage', 'tokens', 'cost', 'written', 'escalated', 'failed', 'skipped', 'drafts']);
  assert.equal(written.model, 'claude-opus-5-5');
  assert.equal(written.escalation, 'claude-sonnet-5-5');
  assert.equal(written.budget, 1500000);
  assert.deepEqual(written.written, [NEW_ID]);
  assert.deepEqual(written.escalated, []);
  assert.deepEqual(written.failed, []);
  assert.equal(written.tokens, 50000);
  assert.equal(written.cost, (30000 * 4 + 8000 * 20 + 12000 * 0.2) / 1e6);
  assert.deepEqual(written.drafts[0], { lesson: LESSON, id: NEW_ID, ok: true, model: 'claude-opus-5-5', steps: ['draft:claude-opus-5-5'], tokens: 50000, cost: written.cost });
  assert.match(lines[lines.length - 1], /Wrote 1 problems \(0 escalated\)\. 0 lessons failed\. Tokens: 50000, estimated cost \$0\.28\./);
});

test('main refuses bad input, a missing key, and prints the bundle size on a dry run', async () => {
  const root = fixture();
  assert.equal(await generate.main([], { root, out: quiet }), 1);
  assert.equal(await generate.main(['phases/03-deep-learning-core/99-none'], { root, out: quiet }), 1);
  assert.equal(await generate.main(['../etc'], { root, out: quiet }), 1);
  assert.equal(await generate.main([LESSON, LESSON.replace('05-loss', '04-loss'), '--id', 'x'], { root, out: quiet }), 1);
  assert.equal(await generate.main([LESSON, '--id', 'softmax-cross-entropy'], { root, out: quiet, client: fakeClient([]) }), 1);
  assert.equal(await generate.main([LESSON, '--id', 'Bad_Id'], { root, out: quiet, client: fakeClient([]) }), 1);
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(await generate.main([LESSON], { root, out: quiet }), 2);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
  const lines = [];
  assert.equal(await generate.main([LESSON, '--dry-run'], { root, out: { log: line => lines.push(line), error: line => lines.push(line) } }), 0);
  assert.match(lines[0], new RegExp(`^${LESSON}: 2 files, \\d+ characters$`));
  assert.match(lines[1], /^System prompt: \d+ characters\.$/);
});

test('haiku pricing switches to the long-prompt rate above 100k input tokens', () => {
  const short = generate.callCost({ input_tokens: 50000, output_tokens: 10000 }, 'claude-haiku-5-5');
  const long = generate.callCost({ input_tokens: 150000, output_tokens: 10000 }, 'claude-haiku-5-5');
  assert.equal(short, (50000 * 0.1 + 10000 * 0.5) / 1e6);
  assert.equal(long, (150000 * 0.5 + 10000 * 2.5) / 1e6);
});

test('the run report lists each lesson, and the PR body and commit carry no attribution', () => {
  const summary = {
    model: 'claude-haiku-5-5', escalation: 'claude-sonnet-5-5', budget: 1500000, tokens: 90000, cost: 0.21,
    written: ['a-one', 'b-two'], escalated: ['b-two'], failed: [{ lesson: 'phases/01-x/03-z', id: '', steps: [], problems: ['mutant m passes every check'] }], skipped: ['phases/01-x/04-w'],
    drafts: [
      { lesson: 'phases/01-x/01-a', id: 'a-one', ok: true, model: 'claude-haiku-5-5', steps: ['draft'], tokens: 40000, cost: 0.01 },
      { lesson: 'phases/01-x/02-b', id: 'b-two', ok: true, model: 'claude-sonnet-5-5', steps: ['draft', 'critique', 'revise', 'escalate'], tokens: 50000, cost: 0.2 },
      { lesson: 'phases/01-x/03-z', id: '', ok: false, model: 'claude-haiku-5-5', steps: ['draft'], tokens: 0, cost: 0 },
    ],
  };
  const body = report(summary, 'pr');
  assert.match(body, /\| `phases\/01-x\/01-a` \| `a-one` \| written \| haiku-5-5 \| 1 \| 40000 \| \$0\.010 \|/);
  assert.match(body, /\| `phases\/01-x\/03-z` \| - \| skipped \|/);
  assert.match(body, /Escalated to sonnet-5-5: `b-two`/);
  assert.match(body, /Nothing was committed for these lessons:\n- `phases\/01-x\/03-z`/);
  assert.match(body, /Not started because of the problem cap or the token budget: `phases\/01-x\/04-w`/);
  assert.match(report(summary, 'summary'), /^## Practice problem drafts/);
  const commit = report(summary, 'commit');
  assert.match(commit, /^chore\(practice\): draft 2 problems\n/);
  assert.match(commit, /- practice\/b-two from phases\/01-x\/02-b/);
  for (const text of [body, commit]) assert.doesNotMatch(text, /Co-Authored-By|Generated with|Claude Code|noreply@anthropic/i);
});

test('the exemplar problem passes the real gate, and a failed draft leaves no files behind', { timeout: 300000 }, t => {
  if (!HAS_NUMPY) {
    t.skip(`${PYTHON} has no numpy`);
    return;
  }
  const root = fixture();
  const before = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('practice-gen-')).length;
  const passed = generate.gateDraft({ files: exemplarFiles(), id: NEW_ID, root, python: PYTHON });
  assert.equal(passed.ok, true, passed.output);
  assert.ok(passed.files['fixtures.json'].length > 1000);
  assert.ok(!Object.keys(passed.files).some(file => /__pycache__|\.pyc$/.test(file)));
  assert.ok(!fs.existsSync(path.join(root, 'practice', NEW_ID)));
  const files = exemplarFiles();
  files['mutants/sum_not_mean.py'] = files['solution.py'];
  const failed = generate.gateDraft({ files, id: NEW_ID, root, python: PYTHON });
  assert.equal(failed.ok, false);
  assert.ok(failed.problems.some(problem => /mutant sum_not_mean changes 0 lines/.test(problem)), failed.problems.join('\n'));
  assert.ok(!fs.existsSync(path.join(root, 'practice', NEW_ID)));
  assert.equal(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('practice-gen-')).length, before);
});

test('an end to end run with the real gate writes the problem with its fixtures', { timeout: 300000 }, async t => {
  if (!HAS_NUMPY) {
    t.skip(`${PYTHON} has no numpy`);
    return;
  }
  const root = fixture();
  const client = fakeClient([reply()]);
  const gate = args => generate.gateDraft({ ...args, python: PYTHON });
  const result = await generate.generateProblem({ lesson: LESSON, client, root, gate });
  assert.equal(result.ok, true, result.problems.join('\n'));
  const folder = path.join(root, 'practice', NEW_ID);
  assert.ok(fs.existsSync(path.join(folder, 'fixtures.json')));
  const check = spawnSync(PYTHON, [path.join(root, 'scripts/practice/validate.py'), NEW_ID], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
});
