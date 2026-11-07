const test = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter } = require('../lib/agent-http');
const { readBounded } = require('../lib/read-bounded');
const { readTranslatedResource, isStaleResource } = require('../lib/agent-content');
const { lessonDocumentSeo } = require('../lib/lesson-document');
const translations = require('../lib/lesson-translations');
const lessonApi = require('../api/lesson');
const resource = require('../api/v1/resource');
const mcp = require('../api/mcp');

const PERCEPTRON = 'phases/03-deep-learning-core/01-the-perceptron';
const HINDI = '# पर्सेप्ट्रोन\n\n> पर्सेप्ट्रॉन तंत्रिका नेटवर्क का परमाणु है।\n\n## अवधारणा\n\nएक न्यूरॉन एक निर्णय लेता है।\n';
const RETRY_CACHE = 'public, max-age=0, s-maxage=300, must-revalidate';

function recorder() {
  const output = { statusCode: 200, headers: {}, body: '' };
  const res = {
    setHeader(name, value) { output.headers[String(name).toLowerCase()] = String(value); },
    removeHeader(name) { delete output.headers[String(name).toLowerCase()]; },
    end(value) { output.body = value == null ? '' : String(value); },
  };
  Object.defineProperty(res, 'statusCode', { get() { return output.statusCode; }, set(value) { output.statusCode = value; } });
  return { output, res };
}

async function invoke(handler, req) {
  const { output, res } = recorder();
  await handler({ method: 'GET', headers: {}, socket: { remoteAddress: '192.0.2.1' }, ...req }, res);
  if (/json/.test(output.headers['content-type'] || '') && output.body) output.json = JSON.parse(output.body);
  return output;
}

const rpc = (handler, body, version = '2025-11-25') => invoke(handler, {
  method: 'POST', body,
  headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'mcp-protocol-version': version },
});

function lessonAssets(overrides) {
  const assets = lessonApi.loadProductionAssets();
  const entry = Object.assign({}, assets.manifest.lessons[PERCEPTRON], { translations: ['hi'] });
  const lessons = Object.assign({}, assets.manifest.lessons, { [PERCEPTRON]: entry });
  return Object.assign({}, assets, { manifest: Object.assign({}, assets.manifest, { lessons }) }, overrides);
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('translation reader reports stale fallbacks separately from fresh content', async () => {
  let time = 0;
  let healthy = true;
  const read = translations.createTranslationReader({
    now: () => time,
    fetchImpl: () => Promise.resolve(healthy ? new Response(HINDI) : new Response('', { status: 502 })),
  });
  assert.deepEqual(await read.result('hi', PERCEPTRON), { markdown: HINDI, stale: false });
  healthy = false;
  time += 11 * 60 * 1000;
  assert.deepEqual(await read.result('hi', PERCEPTRON), { markdown: HINDI, stale: true });
  assert.equal(await read('hi', PERCEPTRON), HINDI);
  assert.deepEqual(await read.result('ar', PERCEPTRON), { markdown: null, stale: false });
  assert.equal(translations.readTranslationResult, translations.readTranslation.result);
});

test('translation cache eviction keeps pending fetches and last good copies', async () => {
  let time = 0;
  const calls = new Map();
  const slow = deferred();
  const pendingPath = 'phases/01-a/pending';
  const goodPath = 'phases/01-a/good';
  let goodHealthy = true;
  const read = translations.createTranslationReader({
    now: () => time,
    fetchImpl: url => {
      calls.set(url, (calls.get(url) || 0) + 1);
      if (url === translations.translationUrl('hi', pendingPath)) return slow.promise;
      if (url === translations.translationUrl('hi', goodPath)) return Promise.resolve(goodHealthy ? new Response(HINDI) : new Response('', { status: 502 }));
      return Promise.resolve(new Response('', { status: 404 }));
    },
  });
  const pending = read('hi', pendingPath);
  assert.equal(await read('hi', goodPath), HINDI);
  for (let index = 0; index < 200; index += 1) assert.equal(await read('hi', `phases/01-a/missing-${index}`), null);
  const again = read('hi', pendingPath);
  assert.equal(calls.get(translations.translationUrl('hi', pendingPath)), 1);
  slow.resolve(new Response(HINDI));
  assert.equal(await pending, HINDI);
  assert.equal(await again, HINDI);
  assert.equal(await read('hi', goodPath), HINDI);
  assert.equal(calls.get(translations.translationUrl('hi', goodPath)), 1);
  goodHealthy = false;
  time += 11 * 60 * 1000;
  assert.deepEqual(await read.result('hi', goodPath), { markdown: HINDI, stale: true });
});

test('paths without a translation source resolve as not found without fetching', async () => {
  let fetched = 0;
  const read = translations.createTranslationReader({ fetchImpl: () => { fetched += 1; return Promise.resolve(new Response(HINDI)); } });
  assert.equal(translations.canTranslate('hi', 'projects/dataset-split-auditor'), false);
  assert.equal(await read('hi', 'projects/dataset-split-auditor'), null);
  assert.equal(fetched, 0);

  const entry = { path: 'projects/x', kind: 'project', title: 'X', description: 'X', url: 'https://aiengineeringfromscratch.com/project.html?id=x', sourceUrl: 'https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/projects/x/README.md', translations: ['hi'], markdown: '# X\n' };
  const readEntry = path => (path === entry.path ? entry : null);
  assert.equal(await readTranslatedResource(entry.path, 'hi', { read: readEntry }), null);
  const missing = await invoke(resource.createHandler({ read: readEntry, limit: () => true }), { headers: { accept: 'application/json' }, query: { path: entry.path, lang: 'hi' } });
  assert.equal(missing.statusCode, 404);
  const call = await rpc(mcp.createHandler({ read: readEntry, limit: () => true }), { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_resource', arguments: { path: entry.path, lang: 'hi' } } });
  assert.equal(call.json.result.isError, true);
});

test('resource API caches stale translations briefly and fresh translations normally', async () => {
  const entry = { path: 'phases/01-a/01-x', kind: 'lesson', title: 'X', description: 'X', url: 'https://aiengineeringfromscratch.com/lesson?path=phases%2F01-a%2F01-x', sourceUrl: 'https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/phases/01-a/01-x/docs/en.md', translations: ['hi'], markdown: '# X\n' };
  const read = path => (path === entry.path ? entry : null);
  for (const [stale, cache] of [[true, RETRY_CACHE], [false, 'public, max-age=300, s-maxage=86400']]) {
    const readTranslation = () => Promise.resolve({ markdown: HINDI, stale });
    const translated = await readTranslatedResource(entry.path, 'hi', { read, readTranslation });
    assert.equal(isStaleResource(translated), stale);
    assert.equal(Object.keys(translated).includes('stale'), false);
    const handler = resource.createHandler({ read, limit: () => true, readTranslated: (path, lang, options) => readTranslatedResource(path, lang, { ...options, readTranslation }) });
    const response = await invoke(handler, { headers: { accept: 'application/json' }, query: { path: entry.path, lang: 'hi' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json.markdown, HINDI);
    assert.equal(response.headers['cache-control'], cache);
  }
});

test('lesson pages cache stale translations briefly', async () => {
  const url = `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=hi`;
  for (const [result, cache] of [[{ markdown: HINDI, stale: true }, RETRY_CACHE], [{ markdown: HINDI, stale: false }, 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800']]) {
    const handler = lessonApi.createHandler({ loadAssets: () => lessonAssets(), readTranslation: () => Promise.resolve(result) });
    const response = await invoke(handler, { url });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-language'], 'hi');
    assert.equal(response.headers['cache-control'], cache);
  }
});

test('lesson Markdown requests that reject HTML get 406 when no Markdown exists', async () => {
  const handler = lessonApi.createHandler({ loadAssets: () => lessonAssets({ readMarkdown() { throw new Error('ENOENT'); } }) });
  const url = `/lesson?path=${encodeURIComponent(PERCEPTRON)}`;
  for (const method of ['GET', 'HEAD']) {
    const rejected = await invoke(handler, { method, url, headers: { accept: 'text/markdown' } });
    assert.equal(rejected.statusCode, 406);
    assert.equal(rejected.headers['content-type'], 'application/problem+json; charset=utf-8');
    assert.equal(rejected.headers['cache-control'], 'no-store');
    assert.equal(rejected.headers['content-language'], undefined);
    if (method === 'HEAD') assert.equal(rejected.body, '');
  }
  const fallback = await invoke(handler, { url, headers: { accept: 'text/markdown, text/html;q=0.5' } });
  assert.equal(fallback.statusCode, 200);
  assert.match(fallback.headers['content-type'], /^text\/html/);
});

test('lesson lang=en redirects to the URL without lang', async () => {
  const handler = lessonApi.createHandler({ loadAssets: () => lessonAssets() });
  const response = await invoke(handler, { url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&learningPath=x&lang=en` });
  assert.equal(response.statusCode, 308);
  assert.doesNotMatch(response.headers.location, /lang=/);
  const page = await invoke(handler, { url: response.headers.location });
  assert.equal(page.statusCode, 200);
  assert.doesNotMatch(page.body, /lang=en(?:&|")/);
});

test('lesson Content-Language is set only after the page renders', async () => {
  const handler = lessonApi.createHandler({ loadAssets: () => lessonAssets({ template: '<html lang="en"><body></body></html>' }) });
  const response = await invoke(handler, { url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}` });
  assert.equal(response.statusCode, 500);
  assert.equal(response.headers['content-language'], undefined);
  assert.equal(response.headers.vary, undefined);
});

test('readBounded cancels oversized bodies and keeps the original error', async () => {
  let cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled += 1; } });
  await assert.rejects(readBounded({ headers: new Headers({ 'content-length': '999' }), body }, 10, 'too-large'), /too-large/);
  assert.equal(cancelled, 1);
  await assert.rejects(readBounded({ headers: new Headers({ 'content-length': '999' }), body: null }, 10, 'too-large'), /too-large/);
  const rejecting = { cancel: () => Promise.reject(new Error('cancel-failed')) };
  await assert.rejects(readBounded({ headers: new Headers({ 'content-length': '999' }), body: rejecting }, 10, 'too-large'), /too-large/);
  const reader = read => ({ headers: new Headers(), body: { getReader: () => ({ read, cancel: () => Promise.reject(new Error('cancel-failed')) }) } });
  await assert.rejects(readBounded(reader(() => Promise.reject(new Error('read-failed'))), 10), /read-failed/);
  let done = false;
  const text = await readBounded(reader(() => {
    if (done) return Promise.resolve({ done: true });
    done = true;
    return Promise.resolve({ done: false, value: new TextEncoder().encode('ok') });
  }), 10);
  assert.equal(text, 'ok');
});

test('a full limiter evicts clients under quota and keeps exhausted ones', () => {
  const limiter = createLimiter({ limit: 2, maxClients: 2, now: () => 1000, vercel: true });
  const call = address => {
    const { output, res } = recorder();
    limiter({ method: 'GET', headers: { 'x-vercel-forwarded-for': address } }, res);
    return output.statusCode;
  };
  assert.equal(call('192.0.2.1'), 200);
  assert.equal(call('2001:db8:1:2::1'), 200);
  assert.equal(call('2001:db8:1:2:ffff:ffff:ffff:ffff'), 200);
  assert.equal(call('198.51.100.7'), 200);
  assert.equal(call('203.0.113.9'), 200);
  assert.equal(call('2001:db8:1:2::5'), 429);
  assert.equal(call('::ffff:203.0.113.9'), 200);
  assert.equal(call('203.0.113.9'), 429);
});

test('a limiter full of exhausted clients refuses new clients', () => {
  const limiter = createLimiter({ limit: 1, maxClients: 2, now: () => 1000, vercel: true });
  const call = address => {
    const { output, res } = recorder();
    limiter({ method: 'GET', headers: { 'x-vercel-forwarded-for': address } }, res);
    return output.statusCode;
  };
  assert.equal(call('192.0.2.1'), 200);
  assert.equal(call('192.0.2.2'), 200);
  const { output, res } = recorder();
  limiter({ method: 'GET', headers: { 'x-vercel-forwarded-for': '192.0.2.3' } }, res);
  assert.equal(output.statusCode, 429);
  assert.match(output.headers.ratelimit, /r=0;/);
  assert.equal(call('192.0.2.1'), 429);
});

test('MCP accepts 2025-06-18 and parses each request body once', async () => {
  const handler = mcp.createHandler({ limit: () => true });
  const ping = await rpc(handler, { jsonrpc: '2.0', id: 1, method: 'ping' }, '2025-06-18');
  assert.equal(ping.statusCode, 200);
  assert.deepEqual(ping.json.result, {});
  const init = await rpc(handler, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'state-test', version: '1' } } }, '2025-06-18');
  assert.equal(init.json.result.protocolVersion, '2025-06-18');
  const message = { jsonrpc: '2.0', id: 3, method: 'ping' };
  assert.deepEqual((await rpc(handler, JSON.stringify(message))).json.result, {});
  assert.deepEqual((await rpc(handler, Buffer.from(JSON.stringify(message)))).json.result, {});
  assert.equal((await rpc(handler, JSON.stringify(JSON.stringify(message)))).json.error.code, -32600);
});

test('lesson documents keep the first H1 as the title', () => {
  assert.equal(lessonDocumentSeo('# First Title\n\n> Hook.\n\n## Part\n\nBody text.\n\n# Second Title\n', 'Fallback').title, 'First Title');
});
