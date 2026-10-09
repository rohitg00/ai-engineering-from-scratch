const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { renderCollection } = require('../api/blogs');

const template = fs.readFileSync(path.join(__dirname, 'blogs.html'), 'utf8');
const origin = 'https://aiengineeringfromscratch.com';
const item = { id: '/blog/example/', title: 'Inside an agent loop', description: 'Inspect the loop.', kind: 'blog' };

function schemaFor(items) {
  const html = renderCollection(template, items);
  const match = html.match(/<script id="writing-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return { html, graph: JSON.parse(match[1])['@graph'] };
}

test('search crawlers receive an authored collection and current local article URLs in initial HTML', () => {
  const { html, graph } = schemaFor([item]);
  const collection = graph.find(node => node['@type'] === 'CollectionPage');
  const breadcrumbs = graph.find(node => node['@type'] === 'BreadcrumbList');
  assert.equal(collection.url, origin + '/blogs');
  assert.equal(collection.author.name, 'Rohit Ghumare');
  assert.equal(collection.author.url, origin + '/about');
  assert.equal(collection.mainEntity.numberOfItems, 1);
  assert.deepEqual(collection.mainEntity.itemListElement, [
    { '@type': 'ListItem', position: 1, name: item.title, url: origin + item.id },
  ]);
  assert.equal(collection.breadcrumb['@id'], breadcrumbs['@id']);
  assert.equal(breadcrumbs.itemListElement[1].item, collection.url);
  assert.match(html, /<h2><a href="\/blog\/example\/">Inside an agent loop<\/a><\/h2>/);
  assert.match(html, /name="robots" content="index,\s*follow,\s*max-image-preview:large"/);
  assert.match(html, /name="twitter:image"/);
  assert.match(html, /property="og:site_name"/);
});

test('structured listings follow additions and removals and safely serialize untrusted titles', () => {
  const title = '</script><script>alert("test")</script>';
  const added = { ...item, id: '/guides/example/', kind: 'guide', title };
  const { html, graph } = schemaFor([item, added]);
  assert.equal(graph[0].mainEntity.numberOfItems, 2);
  assert.equal(graph[0].mainEntity.itemListElement[1].name, title);
  assert.doesNotMatch(html, /<script>alert/);
  const removed = schemaFor([added]).graph[0].mainEntity;
  assert.equal(removed.numberOfItems, 1);
  assert.equal(removed.itemListElement[0].position, 1);
  assert.equal(schemaFor([]).graph[0].mainEntity.numberOfItems, 0);
});

test('the course homepage has a static collection link and topic links resolve to real lessons', () => {
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.match(homepage, /<a\b[^>]*href="\/blogs"[^>]*>Blogs &amp; Guides<\/a>/);
  const lessonLinks = [...template.matchAll(/href="(\/lesson\?path=[^"]+)"/g)];
  assert.ok(lessonLinks.length >= 4);
  for (const [, href] of lessonLinks) {
    const lessonPath = new URL(href, origin).searchParams.get('path');
    assert.ok(fs.existsSync(path.join(__dirname, '..', lessonPath, 'docs', 'en.md')), lessonPath);
  }
});
