#!/usr/bin/env node
/**
 * Materialize vercel.json's clean-URL rewrites for static hosts that have no
 * rewrite engine (GitHub Pages). Reads the `rewrites` table — the single source
 * of truth, so the two hosts cannot drift — and writes
 * `<out>/<source>/index.html` for each entry, making /catalog, /glossary,
 * /path, /roadmap and /about resolve the way they do on Vercel.
 *
 * A redirect stub, not a copy: every page in site/ references its assets
 * relatively ("data.js", "style.css"), so a copy one directory down would
 * resolve them against /catalog/ and 404.
 *
 * Run: node scripts/pages_aliases.mjs [outDir]   # default: site/
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const { rewrites = [] } = JSON.parse(
  readFileSync(join(ROOT, 'vercel.json'), 'utf8')
);

let count = 0;
for (const { source, destination } of rewrites) {
  const slug = source.replace(/^\/+|\/+$/g, '');
  if (!slug || !destination) continue;
  // Climb back out of the alias directory so the stub's target stays
  // relative, and the site keeps working under a /<repo>/ base path.
  const target = '../'.repeat(slug.split('/').length) + destination.replace(/^\/+/, '');
  const dir = join(OUT, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), stub(target), 'utf8');
  console.log(`   /${slug} -> ${destination}`);
  count++;
}
console.log(`wrote ${count} clean-URL alias${count === 1 ? '' : 'es'}`);
