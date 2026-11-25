#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns');
const fs = require('node:fs');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const zlib = require('node:zlib');
const rules = require('./landscape-rules.js');
const { phaseSlug, phasePath } = require('../lib/hub-routes');

const REPO_ROOT = path.resolve(__dirname, '..');
const LANDSCAPE_DIR = path.join(REPO_ROOT, 'landscape');
const ENTRY_DIR = path.join(LANDSCAPE_DIR, 'entries');
const CATEGORY_PATH = path.join(LANDSCAPE_DIR, 'categories.json');
const LOGO_DIR = path.join(__dirname, 'logos', 'landscape');
const LOGO_WEB_PATH = 'logos/landscape';
const OUTPUT_PATH = path.join(__dirname, 'landscape-data.js');
const FETCH_TIMEOUT_MS = 15000;
const PACK_PREFIX = 'landscape-logos-';
const STAR_BATCH = 50;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'ai-engineering-from-scratch-landscape';
const DEFAULT_DIRS = { entryDir: ENTRY_DIR, categoryPath: CATEGORY_PATH, logoDir: LOGO_DIR };

const BLOCKED_ADDRESSES = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
]) BLOCKED_ADDRESSES.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]
]) BLOCKED_ADDRESSES.addSubnet(address, prefix, 'ipv6');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadCategories(categoryPath) {
  const categories = readJson(categoryPath);
  const errors = [];
  const seen = new Set();
  for (const category of categories) {
    if (!category.id || !category.group || !category.name || !category.summary || !category.phase) {
      errors.push(`categories.json: "${category.id || '?'}" needs id, group, name, summary and phase`);
      continue;
    }
    if (seen.has(category.id)) errors.push(`categories.json: duplicate id "${category.id}"`);
    seen.add(category.id);
    if (!fs.existsSync(path.join(REPO_ROOT, 'phases', category.phase))) {
      errors.push(`categories.json: "${category.id}" points to a missing phase "${category.phase}"`);
    }
  }
  return { categories, errors };
}

function logoType(name) {
  const match = /\.(svg|png)$/i.exec(String(name));
  return match ? match[1].toLowerCase() : null;
}

function chosenLogo(slug, entry) {
  if (typeof entry.logo === 'string') return entry.logo;
  if (typeof entry.logo_url !== 'string') return null;
  let pathname;
  try { pathname = new URL(entry.logo_url).pathname; } catch (_) { return null; }
  const type = logoType(pathname);
  return type ? `${slug}.${type}` : null;
}

function pngDataProblems(bytes) {
  const png = rules.readPng(bytes);
  if (png.error) return [];
  const expected = rules.pngDataLength(png.header);
  let pixels;
  try {
    pixels = zlib.inflateSync(Buffer.concat(png.idat), { maxOutputLength: expected + 1 });
  } catch (_) {
    return ['PNG logo image data is damaged or larger than its size says'];
  }
  if (pixels.length !== expected) return ['PNG logo image data does not match its size'];
  return [];
}

function logoProblems(type, bytes) {
  if (type === 'svg') return rules.svgErrors(bytes.toString('utf8'));
  const problems = rules.pngErrors(bytes);
  return problems.length ? problems : pngDataProblems(bytes);
}

function loadLandscape(dirs = DEFAULT_DIRS) {
  const { entryDir, categoryPath, logoDir } = { ...DEFAULT_DIRS, ...dirs };
  const { categories, errors } = loadCategories(categoryPath);
  const categoryIds = categories.map((category) => category.id);
  const entries = [];
  const names = new Map();
  const files = fs.existsSync(entryDir) ? fs.readdirSync(entryDir).sort() : [];
  const usedLogos = new Set();

  for (const file of files) {
    const label = `${rules.ENTRY_DIR}/${file}`;
    if (!file.endsWith('.json')) {
      errors.push(`${label}: only .json files belong in this folder`);
      continue;
    }
    const slug = file.slice(0, -'.json'.length);
    let entry;
    try {
      entry = readJson(path.join(entryDir, file));
    } catch (error) {
      errors.push(`${label}: not valid JSON (${error.message})`);
      for (const type of rules.LOGO_TYPES) usedLogos.add(`${slug}.${type}`);
      continue;
    }
    const entryErrors = rules.validateEntry(slug, entry, categoryIds);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      for (const problem of entryErrors) errors.push(`${label}: ${problem}`);
      continue;
    }
    const chosen = chosenLogo(slug, entry);
    if (chosen) usedLogos.add(chosen);
    const chosenPath = chosen && path.join(logoDir, path.basename(chosen));
    const hasLogo = Boolean(chosenPath && fs.existsSync(chosenPath));
    if (entry.logo && !hasLogo) entryErrors.push(`logo file site/${LOGO_WEB_PATH}/${entry.logo} is missing`);
    if (hasLogo) entryErrors.push(...logoProblems(logoType(chosen), fs.readFileSync(chosenPath)));
    if (typeof entry.name === 'string') {
      const key = entry.name.trim().toLowerCase();
      if (names.has(key)) entryErrors.push(`"${entry.name}" is already listed in ${names.get(key)}`);
      else names.set(key, label);
    }
    if (entryErrors.length) {
      for (const problem of entryErrors) errors.push(`${label}: ${problem}`);
      continue;
    }
    entries.push({
      slug,
      name: entry.name.trim(),
      url: entry.url,
      category: entry.category,
      categories: [entry.category].concat(entry.also || []),
      description: entry.description.trim(),
      open_source: entry.open_source,
      repo: entry.repo || null,
      x: entry.x || null,
      pinned: false,
      featured: false,
      sponsor: false,
      logo: hasLogo ? `${LOGO_WEB_PATH}/${chosen}` : null,
      logo_url: entry.logo_url || null
    });
  }

  if (fs.existsSync(logoDir)) {
    for (const logo of fs.readdirSync(logoDir)) {
      if (logo.startsWith('.')) continue;
      if (!usedLogos.has(logo)) errors.push(`site/${LOGO_WEB_PATH}/${logo}: no entry uses this logo`);
    }
  }

  const pinRank = new Map();
  for (const category of categories) {
    (category.pinned || []).forEach((slug, index) => {
      pinRank.set(slug, index);
      if (!entries.some((entry) => entry.slug === slug && entry.categories.includes(category.id))) errors.push(`categories.json: "${category.id}" pins "${slug}", which is not in that category`);
    });
  }
  const featured = new Set(categories.flatMap((category) => category.featured || []));
  const sponsors = new Set(categories.flatMap((category) => category.sponsors || []));
  for (const entry of entries) {
    entry.pinned = pinRank.has(entry.slug);
    entry.featured = featured.has(entry.slug);
    entry.sponsor = sponsors.has(entry.slug);
  }
  const rank = (entry) => (pinRank.has(entry.slug) ? pinRank.get(entry.slug) : Infinity);
  entries.sort((a, b) => (rank(a) - rank(b)) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return { categories, entries, errors };
}

function publicData(landscape) {
  return {
    repo: rules.REPO,
    categories: landscape.categories.map((category) => ({
      id: category.id,
      group: category.group,
      name: category.name,
      summary: category.summary,
      learn: phasePath(phaseSlug(category.phase))
    })),
    entries: landscape.entries.map(({ logo_url, ...entry }) => entry)
  };
}

function readSiteLogo(entry) {
  return fs.readFileSync(path.join(__dirname, entry.logo));
}

function packLogos(data, readLogo = readSiteLogo) {
  const groups = [...new Set(data.categories.map((category) => category.group))];
  const groupOf = new Map(data.categories.map((category) => [category.id, groups.indexOf(category.group)]));
  const chunks = groups.map(() => []);
  const sizes = groups.map(() => 0);
  for (const entry of data.entries) {
    if (!entry.logo) continue;
    const bytes = readLogo(entry);
    const index = groupOf.get(entry.category);
    entry.pack = [index, sizes[index], bytes.length];
    chunks[index].push(bytes);
    sizes[index] += bytes.length;
  }
  return chunks.map((list) => Buffer.concat(list));
}

function writePacks(data, packs) {
  for (const stale of fs.readdirSync(__dirname)) {
    if (stale.startsWith(PACK_PREFIX) && stale.endsWith('.bin')) fs.unlinkSync(path.join(__dirname, stale));
  }
  data.packs = packs.map((bytes, index) => {
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const name = `${PACK_PREFIX}${index}-${hash}.bin`;
    fs.writeFileSync(path.join(__dirname, name), bytes);
    return name;
  });
  return packs.reduce((total, bytes) => total + bytes.length, 0);
}

function writeLandscape() {
  const landscape = loadLandscape();
  if (landscape.errors.length) {
    throw new Error(`landscape has ${landscape.errors.length} problem(s):\n  - ${landscape.errors.join('\n  - ')}`);
  }
  const data = publicData(landscape);
  const packed = writePacks(data, packLogos(data));
  fs.writeFileSync(OUTPUT_PATH, `window.LANDSCAPE = ${JSON.stringify(data)};\n`);
  console.log(`   packed ${data.packs.length} logo files (${Math.round(packed / 1024)} KB)`);
  console.log(`   wrote landscape-data.js (${data.entries.length} tools, ${data.categories.length} categories)`);
  return data;
}

function isPublicAddress(address) {
  const family = net.isIP(String(address));
  if (!family) return false;
  return !BLOCKED_ADDRESSES.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function publicLookup(resolve = dns.lookup) {
  return function lookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    resolve(hostname, options, (error, address, family) => {
      if (error) return callback(error);
      const list = Array.isArray(address) ? address : [{ address, family }];
      const blocked = list.find((item) => !isPublicAddress(item.address));
      if (!list.length || blocked) {
        const problem = new Error(`${hostname} resolves to a private or reserved address${blocked ? ` (${blocked.address})` : ''}`);
        problem.code = 'ELANDSCAPEPRIVATE';
        return callback(problem);
      }
      return callback(null, address, family);
    });
  };
}

function readCapped(stream, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        stream.destroy();
        reject(new Error(`logo is larger than ${limit / 1024} KB`));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function requestLogo(url, { lookup, signal }) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      lookup,
      signal,
      agent: false,
      headers: { 'accept-encoding': 'identity', 'user-agent': USER_AGENT }
    }, (response) => {
      const status = response.statusCode;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        try {
          resolve({ redirect: new URL(response.headers.location, url).href });
        } catch (_) {
          reject(new Error('logo_url redirects to an address that is not valid'));
        }
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`logo_url answered HTTP ${status}`));
        return;
      }
      const encoding = String(response.headers['content-encoding'] || 'identity').toLowerCase();
      if (encoding !== 'identity') {
        response.destroy();
        reject(new Error(`logo_url answered with a compressed body (${encoding})`));
        return;
      }
      if (Number(response.headers['content-length'] || 0) > rules.MAX_LOGO_BYTES) {
        response.destroy();
        reject(new Error(`logo is larger than ${rules.MAX_LOGO_BYTES / 1024} KB`));
        return;
      }
      readCapped(response, rules.MAX_LOGO_BYTES).then((bytes) => resolve({ bytes }), reject);
    });
    request.on('error', (error) => reject(error.code === 'ELANDSCAPEPRIVATE' ? new Error(`logo_url ${error.message}`) : error));
  });
}

async function downloadLogo(url, { lookup = publicLookup() } = {}) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = rules.parseHttps(current);
    if (!target) throw new Error(hop ? 'logo_url redirects to an address that is not public https' : '"logo_url" must be a public https:// address');
    const result = await requestLogo(target.href, { lookup, signal });
    if (result.redirect) {
      current = result.redirect;
      continue;
    }
    const type = /\.png$/i.test(new URL(url).pathname) ? 'png' : 'svg';
    const problems = logoProblems(type, result.bytes);
    if (problems.length) throw new Error(problems.join('; '));
    return { type, bytes: result.bytes };
  }
  throw new Error(`logo_url redirects more than ${MAX_REDIRECTS} times`);
}

const STAR_APIS = {
  'github.com': (owner, name) => [`https://api.github.com/repos/${owner}/${name}`, (body) => [body.stargazers_count, body.private === false]],
  'gitlab.com': (owner, name) => [`https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${name}`)}`, (body) => [body.star_count, body.visibility === 'public']],
  'codeberg.org': (owner, name) => [`https://codeberg.org/api/v1/repos/${owner}/${name}`, (body) => [body.stars_count, body.private === false]]
};

async function repoStars(repo) {
  const { hostname, pathname } = new URL(repo);
  const [owner, name] = pathname.slice(1).split('/');
  const [api, read] = STAR_APIS[hostname](owner, name);
  const headers = { accept: 'application/json', 'user-agent': USER_AGENT };
  if (hostname === 'github.com' && process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(api, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (response.status === 404) return { found: false };
  if (!response.ok) throw new Error(`${hostname} answered HTTP ${response.status} for ${repo}`);
  const [stars, open] = read(await response.json());
  return { found: true, stars: Number(stars) || 0, open };
}

async function githubStars(repos) {
  const found = new Map();
  for (let start = 0; start < repos.length; start += STAR_BATCH) {
    const batch = repos.slice(start, start + STAR_BATCH);
    const fields = batch.map((repo, index) => {
      const [owner, name] = new URL(repo).pathname.slice(1).split('/');
      return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { stargazerCount isPrivate }`;
    });
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify({ query: `query { ${fields.join(' ')} }` }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`github.com answered HTTP ${response.status}`);
    const { data } = await response.json();
    if (!data) throw new Error('github.com answered without data');
    batch.forEach((repo, index) => {
      const node = data[`r${index}`];
      found.set(repo, node ? { found: true, stars: node.stargazerCount, open: !node.isPrivate } : { found: false });
    });
  }
  return found;
}

async function checkStars(files, lookupStars = repoStars) {
  const errors = [];
  const entries = [];
  for (const file of files) {
    const slug = path.basename(file).replace(/\.json$/, '');
    let entry;
    try {
      entry = readJson(path.resolve(REPO_ROOT, file));
    } catch (_) {
      continue;
    }
    if (!entry || entry.open_source !== true || typeof entry.repo !== 'string' || rules.validateEntry(slug, { ...entry, category: 'x' }, ['x']).some((problem) => /"repo"/.test(problem))) continue;
    entries.push({ slug, entry });
  }
  let known = new Map();
  if (lookupStars === repoStars && process.env.GITHUB_TOKEN) {
    const repos = entries.map(({ entry }) => entry.repo).filter((repo) => new URL(repo).hostname === 'github.com');
    try {
      known = await githubStars([...new Set(repos)]);
    } catch (_) {
      known = new Map();
    }
  }
  for (const { slug, entry } of entries) {
    try {
      const result = known.get(entry.repo) || await lookupStars(entry.repo);
      if (!result.found || !result.open) errors.push(`${rules.entryPath(slug)}: ${entry.repo} is not a public repository`);
      else if (result.stars < rules.MIN_STARS) errors.push(`${rules.entryPath(slug)}: ${entry.repo} has ${result.stars} stars; open source tools need ${rules.MIN_STARS} or more`);
    } catch (error) {
      errors.push(`${rules.entryPath(slug)}: could not read stars (${error.message})`);
    }
  }
  return { errors, checked: entries.length };
}

async function resolveRemoteLogos({ write }) {
  const landscape = loadLandscape();
  const errors = landscape.errors.slice();
  let fetched = 0;
  for (const entry of landscape.entries) {
    if (entry.logo || !entry.logo_url) continue;
    try {
      const logo = await downloadLogo(entry.logo_url);
      if (write) {
        fs.mkdirSync(LOGO_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOGO_DIR, `${entry.slug}.${logo.type}`), logo.bytes);
      }
      fetched += 1;
    } catch (error) {
      errors.push(`${rules.entryPath(entry.slug)}: ${error.message}`);
    }
  }
  return { errors, fetched, total: landscape.entries.length };
}

async function main(argv) {
  const starsAt = argv.indexOf('--stars');
  if (starsAt !== -1) {
    const result = await checkStars(argv.slice(starsAt + 1));
    if (result.errors.length) {
      console.error(`Star check failed with ${result.errors.length} problem(s):\n`);
      for (const problem of result.errors) console.error(`  - ${problem}`);
      console.error('\nListing rules: landscape/README.md');
      return 1;
    }
    console.log(`Stars OK: ${result.checked} open source tool(s) checked`);
    return 0;
  }
  const remote = argv.includes('--remote');
  const fetchLogos = argv.includes('--fetch-logos');
  if (argv.includes('--check') || fetchLogos) {
    let result;
    if (remote || fetchLogos) {
      result = await resolveRemoteLogos({ write: fetchLogos });
    } else {
      const landscape = loadLandscape();
      result = { errors: landscape.errors, fetched: 0, total: landscape.entries.length };
    }
    if (result.errors.length) {
      console.error(`Landscape check failed with ${result.errors.length} problem(s):\n`);
      for (const problem of result.errors) console.error(`  - ${problem}`);
      console.error('\nHow to fix an entry: landscape/README.md');
      return 1;
    }
    console.log(`Landscape OK: ${result.total} tools${result.fetched ? `, ${result.fetched} logo(s) ${fetchLogos ? 'saved' : 'reachable'}` : ''}`);
    return 0;
  }
  writeLandscape();
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  loadLandscape,
  publicData,
  packLogos,
  writeLandscape,
  logoProblems,
  isPublicAddress,
  publicLookup,
  readCapped,
  downloadLogo,
  checkStars,
  resolveRemoteLogos,
  OUTPUT_PATH, githubStars };
