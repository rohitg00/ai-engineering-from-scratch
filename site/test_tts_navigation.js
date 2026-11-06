const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'tts.js'), 'utf8');

function extract(name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const end = source.indexOf('\n  }\n', start);
  return source.slice(start, end + 4);
}

function navigator() {
  const state = { chunks: [], index: 0 };
  const neighbourIndex = new Function('state', extract('chunkIndexFor') + extract('neighbourIndex') + 'return neighbourIndex;')(state);
  return function (old, was, rebuilt, index, delta) {
    state.chunks = rebuilt;
    state.index = index;
    return neighbourIndex(old, was, delta);
  };
}

function chunks(texts, els) {
  return texts.map((text, i) => ({ text, el: els ? els[i] : null }));
}

test('skips after a refresh go to the neighbouring passage, not content inserted earlier', () => {
  const run = navigator();
  const old = chunks(['A', 'B', 'C']);
  const rebuilt = chunks(['A', 'X', 'B2', 'C']);
  assert.equal(run(old, 1, rebuilt, 1, 1), 3);
  assert.equal(run(old, 1, rebuilt, 1, -1), 0);
});

test('a repeated passage keeps the occurrence next to the removed one', () => {
  const run = navigator();
  const els = [{}, {}, {}, {}, {}];
  const old = chunks(['A', 'B', 'X', 'B', 'C'], els);
  const kept = chunks(['A', 'B', 'B', 'C'], [els[0], els[1], els[3], els[4]]);
  assert.equal(run(old, 2, kept, 2, 1), 2);
  assert.equal(run(old, 2, kept, 2, -1), 1);
  const replaced = chunks(['A', 'B', 'B', 'C'], [{}, {}, {}, {}]);
  assert.equal(run(old, 2, replaced, 2, 1), 2);
  assert.equal(run(old, 2, replaced, 2, -1), 1);
});

test('skipping past a removed last or first passage stops or clamps', () => {
  const run = navigator();
  assert.equal(run(chunks(['A', 'B', 'C']), 2, chunks(['A', 'B']), 1, 1), 2);
  assert.equal(run(chunks(['A', 'B', 'C']), 0, chunks(['B', 'C']), 0, -1), -1);
});
