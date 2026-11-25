'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const rules = require('./landscape-rules.js');
const { loadLandscape, publicData, writeLandscape } = require('./build-landscape.js');

const CATEGORY_IDS = ['models', 'evaluation'];
const VALID = {
  name: 'Acme Evals',
  url: 'https://acme.dev',
  category: 'evaluation',
  description: 'Runs evaluation suites against model outputs and reports regressions.',
  open_source: true,
  repo: 'https://github.com/acme/evals',
  logo_url: 'https://acme.dev/logo.svg'
};

function errorsFor(change, slug = 'acme-evals') {
  const entry = { ...VALID, ...change };
  for (const key of Object.keys(entry)) if (entry[key] === undefined) delete entry[key];
  return rules.validateEntry(slug, entry, CATEGORY_IDS);
}

test('the committed landscape has no problems', () => {
  const landscape = loadLandscape();
  assert.deepEqual(landscape.errors, []);
  assert.ok(landscape.entries.length >= 700);
  assert.ok(landscape.categories.length >= 50);
  for (const category of landscape.categories) assert.ok(category.group, category.id);
});

test('every committed entry shows a real logo and a known category', () => {
  const data = publicData(loadLandscape());
  const ids = new Set(data.categories.map((category) => category.id));
  for (const entry of data.entries) {
    assert.ok(ids.has(entry.category), `${entry.slug} category`);
    assert.ok(entry.logo, `${entry.slug} logo`);
    assert.ok(fs.existsSync(path.join(__dirname, entry.logo)), `${entry.slug} logo file`);
    assert.equal(entry.logo_url, undefined);
  }
  for (const category of data.categories) assert.match(category.learn, /^\/phase\/[a-z0-9-]+$/);
});

test('logo packs hold every logo at the recorded offset', () => {
  const data = writeLandscape();
  assert.ok(data.packs.length >= 1 && data.packs.length <= 12);
  for (const name of data.packs) assert.match(name, /^landscape-logos-\d+-[0-9a-f]{10}\.bin$/);
  const packs = data.packs.map((name) => fs.readFileSync(path.join(__dirname, name)));
  for (const entry of data.entries) {
    const [index, offset, length] = entry.pack;
    const original = fs.readFileSync(path.join(__dirname, entry.logo));
    assert.equal(length, original.length, entry.slug);
    assert.ok(packs[index].subarray(offset, offset + length).equals(original), entry.slug);
  }
});

test('a complete entry passes', () => {
  assert.deepEqual(errorsFor({}), []);
  assert.deepEqual(errorsFor({ description: 'Hosted inference with per-token pricing.' }), []);
});

test('a closed source entry passes without a repository', () => {
  assert.deepEqual(errorsFor({ open_source: false, repo: undefined }), []);
});

test('each broken field is reported in plain words', () => {
  const cases = [
    [{ name: '' }, /"name" is required/],
    [{ url: 'http://acme.dev' }, /"url" must be a public https/],
    [{ url: 'https://127.0.0.1/x' }, /"url" must be a public https/],
    [{ category: 'misc' }, /"category" must be one of/],
    [{ description: 'x'.repeat(201) + '.' }, /200 characters or fewer/],
    [{ description: 'Runs evals' }, /end with a period/],
    [{ description: 'The best eval runner.' }, /promotional/],
    [{ description: 'Stablecoin wallets for agents.' }, /outside the scope/],
    [{ description: 'On-chain agent identity.' }, /outside the scope/],
    [{ open_source: 'yes' }, /true or false/],
    [{ repo: undefined }, /"repo" is required/],
    [{ repo: 'https://example.com/acme/evals' }, /"repo" is required/],
    [{ open_source: false }, /only for open source/],
    [{ open_source: false, repo: undefined, url: 'https://acme.vercel.app' }, /own domain/],
    [{ logo_url: undefined }, /give "logo_url"/],
    [{ logo: 'acme-evals.svg' }, /not both/],
    [{ logo_url: 'https://acme.dev/logo.gif' }, /\.svg or \.png file/],
    [{ x: '@acme' }, /X handle/],
    [{ x: 'a'.repeat(16) }, /X handle/],
    [{ also: ['evaluation'] }, /unknown or repeated/],
    [{ also: ['nope'] }, /unknown or repeated/],
    [{ also: [] }, /1 to 3 more categories/],
    [{ stars: 5 }, /unknown field "stars"/]
  ];
  for (const [change, pattern] of cases) {
    const errors = errorsFor(change);
    assert.ok(errors.some((problem) => pattern.test(problem)), `${JSON.stringify(change)} -> ${errors.join(' | ')}`);
  }
});

test('the file name must be a slug and match the logo file', () => {
  assert.ok(errorsFor({}, 'Acme Evals').some((problem) => /file name/.test(problem)));
  assert.ok(errorsFor({ logo_url: undefined, logo: 'other.svg' }).some((problem) => /"logo" must be "acme-evals.svg" or "acme-evals.png"/.test(problem)));
  assert.deepEqual(errorsFor({ logo_url: undefined, logo: 'acme-evals.png' }), []);
  assert.deepEqual(errorsFor({ x: 'acme_dev' }), []);
  assert.deepEqual(errorsFor({ also: ['models'] }), []);
});

test('slugify makes a safe file name', () => {
  assert.equal(rules.slugify('Weights & Biases'), 'weights-and-biases');
  assert.equal(rules.slugify('  vLLM 2.0 '), 'vllm-2-0');
  assert.equal(rules.slugify('Café Été'), 'cafe-ete');
  assert.equal(rules.slugify('../../etc'), 'etc');
});

test('unsafe SVG files are rejected', () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
  assert.deepEqual(rules.svgErrors(ok), []);
  assert.deepEqual(rules.svgErrors('<?xml version="1.0"?>\n' + ok), []);
  const bad = [
    '<html></html>',
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="x()"></svg>',
    '<svg><a href="javascript:x()"></a></svg>',
    '<svg><image href="https://x.dev/a.png"/></svg>',
    '<svg><use href="https://x.dev/a.svg#b"/></svg>',
    '<svg><foreignObject></foreignObject></svg>',
    '<svg><style>@import url(https://x.dev/a.css);</style></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>',
    '<svg>' + 'a'.repeat(rules.MAX_LOGO_BYTES) + '</svg>'
  ];
  for (const svg of bad) assert.ok(rules.svgErrors(svg).length > 0, svg.slice(0, 60));
  assert.deepEqual(rules.svgErrors('<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>'), []);
});

test('PNG logos must be real PNG files of a usable size', () => {
  const png = (width, height) => {
    const bytes = Buffer.alloc(32);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes;
  };
  assert.deepEqual(rules.pngErrors(png(128, 128)), []);
  assert.ok(rules.pngErrors(png(16, 16)).length > 0);
  assert.ok(rules.pngErrors(Buffer.from('<svg></svg>')).length > 0);
  assert.ok(rules.pngErrors(Buffer.concat([png(128, 128), Buffer.alloc(rules.MAX_LOGO_BYTES)])).length > 0);
});

test('the form output is the same shape the check accepts', () => {
  const entry = rules.buildEntry({ ...VALID, repo: 'https://github.com/acme/evals.git/', name: '  Acme Evals ' });
  assert.deepEqual(rules.validateEntry(rules.slugify(entry.name), entry, CATEGORY_IDS), []);
  assert.deepEqual(Object.keys(JSON.parse(rules.entryJson(entry))), ['name', 'url', 'category', 'description', 'open_source', 'repo', 'logo_url']);
  const closed = rules.buildEntry({ ...VALID, open_source: false });
  assert.equal(closed.repo, undefined);
  assert.equal(rules.buildEntry({ ...VALID, x: 'https://x.com/acme/' }).x, 'acme');
  assert.equal(rules.buildEntry({ ...VALID, x: '@acme' }).x, 'acme');
});

test('the pull request link opens the right new file', () => {
  const url = new URL(rules.pullRequestUrl('acme-evals', VALID));
  assert.equal(url.origin + url.pathname, 'https://github.com/rohitg00/ai-engineering-from-scratch/new/main');
  assert.equal(url.searchParams.get('filename'), 'landscape/entries/acme-evals.json');
  assert.deepEqual(JSON.parse(url.searchParams.get('value')), VALID);
});

test('the page loads the data, the shared rules and the form', () => {
  const html = fs.readFileSync(path.join(__dirname, 'landscape.html'), 'utf8');
  for (const needle of ['landscape-data.js', 'landscape-rules.js', 'landscape.js', 'landscape.css', 'id="addForm"', 'id="landscapeGrid"', 'og/page/landscape.png']) {
    assert.ok(html.includes(needle), needle);
  }
  const script = fs.readFileSync(path.join(__dirname, 'landscape.js'), 'utf8');
  assert.ok(script.includes("'nofollow noopener'"));
  assert.ok(!/innerHTML/.test(script));
});

test('the issue form lists the same categories as categories.json', () => {
  const categories = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'landscape', 'categories.json'), 'utf8'));
  const form = fs.readFileSync(path.join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', 'landscape_tool.yml'), 'utf8');
  for (const category of categories) assert.ok(form.includes(`- ${category.name}\n`), category.name);
});
