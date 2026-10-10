const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { versionHtml, versionSite } = require('./version-assets');
const { cardTags, cardVersion, pageCard } = require('../lib/og-cards');
const config = require('../vercel.json');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'header.js'), 'window.navigation = ["Catalog"];');
  fs.writeFileSync(path.join(root, 'style.css'), 'body { color: blue; }');
  return root;
}

function assetUrl(html, name) {
  return html.match(new RegExp(`${name.replace('.', '\\.')}\\?[^"']+`))[0];
}

test('new navigation bytes replace an already-cached legacy URL on every page', t => {
  const root = fixture(t);
  for (const name of ['index.html', 'projects.html', 'lesson.html', 'certification.html']) {
    fs.writeFileSync(path.join(root, name), '<script src="header.js?v=20260927a" defer></script>');
  }
  versionSite(root);
  const original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const oldUrl = assetUrl(original, 'header.js');
  assert.notEqual(oldUrl, 'header.js?v=20260927a');
  fs.writeFileSync(path.join(root, 'header.js'), 'window.navigation = ["Catalog", "Projects"];');
  versionSite(root);
  const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const newUrl = assetUrl(current, 'header.js');
  assert.notEqual(newUrl, oldUrl);
  for (const name of ['projects.html', 'lesson.html', 'certification.html']) {
    assert.equal(assetUrl(fs.readFileSync(path.join(root, name), 'utf8'), 'header.js'), newUrl);
  }
  versionSite(root);
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), current);
});

test('styles are versioned independently, preserving query options and fragments', t => {
  const root = fixture(t);
  const html = '<link rel="stylesheet" href="/style.css?theme=dark&amp;v=old#main"><script src="./header.js"></script>';
  const before = versionHtml(html, root);
  fs.writeFileSync(path.join(root, 'style.css'), 'body { color: red; }');
  const after = versionHtml(before, root);
  assert.notEqual(assetUrl(before, 'style.css'), assetUrl(after, 'style.css'));
  assert.equal(assetUrl(before, 'header.js'), assetUrl(after, 'header.js'));
  assert.match(after, /theme=dark&amp;v=[a-f0-9]{16}#main/);
  assert.equal(versionHtml(after, root), after);
});

test('remote assets, inline code, comments and page links are unchanged', t => {
  const root = fixture(t);
  const html = '<!-- <script src="missing.js"></script> -->'
    + '<script>const example = \'<link href="missing.css">\';</script>'
    + '<script src="https://cdn.example.test/library.js?v=1"></script>'
    + '<link href="//cdn.example.test/style.css">'
    + '<link rel="canonical" href="projects.html">';
  assert.equal(versionHtml(html, root), html);
});

test('missing assets or paths outside the site fail before any page is rewritten', t => {
  const root = fixture(t);
  const html = '<script src="header.js"></script>';
  fs.writeFileSync(path.join(root, 'index.html'), html);
  fs.writeFileSync(path.join(root, 'missing.html'), '<script src="missing.js"></script>');
  assert.throws(() => versionSite(root), /ENOENT/);
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), html);
  assert.throws(() => versionHtml('<script src="../outside.js"></script>', root), /outside the site/);
});

test('the deploy pass writes every card tag with a content version and an unknown card stops the build', t => {
  const root = fixture(t);
  const cards = { 'page/about': pageCard('about', {}) };
  fs.writeFileSync(path.join(root, 'og-cards.json'), JSON.stringify({ version: 1, cards }));
  const card = 'https://aiengineeringfromscratch.com/og/page/about.png';
  fs.writeFileSync(path.join(root, 'about.html'), [
    '<head>',
    `  <meta property="og:image" content="${card}">`,
    '  <meta name="twitter:card" content="summary">',
    `  <meta name="twitter:image" content="${card}?v=0123abcd">`,
    '</head>',
  ].join('\n'));
  versionSite(root);
  const versioned = `${card}?v=${cardVersion(cards['page/about'])}`;
  const html = fs.readFileSync(path.join(root, 'about.html'), 'utf8');
  assert.equal(html, ['<head>'].concat(cardTags(versioned, cards['page/about']).map(tag => `  ${tag}`), '</head>').join('\n'));
  versionSite(root);
  assert.equal(fs.readFileSync(path.join(root, 'about.html'), 'utf8'), html);
  fs.writeFileSync(path.join(root, 'missing.html'), '<meta property="og:image" content="https://aiengineeringfromscratch.com/og/page/missing.png">');
  assert.throws(() => versionSite(root), /No social card for page\/missing/);
  assert.equal(fs.readFileSync(path.join(root, 'about.html'), 'utf8'), html);
});

function responseHeaders(url) {
  const headers = {};
  for (const rule of config.headers) {
    if (new RegExp(`^${rule.source}$`).test(new URL(url, 'https://site.test').pathname)) {
      for (const header of rule.headers) headers[header.key.toLowerCase()] = header.value;
    }
  }
  return headers;
}

test('HTML and mutable scripts/styles must revalidate, including old query strings', () => {
  for (const url of ['/', '/index.html', '/projects.html', '/project.html', '/projects', '/project', '/learning-paths', '/prereqs', '/about', '/catalog',
    '/header.js?v=20260927a', '/style.css?v=old', '/figures/projects/dataset-split-auditor.js']) {
    const policy = responseHeaders(url)['cache-control'];
    assert.match(policy, /(?:^|, )max-age=0(?:,|$)/, url);
    assert.match(policy, /must-revalidate/, url);
    assert.doesNotMatch(policy, /stale-while-revalidate/, url);
  }
  assert.equal(responseHeaders('/')['vary'], 'Accept, Accept-Encoding');
  for (const name of ['projects-data.js', 'certification-data.js', 'build-meta.js']) {
    assert.equal(responseHeaders('/' + name)['cache-control'], 'no-cache, must-revalidate');
  }
  assert.match(responseHeaders('/poster.png')['cache-control'], /max-age=86400/);
  assert.match(responseHeaders('/font.woff2')['cache-control'], /max-age=86400/);
  assert.ok(config.buildCommand.endsWith('node site/version-assets.js'));
});

function invoke(handler, query, accept = 'text/html') {
  const headers = {};
  const res = { setHeader(name, value) { headers[name.toLowerCase()] = value; }, end() {} };
  handler({ method: 'GET', headers: { accept }, query }, res);
  return { status: res.statusCode, headers };
}

test('server-rendered pages revalidate in browsers while keeping CDN reuse and errors uncached', () => {
  const lessonPath = 'phases/01-math/01-vectors';
  const lesson = require('../api/lesson').createHandler({ loadAssets: () => ({
    template: '<!-- AIFS:LESSON-SEO:START --><!-- AIFS:LESSON-SEO:END --><!-- AIFS:LESSON-FALLBACK:START --><!-- AIFS:LESSON-FALLBACK:END -->',
    manifest: { lessons: { [lessonPath]: { path: lessonPath, title: 'Vectors' } } },
  }) });
  const certification = require('../api/certification').createHandler({ loadAssets: () => ({
    template: '<!-- AIFS:CERTIFICATION-SEO:START --><!-- AIFS:CERTIFICATION-SEO:END --><!-- AIFS:CERTIFICATION-FALLBACK:START --><!-- AIFS:CERTIFICATION-FALLBACK:END -->',
    manifest: { tracks: { example: { id: 'example', title: 'Example' } } },
  }) });
  for (const result of [invoke(lesson, { path: lessonPath }), invoke(certification, { id: 'example' }),
    invoke(require('../api/markdown'), { path: '/' })]) {
    assert.equal(result.status, 200);
    assert.match(result.headers['cache-control'], /(?:^|, )max-age=0(?:,|$)/);
    assert.match(result.headers['cache-control'], /must-revalidate/);
    assert.match(result.headers['cache-control'], /s-maxage=86400/);
    assert.doesNotMatch(result.headers['cache-control'], /stale-while-revalidate/);
  }
  assert.equal(invoke(lesson, { path: 'missing' }).headers['cache-control'], 'no-store');
});
