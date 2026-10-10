const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
const start = source.indexOf('      function inlineFormat(text) {');
const end = source.indexOf('      function slugify(text) {', start);
assert.notEqual(start, -1, 'inlineFormat function should exist');
assert.notEqual(end, -1, 'inlineFormat function end marker should exist');

const context = {};
vm.runInNewContext(source.slice(start, end) + '\nthis.inlineFormat = inlineFormat;', context);

test('inline links keep balanced parentheses in URL destinations', () => {
  const html = context.inlineFormat(
    '[Goal-Directed Requirements Acquisition](https://doi.org/10.1016/0167-6423(93)90021-G)'
  );

  assert.match(html, /href="https:\/\/doi\.org\/10\.1016\/0167-6423\(93\)90021-G"/);
  assert.match(html, />Goal-Directed Requirements Acquisition<\/a>$/);
  assert.doesNotMatch(html, /90021-G<\/a>/);
});

test('ordinary inline links still render as external links', () => {
  const html = context.inlineFormat('[Example](https://example.com/path)');

  assert.equal(
    html,
    '<a href="https://example.com/path" target="_blank" rel="noopener">Example</a>'
  );
});

test('a closing bracket in preceding text does not become part of the link label', () => {
  const html = context.inlineFormat('[draft] See [Example](https://example.com)');

  assert.equal(
    html,
    '[draft] See <a href="https://example.com" target="_blank" rel="noopener">Example</a>'
  );
});

test('escaped parentheses in a destination are unescaped in the rendered URL', () => {
  const html = context.inlineFormat('[Example](https://example.com/foo\\(bar\\))');

  assert.equal(
    html,
    '<a href="https://example.com/foo(bar)" target="_blank" rel="noopener">Example</a>'
  );
});

test('an escaped closing bracket stays inside the link label', () => {
  const html = context.inlineFormat('[a\\]b](https://example.com)');

  assert.equal(
    html,
    '<a href="https://example.com" target="_blank" rel="noopener">a]b</a>'
  );
});
