#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadCategories() {
  const categories = readJson(CATEGORY_PATH);
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

function logoFile(slug, type) {
  return path.join(LOGO_DIR, `${slug}.${type}`);
}

function localLogo(slug) {
  return rules.LOGO_TYPES.find((type) => fs.existsSync(logoFile(slug, type))) || null;
}

function logoProblems(type, bytes) {
  return type === 'svg' ? rules.svgErrors(bytes.toString('utf8')) : rules.pngErrors(bytes);
}

function loadLandscape() {
  const { categories, errors } = loadCategories();
  const categoryIds = categories.map((category) => category.id);
  const entries = [];
  const names = new Map();
  const files = fs.existsSync(ENTRY_DIR) ? fs.readdirSync(ENTRY_DIR).sort() : [];

  for (const file of files) {
    const label = `${rules.ENTRY_DIR}/${file}`;
    if (!file.endsWith('.json')) {
      errors.push(`${label}: only .json files belong in this folder`);
      continue;
    }
    const slug = file.slice(0, -'.json'.length);
    let entry;
    try {
      entry = readJson(path.join(ENTRY_DIR, file));
    } catch (error) {
      errors.push(`${label}: not valid JSON (${error.message})`);
      continue;
    }
    const entryErrors = rules.validateEntry(slug, entry, categoryIds);
    const logoType = localLogo(slug);
    if (entry.logo && !fs.existsSync(path.join(LOGO_DIR, String(entry.logo)))) entryErrors.push(`logo file site/${LOGO_WEB_PATH}/${entry.logo} is missing`);
    if (logoType) entryErrors.push(...logoProblems(logoType, fs.readFileSync(logoFile(slug, logoType))));
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
      logo: logoType ? `${LOGO_WEB_PATH}/${slug}.${logoType}` : null,
      logo_url: entry.logo_url || null
    });
  }

  if (fs.existsSync(LOGO_DIR)) {
    const slugs = new Set(files.map((file) => file.replace(/\.json$/, '')));
    for (const logo of fs.readdirSync(LOGO_DIR)) {
      if (logo.startsWith('.')) continue;
      if (!slugs.has(logo.replace(/\.(svg|png)$/, ''))) errors.push(`site/${LOGO_WEB_PATH}/${logo}: no entry uses this logo`);
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

function packLogos(data) {
  const groups = [...new Set(data.categories.map((category) => category.group))];
  const groupOf = new Map(data.categories.map((category) => [category.id, groups.indexOf(category.group)]));
  const chunks = groups.map(() => []);
  const sizes = groups.map(() => 0);
  for (const entry of data.entries) {
    if (!entry.logo) continue;
    const bytes = fs.readFileSync(path.join(__dirname, entry.logo));
    const index = groupOf.get(entry.category);
    entry.pack = [index, sizes[index], bytes.length];
    chunks[index].push(bytes);
    sizes[index] += bytes.length;
  }
  for (const stale of fs.readdirSync(__dirname)) {
    if (stale.startsWith(PACK_PREFIX) && stale.endsWith('.bin')) fs.unlinkSync(path.join(__dirname, stale));
  }
  data.packs = chunks.map((list, index) => {
    const bytes = Buffer.concat(list);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const name = `${PACK_PREFIX}${index}-${hash}.bin`;
    fs.writeFileSync(path.join(__dirname, name), bytes);
    return name;
  });
  return sizes.reduce((total, size) => total + size, 0);
}

function writeLandscape() {
  const landscape = loadLandscape();
  if (landscape.errors.length) {
    throw new Error(`landscape has ${landscape.errors.length} problem(s):\n  - ${landscape.errors.join('\n  - ')}`);
  }
  const data = publicData(landscape);
  const packed = packLogos(data);
  fs.writeFileSync(OUTPUT_PATH, `window.LANDSCAPE = ${JSON.stringify(data)};\n`);
  console.log(`   packed ${data.packs.length} logo files (${Math.round(packed / 1024)} KB)`);
  console.log(`   wrote landscape-data.js (${data.entries.length} tools, ${data.categories.length} categories)`);
  return data;
}

async function downloadLogo(url) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`logo_url answered HTTP ${response.status}`);
  if (!rules.parseHttps(response.url)) throw new Error('logo_url redirects to an address that is not public https');
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > rules.MAX_LOGO_BYTES) throw new Error(`logo is larger than ${rules.MAX_LOGO_BYTES / 1024} KB`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = /\.png$/i.test(new URL(url).pathname) ? 'png' : 'svg';
  const problems = logoProblems(type, bytes);
  if (problems.length) throw new Error(problems.join('; '));
  return { type, bytes };
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
        fs.writeFileSync(logoFile(entry.slug, logo.type), logo.bytes);
      }
      fetched += 1;
    } catch (error) {
      errors.push(`${rules.entryPath(entry.slug)}: ${error.message}`);
    }
  }
  return { errors, fetched, total: landscape.entries.length };
}

async function main(argv) {
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

module.exports = { loadLandscape, publicData, writeLandscape, downloadLogo, resolveRemoteLogos, OUTPUT_PATH };
