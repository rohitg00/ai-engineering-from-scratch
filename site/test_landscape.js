'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const zlib = require('node:zlib');
const rules = require('./landscape-rules.js');
const {
  loadLandscape, publicData, packLogos, writeLandscape, logoProblems,
  isPublicAddress, publicLookup, readCapped, checkStars, githubStars
} = require('./build-landscape.js');

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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function makePng(width, height, { pixels } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = pixels || Buffer.alloc(height * (1 + width * 4), 0x7f).fill(0, 0, 0);
  if (!pixels) for (let y = 0; y < height; y += 1) rows[y * (1 + width * 4)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const FIXTURE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

function fixture(entries, logos) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'landscape-'));
  const dirs = { entryDir: path.join(root, 'entries'), logoDir: path.join(root, 'logos'), categoryPath: path.join(root, 'categories.json') };
  fs.mkdirSync(dirs.entryDir);
  fs.mkdirSync(dirs.logoDir);
  const categories = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'landscape', 'categories.json'), 'utf8')).slice(0, 2)
    .map(({ pinned, featured, sponsors, ...category }) => category);
  fs.writeFileSync(dirs.categoryPath, JSON.stringify(categories));
  for (const [slug, entry] of Object.entries(entries)) {
    fs.writeFileSync(path.join(dirs.entryDir, `${slug}.json`), JSON.stringify({ ...VALID, logo_url: undefined, category: categories[0].id, ...entry }));
  }
  for (const [name, bytes] of Object.entries(logos)) fs.writeFileSync(path.join(dirs.logoDir, name), bytes);
  return dirs;
}

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

test('every committed entry shows a real logo or waits for its logo_url, in a known category', () => {
  const landscape = loadLandscape();
  const pending = new Set(landscape.entries.filter((entry) => !entry.logo).map((entry) => entry.slug));
  for (const entry of landscape.entries) {
    if (pending.has(entry.slug)) assert.ok(entry.logo_url, `${entry.slug} has neither a logo file nor a logo_url`);
  }
  const data = publicData(landscape);
  const ids = new Set(data.categories.map((category) => category.id));
  for (const entry of data.entries) {
    assert.ok(ids.has(entry.category), `${entry.slug} category`);
    assert.equal(entry.logo_url, undefined);
    if (pending.has(entry.slug)) assert.equal(entry.logo, null, `${entry.slug} logo`);
    else assert.ok(fs.existsSync(path.join(__dirname, entry.logo)), `${entry.slug} logo file`);
  }
  for (const category of data.categories) assert.match(category.learn, /^\/phase\/[a-z0-9-]+$/);
});

test('logo packs hold every logo at the recorded offset', () => {
  const data = writeLandscape();
  assert.ok(data.packs.length >= 1 && data.packs.length <= 12);
  for (const name of data.packs) assert.match(name, /^landscape-logos-\d+-[0-9a-f]{10}\.bin$/);
  const packs = data.packs.map((name) => fs.readFileSync(path.join(__dirname, name)));
  for (const entry of data.entries) {
    if (!entry.logo) {
      assert.equal(entry.pack, undefined, entry.slug);
      continue;
    }
    const [index, offset, length] = entry.pack;
    const original = fs.readFileSync(path.join(__dirname, entry.logo));
    assert.equal(length, original.length, entry.slug);
    assert.ok(packs[index].subarray(offset, offset + length).equals(original), entry.slug);
  }
});

test('a pending logo_url entry builds without a logo or pack, next to a local one', () => {
  const png = makePng(64, 64);
  const dirs = fixture({
    'acme-evals': { logo_url: 'https://acme.dev/logo.png' },
    'beta-evals': { name: 'Beta Evals', logo: 'beta-evals.png' }
  }, { 'beta-evals.png': png });
  const landscape = loadLandscape(dirs);
  assert.deepEqual(landscape.errors, []);
  const data = publicData(landscape);
  const packs = packLogos(data, (entry) => fs.readFileSync(path.join(dirs.logoDir, path.basename(entry.logo))));
  const pending = data.entries.find((entry) => entry.slug === 'acme-evals');
  const local = data.entries.find((entry) => entry.slug === 'beta-evals');
  assert.equal(pending.logo, null);
  assert.equal(pending.pack, undefined);
  assert.equal(local.logo, 'logos/landscape/beta-evals.png');
  const [index, offset, length] = local.pack;
  assert.ok(packs[index].subarray(offset, offset + length).equals(png));
});

test('the logo field picks the exact file even when the other type is still there', () => {
  const dirs = fixture({ 'acme-evals': { logo: 'acme-evals.png' } }, { 'acme-evals.svg': FIXTURE_SVG, 'acme-evals.png': makePng(64, 64) });
  const landscape = loadLandscape(dirs);
  assert.equal(landscape.entries[0].logo, 'logos/landscape/acme-evals.png');
  assert.deepEqual(landscape.errors, ['site/logos/landscape/acme-evals.svg: no entry uses this logo']);
  const missing = loadLandscape(fixture({ 'acme-evals': { logo: 'acme-evals.png' } }, { 'acme-evals.svg': FIXTURE_SVG }));
  assert.ok(missing.errors.some((problem) => /acme-evals\.png is missing/.test(problem)), missing.errors.join(' | '));
});

test('a saved logo_url file is the one that matches the link type', () => {
  const dirs = fixture({ 'acme-evals': { logo_url: 'https://acme.dev/logo.png' } }, { 'acme-evals.svg': FIXTURE_SVG });
  const landscape = loadLandscape(dirs);
  assert.equal(landscape.entries[0].logo, null);
  assert.deepEqual(landscape.errors, ['site/logos/landscape/acme-evals.svg: no entry uses this logo']);
});

test('logo downloads only connect to public addresses', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '64:ff9b::a9fe:a9fe', 'not-an-ip']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
  const resolveTo = (answer) => (hostname, options, callback) => callback(null, ...(options.all ? [answer] : [answer[0].address, answer[0].family]));
  const lookupWith = (answer, options) => new Promise((resolve) => publicLookup(resolveTo(answer))('logo.example', options, (error, address) => resolve({ error, address })));
  assert.match((await lookupWith([{ address: '127.0.0.1', family: 4 }], {})).error.message, /private or reserved address \(127\.0\.0\.1\)/);
  assert.match((await lookupWith([{ address: '1.1.1.1', family: 4 }, { address: '10.0.0.1', family: 4 }], { all: true })).error.message, /10\.0\.0\.1/);
  assert.deepEqual(await lookupWith([{ address: '1.1.1.1', family: 4 }], {}), { error: null, address: '1.1.1.1' });
});

test('logo downloads stop reading once the body passes the size limit', async () => {
  let pulled = 0;
  const endless = new Readable({ read() { pulled += 1; this.push(Buffer.alloc(16 * 1024)); } });
  await assert.rejects(readCapped(endless, rules.MAX_LOGO_BYTES), /larger than 100 KB/);
  assert.ok(pulled * 16 * 1024 <= rules.MAX_LOGO_BYTES + 64 * 1024, `read ${pulled} chunks`);
  assert.equal((await readCapped(Readable.from([Buffer.from('ab'), Buffer.from('c')]), 10)).toString(), 'abc');
});

test('the star check reads the threshold from the repository host', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'landscape-stars-'));
  const write = (slug, entry) => {
    const file = path.join(root, `${slug}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...VALID, ...entry }));
    return file;
  };
  const files = [
    write('popular', { repo: 'https://github.com/acme/popular' }),
    write('small', { repo: 'https://github.com/acme/small' }),
    write('hidden', { repo: 'https://github.com/acme/hidden' }),
    write('closed', { open_source: false, repo: undefined })
  ];
  const answers = {
    'https://github.com/acme/popular': { found: true, stars: rules.MIN_STARS, open: true },
    'https://github.com/acme/small': { found: true, stars: 12, open: true },
    'https://github.com/acme/hidden': { found: false }
  };
  const result = await checkStars(files, async (repo) => answers[repo]);
  assert.equal(result.checked, 3);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /small\.json: .* has 12 stars/);
  assert.match(result.errors[1], /hidden\.json: .* not a public repository/);
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
    [{ repo: 'https://github.com/../evals' }, /"repo" is required/],
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
  const good = makePng(128, 128);
  assert.deepEqual(rules.pngErrors(good), []);
  assert.deepEqual(logoProblems('png', good), []);
  assert.ok(rules.pngErrors(makePng(16, 16)).length > 0);
  assert.ok(rules.pngErrors(Buffer.from('<svg></svg>')).length > 0);
  const huge = Buffer.concat([good.subarray(0, -12), chunk('tEXt', Buffer.alloc(rules.MAX_LOGO_BYTES)), good.subarray(-12)]);
  assert.match(rules.pngErrors(huge).join(' '), /larger than 100 KB/);

  const headerOnly = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(headerOnly);
  headerOnly.writeUInt32BE(128, 16);
  headerOnly.writeUInt32BE(128, 20);
  assert.ok(rules.pngErrors(headerOnly).length > 0, 'a signature and size without image data');

  const damaged = Buffer.from(good);
  damaged[good.length - 20] ^= 0xff;
  assert.match(rules.pngErrors(damaged).join(' '), /damaged/);
  assert.match(rules.pngErrors(good.subarray(0, good.length - 12)).join(' '), /cut short/);

  const short = makePng(128, 128, { pixels: Buffer.alloc(10) });
  assert.deepEqual(rules.pngErrors(short), []);
  assert.match(logoProblems('png', short).join(' '), /does not match its size/);
  const garbage = Buffer.concat([good.subarray(0, 33), chunk('IDAT', Buffer.from('not zlib')), good.subarray(-12)]);
  assert.match(logoProblems('png', garbage).join(' '), /damaged/);
});

test('the form output is the same shape the check accepts', () => {
  const entry = rules.buildEntry({ ...VALID, repo: 'https://github.com/acme/evals.git/', name: '  Acme Evals ' });
  assert.deepEqual(rules.validateEntry(rules.slugify(entry.name), entry, CATEGORY_IDS), []);
  assert.deepEqual(Object.keys(JSON.parse(rules.entryJson(entry))), ['name', 'url', 'category', 'description', 'open_source', 'repo', 'logo_url']);
  const closed = rules.buildEntry({ ...VALID, open_source: false });
  assert.equal(closed.repo, undefined);
  assert.equal(rules.buildEntry({ ...VALID, x: 'https://x.com/acme/' }).x, 'acme');
  assert.equal(rules.buildEntry({ ...VALID, x: '@acme' }).x, 'acme');
  const loose = rules.buildEntry({ ...VALID, url: 'acme.dev', repo: 'www.github.com/acme/evals/tree/main', logo_url: 'http://acme.dev/logo.svg?v=2' });
  assert.equal(loose.url, 'https://acme.dev');
  assert.equal(loose.repo, 'https://github.com/acme/evals');
  assert.equal(loose.logo_url, 'https://acme.dev/logo.svg?v=2');
  assert.deepEqual(rules.validateEntry('acme-evals', loose, CATEGORY_IDS), []);
  assert.equal(rules.buildEntry({ ...VALID, url: '' }).url, '');
  assert.equal(rules.buildEntry({ ...VALID, url: 'https:acme.dev' }).url, 'https:acme.dev');
  const repoOf = (repo) => rules.buildEntry({ ...VALID, repo }).repo;
  assert.equal(repoOf('https://github.com/acme/evals/issues/5?x=1'), 'https://github.com/acme/evals');
  assert.equal(repoOf('https://gitlab.com/acme/evals/-/tree/main'), 'https://gitlab.com/acme/evals');
  assert.equal(repoOf('https://gitlab.com/group/subgroup/project'), 'https://gitlab.com/group/subgroup/project');
  assert.ok(rules.validateEntry('acme-evals', rules.buildEntry({ ...VALID, repo: 'https://gitlab.com/group/subgroup/project' }), CATEGORY_IDS).some((problem) => /"repo" is required/.test(problem)));
  assert.equal(repoOf('https://github.com/acme/evals/extra'), 'https://github.com/acme/evals/extra');
  const blank = rules.validateEntry('your-tool', rules.buildEntry({ category: 'evaluation' }), CATEGORY_IDS);
  assert.ok(blank.length >= 4 && !blank.some((problem) => /file name/.test(problem)));
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

test('GitHub stars are read in batches of 50', async () => {
  const repos = Array.from({ length: 51 }, (_, index) => `https://github.com/acme/tool-${index}`);
  const queries = [];
  const realFetch = global.fetch;
  const realToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'test-token';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.github.com/graphql');
    assert.equal(options.headers.authorization, 'Bearer test-token');
    const { query } = JSON.parse(options.body);
    queries.push(query);
    const data = {};
    for (const [, alias, name] of query.matchAll(/(r\d+): repository\(owner: "acme", name: "(tool-\d+)"\)/g)) {
      data[alias] = name === 'tool-1' ? null : { stargazerCount: name === 'tool-0' ? 9000 : 10, isPrivate: name === 'tool-2' };
    }
    return { ok: true, json: async () => ({ data }) };
  };
  try {
    const found = await githubStars(repos);
    assert.equal(queries.length, 2);
    assert.deepEqual(queries.map((query) => query.match(/repository\(/g).length), [50, 1]);
    assert.equal(found.size, 51);
    assert.deepEqual(found.get(repos[0]), { found: true, stars: 9000, open: true });
    assert.deepEqual(found.get(repos[1]), { found: false });
    assert.deepEqual(found.get(repos[2]), { found: true, stars: 10, open: false });
    global.fetch = async () => ({ ok: false, status: 502 });
    await assert.rejects(githubStars(repos.slice(0, 1)), /HTTP 502/);
  } finally {
    global.fetch = realFetch;
    if (realToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = realToken;
  }
});
