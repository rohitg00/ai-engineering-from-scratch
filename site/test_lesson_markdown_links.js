const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMd } = require('./lesson-markdown.js');

function renderInline(markdown) {
  const html = parseMd(markdown);
  assert.match(html, /^<p>.*<\/p>$/);
  return html.slice(3, -4);
}

test('inline links keep balanced parentheses in URL destinations', () => {
  const html = renderInline(
    '[Goal-Directed Requirements Acquisition](https://doi.org/10.1016/0167-6423(93)90021-G)'
  );

  assert.match(html, /href="https:\/\/doi\.org\/10\.1016\/0167-6423\(93\)90021-G"/);
  assert.match(html, />Goal-Directed Requirements Acquisition<\/a>$/);
  assert.doesNotMatch(html, /90021-G<\/a>/);
});

test('ordinary inline links still render as external links', () => {
  const html = renderInline('[Example](https://example.com/path)');

  assert.equal(
    html,
    '<a href="https://example.com/path" target="_blank" rel="noopener">Example</a>'
  );
});

test('a closing bracket in preceding text does not become part of the link label', () => {
  const html = renderInline('[draft] See [Example](https://example.com)');

  assert.equal(
    html,
    '[draft] See <a href="https://example.com" target="_blank" rel="noopener">Example</a>'
  );
});

test('escaped parentheses in a destination are unescaped in the rendered URL', () => {
  const html = renderInline('[Example](https://example.com/foo\\(bar\\))');

  assert.equal(
    html,
    '<a href="https://example.com/foo(bar)" target="_blank" rel="noopener">Example</a>'
  );
});

test('an escaped closing bracket stays inside the link label', () => {
  const html = renderInline('[a\\]b](https://example.com)');

  assert.equal(
    html,
    '<a href="https://example.com" target="_blank" rel="noopener">a]b</a>'
  );
});

test('an escaped opening bracket does not start an inline link', () => {
  const html = renderInline('\\[Example](https://example.com)');

  assert.equal(html, '[Example](https://example.com)');
});
