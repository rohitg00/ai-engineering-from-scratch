const SOURCE = 'https://rohitghumare.com';
const ARTICLE_PATH = /^\/(blog|guides)\/[a-z0-9][a-z0-9-]*\/$/;
const TTL = 5 * 60 * 1000;

function validateFeed(feed) {
  if (feed?.version !== 1 || feed.homeUrl !== SOURCE || !Array.isArray(feed.items) || feed.items.length > 2000) {
    throw new Error('Invalid writing feed');
  }
  const seen = new Set();
  const items = feed.items.map(item => {
    if (!item || !ARTICLE_PATH.test(item.id) || item.url !== SOURCE + item.id ||
        item.kind !== (item.id.startsWith('/blog/') ? 'blog' : 'guide') ||
        typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500 ||
        typeof item.description !== 'string' || item.description.length > 5000 || seen.has(item.id)) {
      throw new Error('Invalid writing entry');
    }
    seen.add(item.id);
    const entry = { id: item.id, url: item.url, kind: item.kind, title: item.title, description: item.description };
    for (const field of ['datePublished', 'dateModified']) {
      if (item[field] !== undefined) {
        if (typeof item[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(item[field]) || !Number.isFinite(Date.parse(item[field]))) {
          throw new Error('Invalid writing date');
        }
        entry[field] = item[field];
      }
    }
    return entry;
  });
  return items.sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || '') || a.title.localeCompare(b.title));
}

async function readBounded(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Writing response too large');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Writing response too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel();
  }
}

function createPortfolioSource({ fetchImpl = fetch, now = Date.now, ttl = TTL, staleTtl = 24 * 60 * 60 * 1000 } = {}) {
  const cache = new Map();
  const pending = new Map();

  async function cached(key, load) {
    const previous = cache.get(key);
    if (previous && now() - previous.time < ttl) return { value: previous.value, stale: false };
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => {
      try {
        const value = await load();
        cache.delete(key);
        cache.set(key, { value, time: now() });
        while (cache.size > 41) {
          const oldestArticle = Array.from(cache.keys()).find(entry => entry !== 'feed');
          cache.delete(oldestArticle);
        }
        return { value, stale: false };
      } catch (error) {
        if (previous && now() - previous.time < staleTtl) return { value: previous.value, stale: true };
        throw error;
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, promise);
    return promise;
  }

  async function request(url, type, maxBytes) {
    const response = await fetchImpl(url, {
      headers: { Accept: type },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes(type)) {
      throw new Error('Writing source unavailable');
    }
    return readBounded(response, maxBytes);
  }

  return {
    getFeed() {
      return cached('feed', async () => validateFeed(JSON.parse(await request(SOURCE + '/api/content', 'application/json', 2 * 1024 * 1024))));
    },
    getArticle(item, transform = html => html) {
      if (!ARTICLE_PATH.test(item.id) || item.url !== SOURCE + item.id) throw new Error('Invalid article URL');
      return cached(item.id, async () => transform(await request(item.url, 'text/html', 4 * 1024 * 1024)));
    },
  };
}

module.exports = { createPortfolioSource, validateFeed, ARTICLE_PATH };
