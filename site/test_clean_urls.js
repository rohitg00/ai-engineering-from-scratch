const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { cleanHref, cleanHtml, cleanSite } = require('./clean-urls');
const config = require('../vercel.json');

test('every public HTML page has a clean route and an old-URL redirect', () => {
  const pages = fs.readdirSync(__dirname).filter(name => name.endsWith('.html') && name !== '404.html');
  for (const name of pages) {
    const route = '/' + name.slice(0, -5);
    if (name === 'index.html') {
      assert.ok(config.redirects.some(rule => rule.source === '/index' && rule.destination === '/'));
      continue;
    }
    assert.ok(config.rewrites.some(rule => rule.source === route), route);
    const legacyHandler = config.routes.some(rule => rule.src === '/' + name.replace('.', '\\.'));
    const redirect = config.redirects.some(rule => {
      const pattern = rule.source.replace(':page(', '(?:');
      return new RegExp('^' + pattern + '$').test('/' + name) && rule.permanent;
    });
    assert.ok(legacyHandler || redirect, name);
  }
  assert.ok(!config.rewrites.some(rule => rule.source === '/:path*'));
  assert.equal(config.trailingSlash, false);
});

test('page links preserve query encoding, fragments and external destinations', () => {
  const pages = new Set(['index', 'project', 'catalog']);
  assert.equal(cleanHref('project.html?id=dataset-split-auditor&stage=03-split-groups#main', pages), 'project?id=dataset-split-auditor&stage=03-split-groups#main');
  assert.equal(cleanHref('/catalog.html?q=a%26b', pages), '/catalog?q=a%26b');
  assert.equal(cleanHref('index.html#contents', pages), './#contents');
  assert.equal(cleanHref('https://aiengineeringfromscratch.com/index.html', pages), 'https://aiengineeringfromscratch.com/');
  for (const href of ['https://example.com/project.html', '../examples/project.html', 'style.css', 'missing.html', '/project-content/demo.html']) {
    assert.equal(cleanHref(href, pages), href);
  }
});

test('built HTML publishes clean links and identities without rewriting inline code or assets', () => {
  const pages = new Set(['index', 'projects']);
  const source = '<link rel="canonical" href="https://aiengineeringfromscratch.com/projects.html">'
    + '<a href="projects.html#ladder">Projects</a><a href="index.html#contents">Home</a>'
    + '<script>const example = \'<a href="projects.html">example</a>\';</script>'
    + '<script src="header.js?v=abc"></script><!-- <a href="projects.html"> -->';
  const output = cleanHtml(source, pages);
  assert.match(output, /rel="canonical" href="https:\/\/aiengineeringfromscratch.com\/projects"/);
  assert.match(output, /href="projects#ladder"/);
  assert.match(output, /href="\.\/#contents"/);
  assert.match(output, /const example = '<a href="projects.html">example<\/a>'/);
  assert.match(output, /src="header.js\?v=abc"/);
  assert.match(output, /<!-- <a href="projects.html"> -->/);
  assert.equal(cleanHtml(output, pages), output);
});

test('build output keeps sitemap, discovery links and HTML identities consistent', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-clean-urls-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<a href="projects.html">Projects</a>');
  fs.writeFileSync(path.join(root, 'projects.html'), '<link rel="canonical" href="https://aiengineeringfromscratch.com/projects.html">');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset><url><loc>https://aiengineeringfromscratch.com/index.html</loc></url></urlset>');
  fs.writeFileSync(path.join(root, 'llms.txt'), '[Projects](https://aiengineeringfromscratch.com/projects.html)');
  cleanSite(root);
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/aiengineeringfromscratch.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/aiengineeringfromscratch.com\/projects<\/loc>/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'llms.txt'), 'utf8'), /\.html/);
  cleanSite(root);
  assert.equal(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'), sitemap);
});

test('bare project requests recover through the catalog while selected projects keep their query', () => {
  const rule = config.redirects.find(rule => rule.source === '/project');
  assert.deepEqual(rule.missing, [{ type: 'query', key: 'id' }]);
  assert.equal(rule.destination, '/projects');
  assert.equal(rule.permanent, false);
  assert.equal(config.rewrites.find(rule => rule.source === '/project').destination, '/project.html');
});
