const assert = require('node:assert/strict');
const test = require('node:test');
const { mirrorArticle } = require('./writing-mirror');

const item = { id: '/blog/example/', url: 'https://rohitghumare.com/blog/example/', kind: 'blog', title: 'Example' };
const guide = { id: '/guides/model/', url: 'https://rohitghumare.com/guides/model/', kind: 'guide', title: 'Model' };
const catalog = [item, guide];
const theme = '<button class="toggle" id="theme" aria-label="Toggle theme"><svg class="sun"><path d="M1 2"/></svg></button>';
const script = 'const example = \'<a href="/blog/example/">not markup</a>\';\nconst root=document.documentElement; document.getElementById("theme").onclick=()=>root.dataset.theme="dark";';
const style = '.fig{font-family:var(--mono)} .arrow{marker-end:url(#head)}';

function fixture({ legacy = false, head = '', body = '' } = {}) {
  return '<!doctype html><html><head><title>Example</title>'
    + '<link rel="canonical" href="' + item.url + '">'
    + '<meta property="og:url" content="' + item.url + '">'
    + '<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323">'
    + '<style>' + style + '</style>' + head + '</head><body><div class="wrap">'
    + (legacy
      ? '<div class="topbar"><nav class="crumb"><a href="/">Rohit Ghumare</a><a href="/">Blog</a></nav>' + theme + '</div>'
      : '<nav class="nav"><a class="brand" href="/">rg<span>.</span></a><div class="links"><a href="/guides/">Guides</a><a href="/blog/">Blog</a>' + theme + '</div></nav>')
    + '<article><nav class="crumb"><a href="/">Home</a><a href="/blog/">Blog</a></nav><h1>Example</h1>'
    + '<p class="byline">Rohit Ghumare · October 8, 2026</p><nav class="toc"><a href="#figure">Contents</a></nav>'
    + '<div id="figure" class="fig"><svg><defs><marker id="head"></marker></defs><path marker-end="url(#head)"/></svg></div>'
    + body + '<div class="author"><span class="n">Rohit Ghumare</span><p>I build agent infrastructure.</p></div></article>'
    + '<footer><a href="/blog/">Blog</a> · <a href="/">rohitghumare</a></footer></div>'
    + '<script>' + script + '</script><script src="/search.js" defer></script><script src="/dither.js" defer></script></body></html>';
}

test('the complete article keeps executable figures, anchors, source metadata, and authorship', () => {
  const result = mirrorArticle(fixture(), item, catalog);
  assert.ok(result.includes('<script>' + script + '</script>'));
  assert.ok(result.includes('<style>' + style + '</style>'));
  assert.ok(result.includes(theme));
  assert.match(result, /href="#figure"/);
  assert.match(result, /marker-end="url\(#head\)"/);
  assert.match(result, /<link rel="canonical" href="https:\/\/rohitghumare.com\/blog\/example\/">/);
  assert.match(result, /<meta property="og:url" content="https:\/\/aiengineeringfromscratch.com\/blog\/example\/">/);
  assert.match(result, /<meta property="og:site_name" content="AI Engineering from Scratch">/);
  assert.match(result, /class="byline">Rohit Ghumare/);
  assert.match(result, /class="n">Rohit Ghumare/);
  assert.match(result, /AI \/ FROM SCRATCH/);
  assert.match(result, /href="\/blogs">Blogs &amp; Guides/);
  assert.doesNotMatch(result, /<base\b|src="\/search.js"|>rohitghumare<|class="brand"/);
});

test('legacy breadcrumb headers retain their theme button and receive course navigation', () => {
  const result = mirrorArticle(fixture({ legacy: true }), item, catalog);
  assert.equal((result.match(/id="theme"/g) || []).length, 1);
  assert.match(result, /<nav class="aiefs-reader-nav" aria-label="Primary">/);
  assert.doesNotMatch(result, /class="topbar"/);
  assert.ok(result.includes('<script>' + script + '</script>'));
});

test('article links stay local, including unlisted targets, while downloadable assets use their source', () => {
  const result = mirrorArticle(fixture({ body: [
    '<a href="/guides/model/#quant">Model</a>',
    '<a href="https://rohitghumare.com/guides/model/?mode=one&amp;x=two#fit">Model absolute</a>',
    '<a href="../unpublished/">Unlisted</a>',
    '<a href="/guides/">All guides</a>',
    '<a href="code/harness.py">Runnable code</a>',
    '<a href="https://docs.example.org/api/">Reference</a>',
    '<img src="figure.png" srcset="figure.png 1x, /figure@2x.png 2x">',
    '<img src="data:image/svg+xml;base64,abc">',
    '<svg><use href="#head"/></svg>',
  ].join('') }), item, catalog);
  assert.match(result, /href="\/guides\/model\/#quant"/);
  assert.match(result, /href="\/guides\/model\/\?mode=one&amp;x=two#fit"/);
  assert.match(result, /href="\/blog\/unpublished\/"/);
  assert.match(result, /href="https:\/\/rohitghumare.com\/blog\/example\/code\/harness.py"/);
  assert.match(result, /src="https:\/\/rohitghumare.com\/blog\/example\/figure.png"/);
  assert.match(result, /srcset="https:\/\/rohitghumare.com\/blog\/example\/figure.png 1x, https:\/\/rohitghumare.com\/figure@2x.png 2x"/);
  assert.match(result, /src="https:\/\/rohitghumare.com\/dither.js"/);
  assert.match(result, /href="https:\/\/rohitghumare.com\/favicon.svg"/);
  assert.match(result, /src="data:image\/svg\+xml;base64,abc"/);
  assert.match(result, /<use href="#head"\/>/);
  assert.match(result, /href="https:\/\/docs.example.org\/api\/"/);
});

test('script strings, comments, and escaped code cannot masquerade as HTML to rewrite or validate', () => {
  const comment = '<!-- <meta name="robots" content="noindex"><a href="/guides/">Example</a> -->';
  const exampleScript = '<script>const head = \'<link rel="canonical" href="https://evil.example/">\';</script>';
  const exampleCode = '<pre>&lt;a href="/guides/"&gt;code&lt;/a&gt;</pre>';
  const result = mirrorArticle(fixture({ body: comment + exampleScript + exampleCode }), item, catalog);
  assert.ok(result.includes(comment));
  assert.ok(result.includes(exampleScript));
  assert.ok(result.includes(exampleCode));
});

test('drafts, redirects, mismatched canonicals, and malformed reader documents fail closed', () => {
  for (const head of [
    '<meta name="robots" content="noindex, follow">',
    '<meta content="NOINDEX" name="googlebot">',
    '<meta name="robots" content="none">',
    '<meta http-equiv="Refresh" content="0;url=https://example.org/">',
    '<link rel="canonical" href="' + item.url + '">',
    '<base href="https://rohitghumare.com/">',
  ]) assert.throws(() => mirrorArticle(fixture({ head }), item, catalog));
  assert.throws(() => mirrorArticle(fixture().replace('<link rel="canonical" href="' + item.url + '">', ''), item, catalog), /canonical/);
  assert.throws(() => mirrorArticle(fixture().replace('rel="canonical" href="' + item.url, 'rel="canonical" href="https://rohitghumare.com/blog/other/'), item, catalog), /canonical/);
  assert.throws(() => mirrorArticle(fixture(), { ...item, url: 'https://evil.example/blog/example/' }, catalog), /canonical/);
  assert.throws(() => mirrorArticle(fixture(), item, [guide]), /published/);
});

test('valid future layouts get reader navigation without requiring an article tag or theme control', () => {
  const minimal = '<!doctype html><html><head><link rel="canonical" href="' + item.url + '"></head><body><main><h1>Future layout</h1><p>Still readable.</p></main></body></html>';
  const result = mirrorArticle(minimal, item, catalog);
  assert.match(result, /<nav class="aiefs-reader-nav" aria-label="Primary" data-aiefs-fallback>/);
  assert.match(result, /<main><h1>Future layout<\/h1><p>Still readable.<\/p><\/main>/);
  assert.match(result, /href="\/blogs">Blogs &amp; Guides/);
  assert.doesNotMatch(result, /id="theme"/);

  const noTheme = fixture().replace(theme, '').replace('<script>' + script + '</script>', '');
  const adapted = mirrorArticle(noTheme, item, catalog);
  assert.equal((adapted.match(/class="aiefs-reader-nav"/g) || []).length, 1);
  assert.doesNotMatch(adapted, /id="theme"/);
  assert.match(adapted, /<h1>Example<\/h1>/);
});

test('absolute or versioned portfolio search is removed without removing unrelated source scripts', () => {
  const html = fixture().replace('src="/search.js"', "src='https://rohitghumare.com/search.js?v=2'")
    .replace('</body>', '<script src="https://example.org/search.js" defer></script></body>');
  const result = mirrorArticle(html, item, catalog);
  assert.doesNotMatch(result, /rohitghumare.com\/search.js/);
  assert.match(result, /src="https:\/\/example.org\/search.js"/);
});

test('social sharing uses the course URL and site name while the search canonical stays original', () => {
  const result = mirrorArticle(fixture({ head: '<meta name="twitter:url" content="' + item.url + '"><meta property="og:site_name" content="Rohit Ghumare">' }), item, catalog);
  assert.match(result, /name="twitter:url" content="https:\/\/aiengineeringfromscratch.com\/blog\/example\/"/);
  assert.match(result, /property="og:url" content="https:\/\/aiengineeringfromscratch.com\/blog\/example\/"/);
  assert.match(result, /rel="canonical" href="https:\/\/rohitghumare.com\/blog\/example\/"/);
  assert.equal((result.match(/og:site_name/g) || []).length, 1);
  assert.match(result, /property="og:site_name" content="AI Engineering from Scratch"/);
});

test('structured breadcrumbs match the course navigation without altering article identity or other schema', () => {
  const article = {
    '@type': 'Article', headline: 'Example', description: 'Use <tools> safely.',
    mainEntityOfPage: { '@type': 'WebPage', '@id': item.url },
    author: { '@type': 'Person', name: 'Rohit Ghumare', url: 'https://rohitghumare.com/' },
    publisher: { '@type': 'Organization', name: 'Rohit Ghumare' },
  };
  const faq = { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'What is <tool>?' }] };
  const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Blog', item: 'https://rohitghumare.com/blog/' }] };
  const title = 'Example </script><script>alert(1)</script>';
  const nodes = [article, breadcrumb, faq];
  for (const data of [{ '@context': 'https://schema.org', '@graph': nodes }, nodes]) {
    const source = '<script type="application/ld+json">' + JSON.stringify(data) + '</script>';
    const result = mirrorArticle(fixture({ head: source }), { ...item, title }, catalog);
    const body = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    assert.doesNotMatch(body, /</);
    const parsed = JSON.parse(body);
    const actual = parsed['@graph'] || parsed;
    assert.deepEqual(actual[0], article);
    assert.deepEqual(actual[2], faq);
    assert.deepEqual(actual[1].itemListElement, [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aiengineeringfromscratch.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blogs & Guides', item: 'https://aiengineeringfromscratch.com/blogs' },
      { '@type': 'ListItem', position: 3, name: title, item: 'https://aiengineeringfromscratch.com/blog/example/' },
    ]);
    assert.ok(result.includes('<script>' + script + '</script>'));
    assert.ok(result.includes('<style>' + style + '</style>'));
  }
});

test('malformed and non-breadcrumb JSON-LD stays intact and does not prevent rendering', () => {
  for (const body of ['{ "@type": "BreadcrumbList", invalid }', '{ "@type": "Article", "headline": "Example" }', 'null']) {
    const source = '<script type="application/ld+json">' + body + '</script>';
    const result = mirrorArticle(fixture({ head: source }), item, catalog);
    assert.ok(result.includes(source));
    assert.match(result, /<h1>Example<\/h1>/);
  }
});
