#!/usr/bin/env node
/**
 * Local-first dev server for the static course site.
 *
 * - Serves `site/` assets (index.html, lesson.html, etc.)
 * - Serves course content from the local filesystem under `/content/...`
 * - Provides a minimal runner API:
 *     POST /api/run  -> executes python for a single file
 *     POST /api/test -> executes tests (pytest if available, else unittest)
 *
 * This is intentionally dependency-free (no npm install).
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_DIR = __dirname;
const COURSE_ROOT = path.resolve(SITE_DIR, '..');
const CATALOG_PATH = path.join(COURSE_ROOT, 'catalog.json');

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || '127.0.0.1';

const MAX_BODY_BYTES = 1_000_000; // 1MB
const MAX_CODE_BYTES = 300_000; // 300KB
const RUN_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 60_000;

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.md', 'text/markdown; charset=utf-8'],
]);

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf-8');
  res.writeHead(status, { 'content-length': buf.length, ...headers });
  res.end(buf);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), { 'content-type': 'application/json; charset=utf-8' });
}

function notFound(res) {
  sendJson(res, 404, { error: 'not_found' });
}

function badRequest(res, message) {
  sendJson(res, 400, { error: 'bad_request', message });
}

function safeJoin(rootDir, urlPath) {
  const clean = String(urlPath || '').replace(/^\/+/, '');
  if (!clean || clean.includes('\0')) return null;
  const resolved = path.resolve(rootDir, clean);
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) return null;
  return resolved;
}

async function readBodyJson(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('invalid_json');
  }
}

async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function runProcess(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      ...opts,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...(opts?.env || {}) },
    });

    let stdout = '';
    let stderr = '';
    const maxOut = 2_000_000;

    child.stdout.on('data', (d) => {
      if (stdout.length < maxOut) stdout += d.toString('utf-8');
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < maxOut) stderr += d.toString('utf-8');
    });

    const timeoutMs = opts?.timeoutMs ?? 10_000;
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve({ code: null, signal: 'SIGKILL', stdout, stderr, timedOut: true });
    }, timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut: false });
    });
  });
}

async function ensureTmpDir(prefix) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  return dir;
}

async function copyDir(srcDir, dstDir, { excludeNames = new Set() } = {}) {
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  await fsp.mkdir(dstDir, { recursive: true });
  for (const ent of entries) {
    if (excludeNames.has(ent.name)) continue;
    const src = path.join(srcDir, ent.name);
    const dst = path.join(dstDir, ent.name);
    if (ent.isDirectory()) {
      await copyDir(src, dst, { excludeNames });
    } else if (ent.isFile()) {
      await fsp.copyFile(src, dst);
    }
  }
}

let catalog = null;
async function loadCatalog() {
  if (catalog) return catalog;
  const raw = await fsp.readFile(CATALOG_PATH, 'utf-8');
  catalog = JSON.parse(raw);
  return catalog;
}

async function lessonMetaByPath(lessonPath) {
  const c = await loadCatalog();
  const phases = c?.phases || [];
  for (const p of phases) {
    for (const l of p.lessons || []) {
      if (l.path === lessonPath) return l;
    }
  }
  return null;
}

async function resolveRunnables(lessonDir, meta) {
  const runnables = [];
  const addIfExists = async (relPath, source) => {
    const abs = safeJoin(lessonDir, relPath);
    if (!abs) return;
    try {
      const st = await fsp.stat(abs);
      if (!st.isFile()) return;
    } catch {
      return;
    }
    const ext = path.extname(relPath).toLowerCase();
    const lang =
      ext === '.py' ? 'Python' :
      ext === '.ts' ? 'TypeScript' :
      ext === '.js' ? 'JavaScript' :
      ext === '.rs' ? 'Rust' :
      ext === '.jl' ? 'Julia' :
      ext === '.ipynb' ? 'Notebook' :
      'File';
    const kind = ext === '.ipynb' ? 'notebook' : 'code';
    runnables.push({ path: relPath.replace(/\\/g, '/'), kind, lang, source });
  };

  const declared = Array.isArray(meta?.code_files) ? meta.code_files : [];
  for (const f of declared) {
    const name = String(f || '').trim();
    if (!name) continue;
    await addIfExists(name, 'catalog');
    await addIfExists(path.join('code', name), 'catalog');
  }

  // Notebook discovery (common patterns)
  await addIfExists('notebook.ipynb', 'auto');
  await addIfExists(path.join('notebooks', 'notebook.ipynb'), 'auto');

  // Fallback: scan code/ for common runnable extensions
  if (runnables.length === 0) {
    const codeDir = path.join(lessonDir, 'code');
    try {
      const entries = await fsp.readdir(codeDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        const ext = path.extname(ent.name).toLowerCase();
        if (!['.py', '.js', '.ts', '.rs', '.jl', '.sh'].includes(ext)) continue;
        await addIfExists(path.join('code', ent.name), 'auto');
      }
    } catch {}
  }

  // Deduplicate by path
  const seen = new Set();
  const uniq = [];
  for (const r of runnables) {
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    uniq.push(r);
  }
  return uniq;
}

async function readJsonIfExists(absPath) {
  try {
    const raw = await fsp.readFile(absPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function hasTests(lessonDir) {
  try {
    const st = await fsp.stat(path.join(lessonDir, 'tests'));
    if (st.isDirectory()) return true;
  } catch {}
  try {
    const entries = await fsp.readdir(lessonDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (/^test_.*\.py$/i.test(ent.name) || /_test\.py$/i.test(ent.name)) return true;
    }
  } catch {}
  return false;
}

async function serveStaticFile(res, filePath) {
  try {
    const st = await fsp.stat(filePath);
    if (!st.isFile()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME.get(ext) || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    notFound(res);
  }
}

function parseUrl(reqUrl) {
  try {
    return new URL(reqUrl, `http://${HOST}:${PORT}`);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const u = parseUrl(req.url);
  if (!u) return badRequest(res, 'invalid_url');

  // CORS for local dev (same-origin in normal use; harmless here)
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && u.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && u.pathname === '/api/lesson-meta') {
    const lessonPath = u.searchParams.get('path') || '';
    if (!lessonPath.startsWith('phases/')) return badRequest(res, 'path must start with phases/');
    const meta = await lessonMetaByPath(lessonPath);
    if (!meta) return sendJson(res, 200, { path: lessonPath, has_docs: false, has_code: false, code_files: [], runnables: [] });
    const lessonDir = safeJoin(COURSE_ROOT, meta.path);
    const runnables = lessonDir ? await resolveRunnables(lessonDir, meta) : [];
    return sendJson(res, 200, {
      path: meta.path,
      title: meta.title,
      has_docs: !!meta.has_docs,
      has_quiz: !!meta.has_quiz,
      has_code: !!meta.has_code,
      code_files: Array.isArray(meta.code_files) ? meta.code_files : [],
      runnables,
    });
  }

  if (req.method === 'GET' && u.pathname === '/api/list') {
    const rel = u.searchParams.get('path') || '';
    if (!rel || rel.includes('..') || rel.includes('\0')) return badRequest(res, 'invalid path');
    const targetDir = safeJoin(COURSE_ROOT, rel);
    if (!targetDir) return badRequest(res, 'invalid path');
    try {
      const st = await fsp.stat(targetDir);
      if (!st.isDirectory()) return badRequest(res, 'path is not a directory');
      const entries = await fsp.readdir(targetDir, { withFileTypes: true });
      const out = [];
      for (const ent of entries) {
        const abs = path.join(targetDir, ent.name);
        let size = 0;
        try {
          const est = await fsp.stat(abs);
          size = est.isFile() ? est.size : 0;
        } catch {}
        out.push({
          name: ent.name,
          type: ent.isDirectory() ? 'dir' : ent.isFile() ? 'file' : 'other',
          size,
          path: path.posix.join(rel.replace(/\\/g, '/'), ent.name),
          url: '/content/' + path.posix.join(rel.replace(/\\/g, '/'), ent.name),
        });
      }
      out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
      return sendJson(res, 200, { ok: true, entries: out });
    } catch {
      return notFound(res);
    }
  }

  if (req.method === 'GET' && u.pathname === '/api/rubric') {
    const lessonPath = u.searchParams.get('path') || '';
    if (!lessonPath.startsWith('phases/')) return badRequest(res, 'path must start with phases/');
    const meta = await lessonMetaByPath(lessonPath);
    const lessonDir = safeJoin(COURSE_ROOT, lessonPath);
    if (!lessonDir) return badRequest(res, 'invalid path');

    const explicit = await readJsonIfExists(path.join(lessonDir, 'rubric.json'));
    if (explicit) return sendJson(res, 200, { ok: true, rubric: explicit, source: 'file' });

    const runnables = meta ? await resolveRunnables(lessonDir, meta) : [];
    const tests = await hasTests(lessonDir);
    const generated = {
      version: 1,
      lessonPath,
      title: meta?.title || '',
      items: runnables.map((r) => ({
        id: r.path,
        runnable: r.path,
        kind: r.kind,
        language: r.lang,
        goal: '',
        checks: {
          run: true,
          tests,
          style: false,
        },
      })),
      guidance: {
        allowInternet: false,
        allowExternalPackages: true,
      },
    };
    return sendJson(res, 200, { ok: true, rubric: generated, source: 'generated' });
  }

  if (req.method === 'POST' && u.pathname === '/api/review') {
    // Stub: UI can call this later once you decide which LLM provider to use.
    return sendJson(res, 501, {
      ok: false,
      error: 'not_implemented',
      message: 'AI review is not wired up yet. Add an LLM provider and implement /api/review.',
    });
  }

  if (req.method === 'POST' && u.pathname === '/api/run') {
    let body;
    try {
      body = await readBodyJson(req);
    } catch (e) {
      return badRequest(res, e.message === 'body_too_large' ? 'body too large' : 'invalid json');
    }

    const lessonPath = String(body?.lessonPath || '');
    const filePath = String(body?.filePath || '');
    const code = String(body?.code || '');
    const args = Array.isArray(body?.args) ? body.args.map(String) : [];

    if (!lessonPath.startsWith('phases/')) return badRequest(res, 'lessonPath must start with phases/');
    if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) return badRequest(res, 'invalid filePath');
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES) return badRequest(res, 'code too large');

    const lessonDir = safeJoin(COURSE_ROOT, lessonPath);
    if (!lessonDir || !(await fileExists(lessonDir))) return badRequest(res, 'lesson not found');

    const tmp = await ensureTmpDir('aifs-run-');
    const dstLesson = path.join(tmp, 'lesson');

    await copyDir(lessonDir, dstLesson, { excludeNames: new Set(['outputs', '.git', '__pycache__']) });

    const target = safeJoin(dstLesson, filePath);
    if (!target) return badRequest(res, 'invalid filePath');
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, code, 'utf-8');

    const r = await runProcess(
      'python3',
      ['-I', filePath, ...args],
      { cwd: dstLesson, timeoutMs: RUN_TIMEOUT_MS }
    );

    return sendJson(res, 200, {
      ok: r.code === 0 && !r.timedOut,
      timedOut: r.timedOut,
      code: r.code,
      signal: r.signal,
      stdout: r.stdout,
      stderr: r.stderr,
    });
  }

  if (req.method === 'POST' && u.pathname === '/api/test') {
    let body;
    try {
      body = await readBodyJson(req);
    } catch (e) {
      return badRequest(res, e.message === 'body_too_large' ? 'body too large' : 'invalid json');
    }

    const lessonPath = String(body?.lessonPath || '');
    const edits = body?.edits && typeof body.edits === 'object' ? body.edits : {};

    if (!lessonPath.startsWith('phases/')) return badRequest(res, 'lessonPath must start with phases/');

    const lessonDir = safeJoin(COURSE_ROOT, lessonPath);
    if (!lessonDir || !(await fileExists(lessonDir))) return badRequest(res, 'lesson not found');

    const tmp = await ensureTmpDir('aifs-test-');
    const dstLesson = path.join(tmp, 'lesson');

    await copyDir(lessonDir, dstLesson, { excludeNames: new Set(['outputs', '.git', '__pycache__']) });

    // Apply edits
    for (const [rel, content] of Object.entries(edits)) {
      const relPath = String(rel || '');
      if (!relPath || relPath.includes('..') || path.isAbsolute(relPath)) continue;
      const txt = String(content ?? '');
      if (Buffer.byteLength(txt, 'utf-8') > MAX_CODE_BYTES) continue;
      const target = safeJoin(dstLesson, relPath);
      if (!target) continue;
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, txt, 'utf-8');
    }

    const hasPytest = (await runProcess('python3', ['-c', 'import pytest; print(pytest.__version__)'], { cwd: dstLesson, timeoutMs: 3000 })).code === 0;
    const cmd = 'python3';
    const args = hasPytest ? ['-m', 'pytest', '-q'] : ['-m', 'unittest', 'discover', '-v'];

    const r = await runProcess(cmd, args, { cwd: dstLesson, timeoutMs: TEST_TIMEOUT_MS });
    return sendJson(res, 200, {
      ok: r.code === 0 && !r.timedOut,
      runner: hasPytest ? 'pytest' : 'unittest',
      timedOut: r.timedOut,
      code: r.code,
      signal: r.signal,
      stdout: r.stdout,
      stderr: r.stderr,
    });
  }

  if (req.method === 'GET' && u.pathname.startsWith('/content/')) {
    const rel = u.pathname.slice('/content/'.length);
    const target = safeJoin(COURSE_ROOT, rel);
    if (!target) return notFound(res);
    return serveStaticFile(res, target);
  }

  // Serve site assets. Default to index.html.
  if (req.method === 'GET') {
    const rel = u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\/+/, '');
    const target = safeJoin(SITE_DIR, rel);
    if (!target) return notFound(res);
    return serveStaticFile(res, target);
  }

  notFound(res);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`AIFS local server running at http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`- Dashboard: http://${HOST}:${PORT}/dashboard.html`);
  // eslint-disable-next-line no-console
  console.log(`- About:     http://${HOST}:${PORT}/index.html`);
  // eslint-disable-next-line no-console
  console.log(`- Lessons: http://${HOST}:${PORT}/lesson.html?path=phases/01-math-foundations/01-linear-algebra-intuition`);
});
