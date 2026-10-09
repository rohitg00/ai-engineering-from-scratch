const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createPortfolioSource, validateFeed } = require('./portfolio-source');

const item = { id: '/blog/example/', url: 'https://rohitghumare.com/blog/example/', kind: 'blog', title: 'An example', description: 'A practical example', datePublished: '2026-10-08' };
const guide = { id: '/guides/example/', url: 'https://rohitghumare.com/guides/example/', kind: 'guide', title: 'A guide', description: 'An undated walkthrough' };
function feed(items = [item, guide]) { return { version: 1, homeUrl: 'https://rohitghumare.com', items }; }
function json(value) { return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }); }

test('feed supports undated guides and rejects off-origin, duplicate, mismatched and traversal entries', () => {
  assert.deepEqual(validateFeed(feed()), [item, guide]);
  for (const entry of [{ ...item, url: 'https://example.com/blog/example/' }, { ...item, id: '/blog/../private/' },
    { ...item, kind: 'guide' }, { ...item, datePublished: 'tomorrow' }, { ...item, title: '' }]) {
    assert.throws(() => validateFeed(feed([entry])));
  }
  assert.throws(() => validateFeed(feed([item, item])));
  assert.throws(() => validateFeed({ ...feed(), version: 2 }));
});

test('cache coalesces requests and refreshes source edits, additions, and removals without a build', async () => {
  let now = 0;
  let entries = [item];
  let calls = 0;
  const source = createPortfolioSource({ now: () => now, ttl: 100, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://rohitghumare.com/api/content');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return json(feed(entries));
  } });
  await Promise.all([source.getFeed(), source.getFeed(), source.getFeed()]);
  assert.equal(calls, 1);
  entries = [{ ...item, title: 'Edited title' }, guide];
  assert.equal((await source.getFeed()).value[0].title, item.title);
  now = 101;
  assert.deepEqual((await source.getFeed()).value.map(entry => entry.title), ['Edited title', 'A guide']);
  entries = [guide];
  now = 202;
  assert.deepEqual((await source.getFeed()).value, [guide]);
  assert.equal(calls, 3);
});

test('bounded stale cache covers outages but cold and expired failures remain errors', async () => {
  let now = 0;
  let fail = false;
  const source = createPortfolioSource({ now: () => now, ttl: 100, staleTtl: 500, fetchImpl: async () => {
    if (fail) throw new Error('offline');
    return json(feed());
  } });
  assert.equal((await source.getFeed()).stale, false);
  fail = true;
  now = 101;
  assert.equal((await source.getFeed()).stale, true);
  now = 501;
  await assert.rejects(source.getFeed(), /offline/);
  const cold = createPortfolioSource({ fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(cold.getFeed(), /offline/);
});

test('reading the entire catalog cannot evict the feed needed during an outage', async () => {
  let offline = false;
  let now = 0;
  const source = createPortfolioSource({ now: () => now, ttl: 100, fetchImpl: async url => {
    if (offline) throw new Error('offline');
    if (url.endsWith('/api/content')) return json(feed());
    return new Response('article', { headers: { 'Content-Type': 'text/html' } });
  } });
  await source.getFeed();
  for (let index = 0; index < 80; index++) {
    const id = `/blog/post-${index}/`;
    await source.getArticle({ id, url: 'https://rohitghumare.com' + id });
  }
  offline = true;
  now = 101;
  assert.deepEqual(await source.getFeed(), { value: [item, guide], stale: true });
});

test('source checks status, MIME, payload limits, and fixed article URLs', async () => {
  for (const response of [new Response('missing', { status: 404 }), new Response('<html>wrong</html>'),
    new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '3000000' } }),
    new Response('x'.repeat(2100000), { headers: { 'Content-Type': 'application/json' } })]) {
    await assert.rejects(createPortfolioSource({ fetchImpl: async () => response }).getFeed());
  }
  const source = createPortfolioSource({ fetchImpl: async (url, options) => {
    assert.equal(url, item.url);
    assert.equal(options.headers.Accept, 'text/html');
    return new Response('<html>full article</html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } });
  assert.equal((await source.getArticle(item)).value, '<html>full article</html>');
  assert.throws(() => source.getArticle({ ...item, url: 'http://localhost/admin' }));
});

test('a malformed article update cannot replace previously validated reader content', async () => {
  let now = 0;
  let html = 'valid article';
  const source = createPortfolioSource({ now: () => now, ttl: 100, fetchImpl: async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) });
  function transform(value) {
    if (value !== 'valid article') throw new Error('canonical mismatch');
    return 'validated reader';
  }
  assert.deepEqual(await source.getArticle(item, transform), { value: 'validated reader', stale: false });
  now = 101;
  html = 'invalid replacement';
  assert.deepEqual(await source.getArticle(item, transform), { value: 'validated reader', stale: true });
});

async function invoke(handler, req = {}) {
  const headers = {};
  let body = '';
  const res = { setHeader(name, value) { headers[name.toLowerCase()] = value; }, end(value) { body = value; } };
  await handler({ method: 'GET', url: '/blogs', ...req }, res);
  return { status: res.statusCode, headers, body };
}

test('collection is server-rendered, escapes metadata, and sends readers to local full articles', async () => {
  const { createHandler } = require('../api/blogs');
  const handler = createHandler({ source: { getFeed: async () => ({ value: [{ ...item, title: '<script>bad</script>', description: 'A & B' }, guide] }) } });
  const result = await invoke(handler);
  assert.equal(result.status, 200);
  assert.match(result.body, /href="\/blog\/example\/"/);
  assert.match(result.body, /href="\/guides\/example\/"/);
  assert.match(result.body, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(result.body, /A &amp; B/);
  assert.doesNotMatch(result.body, /rohitghumare\.com|Writing is temporarily unavailable/);
  assert.match(result.body, /rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/blogs"/);
  assert.match(result.headers['cache-control'], /s-maxage=300/);
  const head = await invoke(handler, { method: 'HEAD' });
  assert.equal(head.body, '');
  assert.equal(Number(head.headers['content-length']), Buffer.byteLength(result.body));
  const query = await invoke(handler, { url: '/api/blogs?path=' + encodeURIComponent(item.id), query: { path: item.id } });
  assert.equal(query.body, result.body);
  const trailing = await invoke(handler, { url: '/blogs/?search=agent' });
  assert.equal(trailing.status, 308);
  assert.equal(trailing.headers.location, '/blogs?search=agent');
});

test('article reader preserves interactive content and original canonical while keeping links local', async () => {
  const { createHandler } = require('../api/blogs');
  const html = `<!DOCTYPE html><html><head><link rel="canonical" href="${item.url}"><title>Example</title></head><body><article><h1>Example</h1><p>Full article text</p><a href="${guide.url}">Next</a><button id="replay">Replay</button><script>document.getElementById('replay').onclick=function(){this.textContent='Played'}</script></article></body></html>`;
  const handler = createHandler({ article: true, source: { getFeed: async () => ({ value: [item, guide] }), getArticle: async (_, transform) => ({ value: transform(html) }) } });
  const result = await invoke(handler, { url: item.id, query: { path: guide.id } });
  assert.equal(result.status, 200);
  assert.match(result.body, /Full article text/);
  assert.match(result.body, /rel="canonical" href="https:\/\/rohitghumare\.com\/blog\/example\/"/);
  assert.match(result.body, /href="\/guides\/example\/"/);
  assert.match(result.body, /this.textContent='Played'/);
});

test('missing and invalid paths never fetch arbitrary articles; failures and methods are uncached', async () => {
  const { createHandler } = require('../api/blogs');
  let requested = 0;
  const handler = createHandler({ article: true, source: { getFeed: async () => ({ value: [item] }), getArticle: async () => { requested++; } } });
  for (const value of ['/blog/missing/', '/blog/../../secret/', [item.id], ['x', 'y'], 'https://evil.test/']) {
    const result = await invoke(handler, { url: '/api/writing', query: { path: value } });
    assert.equal(result.status, 404);
    assert.equal(result.headers['cache-control'], 'no-store');
  }
  assert.equal(requested, 0);
  const method = await invoke(handler, { method: 'POST' });
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'GET, HEAD');
  const failing = createHandler({ source: { getFeed: async () => { throw new Error('fixture outage'); } } });
  const result = await invoke(failing);
  assert.equal(result.status, 503);
  assert.equal(result.headers['x-robots-tag'], 'noindex');
  assert.doesNotMatch(result.body, /fixture outage|rohitghumare/);
});

test('writing routes precede static files and package the collection template', () => {
  const config = require('../vercel.json');
  for (const pathname of ['/blogs', '/blogs.html', item.id, guide.id]) {
    const route = config.routes.find(entry => new RegExp('^' + entry.src + '$').test(pathname));
    assert.ok(route, pathname);
    assert.match(route.dest, /^\/api\/(blogs|writing)/);
  }
  const trailing = config.routes.find(entry => new RegExp('^' + entry.src + '$').test('/blogs/'));
  assert.equal(trailing.status, 308);
  assert.equal(trailing.headers.Location, '/blogs');
  assert.equal(config.functions['api/blogs.js'].includeFiles, 'site/blogs.html');
  assert.match(fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'curriculum.yml'), 'utf8'), /node --test site\/test_portfolio_sync.js site\/test_writing_mirror.js/);
});
