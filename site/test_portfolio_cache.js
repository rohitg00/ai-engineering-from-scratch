const assert = require('node:assert/strict');
const test = require('node:test');
const { createPortfolioSource } = require('./portfolio-source');

const item = {
  id: '/blog/example/',
  url: 'https://rohitghumare.com/blog/example/',
  kind: 'blog',
  title: 'An example',
  description: 'A practical example',
};

test('failed feed refreshes back off for 30 seconds and retry after the deadline', async () => {
  let now = 0;
  let offline = false;
  let calls = 0;
  const source = createPortfolioSource({ now: () => now, ttl: 100, staleTtl: 120000, fetchImpl: async () => {
    calls++;
    if (offline) throw new Error('offline');
    return new Response(JSON.stringify({ version: 1, homeUrl: 'https://rohitghumare.com', items: [item] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } });

  assert.deepEqual(await source.getFeed(), { value: [item], stale: false });
  offline = true;
  now = 101;
  assert.deepEqual(await source.getFeed(), { value: [item], stale: true });
  assert.equal(calls, 2);
  for (now of [102, 10000, 30100]) {
    assert.deepEqual(await source.getFeed(), { value: [item], stale: true });
  }
  assert.equal(calls, 2);

  now = 30101;
  assert.equal((await source.getFeed()).stale, true);
  assert.equal(calls, 3);
  now = 60100;
  assert.equal((await source.getFeed()).stale, true);
  assert.equal(calls, 3);
  offline = false;
  now = 60101;
  assert.equal((await source.getFeed()).stale, false);
  assert.equal(calls, 4);
  now = 60102;
  assert.equal((await source.getFeed()).stale, false);
  assert.equal(calls, 4);
});

test('article backoff never extends the original stale deadline', async () => {
  let now = 0;
  let offline = false;
  let calls = 0;
  const source = createPortfolioSource({ now: () => now, ttl: 100, staleTtl: 50000, fetchImpl: async () => {
    calls++;
    if (offline) throw new Error('offline');
    return new Response('original article', { headers: { 'Content-Type': 'text/html' } });
  } });

  assert.deepEqual(await source.getArticle(item), { value: 'original article', stale: false });
  offline = true;
  now = 49000;
  assert.deepEqual(await source.getArticle(item), { value: 'original article', stale: true });
  now = 49999;
  assert.equal((await source.getArticle(item)).stale, true);
  assert.equal(calls, 2);
  now = 50000;
  await assert.rejects(source.getArticle(item), /offline/);
  assert.equal(calls, 3);
});
