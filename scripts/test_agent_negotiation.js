const assert = require('node:assert/strict');
const test = require('node:test');
const handler = require('../api/markdown.js');
const versionedHandler = require('../api/v1/markdown.js');

function request(accept, requestPath = '/', method = 'GET', serve = handler) {
  const headers = {};
  let body = '';
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(value) { body = value || ''; },
  };
  serve({ method, headers: { accept }, query: { path: requestPath } }, res);
  return { res, headers, body };
}

test('serves Markdown for the canonical homepage when preferred', () => {
  const result = request('text/markdown, text/html;q=0.8');
  assert.equal(result.res.statusCode, 200);
  assert.match(result.headers['content-type'], /^text\/markdown/);
  assert.equal(result.headers.vary, 'Accept, Accept-Encoding');
  assert.equal(result.headers['x-api-version'], '1');
  assert.equal(Object.keys(result.headers).some(name => /ratelimit/i.test(name)), false);
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
  assert.equal(result.headers['content-type'], 'application/problem+json; charset=utf-8');
  assert.deepEqual(JSON.parse(result.body), {
    type: 'about:blank', title: 'Not Acceptable', status: 406,
    code: 'representation_not_supported', detail: 'Request text/html or text/markdown.',
    hint: 'See /docs and /openapi.json for supported requests.',
  });
  assert.equal(result.headers['cache-control'], 'no-store');
});

test('returns an agent-readable 404 for an unknown negotiated route', () => {
  const result = request('text/markdown', '/does-not-exist');
  assert.equal(result.res.statusCode, 404);
  assert.match(result.headers['content-type'], /^text\/markdown/);
  assert.match(result.body, /llms\.txt/);
});

test('versioned API keeps the same success and error contract', () => {
  assert.equal(versionedHandler, handler);
  for (const [accept, route] of [
    ['text/markdown', '/'], ['text/html', '/about'],
    ['application/json', '/'], ['application/json', '/missing'],
  ]) {
    const legacy = request(accept, route);
    const versioned = request(accept, route, 'GET', versionedHandler);
    assert.equal(versioned.res.statusCode, legacy.res.statusCode);
    assert.deepEqual(versioned.headers, legacy.headers);
    assert.equal(versioned.body, legacy.body);
  }
});

test('unknown paths preserve HTML and Markdown recovery and offer typed API errors', () => {
  for (const route of ['/missing', 'toString', 'constructor', '__proto__', '/../../README.md']) {
    const html = request('text/html', route);
    assert.equal(html.res.statusCode, 404);
    assert.match(html.headers['content-type'], /^text\/html/);
    assert.match(html.body, /sitemap\.xml/);
    const markdown = request('text/markdown', route);
    assert.equal(markdown.res.statusCode, 404);
    assert.match(markdown.body, /\[curriculum index\]\(\/llms\.txt\)/);
    const json = request('application/json', route);
    assert.equal(json.res.statusCode, 404);
    assert.match(json.headers['content-type'], /^application\/problem\+json/);
    assert.equal(JSON.parse(json.body).status, 404);
    assert.equal(JSON.parse(json.body).code, 'resource_not_found');
  }
});

test('explicit rejections take precedence over wildcard preferences', () => {
  for (const accept of ['text/html;q=0, text/markdown;q=0', '*/*;q=0', 'text/*;q=0, */*;q=1']) {
    assert.equal(request(accept).res.statusCode, 406, accept);
  }
  assert.match(request('text/markdown;q=0, */*').headers['content-type'], /^text\/html/);
  assert.match(request('text/html;q=0, text/*').headers['content-type'], /^text\/markdown/);
  assert.match(request('text/*;q=0.2, */*;q=1, text/html;q=0.5').headers['content-type'], /^text\/html/);
  assert.match(request(undefined).headers['content-type'], /^text\/html/);
  assert.match(request('*/*').headers['content-type'], /^text\/html/);
});

test('GET and HEAD return identical metadata with no HEAD body', () => {
  for (const [accept, route] of [
    ['text/html', '/'], ['text/markdown', '/'], ['text/html', '/missing'],
    ['text/markdown', '/missing'], ['application/json', '/missing'], ['application/json', '/'],
  ]) {
    const get = request(accept, route);
    const head = request(accept, route, 'HEAD');
    assert.equal(head.res.statusCode, get.res.statusCode);
    assert.deepEqual(head.headers, get.headers);
    assert.equal(head.body, '');
  }
});

test('public resource API only permits reads', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const result = request('text/markdown', '/', method);
    assert.equal(result.res.statusCode, 405);
    assert.equal(result.headers.allow, 'GET, HEAD');
    assert.equal(JSON.parse(result.body).code, 'method_not_allowed');
  }
});
