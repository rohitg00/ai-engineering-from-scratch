'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const generate = require('./generate');
const bankLib = require('./validate');
const { report } = require('./report');

const REPO = path.resolve(__dirname, '..', '..');
const CARD = 'agents';
const ID = 'finish-tool-or-silence';
const FILE = `interviews/questions/${CARD}/${ID}.md`;
const ORIGINAL = fs.readFileSync(path.join(REPO, FILE), 'utf8');
const DATE = '2026-11-04';
const USAGE = { input_tokens: 30000, output_tokens: 4000, cache_read_input_tokens: 60000, cache_creation_input_tokens: 0 };

const roots = [];

test.after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iv-gen-'));
  roots.push(root);
  for (const name of ['phases', 'manuals', 'practice', 'cheatsheets', 'learning-paths']) fs.symlinkSync(path.join(REPO, name), path.join(root, name));
  fs.cpSync(path.join(REPO, 'interviews'), path.join(root, 'interviews'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts', 'interviews'), { recursive: true });
  for (const name of ['denylist.txt', 'prompt.md']) fs.copyFileSync(path.join(REPO, 'scripts', 'interviews', name), path.join(root, 'scripts', 'interviews', name));
  fs.unlinkSync(path.join(root, FILE));
  return root;
}

function shortAnswer() {
  return bankLib.splitSections(bankLib.splitFrontMatter(ORIGINAL, FILE).body).sections.find(section => section.title === 'Short answer').text;
}

function leakyTitle() {
  const span = shortAnswer().replace(/`/g, '').split(/\s+/).slice(0, 6).join(' ');
  return ORIGINAL.replace(/^title: .*$/m, `title: ${span.slice(0, 60).trim()}`);
}

function reply(text) {
  return { stop_reason: 'end_turn', usage: USAGE, content: [{ type: 'text', text: `<item>\n${text}\n</item>` }] };
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

const quiet = { log() {}, error() {} };

function readmes(root) {
  return fs.readdirSync(path.join(root, 'interviews', 'questions')).map(card => {
    const file = path.join(root, 'interviews', 'questions', card, 'README.md');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }).concat(fs.readFileSync(path.join(root, 'interviews', 'README.md'), 'utf8'));
}

test('a draft that passes every check is written with haiku, and the summary reports cost', async () => {
  const root = fixture();
  const summary = path.join(root, 'summary.json');
  const client = fakeClient([reply(ORIGINAL)]);
  const code = await generate.main([CARD, '--count', '1', '--summary', summary], { client, root, out: quiet, date: DATE });
  assert.equal(code, 0);
  const written = fs.readFileSync(path.join(root, FILE), 'utf8');
  assert.match(written, /^updated: 2026-11-04$/m);
  assert.match(written, /^card: agents$/m);
  const result = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.deepEqual(result.written, [ID]);
  assert.deepEqual(result.files, [FILE]);
  assert.equal(result.tokens, 94000);
  assert.ok(result.cost > 0);
  const params = client.calls[0];
  assert.equal(params.model, 'claude-haiku-5-5');
  assert.equal(params.system[0].cache_control.type, 'ephemeral');
  assert.match(params.system[0].text, /## The source files of the card agents/);
  assert.match(params.system[0].text, /=== lesson phases\/14-agent-engineering\/01-the-agent-loop/);
  assert.match(params.messages[0].content, /The existing questions of the card/);
  assert.match(params.messages[0].content, /the-agent-loops-forever: This agent loops forever/);
  assert.doesNotMatch(params.messages[0].content, new RegExp(`${ID}:`));
});

test('the model output is parsed into the item format', () => {
  assert.match(generate.parseReply('Sure.\n<item>\n```markdown\n---\nid: a\n---\nx\n```\n</item>').text, /^---\nid: a\n---\nx$/);
  assert.match(generate.parseReply('no item here').error, /one <item> part/);
  const card = { id: CARD };
  const normal = generate.normalizeItem(ORIGINAL.replace(/^card: .*$/m, 'card: rag').replace(/^updated: .*$/m, 'updated: 2020-01-01'), card, DATE);
  assert.equal(normal.id, ID);
  assert.equal(normal.file, FILE);
  assert.match(normal.text, /^card: agents$/m);
  assert.match(normal.text, /^updated: 2026-11-04$/m);
  assert.match(normal.text, /\n$/);
  assert.match(generate.normalizeItem('no front matter', card, DATE).error, /front matter/);
  assert.match(generate.normalizeItem('---\nid: Bad Id\n---\nx\n', card, DATE).error, /lower case/);
});

test('a draft that fails the leak rule is repaired once', async () => {
  const root = fixture();
  const client = fakeClient([reply(leakyTitle()), reply(ORIGINAL)]);
  const summary = path.join(root, 'summary.json');
  const code = await generate.main([CARD, '--summary', summary], { client, root, out: quiet, date: DATE });
  assert.equal(code, 0);
  assert.equal(client.calls.length, 2);
  const feedback = client.calls[1].messages[2].content;
  assert.match(feedback, /the title, the tags, the prompt, a follow-up question or the Taught in line shows an answer span/);
  assert.match(feedback, /Reply with the complete file in the <item> part/);
  assert.deepEqual(JSON.parse(fs.readFileSync(summary, 'utf8')).items[0].steps, ['draft', 'repair']);
  assert.ok(fs.existsSync(path.join(root, FILE)));
});

test('a draft that still fails after one repair is dropped and not written', async () => {
  const root = fixture();
  const leak = ORIGINAL.replace('\n\n## Short answer', ` ${shortAnswer().split(/\s+/).slice(0, 8).join(' ')}\n\n## Short answer`);
  const client = fakeClient([reply(leak), reply(leakyTitle())]);
  const summary = path.join(root, 'summary.json');
  const code = await generate.main([CARD, '--summary', summary], { client, root, out: quiet, date: DATE });
  assert.equal(code, 1);
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].messages[2].content, /the prompt or a follow-up question shows an answer span/);
  assert.ok(!fs.existsSync(path.join(root, FILE)));
  const result = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.deepEqual(result.written, []);
  assert.deepEqual(result.files, []);
  assert.match(result.failed[0].problems.join('\n'), /shows an answer span/);
  assert.match(report(result, 'pr'), /\| `finish-tool-or-silence` \| `agents` \| dropped \|/);
});

test('numbers with no named source, denylist names and dashes go back to the model', async () => {
  const root = fixture();
  const bad = ORIGINAL.replace('\n\n## Short answer', ' The run took 98765.4 seconds on the openai cluster — twice.\n\n## Short answer');
  const client = fakeClient([reply(bad), reply(bad)]);
  await generate.main([CARD], { client, root, out: quiet, date: DATE });
  const feedback = client.calls[1].messages[2].content;
  assert.match(feedback, /numbers that no named source holds: 98765\.4/);
  assert.match(feedback, /names a company from the denylist: openai/);
  assert.match(feedback, /remove the em dash or en dash/);
  assert.ok(!fs.existsSync(path.join(root, FILE)));
});

test('a near duplicate of an existing question is rejected', () => {
  const others = [{ id: 'the-agent-loops-forever', title: 'This agent loops forever, find out why', prompt: 'A coding agent has run for two hours on a task. The trace shows the same shell command again and again.' }];
  assert.match(generate.duplicateProblems({ id: 'the-agent-loops-forever', title: 'x', prompt: 'y' }, others)[0], /is taken/);
  assert.match(generate.duplicateProblems({ id: 'new', title: 'Find out why this agent loops forever', prompt: 'y' }, others)[0], /title is too close/);
  assert.match(generate.duplicateProblems({ id: 'new', title: 'Other', prompt: 'Read this.\n```text\nThe trace shows the same shell command again and again. A coding agent has run for two hours on a task.\n```' }, others)[0], /prompt is too close/);
  assert.match(generate.duplicateProblems({ id: 'new', title: 'Other', prompt: 'The trace shows the same shell command again and again. A coding agent has run for two hours on a task.' }, others)[0], /prompt is too close/);
  const code = Array.from({ length: 40 }, (_, index) => `step_${index} = run_${index}()`).join('\n');
  assert.match(generate.duplicateProblems({ id: 'new', title: 'Other', prompt: `A coding agent has run for two hours on a task. The trace shows the same shell command again and again.\n\n\`\`\`python\n${code}\n\`\`\`` }, others)[0], /prompt is too close/);
  assert.match(generate.duplicateProblems({ id: 'new', title: 'Other', prompt: `A coding agent has run for two hours on a task. The trace shows the same shell command again and again.\n\n~~~python\n${code}\n~~~` }, others)[0], /prompt is too close/);
  const reading = [{ id: 'read-one', title: 'Read the loop', prompt: `Read this function and say what it returns.\n\n\`\`\`python\n${code}\n\`\`\`` }];
  const other = Array.from({ length: 40 }, (_, index) => `total_${index} += weight_${index} * value_${index}`).join('\n');
  assert.deepEqual(generate.duplicateProblems({ id: 'read-two', title: 'Read the sum', prompt: `Read this function and say what it returns.\n\n\`\`\`python\n${other}\n\`\`\`` }, reading), []);
  assert.deepEqual(generate.duplicateProblems({ id: 'new', title: 'Pick a reranker pool size', prompt: 'How many passages go to the cross encoder?' }, others), []);
});

test('the guards stop a run with no key, with an open bot pull request, and cap the count at 5', async () => {
  assert.deepEqual(generate.guard({ hasKey: false, openPrs: '0', count: '1' }), { run: false, code: 2, reason: 'ANTHROPIC_API_KEY is not set.' });
  assert.equal(generate.guard({ hasKey: true, openPrs: '1', count: '1' }).run, false);
  assert.deepEqual(generate.guard({ hasKey: true, openPrs: '0', count: '9' }), { run: true, count: 5, capped: true });
  assert.deepEqual(generate.guard({ hasKey: true, openPrs: '', count: '' }), { run: true, count: 1, capped: false });
  assert.equal(generate.MAX_ITEMS, 5);
  const root = fixture();
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(await generate.main([CARD], { root, out: quiet }), 2);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
  const open = fakeClient([]);
  assert.equal(await generate.main([CARD, '--open-prs', '1'], { client: open, root, out: quiet }), 0);
  assert.equal(open.calls.length, 0);
  const many = fakeClient(Array.from({ length: 20 }, () => ({ stop_reason: 'refusal', usage: USAGE, content: [] })));
  const summary = path.join(root, 'summary.json');
  await generate.main([CARD, '--count', '12', '--summary', summary], { client: many, root, out: quiet, date: DATE });
  assert.equal(many.calls.length, 5);
  assert.equal(JSON.parse(fs.readFileSync(summary, 'utf8')).requested, 5);
  assert.equal(await generate.main(['scenarios'], { client: open, root, out: quiet }), 1);
  assert.deepEqual(generate.guard({ hasKey: true, openPrs: '0', count: '0' }), { run: false, code: 0, reason: 'The count is 0. Nothing to do.' });
  assert.equal(await generate.main([CARD, '--count', '0'], { client: open, root, out: quiet }), 0);
  assert.equal(open.calls.length, 0);
});

test('a token budget of 0 makes no model call', async () => {
  const root = fixture();
  const client = fakeClient([reply(ORIGINAL)]);
  const summary = path.join(root, 'summary.json');
  await generate.main([CARD, '--token-budget', '0', '--summary', summary], { client, root, out: quiet, date: DATE });
  assert.equal(client.calls.length, 0);
  assert.equal(JSON.parse(fs.readFileSync(summary, 'utf8')).skipped, 1);
});

test('a token budget that is not a number stops the run before any model call', async () => {
  const root = fixture();
  const client = fakeClient([reply(ORIGINAL)]);
  assert.equal(await generate.main([CARD, '--token-budget', 'typo'], { client, root, out: quiet, date: DATE }), 1);
  assert.equal(client.calls.length, 0);
  const lines = [];
  await generate.main([CARD, '--count', '0', '--dry-run'], { root, out: { log: line => lines.push(line), error() {} } });
  assert.match(lines[0], /^agents: 0 items,/);
});

test('a failed repair call keeps the tokens of the draft call in the summary', async () => {
  const root = fixture();
  const client = fakeClient([reply(leakyTitle())]);
  const stream = client.beta.messages.stream;
  client.beta.messages.stream = params => {
    if (client.calls.length) throw new Error('overloaded');
    return stream(params);
  };
  const summary = path.join(root, 'summary.json');
  assert.equal(await generate.main([CARD, '--summary', summary], { client, root, out: quiet, date: DATE }), 1);
  const result = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.equal(result.tokens, 94000);
  assert.ok(result.cost > 0);
  assert.deepEqual(result.failed[0].problems, ['overloaded']);
});

test('an answer span inside a fenced block of the prompt is caught', async () => {
  const root = fixture();
  const span = shortAnswer().replace(/`/g, '').split(/\s+/).slice(0, 8).join(' ');
  const fenced = ORIGINAL.replace('\n\n## Short answer', `\n\n\`\`\`text\n${span}\n\`\`\`\n\n## Short answer`);
  const client = fakeClient([reply(fenced), reply(fenced)]);
  await generate.main([CARD], { client, root, out: quiet, date: DATE });
  assert.match(client.calls[1].messages[2].content, /the prompt, a follow-up question or the Taught in line shows an answer span/);
  assert.ok(!fs.existsSync(path.join(root, FILE)));
});

test('the token budget stops the repair and the next items', async () => {
  const root = fixture();
  const client = fakeClient([reply(leakyTitle()), reply(ORIGINAL)]);
  const summary = path.join(root, 'summary.json');
  await generate.main([CARD, '--count', '3', '--token-budget', '1000', '--summary', summary], { client, root, out: quiet, date: DATE });
  assert.equal(client.calls.length, 1);
  const result = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.equal(result.skipped, 2);
  assert.match(result.failed[0].problems.join('\n'), /token budget ran out before the repair/);
});

test('no generated README is written or staged', async () => {
  const root = fixture();
  const before = readmes(root);
  const summary = path.join(root, 'summary.json');
  await generate.main([CARD, '--summary', summary], { client: fakeClient([reply(ORIGINAL)]), root, out: quiet, date: DATE });
  assert.deepEqual(readmes(root), before);
  const result = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.equal(report(result, 'paths'), `${FILE}\n`);
  const sneaky = { ...result, files: [FILE, 'interviews/README.md', `interviews/questions/${CARD}/README.md`, 'interviews/scenarios/README.md', 'site/data.js'] };
  assert.deepEqual(generate.stagedPaths(sneaky), [FILE]);
});

test('the pull request body is a table with the items, card, model, tokens and cost', () => {
  const summary = {
    card: 'rag', model: 'claude-haiku-5-5', budget: 600000, requested: 3, tokens: 90000, cost: 0.021,
    written: ['a'], files: ['interviews/questions/rag/a.md'], failed: [{ id: 'b', steps: ['draft', 'repair'], problems: ['the prompt has numbers that no named source holds: 77'] }], skipped: 1,
    items: [
      { id: 'a', ok: true, model: 'claude-haiku-5-5', steps: ['draft'], sources: ['phases/11-llm-engineering/06-advanced-rag'], tokens: 40000, cost: 0.01 },
      { id: 'b', ok: false, model: 'claude-haiku-5-5', steps: ['draft', 'repair'], sources: [], tokens: 50000, cost: 0.011 },
    ],
  };
  const body = report(summary, 'pr');
  assert.match(body, /\| Item \| Card \| Result \| Model \| Calls \| Tokens \| Cost \| Sources \|/);
  assert.match(body, /\| `a` \| `rag` \| written \| haiku-5-5 \| 1 \| 40000 \| \$0\.010 \| `phases\/11-llm-engineering\/06-advanced-rag` \|/);
  assert.match(body, /Tokens: 90000 of a budget of 600000\. Estimated cost: \$0\.021\./);
  assert.match(body, /Nothing was committed for these drafts:\n- `b`/);
  assert.match(body, /Not started because of the token budget: 1 items/);
  assert.match(body, /Read each item and its named sources before you merge\./);
  assert.match(report(summary, 'commit'), /^feat\(interviews\): add 1 questions to rag/);
});

test('the workflow runs only on demand, skips without a key or with an open bot pull request, and never cancels a run', () => {
  const flow = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'interviews-generate.yml'), 'utf8');
  const on = flow.slice(flow.indexOf('\non:'), flow.indexOf('\npermissions:'));
  assert.match(on, /workflow_dispatch:/);
  assert.doesNotMatch(on, /\n  (?:push|pull_request|schedule):/);
  assert.match(flow, /cancel-in-progress: false/);
  assert.match(flow, /if \[ -z "\$ANTHROPIC_API_KEY" \]/);
  assert.match(flow, /isCrossRepository \| not\) and \(\.headRefName \| startswith\("interviews\/auto-"\)/);
  assert.match(flow, /@anthropic-ai\/sdk@0\.134\.0/);
  assert.match(flow, /--no-save --no-package-lock/);
  assert.match(flow, /report\.js "\$RUNNER_TEMP\/summary\.json" --paths/);
  assert.doesNotMatch(flow, /git add (?:-A|\.|interviews)/);
});
