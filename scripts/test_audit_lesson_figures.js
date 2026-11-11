'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { MIN_TEXT_PX, discoverFences, parseArgs, report } = require('./audit_lesson_figures.js');

function lesson(root, relative, markdown) {
  const file = path.join(root, relative, 'docs', 'en.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, markdown);
}

function silenced(run) {
  const original = console.log;
  const lines = [];
  console.log = line => lines.push(String(line));
  try {
    return { value: run(), lines };
  } finally {
    console.log = original;
  }
}

test('fences keep their config and list every lesson that uses them', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-figure-audit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  lesson(root, 'phases/01-a/01-b', '# A\n\n```figure\nkv-cache-sizer\n```\n\n```python\nprint(1)\n```\n');
  lesson(root, 'phases/01-a/02-c', '# B\n\n```figure\niso-machine   {"machine":"kv-cache"}\n```\n\n```figure\nkv-cache-sizer\n```\n');
  lesson(root, 'certifications/claude/lessons/01-d', '# C\n\n```figure\r\ncf-lanes\r\n```\n');
  fs.writeFileSync(path.join(root, 'phases/01-a/01-b/docs/fr.md'), '```figure\nignored-translation\n```\n');

  const fences = discoverFences(root);

  assert.deepEqual([...fences.keys()].sort(), ['cf-lanes', 'iso-machine {"machine":"kv-cache"}', 'kv-cache-sizer']);
  assert.deepEqual(fences.get('kv-cache-sizer'), ['phases/01-a/01-b/docs/en.md', 'phases/01-a/02-c/docs/en.md']);
});

test('a repository with no lessons has no fences', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-figure-audit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(discoverFences(root).size, 0);
});

test('the report counts failing figures, not findings', () => {
  const rows = [
    { fence: 'a', provider: 'figures-x.js', where: 'desktop/still', rule: 'text-clip', detail: '"x" leaves the drawing by 9px' },
    { fence: 'a', provider: 'figures-x.js', where: 'phone/still', rule: 'text-clip', detail: '"x" leaves the drawing by 9px' },
    { fence: 'a', provider: 'figures-x.js', where: 'phone/still', rule: 'text-overlap', detail: '"x" overlaps "y"' },
    { fence: 'b', provider: 'figures-y.js', where: 'desktop/motion', rule: 'shape-clip', detail: '<circle> leaves the drawing by 7px' },
  ];
  const { value, lines } = silenced(() => report({ rows, figures: 12 }));

  assert.equal(value, 2);
  assert.ok(lines.includes('TOTAL 2'));
  assert.ok(lines.includes('FIGURES 12'));
  assert.ok(lines.includes('text-clip: 1 figures'));
  assert.ok(lines.some(line => line.includes('[desktop/still, phone/still]')));
});

test('a clean run reports zero', () => {
  const { value, lines } = silenced(() => report({ rows: [], figures: 3 }));
  assert.equal(value, 0);
  assert.deepEqual(lines, ['FIGURES 3', 'TOTAL 0']);
});

test('the runtime and the audit share one text floor', () => {
  const runtime = fs.readFileSync(path.join(__dirname, '..', 'site', 'lesson-figures.js'), 'utf8');
  const match = /var MIN_TEXT_PX = (\d+);/.exec(runtime);
  assert.ok(match, 'lesson-figures.js must declare MIN_TEXT_PX');
  assert.equal(Number(match[1]), MIN_TEXT_PX);
});

test('the command line rejects a flag with no usable value', () => {
  assert.deepEqual([...parseArgs(['--only', 'a, b', '--all']).only], ['a', 'b']);
  assert.equal(parseArgs(['--all']).all, true);
  assert.throws(() => parseArgs(['--only', '']), /--only needs a value/);
  assert.throws(() => parseArgs(['--only', ' , ']), /at least one figure name/);
  assert.throws(() => parseArgs(['--shots', '--all']), /--shots needs a value/);
  assert.throws(() => parseArgs(['--json']), /--json needs a value/);
  assert.throws(() => parseArgs(['--fast']), /unknown argument/);
});
