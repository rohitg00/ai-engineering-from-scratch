const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bank = require('./validate');

const root = path.resolve(__dirname, '..', '..');
const QUESTION = 'interviews/questions/inference-serving/prefix-cache-order.md';
const SCENARIO = 'interviews/scenarios/prefix-cache-inflated-benchmark';

function withCopy(mutate, { readmes = false } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-interviews-'));
  try {
    for (const name of ['phases', 'manuals', 'practice', 'cheatsheets', 'learning-paths']) fs.symlinkSync(path.join(root, name), path.join(temp, name));
    fs.cpSync(path.join(root, 'interviews'), path.join(temp, 'interviews'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'scripts', 'interviews'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts', 'interviews', 'denylist.txt'), path.join(temp, 'scripts', 'interviews', 'denylist.txt'));
    mutate(temp);
    const loaded = bank.loadBank(temp);
    return readmes ? loaded.errors.concat(bank.staleReadmes(loaded)) : loaded.errors;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function edit(temp, file, from, to) {
  const full = path.join(temp, file);
  const text = fs.readFileSync(full, 'utf8');
  assert.ok(text.includes(from), `${file} does not contain ${from}`);
  fs.writeFileSync(full, text.replace(from, to));
}

function expectError(mutate, pattern, options) {
  const errors = withCopy(mutate, options);
  assert.ok(errors.some(error => pattern.test(error)), `expected ${pattern}, got:\n${errors.join('\n')}`);
}

test('the bank in the repository passes', () => {
  const loaded = bank.loadBank(root);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.cards.length, 23);
  assert.equal(loaded.groups.length, 6);
  assert.ok(loaded.roles.some(role => role.id === 'inference-engineer'));
  assert.ok(loaded.questions.filter(item => item.card === 'inference-serving').length >= 3);
  assert.ok(loaded.scenarios.length >= 1);
});

test('a copy of the bank with no change passes', () => {
  assert.deepEqual(withCopy(() => {}), []);
});

test('the YAML subset reads maps, lists, flow lists and quoted values', () => {
  const value = bank.parseYaml('a: 1\nb: [x, y]\nc:\n  - id: one\n    d: "k: v"\n  - two\ne:\n  f: g\nh: []\n', 'test');
  assert.deepEqual(value, { a: 1, b: ['x', 'y'], c: [{ id: 'one', d: 'k: v' }, 'two'], e: { f: 'g' }, h: [] });
  assert.throws(() => bank.parseYaml('a: b: c\n', 'test'), /double quotes/);
  assert.throws(() => bank.parseYaml('a: 1\na: 2\n', 'test'), /duplicate key/);
  assert.throws(() => bank.parseYaml('a: 1\n   b: 2\n', 'test'), /indentation/);
});

test('sentences, number tokens and answer spans are counted as the contract says', () => {
  assert.equal(bank.sentenceCount('One idea. Two ideas at 4.8 times. Three `a.b` here.'), 3);
  assert.deepEqual(bank.numberTokens('1,213 ms and 4.8x at [x](../12-y/) 7'), ['1213', '4.8', '7']);
  assert.equal(bank.needsSource('7'), false);
  assert.equal(bank.needsSource('10'), true);
  assert.equal(bank.needsSource('0.5'), true);
  assert.deepEqual(bank.sharedSpans('the cache matches from the first token', 'Why? The cache matches from the first token.').length > 0, true);
  assert.deepEqual(bank.sharedSpans('a short answer', 'a different prompt'), []);
});

test('headings give the same anchors as GitHub', () => {
  const slugs = bank.headingSlugs('# A title\n## Reset the prefix cache between runs\n## Read it, block by block\n## A title\n```text\n## not a heading\n```\n');
  assert.ok(slugs.has('reset-the-prefix-cache-between-runs'));
  assert.ok(slugs.has('read-it-block-by-block'));
  assert.ok(slugs.has('a-title-1'));
  assert.equal(slugs.has('not-a-heading'), false);
});

test('front matter rules fail with a clear message', () => {
  expectError(temp => edit(temp, QUESTION, 'title: Why one ID at the top of a prompt kills the cache', `title: ${'x'.repeat(61)}`), /title must have 1 to 60 characters/);
  expectError(temp => edit(temp, QUESTION, 'kind: debug', 'kind: trivia'), /kind must be one of/);
  expectError(temp => edit(temp, QUESTION, 'level: 2', 'level: 5'), /level must be 1 to 4/);
  expectError(temp => edit(temp, QUESTION, 'rounds: [debugging, ml-depth]', 'rounds: [lunch]'), /unknown round lunch/);
  expectError(temp => edit(temp, QUESTION, 'minutes: 8', 'minutes: 90'), /minutes must be 2 to 60/);
  expectError(temp => edit(temp, QUESTION, 'phases/17-infrastructure-and-production/06-sglang-radixattention]', 'phases/01-math-foundations/08-optimization]'), /does not list lesson/);
  expectError(temp => edit(temp, QUESTION, 'sglang-101#s-prefix-friendly-prompts', 'sglang-101#s-no-such-section'), /has no section s-no-such-section/);
  expectError(temp => edit(temp, QUESTION, 'updated: 2026-11-03', 'updated: 2026-13-03'), /updated must be a date/);
  expectError(temp => edit(temp, QUESTION, 'card: inference-serving', 'card: rag'), /the folder gives inference-serving/);
});

test('body rules fail with a clear message', () => {
  expectError(temp => edit(temp, QUESTION, '## Wrong answers', '## Wrong ideas'), /the ## sections must be/);
  expectError(temp => edit(temp, QUESTION, '- **Level 3:** A team tunes', '- **Level 1:** A team tunes'), /follow-up levels must rise/);
  expectError(temp => edit(temp, QUESTION, '- "Give the cache more memory."', '- Give the cache more memory.'), /Wrong answers item must be/);
  expectError(temp => edit(temp, QUESTION, 'Then prove the fix with the cached-token counters.', 'Then prove the fix. Read the counters. Log it.'), /Short answer must have 2 to 4 sentences/);
  expectError(temp => edit(temp, QUESTION, 'the first token is slow.', 'the first token is slow. A new ID at the start makes every later token a miss.'), /shows an answer span/);
});

test('the number rule rejects a number that no named source holds', () => {
  expectError(temp => edit(temp, QUESTION, 'the cost was 43 ms', 'the cost was 4321 ms'), /numbers that no named source holds: 4321/);
});

test('links, anchors, dashes, http and company names are checked', () => {
  expectError(temp => edit(temp, QUESTION, '3-4-prefix-friendly-prompts.md)', '3-4-no-such-file.md)'), /does not exist/);
  expectError(temp => edit(temp, 'interviews/questions/inference-serving/goodput-sets-the-cap.md', '#goodput-finds-the-knee-that-throughput-hides', '#no-such-heading'), /no heading #no-such-heading/);
  expectError(temp => edit(temp, QUESTION, 'Check the chat template too.', 'Check the chat template \u2014 too.'), /em dash or en dash/);
  expectError(temp => edit(temp, QUESTION, 'Check the chat template too.', 'Check https://example.test too.'), /not http links/);
  expectError(temp => edit(temp, QUESTION, 'Check the chat template too.', 'Check the OpenAI template too.'), /denylist: openai/);
});

test('evidence listings must match their source and appear once in Evidence', () => {
  expectError(temp => edit(temp, `${SCENARIO}/evidence/prefill-lines.txt`, '#cached-token: 6879', '#cached-token: 9999'), /does not match .* byte for byte/);
  expectError(temp => edit(temp, `${SCENARIO}/evidence/prefill-lines.txt`, 'lines: 341-342', 'lines: 341-99999'), /lines must be N-M/);
  expectError(temp => edit(temp, `${SCENARIO}/README.md`, '- [One load four times in a row](evidence/flush-test.txt)\n', ''), /evidence\/flush-test.txt is not listed/);
  expectError(temp => edit(temp, `${SCENARIO}/evidence/flush-test.txt`, 'source: manuals/sglang-101/capture/gpu/out-l4/prefix-cache-flush.txt', 'source: manuals/sglang-101/capture/gpu/out-l4/load-flushed-vs-unflushed.txt'), /is not in the source list/);
  expectError(temp => edit(temp, `${SCENARIO}/README.md`, 'system:\n  version: SGLang 0.5.22\n', 'system:\n'), /system has no version/);
});

test('a generated README that is out of date fails, and --write makes it current', () => {
  expectError(temp => edit(temp, 'interviews/README.md', '# Interviews and scenarios', '# Old title'), /interviews\/README.md is not current/, { readmes: true });
  const errors = withCopy(temp => {
    edit(temp, 'interviews/README.md', '# Interviews and scenarios', '# Old title');
    bank.writeReadmes(bank.loadBank(temp));
  }, { readmes: true });
  assert.deepEqual(errors, []);
});

test('a broken link in a card summary fails in the generated README', () => {
  expectError(temp => edit(temp, 'interviews/topics.yaml', 'every later answer builds on.', 'every later answer builds on. Read [the guide](../manuals/missing.md).'), /interviews\/README.md:\d+: \.\.\/manuals\/missing.md does not exist/);
});

test('the card and role lists are checked', () => {
  expectError(temp => edit(temp, 'interviews/roles.yaml', 'cards: [inference-serving,', 'cards: [no-such-card, inference-serving,'), /unknown card no-such-card/);
  expectError(temp => edit(temp, 'interviews/topics.yaml', '    group: models\n    planned: 30', '    group: nowhere\n    planned: 30'), /unknown group nowhere/);
});

test('an item tags only roles whose card list holds its card', () => {
  expectError(temp => edit(temp, QUESTION, 'roles: [inference-engineer, applied-ai-engineer, agentic-ai-engineer]', 'roles: [inference-engineer, ai-data-engineer]'), /role ai-data-engineer does not list card inference-serving/);
  expectError(temp => edit(temp, 'interviews/roles.yaml', 'cards: [inference-serving, gpu-memory-quantization,', 'cards: [gpu-memory-quantization,'), /prefix-cache-order.md: role inference-engineer does not list card inference-serving/);
});

test('evidence is compared byte for byte, line ends included', () => {
  const body = text => bank.parseEvidence(`title: t\nsource: s\nlang: text\nnote: n\n---\n${text}`, 'x').body;
  assert.equal(body('x\n'), bank.expectedBody('x\n').body);
  assert.notEqual(body('x\r\n'), bank.expectedBody('x\n').body);
  assert.notEqual(body('x'), bank.expectedBody('x\n').body);
  assert.notEqual(body('x\n\n'), bank.expectedBody('x\n').body);
  assert.notEqual(body('x\n'), bank.expectedBody('x').body);
  assert.equal(body('x\r\n'), bank.expectedBody('x\r\n').body);
  assert.equal(body('b\r\n'), bank.expectedBody('a\r\nb\r\nc\r\n', '2-2').body);
  assert.notEqual(body('b\n'), bank.expectedBody('a\r\nb\r\nc\r\n', '2-2').body);
  assert.notEqual(body('b'), bank.expectedBody('a\nb\nc\n', '2-2').body);
  assert.equal(body('c'), bank.expectedBody('a\nb\nc', '3-3').body);
  assert.match(bank.expectedBody('a\nb\n', '2-3').error, /lines must be N-M inside 1-2/);
  assert.equal(bank.parseEvidence('title: t\r\nsource: s\r\n---\r\nx\r\n', 'x').header.source, 's');
});

test('an evidence header does not supply numbers to the number rule', () => {
  expectError(temp => {
    edit(temp, `${SCENARIO}/evidence/flush-test.txt`, 'note: A smaller model on another GPU.', 'note: A smaller model on another GPU at 31337 MHz.');
    edit(temp, `${SCENARIO}/README.md`, 'measured the size of the effect.', 'measured the size of the effect at 31337 MHz.');
  }, /numbers that no named source holds: 31337/);
});

test('each loop round names a known card', () => {
  expectError(temp => edit(temp, 'interviews/loops/inference-engineer.md', ' (card: coding)', ''), /a round must be/);
  expectError(temp => edit(temp, 'interviews/loops/inference-engineer.md', '(card: coding)', '(card: no-such-card)'), /unknown card no-such-card/);
});
