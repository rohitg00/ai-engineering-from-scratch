'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const topicMap = require('./cheatsheet-topics');
const sheets = require('./build-cheatsheets');
const evidenceCheck = require('./cheatsheet-evidence');

const ROOT = path.resolve(__dirname, '..');

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-map-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test('the topic map parses and reports bad entries', () => {
  const good = topicMap.parseTopicMap('- id: demo\n  title: Demo\n  kind: concept\n  sources:\n    - phases/01-a/01-b\n');
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.topics[0].sources, ['phases/01-a/01-b']);
  const bad = topicMap.parseTopicMap('- id: Demo\n  title: Demo\n  kind: story\n  colour: red\n- id: Demo\n  title: Again\n  kind: concept\n  sources:\n    - x\n').errors.join('\n');
  assert.match(bad, /must be lower case/);
  assert.match(bad, /kind must be one of/);
  assert.match(bad, /unexpected line "colour: red"/);
  assert.match(bad, /appears twice/);
  assert.match(bad, /needs sources/);
  const quoted = topicMap.parseTopicMap('- id: demo\n  title: "Demo: one"\n  kind: concept\n  sources:\n    - x\n');
  assert.deepEqual(quoted.errors, []);
  assert.equal(quoted.topics[0].title, 'Demo: one');
  assert.match(topicMap.parseTopicMap('- id: demo\n  title: Demo: one\n  kind: concept\n  sources:\n    - x\n').errors.join('\n'), /put double quotes/);
});

test('every lesson, manual and project of the repository is in a topic', () => {
  const map = topicMap.loadTopicMap(ROOT);
  assert.deepEqual(map.errors, []);
  const problems = topicMap.mapProblems(map, sheets.loadTopics(ROOT), ROOT);
  assert.deepEqual(problems, []);
  const status = topicMap.mapStatus(map, sheets.loadTopics(ROOT), ROOT);
  assert.equal(status.coverage.lessons, status.coverage.lessonTotal);
  assert.equal(status.coverage.covered, status.coverage.total);
});

test('an uncovered lesson, a wrong source list and a stale hash are found', () => {
  const root = fixture({
    'phases/01-a/01-b/docs/en.md': '# B\n',
    'phases/01-a/02-c/docs/en.md': '# C\n',
    'projects/demo/project.json': '{}\n',
    'projects/_template/project.json': '{}\n',
    'cheatsheets/topics.yaml': '- id: demo\n  title: Demo\n  kind: concept\n  sources:\n    - phases/01-a/01-b\n',
  });
  const map = topicMap.loadTopicMap(root);
  const sheet = { id: 'demo', title: 'Demo', file: 'cheatsheets/demo.md', sources: ['phases/01-a/02-c'], sourceHash: 'old' };
  const problems = topicMap.mapProblems(map, [sheet], root).join('\n');
  assert.match(problems, /the lesson phases\/01-a\/02-c is in no topic/);
  assert.match(problems, /the project projects\/demo is in no topic/);
  assert.doesNotMatch(problems, /_template/);
  assert.match(problems, /sources must match/);
  assert.deepEqual(topicMap.mapStatus(map, [sheet], root).stale, ['demo']);
  assert.deepEqual(topicMap.mapStatus(map, [], root).missing, ['demo']);
});

test('the source hash covers docs/en.md and code, not translations or quizzes', () => {
  const root = fixture({
    'phases/01-a/01-b/docs/en.md': '# B\n',
    'phases/01-a/01-b/docs/es.md': '# B es\n',
    'phases/01-a/01-b/quiz.json': '{}\n',
    'phases/01-a/01-b/code/main.py': 'x = 1\n',
  });
  assert.deepEqual(topicMap.sourceFiles('phases/01-a/01-b', root), ['phases/01-a/01-b/code/main.py', 'phases/01-a/01-b/docs/en.md']);
  const before = topicMap.sourceHash(['phases/01-a/01-b'], root);
  fs.writeFileSync(path.join(root, 'phases/01-a/01-b/docs/es.md'), '# changed\n');
  assert.equal(topicMap.sourceHash(['phases/01-a/01-b'], root), before);
  fs.writeFileSync(path.join(root, 'phases/01-a/01-b/code/main.py'), 'x = 2\n');
  assert.notEqual(topicMap.sourceHash(['phases/01-a/01-b'], root), before);
});

test('every sheet passes the quality rubric', () => {
  const failing = sheets.loadTopics(ROOT).map(sheets.qualityReport).filter(report => !report.pass);
  assert.deepEqual(failing.map(report => `${report.id}: ${report.failures.join('; ')}`), []);
});

test('the rubric reports thin blocks, duplicates, empty defaults and a missing diagram', () => {
  const topic = sheets.parseTopic(`---\nid: demo\ntitle: Demo\nsubtitle: Demo.\nhue: 1\nsources: x\n---\n\n## Tasks\ntype: task-table\nfrom: x\n\n| Task | Code |\n|---|---|\n| Run | Go |\n| Run | Go |\n\n## Defaults\ntype: defaults\nfrom: x\n\n| Setting | Default | Note |\n|---|---|---|\n| Port | Not given | HTTP |\n| Host | 0.0.0.0 | Bind |\n\n## Tips\ntype: tips\nfrom: x\n\n- Only one tip.\n`, 'demo.md');
  topic.kind = 'commands';
  const report = sheets.qualityReport(topic);
  assert.equal(report.pass, false);
  const text = report.failures.join('\n');
  assert.match(text, /blocks: 3 blocks/);
  assert.match(text, /diagram/);
  assert.match(text, /tasks: 2 task or command rows, 8 needed/);
  assert.match(text, /code: an annotated-code block/);
  assert.match(text, /defaults without a value: Port/);
  assert.match(text, /thin blocks: Tips/);
  assert.match(text, /duplicate rows: run go/);
  assert.ok(report.score < 60);
});

test('every sheet records a source hash', () => {
  for (const topic of sheets.loadTopics(ROOT)) assert.match(topic.sourceHash, /^[0-9a-f]{16}$/, topic.file);
});

test('every evidence reference resolves to a line in a source of its topic', () => {
  const map = topicMap.loadTopicMap(ROOT);
  const result = evidenceCheck.checkEvidence(map, sheets.loadTopics(ROOT), ROOT);
  assert.deepEqual(result.problems, []);
  assert.ok(result.refs > 10000);
});

test('evidence references expand abbreviations and reject bad paths and lines', () => {
  const root = fixture({ 'phases/01-a/01-b/docs/en.md': 'one\ntwo\nthree\n', 'phases/01-a/01-b/code/main.py': 'x = 1\n', 'phases/01-a/02-c/docs/en.md': 'one\n' });
  const entry = { id: 'demo', sources: ['phases/01-a/01-b'] };
  const blocks = [{ title: 'Tasks' }, { title: 'Flow (steps)' }];
  const text = refs => `# Evidence: cheatsheets/demo.md\n\nAbbreviations: L01 = phases/01-a/01-b, d = docs/en.md.\n\n## Tasks (task-table)\n- fact: ${refs}\n\n## Flow\n- step: L01/d:1-3, code/main.py:1\n`;
  assert.deepEqual(evidenceCheck.evidenceProblems(text('L01/d:2, 3'), entry, blocks, root), []);
  const problems = evidenceCheck.evidenceProblems(text('L01/d:4; L01/docs/none.md:1; phases/01-a/02-c/docs/en.md:1; L01/../02-c/docs/en.md:1'), entry, blocks, root);
  assert.deepEqual(problems, [
    'evidence line 6: L01/d:4 is outside phases/01-a/01-b/docs/en.md (3 lines)',
    'evidence line 6: L01/docs/none.md (phases/01-a/01-b/docs/none.md) does not exist',
    'evidence line 6: phases/01-a/02-c/docs/en.md (phases/01-a/02-c/docs/en.md) is not in a source of this topic',
    'evidence line 6: L01/../02-c/docs/en.md is not a plain repository path',
    'the evidence section for "Tasks" gives no valid path:line',
  ]);
});

test('a from path outside the topic sources is reported', () => {
  const root = fixture({ 'phases/01-a/01-b/docs/en.md': 'Run `serve --port 8000`.\n', 'phases/01-a/02-c/docs/en.md': 'Run `serve --port 8000`.\n' });
  const poster = from => `---\nid: demo\ntitle: Demo\ncode: DM\nsubtitle: A demo.\nhue: 10\nsources: phases/01-a/01-b\n---\n\n## Tasks\ntype: task-table\nfrom: ${from}\n\n| Task | Code |\n|---|---|\n| Serve | \`serve --port 8000\` |\n`;
  const inside = sheets.parseTopic(poster('phases/01-a/01-b/docs/en.md'), 'cheatsheets/demo.md');
  assert.deepEqual(sheets.checkTopic(inside, root).filter(problem => /source of this topic/.test(problem)), []);
  const outside = sheets.parseTopic(poster('phases/01-a/02-c/docs/en.md'), 'cheatsheets/demo.md');
  assert.ok(sheets.checkTopic(outside, root).some(problem => /names phases\/01-a\/02-c\/docs\/en\.md, which is not a source of this topic/.test(problem)));
});
