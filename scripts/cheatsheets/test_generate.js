'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const generate = require('./generate');
const topicMap = require('../../site/cheatsheet-topics');

const REPO = path.resolve(__dirname, '..', '..');
const LESSON = 'phases/01-demo/01-serving';
const DOC = `${LESSON}/docs/en.md`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-gen-'));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  write('scripts/cheatsheets/prompt.md', fs.readFileSync(path.join(REPO, 'scripts/cheatsheets/prompt.md'), 'utf8'));
  write('cheatsheets/AUTHORING.md', fs.readFileSync(path.join(REPO, 'cheatsheets/AUTHORING.md'), 'utf8'));
  write(DOC, '# Serving\n\nStart the server with `serve --port 8000`. Call `run_job(spec)` to queue work.\n\nThis paragraph tells a story and holds nothing to keep\n');
  write(`${LESSON}/code/main.py`, 'def run_job(spec):\n    return spec\n');
  write(`${LESSON}/code/tests/test_main.py`, 'def test_run():\n    pass\n');
  write('cheatsheets/topics.yaml', `- id: demo-serving\n  title: Demo Serving\n  kind: concept\n  sources:\n    - ${LESSON}\n`);
  return root;
}

const BLOCKS = [
  ['Tasks', 'task-table', '| Task | Code |\n|---|---|\n| Start the server | `serve FLAG 8000` |\n| Queue a job | `run_job(<spec>)` |\n| Pick a port | Use 8000 |\n| Stop | Press Ctrl C |'],
  ['Commands', 'command-table', '| Command | What it does |\n|---|---|\n| Serve | Starts the server |\n| Queue | Adds a job |'],
  ['Terms', 'concepts', '- **Job**: one unit of work.\n- **Queue**: jobs in order.'],
  ['One job', 'flow', '1. **Client**: sends a job.\n2. **Server**: queues it.\n3. **Worker**: runs it.'],
  ['Parts', 'architecture', '```arch\nnode | c | 1,1 | Client | sends\nnode | s | 2,1 | Server | queues\nnode | w | 3,1 | Worker | runs\nedge | c | s | job\nedge | s | w | job\n```'],
  ['Defaults', 'defaults', '| Setting | Default | Note |\n|---|---|---|\n| Port | 8000 | HTTP |\n| Port again | 8000 | Same |'],
  ['Troubleshooting', 'troubleshooting', '| Symptom | Cause | Fix |\n|---|---|---|\n| No answer | Server down | Start it |\n| Port busy | Second server | Pick a port |\n| Job lost | Queue full | Wait |'],
  ['Questions', 'qa', '- **Why a queue?** Jobs wait in order.\n- **Why one worker?** It is the default.'],
  ['Tips', 'tips', '- Start the server first.\n- Check the port.'],
  ['Glossary', 'glossary', '- **HTTP**: the web protocol.\n- **CLI**: the command line.'],
];

function poster(flag = '--port', blocks = BLOCKS) {
  const body = blocks.map(([title, type, text]) => `## ${title}\ntype: ${type}\nfrom: ${DOC}\n\n${text.replace('FLAG', flag)}`).join('\n\n');
  return `---\nid: demo-serving\ntitle: Demo Serving\nsubtitle: Start the demo server and queue a job.\nhue: 120\nsources: ${LESSON}\n---\n\n${body}\n`;
}

function evidence(blocks = BLOCKS, ref = 'L01/d:3') {
  return `# Evidence: cheatsheets/demo-serving.md\n\nAbbreviations: L01 = ${LESSON}, d = docs/en.md, c = code/main.py.\n\n${blocks.map(([title]) => `## ${title}\n- fact: ${ref}, L01/c:1-2\n${[2, 3, 4, 5].map(n => `- fact ${n}: L01/d:${n}\n`).join('')}`).join('\n')}`;
}

const USAGE = { input_tokens: 30000, output_tokens: 8000, cache_read_input_tokens: 12000, cache_creation_input_tokens: 0 };

function reply(topic, evidenceText = evidence()) {
  return { stop_reason: 'end_turn', usage: USAGE, content: [{ type: 'text', text: `<topic>\n${topic}\n</topic>\n<evidence>\n${evidenceText}</evidence>` }] };
}

function critique(text = 'Edit the Tasks block: copy the flag from the source.') {
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

function entry(root) {
  return topicMap.loadTopicMap(root).topics[0];
}

test('a draft that passes the checks and the rubric is written with haiku', async () => {
  const root = fixture();
  const client = fakeClient([reply(poster())]);
  const result = await generate.generateTopic({ entry: entry(root), client, root });
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.equal(result.model, 'claude-haiku-5-5');
  assert.equal(result.score, 100);
  assert.deepEqual(result.steps, ['draft:claude-haiku-5-5']);
  const text = fs.readFileSync(path.join(root, 'cheatsheets/demo-serving.md'), 'utf8');
  assert.match(text, /^---\nid: demo-serving\ntitle: Demo Serving\ncode: DS\n/);
  assert.match(text, new RegExp(`source_hash: ${topicMap.sourceHash([LESSON], root)}`));
  const params = client.calls[0];
  assert.equal(params.model, 'claude-haiku-5-5');
  assert.equal(params.fallbacks, undefined);
  assert.equal(params.max_tokens, 20000);
  assert.equal(params.system[0].cache_control.type, 'ephemeral');
  assert.match(params.system[0].text, /## The quality rubric/);
  assert.match(params.messages[0].content, /=== phases\/01-demo\/01-serving\/docs\/en\.md ===/);
  assert.doesNotMatch(params.messages[0].content, /tells a story|test_main/);
});

test('a failing draft gets a haiku critique and a revision', async () => {
  const root = fixture();
  const client = fakeClient([reply(poster('--listen')), critique(), reply(poster())]);
  const result = await generate.generateTopic({ entry: entry(root), client, root });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'claude-haiku-5-5');
  assert.deepEqual(result.steps, ['draft:claude-haiku-5-5', 'critique:claude-haiku-5-5', 'revise:claude-haiku-5-5']);
  const critiqueCall = client.calls[1].messages;
  assert.match(critiqueCall[2].content, /"--listen" is not in its from files/);
  assert.match(critiqueCall[2].content, /Critique your draft/);
  assert.match(client.calls[2].messages[4].content, /Apply every edit/);
});

test('rubric failures go back to the model like fact failures', async () => {
  const root = fixture();
  const thin = BLOCKS.filter(([title]) => title !== 'Troubleshooting' && title !== 'Parts' && title !== 'One job');
  const client = fakeClient([reply(poster('--port', thin), evidence(thin)), critique(), reply(poster())]);
  const result = await generate.generateTopic({ entry: entry(root), client, root });
  assert.equal(result.ok, true);
  const feedback = client.calls[1].messages[2].content;
  assert.match(feedback, /rubric blocks: 7 blocks/);
  assert.match(feedback, /rubric diagram/);
  assert.match(feedback, /rubric troubleshooting/);
});

test('a topic that still fails after two rounds is escalated to sonnet once', async () => {
  const root = fixture();
  const bad = () => reply(poster('--listen'));
  const client = fakeClient([bad(), critique(), bad(), critique(), bad(), reply(poster())]);
  const result = await generate.generateTopic({ entry: entry(root), client, root });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'claude-sonnet-5-5');
  assert.equal(client.calls.length, 6);
  const escalation = client.calls[5];
  assert.equal(escalation.model, 'claude-sonnet-5-5');
  assert.equal(escalation.fallbacks, 'default');
  assert.equal(escalation.messages.length, 1);
  assert.match(escalation.messages[0].content, /A smaller model wrote a draft that failed these checks/);
  assert.match(escalation.messages[0].content, /serve --listen 8000/);
  assert.ok(result.usage.cost > 0);
});

test('a topic that fails after escalation is skipped and not written', async () => {
  const root = fixture();
  const bad = () => reply(poster('--listen'));
  const client = fakeClient([bad(), critique(), bad(), critique(), bad(), bad()]);
  const result = await generate.generateTopic({ entry: entry(root), client, root });
  assert.equal(result.ok, false);
  assert.equal(client.calls.length, 6);
  assert.ok(!fs.existsSync(path.join(root, 'cheatsheets/demo-serving.md')));
  assert.ok(result.problems.some(problem => /--listen/.test(problem)));
});

test('a missing evidence section, a refusal and a climbing from path are refused', async () => {
  const root = fixture();
  const noTags = { stop_reason: 'end_turn', usage: USAGE, content: [{ type: 'text', text: 'Here is the sheet.' }] };
  let client = fakeClient([noTags, critique(), reply(poster(), '# Evidence\n\n## Tasks\n- no line\n'), critique(), { stop_reason: 'refusal', usage: USAGE, content: [] }]);
  let result = await generate.generateTopic({ entry: entry(root), client, root });
  assert.equal(result.ok, false);
  assert.match(client.calls[1].messages[2].content, /one <topic> part and one <evidence> part/);
  assert.match(client.calls[3].messages[6].content, /must start with "# Evidence: cheatsheets\/demo-serving\.md"/);
  assert.match(client.calls[3].messages[6].content, /no section for the block "Commands"/);
  assert.deepEqual(result.problems, ['the model declined the request']);
  fs.mkdirSync(path.join(root, 'phases/01-demo/02-other/docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'phases/01-demo/02-other/docs/en.md'), 'serve --listen 8000\n');
  const sneaky = poster('--listen').replace(`from: ${DOC}\n\n| Task`, `from: ${LESSON}/../02-other/docs/en.md\n\n| Task`);
  client = fakeClient([reply(sneaky), critique(), reply(sneaky), critique(), reply(sneaky)]);
  result = await generate.generateTopic({ entry: entry(root), client, root, escalation: '' });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(problem => /not a plain repository path|not a source of this topic/.test(problem)));
});

test('evidence references that do not resolve go back to the model', async () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'phases/01-demo/02-other/docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'phases/01-demo/02-other/docs/en.md'), 'serve --port 8000\n');
  const cases = [
    ['L01/docs/missing.md:3', /L01\/docs\/missing\.md \(phases\/01-demo\/01-serving\/docs\/missing\.md\) does not exist/],
    ['phases/01-demo/02-other/docs/en.md:1', /phases\/01-demo\/02-other\/docs\/en\.md \(phases\/01-demo\/02-other\/docs\/en\.md\) is not in a source of this topic/],
    ['L01/d:99', /L01\/d:99 is outside phases\/01-demo\/01-serving\/docs\/en\.md \(5 lines\)/],
    ['L01/../02-other/docs/en.md:1', /is not a plain repository path/],
  ];
  for (const [ref, pattern] of cases) {
    const client = fakeClient([reply(poster(), evidence(BLOCKS, ref)), critique(), reply(poster())]);
    const result = await generate.generateTopic({ entry: entry(root), client, root });
    assert.equal(result.ok, true, ref);
    const feedback = client.calls[1].messages[2].content;
    assert.match(feedback, pattern, ref);
    assert.doesNotMatch(feedback, /gives no valid path:line/, ref);
  }
  const lists = evidence().replace('L01 = ', 'L01, L02 = ');
  const client = fakeClient([reply(poster(), lists), critique(), reply(poster())]);
  await generate.generateTopic({ entry: entry(root), client, root });
  assert.match(client.calls[1].messages[2].content, /list or a range of keys/);
  const header = `# Evidence: cheatsheets/demo-serving.md\n\nAbbreviations: L01 = ${LESSON}, d = docs/en.md.\n\n`;
  const bullets = { Tasks: '- fact: L01/d:1\n', Commands: '- fact: L01/d:99\n' };
  const unprovenText = header + BLOCKS.map(([title]) => `## ${title}\n${bullets[title] || '- a: L01/d:1\n- b: L01/d:2\n- c: L01/d:3\n- d: L01/d:4\n'}`).join('\n');
  const unproven = fakeClient([reply(poster(), unprovenText), critique(), reply(poster())]);
  await generate.generateTopic({ entry: entry(root), client: unproven, root });
  const unprovenFeedback = unproven.calls[1].messages[2].content;
  assert.match(unprovenFeedback, /the evidence section for "Tasks" cites 1 of 4 facts/);
  assert.match(unprovenFeedback, /the evidence section for "Commands" gives no valid path:line/);
});

test('main writes missing topics, honours --model and writes a summary with cost', async () => {
  const root = fixture();
  const summary = path.join(root, 'summary.json');
  const client = fakeClient([reply(poster())]);
  const out = { log() {}, error() {} };
  const code = await generate.main(['--missing', '--model', 'opus', '--summary', summary], { client, root, out });
  assert.equal(code, 0);
  assert.equal(client.calls[0].model, 'claude-opus-5-5');
  const written = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.deepEqual(written.written, ['demo-serving']);
  assert.equal(written.tokens, 50000);
  assert.equal(written.topics[0].score, 100);
  assert.equal(written.topics[0].model, 'claude-opus-5-5');
  assert.equal(written.cost, (30000 * 4 + 8000 * 20 + 12000 * 0.2) / 1e6);
  const status = JSON.parse((await capture(['--status'], root)).join('\n'));
  assert.deepEqual(status.missing, []);
  assert.deepEqual(status.stale, []);
  fs.appendFileSync(path.join(root, DOC), '\nA new paragraph.\n');
  assert.deepEqual(JSON.parse((await capture(['--status'], root)).join('\n')).stale, ['demo-serving']);
});

test('the token budget stops retries, and the topic cap leaves topics for the next run', async () => {
  const root = fixture();
  const client = fakeClient([reply(poster('--listen')), critique(), reply(poster())]);
  const result = await generate.generateTopic({ entry: entry(root), client, root, budgetLeft: 1000 });
  assert.equal(result.ok, false);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(result.problems, ['the token budget ran out before the next retry']);
  const summary = path.join(root, 'summary.json');
  const code = await generate.main(['--missing', '--limit', '0', '--summary', summary], { client: fakeClient([reply(poster())]), root, out: { log() {}, error() {} } });
  assert.equal(code, 0);
});

test('haiku pricing switches to the long-prompt rate above 100k input tokens', () => {
  const short = generate.callCost({ input_tokens: 50000, output_tokens: 10000 }, 'claude-haiku-5-5');
  const long = generate.callCost({ input_tokens: 150000, output_tokens: 10000 }, 'claude-haiku-5-5');
  assert.equal(short, (50000 * 0.1 + 10000 * 0.5) / 1e6);
  assert.equal(long, (150000 * 0.5 + 10000 * 2.5) / 1e6);
});

test('markdown sources keep headings, code, tables, lists and fact sentences', () => {
  const text = '# Title\n\nA story with no facts at all here\nThe default is 8000. Nothing else.\n\n| a | b |\n\n```py\nx = 1\n```\n- item\n';
  const trimmed = generate.trimMarkdown(text);
  assert.match(trimmed, /# Title/);
  assert.match(trimmed, /The default is 8000\./);
  assert.doesNotMatch(trimmed, /story|Nothing else/);
  assert.match(trimmed, /\| a \| b \|/);
  assert.match(trimmed, /x = 1/);
  assert.match(trimmed, /- item/);
});

test('main without a client or a key stops with code 2', async () => {
  const root = fixture();
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(await generate.main(['--missing'], { root, out: { log() {}, error() {} } }), 2);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('stamping refuses a sheet whose blocks cite a removed source', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'cheatsheets/demo-serving.md'), poster());
  const moved = { ...entry(root), sources: ['phases/01-demo/09-new'] };
  assert.throws(() => generate.stampTopic(moved, root), /not a source of this topic/);
  generate.stampTopic(entry(root), root);
  assert.match(fs.readFileSync(path.join(root, 'cheatsheets/demo-serving.md'), 'utf8'), /source_hash: [0-9a-f]{16}/);
});

test('the run report lists each topic with its model, rubric score and cost', () => {
  const { report } = require('./report');
  const summary = {
    model: 'claude-haiku-5-5', escalation: 'claude-sonnet-5-5', budget: 1500000, tokens: 90000, cost: 0.21,
    written: ['a', 'b'], escalated: ['b'], failed: [{ id: 'c', steps: [], problems: ['"--x" is not in its from files'] }], skipped: ['d'],
    topics: [
      { id: 'a', ok: true, model: 'claude-haiku-5-5', score: 100, steps: ['draft'], tokens: 40000, cost: 0.01 },
      { id: 'b', ok: true, model: 'claude-sonnet-5-5', score: 100, steps: ['draft', 'critique', 'revise', 'escalate'], tokens: 50000, cost: 0.2 },
      { id: 'c', ok: false, model: 'claude-haiku-5-5', score: 82, steps: ['draft'], tokens: 0, cost: 0 },
    ],
  };
  const body = report(summary, 'pr');
  assert.match(body, /\| `a` \| written \| haiku-5-5 \| 100 \| 1 \| 40000 \| \$0\.010 \|/);
  assert.match(body, /\| `b` \| written \| sonnet-5-5 \| 100 \| 4 \|/);
  assert.match(body, /Escalated to sonnet-5-5: `b`/);
  assert.match(body, /Nothing was committed for these topics:\n- `c`/);
  assert.match(body, /Not started because of the topic cap or the token budget: `d`/);
  assert.match(report(summary, 'commit'), /^chore\(cheatsheets\): write 2 sheets/);
});

test('codes avoid the codes that other sheets use', () => {
  const codes = generate.codeCandidates('Demo Serving');
  assert.equal(codes[0], 'DS');
  assert.ok(codes.includes('DE'));
});

async function capture(argv, root) {
  const lines = [];
  await generate.main(argv, { root, out: { log: line => lines.push(line), error: line => lines.push(line) } });
  return lines;
}
