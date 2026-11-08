#!/usr/bin/env node
/**
 * Materialize vercel.json's clean-URL rewrites for static hosts that have no
 * rewrite engine (GitHub Pages). Reads the `rewrites` table — the single source
 * of truth, so the two hosts cannot drift — and writes
 * `<out>/<source>/index.html` for each entry, making /catalog, /glossary,
 * /path, /roadmap and /about resolve the way they do on Vercel.
 *
 * Two rewrites target serverless functions (/lesson and /certification are
 * server-rendered on Vercel to inject SEO metadata). Pages runs no functions,
 * so those fall back to the very template the function renders — the page
 * works, only the prerendered <head> is missing.
 *
 * A redirect stub, not a copy: every page in site/ references its assets
 * relatively ("data.js", "style.css"), so a copy one directory down would
 * resolve them against /catalog/ and 404.
 *
 * Parameterized rewrites (/glossary/:page([a-z0-9-]+) -> /hubs/glossary/:page.html)
 * are expanded against the built site: one stub per destination file that
 * actually exists, so run this after site/build.js. A stub never replaces a
 * real page, and a source with a file extension (/api/interviews.json) is
 * skipped, since a directory stub cannot serve it.
 *
 * Run: node scripts/pages_aliases.mjs [outDir]   # default: site/
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'site'));

// noindex: the stub is plumbing. The destination page carries the canonical.
const stub = (target) => `<!doctype html>
<meta charset="utf-8">
<title>Redirecting…</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
<p>Redirecting to <a href="${target}">${target}</a>…</p>
`;

// Serverless destinations have no runtime on Pages; each maps to the static
// template its function renders. An /api/ destination missing from this table
// is skipped rather than pointed at a URL that would 404.
const API_STATIC_FALLBACK = {
  '/api/lesson': '/lesson.html',
  '/api/certification': '/certification.html',
};

const { rewrites = [] } = JSON.parse(
  readFileSync(join(ROOT, 'vercel.json'), 'utf8')
);

const STUB_MARK = '<title>Redirecting…</title>';
const PARAM = /:([A-Za-z_]\w*)(?:\(((?:[^()]|\([^()]*\))*)\))?/g;

function filesUnder(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? filesUnder(join(dir, entry.name), rel) : [rel];
  });
}

let siteFiles = null;

// Every concrete (slug, destination) pair a rewrite stands for. A plain rewrite
// is one pair; a parameterized one is matched against the files in OUT.
function expand(source, destination) {
  const slug = source.replace(/^\/+|\/+$/g, '');
  if (!slug.includes(':')) return [[slug, destination]];
  const constraints = {};
  for (const m of slug.matchAll(PARAM)) constraints[m[1]] = m[2] ? new RegExp(`^(?:${m[2]})$`) : /^[^/]+$/;
  const names = [];
  const destPattern = new RegExp('^' + destination.replace(/^\/+/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z_]\w*)/g, (whole, name) => { names.push(name); return '([^/]+)'; }) + '$');
  siteFiles ??= filesUnder(OUT);
  const pairs = [];
  for (const file of siteFiles) {
    const m = file.match(destPattern);
    if (!m) continue;
    const values = Object.fromEntries(names.map((name, i) => [name, m[i + 1]]));
    if (!names.every((name) => !constraints[name] || constraints[name].test(values[name]))) continue;
    pairs.push([slug.replace(PARAM, (whole, name) => values[name]), '/' + file]);
  }
  return pairs;
}

let count = 0;
for (const { source, destination, has } of rewrites) {
  // Conditional rewrites are Vercel's content negotiation: /about with an
  // `accept` header goes to the /api/markdown function, which no static host
  // can serve. Only the unconditional page rewrite belongs in a stub.
  if (has) continue;
  if (!source.replace(/^\/+|\/+$/g, '') || !destination) continue;
  for (const [slug, dest] of expand(source, destination)) {
    // /api/interviews.json would become a directory named interviews.json.
    if (/\.[A-Za-z0-9]+$/.test(slug)) continue;
    const staticDest = dest.startsWith('/api/')
      ? API_STATIC_FALLBACK[dest.split('?')[0]]
      : dest;
    if (!staticDest) continue;
    // /interviews -> /interviews/index.html is already a directory index; a
    // stub there would replace the page with a redirect to itself.
    if (staticDest.replace(/^\/+/, '') === `${slug}/index.html`) continue;
    const file = join(OUT, slug, 'index.html');
    if (existsSync(file) && !readFileSync(file, 'utf8').includes(STUB_MARK)) continue;
    // Climb back out of the alias directory so the stub's target stays
    // relative, and the site keeps working under a /<repo>/ base path.
    const target = '../'.repeat(slug.split('/').length) + staticDest.replace(/^\/+/, '');
    mkdirSync(join(OUT, slug), { recursive: true });
    writeFileSync(file, stub(target), 'utf8');
    count++;
  }
}
console.log(`wrote ${count} clean-URL alias${count === 1 ? '' : 'es'}`);
