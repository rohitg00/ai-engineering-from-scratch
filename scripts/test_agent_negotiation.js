const assert = require('node:assert/strict');
const test = require('node:test');
const handler = require('../api/markdown.js');

function request(accept, requestPath = '/') {
  const headers = {};
  let body = '';
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(value) { body = value || ''; },
  };
  handler({ headers: { accept }, query: { path: requestPath } }, res);
  return { res, headers, body };
}

test('serves Markdown for the canonical homepage when preferred', () => {
  const result = request('text/markdown, text/html;q=0.8');
  assert.equal(result.res.statusCode, 200);
  assert.match(result.headers['content-type'], /^text\/markdown/);
  assert.equal(result.headers.vary, 'Accept, Accept-Encoding');
  assert.match(result.body, /^# AI Engineering from Scratch/);
});

test('keeps HTML when HTML has the higher quality value', () => {
  const result = request('text/html, text/markdown;q=0.5');
  assert.equal(result.res.statusCode, 200);
  assert.match(result.headers['content-type'], /^text\/html/);
  assert.match(result.body, /<html/i);
});

test('returns 406 when the client rejects both supported types', () => {
  const result = request('application/json');
  assert.equal(result.res.statusCode, 406);
  assert.match(result.body, /Not Acceptable/);
});

test('returns an agent-readable 404 for an unknown negotiated route', () => {
  const result = request('text/markdown', '/does-not-exist');
  assert.equal(result.res.statusCode, 404);
  assert.match(result.headers['content-type'], /^text\/markdown/);
  assert.match(result.body, /llms\.txt/);
});
