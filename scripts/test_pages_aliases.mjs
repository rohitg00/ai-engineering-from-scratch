/**
 * scripts/pages_aliases.mjs is the only thing standing between vercel.json's
 * clean-URL rewrites and a GitHub Pages deploy that has no rewrite engine, so
 * a mistake here 404s real URLs on the published site with nothing else to
 * catch it.
 *
 * The load-bearing invariant is the first test: every stub it writes must
 * point at a file that actually ships in site/. A rewrite whose destination is
 * a serverless function has no such file, which is exactly how /lesson — the
 * target of hundreds of links — silently became a dead redirect.
 *
 * Run: node --test scripts/test_pages_aliases.mjs
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'pages_aliases.mjs');
const SITE = join(ROOT, 'site');

function runGenerator(outDir, root = ROOT) {
  const script = root === ROOT ? SCRIPT : join(root, 'scripts', 'pages_aliases.mjs');
  return execFileSync('node', [script, outDir], { encoding: 'utf8' });
}

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * A temp repo root with its own vercel.json, so edge cases can be exercised
 * without editing the real one. The generator resolves ROOT from its own
 * location, so the script has to be copied alongside.
 */
function fixtureRoot(vercelJson) {
  const root = freshDir('aifs-alias-fixture-');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  cpSync(SCRIPT, join(root, 'scripts', 'pages_aliases.mjs'));
  writeFileSync(join(root, 'vercel.json'), JSON.stringify(vercelJson), 'utf8');
  return root;
}

function stubTarget(html) {
  const match = html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)">/);
  return match ? match[1] : null;
}

test('every generated stub points at a file that actually ships in site/', () => {
  const out = freshDir('aifs-alias-real-');
  runGenerator(out);

  const { rewrites } = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  // Parameterized sources expand against a built site (covered by a fixture
  // below); extension sources and directory indexes are deliberately skipped.
  const plain = (r) => {
    const slug = r.source.replace(/^\/+|\/+$/g, '');
    return slug && !slug.includes(':') && !/\.[A-Za-z0-9]+$/.test(slug)
      && r.destination.replace(/^\/+/, '') !== `${slug}/index.html`
      && (!r.destination.startsWith('/api/') || ['/api/lesson', '/api/certification'].includes(r.destination.split('?')[0]));
  };
  const expected = rewrites.filter(r => !r.has && plain(r));
  assert.ok(expected.length > 0, 'vercel.json has no unconditional rewrites to materialize');
  assert.ok(!execFileSync('find', [out, '-name', '*:*'], { encoding: 'utf8' }).trim(),
    'a parameterized source was written as a literal directory');

  for (const { source } of expected) {
    const slug = source.replace(/^\/+|\/+$/g, '');
    const stubPath = join(out, slug, 'index.html');
    assert.ok(existsSync(stubPath), `no stub written for /${slug}`);

    const target = stubTarget(readFileSync(stubPath, 'utf8'));
    assert.ok(target, `/${slug} stub has no refresh target`);

    // Resolve the target the way a browser would: relative to the stub's own
    // directory on the deployed site, which is site/<slug>/.
    const resolved = resolve(SITE, slug, target);
    assert.ok(
      existsSync(resolved),
      `/${slug} redirects to ${target}, which does not exist in site/`
    );
  }
});

test('serverless destinations fall back to the template the function renders', () => {
  const root = fixtureRoot({
    rewrites: [
      { source: '/lesson', destination: '/api/lesson' },
      { source: '/certification', destination: '/api/certification' },
    ],
  });
  const out = freshDir('aifs-alias-api-');
  runGenerator(out, root);

  assert.equal(
    stubTarget(readFileSync(join(out, 'lesson', 'index.html'), 'utf8')),
    '../lesson.html'
  );
  assert.equal(
    stubTarget(readFileSync(join(out, 'certification', 'index.html'), 'utf8')),
    '../certification.html'
  );
});

test('a serverless destination with no static equivalent is skipped, not left dangling', () => {
  const root = fixtureRoot({
    rewrites: [
      { source: '/search', destination: '/api/search' },
      { source: '/catalog', destination: '/catalog.html' },
    ],
  });
  const out = freshDir('aifs-alias-unknown-');
  const log = runGenerator(out, root);

  assert.equal(
    existsSync(join(out, 'search', 'index.html')),
    false,
    '/search got a stub pointing at a function Pages cannot run'
  );
  assert.ok(existsSync(join(out, 'catalog', 'index.html')));
  assert.match(log, /wrote 1 clean-URL alias$/m);
});

test('conditional rewrites are left to Vercel', () => {
  const root = fixtureRoot({
    rewrites: [
      {
        source: '/about',
        has: [{ type: 'header', key: 'accept', value: '.*' }],
        destination: '/api/markdown?path=/about',
      },
      { source: '/about', destination: '/about.html' },
    ],
  });
  const out = freshDir('aifs-alias-conditional-');
  runGenerator(out, root);

  // Both entries share a slug; only the unconditional page rewrite may win, or
  // /about would redirect to a markdown negotiation endpoint Pages cannot serve.
  assert.equal(
    stubTarget(readFileSync(join(out, 'about', 'index.html'), 'utf8')),
    '../about.html'
  );
});

test('stub targets stay relative so the site survives a /<repo>/ base path', () => {
  const root = fixtureRoot({
    rewrites: [
      { source: '/catalog', destination: '/catalog.html' },
      { source: '/docs/api/v1', destination: '/developer.html' },
    ],
  });
  const out = freshDir('aifs-alias-basepath-');
  runGenerator(out, root);

  const shallow = stubTarget(readFileSync(join(out, 'catalog', 'index.html'), 'utf8'));
  const nested = stubTarget(readFileSync(join(out, 'docs', 'api', 'v1', 'index.html'), 'utf8'));

  // This fork publishes under yennj12.js.org/ai-engineering-from-scratch/, so a
  // root-relative "/catalog.html" would escape the base path and 404.
  assert.equal(shallow, '../catalog.html');
  assert.equal(nested, '../../../developer.html');
  for (const target of [shallow, nested]) {
    assert.equal(target.startsWith('/'), false, `${target} is root-relative`);
  }
});

test('the stub carries the query string and hash through the redirect', () => {
  const root = fixtureRoot({ rewrites: [{ source: '/lesson', destination: '/api/lesson' }] });
  const out = freshDir('aifs-alias-query-');
  runGenerator(out, root);

  const html = readFileSync(join(out, 'lesson', 'index.html'), 'utf8');
  // Without this, /lesson?path=<lesson> lands on lesson.html with no lesson to
  // render — the query is the entire payload of those links.
  assert.match(html, /location\.replace\("\.\.\/lesson\.html" \+ location\.search \+ location\.hash\)/);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('a parameterized rewrite gets one stub per destination file the site ships', () => {
  const root = fixtureRoot({
    rewrites: [{ source: '/glossary/:page([a-z0-9-]+)', destination: '/hubs/glossary/:page.html' }],
  });
  const out = freshDir('aifs-alias-param-');
  mkdirSync(join(out, 'hubs', 'glossary'), { recursive: true });
  for (const name of ['adamw', 'kv-cache', 'Not_Valid']) writeFileSync(join(out, 'hubs', 'glossary', `${name}.html`), '<p>term</p>');
  runGenerator(out, root);

  assert.equal(stubTarget(readFileSync(join(out, 'glossary', 'adamw', 'index.html'), 'utf8')), '../../hubs/glossary/adamw.html');
  assert.ok(existsSync(join(out, 'glossary', 'kv-cache', 'index.html')));
  assert.ok(!existsSync(join(out, 'glossary', 'Not_Valid')), 'a file outside the parameter pattern got a stub');
  assert.ok(!existsSync(join(out, 'glossary', ':page([a-z0-9-]+)')));
});

test('a stub never replaces a real page, including its own directory index', () => {
  const root = fixtureRoot({
    rewrites: [
      { source: '/interviews', destination: '/interviews/index.html' },
      { source: '/catalog', destination: '/catalog.html' },
    ],
  });
  const out = freshDir('aifs-alias-real-page-');
  mkdirSync(join(out, 'interviews'), { recursive: true });
  mkdirSync(join(out, 'catalog'), { recursive: true });
  writeFileSync(join(out, 'interviews', 'index.html'), '<h1>Interviews</h1>');
  writeFileSync(join(out, 'catalog', 'index.html'), '<h1>Real catalog page</h1>');
  runGenerator(out, root);

  assert.equal(readFileSync(join(out, 'interviews', 'index.html'), 'utf8'), '<h1>Interviews</h1>');
  assert.equal(readFileSync(join(out, 'catalog', 'index.html'), 'utf8'), '<h1>Real catalog page</h1>');
});

test('a source with a file extension is left to Vercel', () => {
  const root = fixtureRoot({ rewrites: [{ source: '/api/interviews.json', destination: '/interviews.json' }] });
  const out = freshDir('aifs-alias-ext-');
  runGenerator(out, root);
  assert.ok(!existsSync(join(out, 'api', 'interviews.json')));
});
