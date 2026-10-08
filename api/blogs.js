const fs = require('node:fs');
const path = require('node:path');
const { createPortfolioSource, ARTICLE_PATH } = require('../site/portfolio-source');
const { mirrorArticle } = require('../site/writing-mirror');

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderCards(items) {
  return '<div class="writing-list">' + items.map(item => {
    let date = '';
    if (item.datePublished) {
      const label = new Date(item.datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
      date = `<time datetime="${escapeHtml(item.datePublished)}">${escapeHtml(label)}</time>`;
    }
    return `<article class="writing-card" data-kind="${item.kind}"><span class="writing-kind">${item.kind === 'blog' ? 'Blog' : 'Guide'}</span><h2><a href="${escapeHtml(item.id)}">${escapeHtml(item.title)}</a></h2><p>${escapeHtml(item.description)}</p><footer>${date}<a href="${escapeHtml(item.id)}" aria-label="Read ${escapeHtml(item.title)}">Read ${item.kind === 'blog' ? 'article' : 'guide'} <span aria-hidden="true">→</span></a></footer></article>`;
  }).join('\n') + '</div>';
}

function renderCollection(template, items) {
  const start = '<!-- portfolio-content:start -->';
  const end = '<!-- portfolio-content:end -->';
  const before = template.indexOf(start);
  const after = template.indexOf(end);
  if (before < 0 || after < before) throw new Error('Missing writing template markers');
  const content = items.length ? renderCards(items) : '<p>No articles or guides have been published yet.</p>';
  const document = template.slice(0, before + start.length) + '\n' + content + '\n' + template.slice(after);
  const schemaPattern = /(<script id="writing-schema" type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  const schemaMatch = document.match(schemaPattern);
  if (!schemaMatch) throw new Error('Missing writing structured data');
  const collection = JSON.parse(schemaMatch[2]);
  const origin = new URL(collection.url).origin;
  const breadcrumbId = collection.url + '#breadcrumb';
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        ...collection,
        '@id': collection.url + '#collection',
        inLanguage: 'en',
        author: { '@type': 'Person', name: 'Rohit Ghumare', url: origin + '/about' },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((item, index) => ({
            '@type': 'ListItem', position: index + 1, name: item.title, url: origin + item.id,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': breadcrumbId,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AI Engineering from Scratch', item: origin + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blogs & Guides', item: collection.url },
        ],
      },
    ],
  };
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  return document.replace(schemaPattern, (_, open, body, close) => open + json + close);
}

function errorPage(status) {
  const title = status === 404 ? 'Article not found' : 'Writing is temporarily unavailable';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} | AI Engineering from Scratch</title><link rel="stylesheet" href="/style.css"></head><body><main class="container" style="padding-block:80px"><h1>${title}</h1><p>${status === 404 ? 'This article is no longer in the collection.' : 'Please try again in a moment.'}</p><a href="/blogs">Browse Blogs &amp; Guides</a></main></body></html>`;
}

function send(res, method, status, html, stale = false) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', status === 200 ? `public, max-age=0, s-maxage=${stale ? 30 : 300}, must-revalidate` : 'no-store');
  if (status !== 200) res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Content-Length', String(Buffer.byteLength(html)));
  res.end(method === 'HEAD' ? '' : html);
}

function createHandler({ source = createPortfolioSource(), article = false, loadTemplate = () => fs.readFileSync(path.join(__dirname, '..', 'site', 'blogs.html'), 'utf8') } = {}) {
  return async function blogsHandler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(res, method, 405, errorPage(405));
    }
    const url = new URL(req.url || '/', 'http://localhost');
    if (!article && /\/blogs(?:\.html)?\/$/.test(url.pathname)) {
      const search = url.searchParams.get('search');
      res.setHeader('Location', '/blogs' + (search ? '?search=' + encodeURIComponent(search) : ''));
      return send(res, method, 308, '');
    }
    let articlePath = null;
    if (article) {
      articlePath = url.pathname.replace(/\/?$/, '/');
      if (!ARTICLE_PATH.test(articlePath)) articlePath = req.query?.path ?? url.searchParams.get('path');
      if (typeof articlePath !== 'string' || !ARTICLE_PATH.test(articlePath)) return send(res, method, 404, errorPage(404));
    }
    try {
      const feed = await source.getFeed();
      if (articlePath === null) return send(res, method, 200, renderCollection(loadTemplate(), feed.value), feed.stale);
      const item = feed.value.find(entry => entry.id === articlePath);
      if (!item) return send(res, method, 404, errorPage(404));
      const document = await source.getArticle(item, html => mirrorArticle(html, item, feed.value));
      return send(res, method, 200, document.value, feed.stale || document.stale);
    } catch (error) {
      console.error('Writing sync failed:', error.message);
      return send(res, method, 503, errorPage(503));
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.renderCollection = renderCollection;
