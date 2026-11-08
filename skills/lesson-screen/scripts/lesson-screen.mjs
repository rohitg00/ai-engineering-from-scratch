#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const TEMPLATES = path.join(path.dirname(SCRIPT), '..', 'templates');
const SITE_ORIGIN = 'https://aiengineeringfromscratch.com';
const EVENT_TYPES = new Set(['choice', 'part', 'step', 'note']);
const EVENT_KEYS = ['type', 'screen', 'question', 'choice', 'text', 'part', 'label'];
const SCREEN_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.html$/;
const isScreenName = (n) => SCREEN_NAME_RE.test(n);
export const redact = (text) => String(text).replace(/key=[0-9a-f]{16,}/gi, 'key=...');
export const urlHost = (h) => (h && h.includes(':') && !h.startsWith('[') ? `[${h}]` : h);
const ASSET_RE = /^\/(?:s\/)?(lesson-figures|figure-manifest|figures(?:-[a-z0-9-]+)?)\.js$/;
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://aiengineeringfromscratch.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://aiengineeringfromscratch.com; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";

function sessionPaths(dir) {
  const state = path.join(dir, 'state');
  return {
    dir,
    screens: path.join(dir, 'screens'),
    state,
    serverFile: path.join(state, 'server.json'),
    eventsFile: path.join(state, 'events.jsonl'),
    cursorFile: path.join(state, 'events.cursor'),
    lastPortFile: path.join(state, 'last-port'),
    stoppedFile: path.join(state, 'stopped'),
    logFile: path.join(state, 'server.log'),
  };
}

function ensureDirs(dir) {
  const p = sessionPaths(dir);
  fs.mkdirSync(p.screens, { recursive: true });
  fs.mkdirSync(p.state, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(p.state, 0o700); } catch {}
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function nextIndex(dir) {
  const p = sessionPaths(dir);
  let max = 0;
  try {
    for (const name of fs.readdirSync(p.screens)) {
      const m = /^(\d+)/.exec(name);
      if (m && name.endsWith('.html')) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch {}
  return max + 1;
}

function kebab(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function screenTitle(file, name) {
  let body;
  try {
    body = fs.readFileSync(file, 'utf8');
  } catch {
    return name;
  }
  const clean = (raw) => raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const head = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/i.exec(body);
  let text = head ? clean(head[1]) : '';
  if (!text) {
    const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
    text = titleTag ? clean(titleTag[1]) : '';
  }
  return text || name;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function listScreens(dir) {
  const p = sessionPaths(dir);
  let names = [];
  try {
    names = fs.readdirSync(p.screens).filter(isScreenName);
  } catch {}
  const rows = names.map((name) => {
    const full = path.join(p.screens, name);
    let mtime = 0;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {}
    return { name, title: screenTitle(full, name), mtime };
  });
  rows.sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name));
  return rows;
}

export function readEvents(dir, { all = false } = {}) {
  const p = sessionPaths(dir);
  let size = 0;
  try {
    size = fs.statSync(p.eventsFile).size;
  } catch {}
  let offset = 0;
  if (!all) {
    try {
      offset = parseInt(fs.readFileSync(p.cursorFile, 'utf8'), 10) || 0;
    } catch {}
    if (offset > size) offset = 0;
  }
  const events = [];
  if (size > offset) {
    const fd = fs.openSync(p.eventsFile, 'r');
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, size - offset, offset);
    fs.closeSync(fd);
    for (const line of buf.toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {}
    }
  }
  if (!all) {
    try {
      fs.writeFileSync(p.cursorFile, String(size));
    } catch {}
  }
  return events;
}

function countUnread(dir) {
  const p = sessionPaths(dir);
  let size = 0;
  try {
    size = fs.statSync(p.eventsFile).size;
  } catch {}
  let offset = 0;
  try {
    offset = parseInt(fs.readFileSync(p.cursorFile, 'utf8'), 10) || 0;
  } catch {}
  if (offset > size) offset = 0;
  const buf = Buffer.alloc(Math.max(0, size - offset));
  if (!buf.length) return 0;
  const fd = fs.openSync(p.eventsFile, 'r');
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  return buf.toString('utf8').split('\n').filter((l) => l.trim()).length;
}

export function publishScreen(dir, source, name) {
  const body = fs.readFileSync(source, 'utf8');
  const p = sessionPaths(dir);
  ensureDirs(dir);
  const fromTitle = screenTitle(source, '');
  const base = path.basename(source).replace(/\.html?$/i, '').replace(/^\d+-/, '');
  const slug = kebab(name) || kebab(fromTitle) || kebab(base) || 'screen';
  const filename = `${pad2(nextIndex(dir))}-${slug}.html`;
  const file = path.join(p.screens, filename);
  fs.writeFileSync(file, body);
  return { name: filename, file };
}

const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ],
  win32: [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'],
};

function onPath(name, env) {
  for (const d of (env.PATH || '').split(path.delimiter)) {
    if (!d) continue;
    const full = path.join(d, name);
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch {}
  }
  return null;
}

export function findChrome({ chrome, env = process.env, platform = process.platform } = {}) {
  const explicit = typeof chrome === 'string' ? chrome : env.CHROME_PATH;
  if (explicit) {
    if (fs.existsSync(explicit)) return explicit;
    throw new Error(`no browser at ${explicit}`);
  }
  for (const c of CHROME_CANDIDATES[platform] || CHROME_CANDIDATES.linux) {
    if (path.isAbsolute(c)) {
      if (fs.existsSync(c)) return c;
    } else {
      const hit = onPath(c, env);
      if (hit) return hit;
    }
  }
  throw new Error('no Chrome, Chromium, or Edge found. Pass --chrome PATH or set CHROME_PATH');
}

function wsConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      host: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
      },
    });
    req.on('error', reject);
    req.on('response', (res) => reject(new Error(`websocket upgrade failed with ${res.statusCode}`)));
    req.on('upgrade', (res, socket, head) => {
      const listeners = new Set();
      let buf = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
      let parts = [];
      function frame(opcode, payload) {
        const len = payload.length;
        let header;
        if (len < 126) header = Buffer.from([0x80 | opcode, 0x80 | len]);
        else if (len < 65536) {
          header = Buffer.alloc(4);
          header[0] = 0x80 | opcode;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(len, 2);
        } else {
          header = Buffer.alloc(10);
          header[0] = 0x80 | opcode;
          header[1] = 0x80 | 127;
          header.writeBigUInt64BE(BigInt(len), 2);
        }
        const mask = crypto.randomBytes(4);
        const masked = Buffer.alloc(len);
        for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
        socket.write(Buffer.concat([header, mask, masked]));
      }
      function drain() {
        for (;;) {
          if (buf.length < 2) return;
          const fin = (buf[0] & 0x80) !== 0;
          const opcode = buf[0] & 0x0f;
          let len = buf[1] & 0x7f;
          let off = 2;
          if (len === 126) {
            if (buf.length < 4) return;
            len = buf.readUInt16BE(2);
            off = 4;
          } else if (len === 127) {
            if (buf.length < 10) return;
            len = Number(buf.readBigUInt64BE(2));
            off = 10;
          }
          if (buf.length < off + len) return;
          const payload = buf.subarray(off, off + len);
          buf = buf.subarray(off + len);
          if (opcode === 9) frame(10, payload);
          else if (opcode === 8) socket.end();
          else if (opcode === 1 || opcode === 0) {
            parts.push(Buffer.from(payload));
            if (fin) {
              const text = Buffer.concat(parts).toString('utf8');
              parts = [];
              for (const fn of listeners) fn(text);
            }
          }
        }
      }
      socket.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        drain();
      });
      const closers = new Set();
      socket.on('error', () => {});
      socket.on('close', () => {
        for (const fn of closers) fn();
      });
      drain();
      resolve({
        send: (text) => frame(1, Buffer.from(text, 'utf8')),
        onMessage: (fn) => listeners.add(fn),
        onClose: (fn) => closers.add(fn),
        close: () => socket.destroy(),
      });
    });
    req.end();
  });
}

function cdpClient(ws) {
  let nextId = 1;
  const pending = new Map();
  const handlers = new Set();
  ws.onMessage((text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'browser protocol error'));
      else resolve(msg.result || {});
    } else if (msg.method) {
      for (const fn of handlers) fn(msg);
    }
  });
  ws.onClose(() => {
    for (const { reject } of pending.values()) reject(new Error('the browser closed the connection'));
    pending.clear();
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      ws.send(JSON.stringify(msg));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on: (fn) => handlers.add(fn),
  };
}

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    }),
  ]);
}

export async function takeShot({ url, out, width = 1440, height = 900, theme = 'light', wait = 1500, chrome }) {
  const bin = findChrome({ chrome });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-screen-shot-'));
  const child = spawn(bin, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let ws;
  try {
    const browserWs = await withTimeout(new Promise((resolve, reject) => {
      let errText = '';
      child.stderr.on('data', (d) => {
        errText += d.toString('utf8');
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(errText);
        if (m) resolve(m[1]);
      });
      child.on('error', reject);
      child.on('exit', (code) => reject(new Error(`the browser exited with code ${code}`)));
    }), 20000, 'browser start');
    ws = await wsConnect(browserWs);
    const cdp = cdpClient(ws);
    const errors = [];
    let loaded;
    const loadedPromise = new Promise((r) => {
      loaded = r;
    });
    cdp.on((msg) => {
      const prm = msg.params || {};
      if (msg.method === 'Page.loadEventFired') loaded();
      else if (msg.method === 'Runtime.exceptionThrown') {
        const d = prm.exceptionDetails || {};
        errors.push(((d.exception && d.exception.description) || d.text || 'exception').split('\n')[0].slice(0, 300));
      } else if (msg.method === 'Runtime.consoleAPICalled' && (prm.type === 'error' || prm.type === 'assert')) {
        errors.push((prm.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ').slice(0, 300));
      } else if (msg.method === 'Log.entryAdded' && prm.entry && prm.entry.level === 'error') {
        errors.push(String(prm.entry.text || '').slice(0, 300));
      }
    });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const s = (method, params) => cdp.send(method, params, sessionId);
    await s('Page.enable');
    await s('Runtime.enable');
    await s('Log.enable');
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await s('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('theme',${JSON.stringify(theme)})}catch(e){}` });
    const nav = await s('Page.navigate', { url });
    if (nav.errorText) throw new Error(`could not open the page: ${nav.errorText}`);
    await withTimeout(loadedPromise, 30000, 'page load');
    await new Promise((r) => setTimeout(r, wait));
    const shot = await withTimeout(s('Page.captureScreenshot', { format: 'png' }), 30000, 'screenshot');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    return { file: out, url, width, height, theme, errors: errors.map(redact) };
  } finally {
    if (ws) ws.close();
    try {
      child.kill('SIGKILL');
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

const RAW_BASE = 'https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/';
const LESSON_RE = /^phases\/\d{2}-[a-z0-9-]+\/\d{2}-[a-z0-9-]+$/;
const RUNNERS = {
  python: { ext: 'py', cmd: 'python3 main.py' },
  typescript: { ext: 'ts', cmd: 'npx tsx main.ts' },
  javascript: { ext: 'js', cmd: 'node main.js' },
  rust: { ext: 'rs', cmd: 'rustc --edition 2021 main.rs -o main && ./main' },
  julia: { ext: 'jl', cmd: 'julia main.jl' },
};

function mdPlain(text) {
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/\$([^$]+)\$/g, (m, tex) => texPlain(tex))
    .replace(/\s+/g, ' ')
    .trim();
}

const TEX_SYMBOLS = { le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', infty: '∞', in: '∈', to: '→', rightarrow: '→', leftarrow: '←', sum: 'Σ', prod: 'Π', partial: '∂', nabla: '∇', pm: '±', propto: '∝', ldots: '…', cdots: '⋯' };
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', pi: 'π', tau: 'τ', phi: 'φ', omega: 'ω' };
function texPlain(tex) {
  return tex
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|pi|tau|phi|omega)\b/g, (m, g) => GREEK[g])
    .replace(/\\([a-zA-Z]+)/g, (m, name) => (TEX_SYMBOLS[name] ? TEX_SYMBOLS[name] : m))
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\(left|right)/g, '')
    .replace(/\\(text|mathrm|mathbf|mathit|operatorname)\b/g, '')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '');
}

function mdSection(md, heading) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

function mdItems(text) {
  return text.split('\n').filter((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l)).map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
}

function mdRow(line) {
  const cells = [];
  let cell = '';
  let code = false;
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (ch === '`') {
      code = !code;
      cell += ch;
    } else if (ch === '|' && !code) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map(mdPlain);
}

export function parseLesson(md) {
  const title = (/^# (.+)$/m.exec(md) || [])[1] || '';
  const hook = (/^> (.+)$/m.exec(md) || [])[1] || '';
  const languages = ((/^\*\*Languages:\*\*\s*(.+)$/m.exec(md) || [])[1] || '').split(',').map((x) => mdPlain(x).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim()).filter(Boolean);
  const objectives = mdItems(mdSection(md, 'Learning Objectives')).map(mdPlain).filter(Boolean).slice(0, 6);
  const rows = mdSection(md, 'Key Terms').split('\n').filter((l) => l.trim().startsWith('|') && !/^\s*\|\s*:?-{2,}/.test(l)).map(mdRow);
  const width = rows.length ? rows[0].length : 0;
  const terms = rows.slice(1).filter((r) => r.length === width && width >= 2 && r[0] && r[width - 1]).map((r) => ({ term: r[0], means: r[width - 1] })).slice(0, 8);
  const exercise = mdPlain((mdItems(mdSection(md, 'Exercises'))[0] || '').replace(/^\*\*[^*]+\*\*\s*/, ''));
  const reading = mdItems(mdSection(md, 'Further Reading')).map((item) => {
    const link = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(item);
    const bare = /(https?:\/\/[^\s)]+)/.exec(item);
    return { text: mdPlain(link ? link[1] : item).slice(0, 160), url: link ? link[2] : bare ? bare[1] : '' };
  }).filter((r) => r.url).slice(0, 5);
  return { title: mdPlain(title), hook: mdPlain(hook), languages, objectives, terms, exercise, reading };
}

export function quizQuestions(quiz) {
  const list = Array.isArray(quiz) ? quiz : quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
  return list.filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2
    && q.options.every((o) => typeof o === 'string') && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length)
    .map((q) => {
      const plain = q.options.map(mdPlain);
      const options = new Set(plain).size === plain.length ? plain : q.options.map((o) => o.trim());
      return { id: typeof q.id === 'string' ? q.id : '', ask: '', q: mdPlain(q.question), options, correct: q.correct, explain: mdPlain(q.explanation || ''), stage: q.stage || '' };
    });
}

function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function termQuestions(terms, seed) {
  if (terms.length < 4) return [];
  const rand = seeded(seed);
  return terms.slice(0, 4).map((t) => {
    const others = shuffled(terms.filter((o) => o.term !== t.term).map((o) => o.term), rand).slice(0, 3);
    const options = shuffled([t.term, ...others], rand);
    const escaped = t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const masked = t.means.replace(new RegExp(`(^|[^\\w])${escaped}(?=$|[^\\w])`, 'gi'), '$1____');
    return { id: `${seed}#term:${t.term}`, ask: 'Which term matches this meaning?', q: masked, options, correct: options.indexOf(t.term), explain: `${t.term}: ${t.means}`, stage: 'terms' };
  });
}

function lessonOnDisk(repo, lesson) {
  return repo && fs.existsSync(path.join(repo, lesson, 'docs', 'en.md'));
}

function findLessonRepo(cwd, lesson) {
  let d = path.resolve(cwd);
  for (;;) {
    if (lessonOnDisk(d, lesson)) return d;
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}

async function readLessonFile(repo, lesson, rel) {
  if (repo) {
    const file = path.join(repo, lesson, rel);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  }
  const res = await fetch(RAW_BASE + lesson + '/' + rel);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`could not fetch ${lesson}/${rel}: ${res.status}`);
  return res.text();
}

export async function loadPractice(lesson, { repo } = {}) {
  const clean = String(lesson || '').replace(/\/+$/, '');
  if (!LESSON_RE.test(clean)) throw new Error('practice needs a lesson path such as phases/07-transformers-deep-dive/16-speculative-decoding');
  const md = await readLessonFile(repo, clean, 'docs/en.md');
  if (!md) throw new Error(`no lesson at ${clean}`);
  const info = parseLesson(md);
  let quiz = null;
  const raw = await readLessonFile(repo, clean, 'quiz.json');
  if (raw) {
    try {
      quiz = JSON.parse(raw);
    } catch {}
  }
  const fromQuiz = quizQuestions(quiz).map((q, i) => ({ ...q, id: q.id ? `${clean}#${q.id}` : `${clean}#q${i}` }));
  const questions = fromQuiz.length ? fromQuiz : termQuestions(info.terms, clean);
  const runner = RUNNERS[info.languages[0]];
  let run = '';
  if (runner) {
    const entry = `code/main.${runner.ext}`;
    const exists = repo ? fs.existsSync(path.join(repo, clean, entry)) : await fetch(RAW_BASE + clean + '/' + entry, { method: 'HEAD' }).then((r) => r.ok, () => false);
    if (exists) run = `cd "${repo ? path.join(repo, clean, 'code') : `${clean}/code`}" && ${runner.cmd}`;
  }
  const [phase, slug] = clean.split('/').slice(1);
  return {
    lesson: clean,
    phase: phase.slice(0, 2),
    number: slug.slice(0, 2),
    ...info,
    run,
    runFrom: repo ? 'clone' : 'github',
    questions,
    source: fromQuiz.length ? 'quiz' : questions.length ? 'terms' : 'none',
    web: `https://aiengineeringfromscratch.com/lesson?path=${clean}`,
    github: `https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/${clean}`,
  };
}

export function writePracticeScreen(dir, data, name) {
  const p = sessionPaths(dir);
  ensureDirs(dir);
  const slug = kebab(name) || `practice-${kebab(data.lesson.split('/').pop().replace(/^\d+-/, ''))}`.slice(0, 40);
  const filename = `${pad2(nextIndex(dir))}-${slug}.html`;
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const html = fs.readFileSync(path.join(TEMPLATES, 'practice.html'), 'utf8')
    .replace('__PRACTICE_TITLE__', () => escapeHtml(`Practice: ${data.title || data.lesson}`))
    .replace('__PRACTICE_DATA__', () => json);
  const file = path.join(p.screens, filename);
  fs.writeFileSync(file, html);
  return { name: filename, file };
}

function keyMatches(candidate, key) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(key).digest();
  return crypto.timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) tooLarge = true;
      if (!tooLarge) chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('too large'), { code: 413 }));
      else resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export function createServer(opts = {}) {
  const dir = path.resolve(opts.dir || path.join(process.cwd(), '.lesson-screen'));
  const host = opts.host || '127.0.0.1';
  const assets = opts.assets || 'live';
  const repo = opts.repo ? path.resolve(opts.repo) : undefined;
  const idleMs = opts.idleMs ?? 120 * 60 * 1000;
  const urlHostOpt = opts.urlHost;
  const key = crypto.randomBytes(24).toString('hex');
  const p = sessionPaths(dir);
  ensureDirs(dir);

  const sockets = new Set();
  const sseClients = new Set();
  let closed = false;
  let boundPort = 0;
  let signature = '';
  let cachedList = [];

  function rescan() {
    let rows;
    try {
      rows = fs.readdirSync(p.screens)
        .filter(isScreenName)
        .map((name) => {
          const full = path.join(p.screens, name);
          const st = fs.statSync(full);
          return { name, mtime: st.mtimeMs, size: st.size };
        })
        .sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name));
    } catch {
      rows = [];
    }
    const sig = rows.map((r) => `${r.name}:${r.mtime}:${r.size}`).join('|');
    if (sig === signature) return false;
    signature = sig;
    cachedList = rows.map((r) => ({
      name: r.name,
      title: screenTitle(path.join(p.screens, r.name), r.name),
      mtime: r.mtime,
    }));
    return true;
  }

  rescan();
  const scanTimer = setInterval(() => {
    if (closed) return;
    if (rescan()) {
      poke();
      const data = `event: screens\ndata: ${JSON.stringify({ screens: cachedList })}\n\n`;
      for (const res of sseClients) {
        try {
          res.write(data);
        } catch {}
      }
    }
  }, 400);
  scanTimer.unref();

  let idleTimer = null;
  function poke() {
    if (closed) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => finish('idle'), idleMs);
    idleTimer.unref();
  }
  poke();

  function finish(reason) {
    if (closed) return;
    try {
      fs.writeFileSync(p.stoppedFile, JSON.stringify({ reason, at: new Date().toISOString() }));
    } catch {}
    try {
      fs.rmSync(p.serverFile, { force: true });
    } catch {}
    close();
  }

  function close() {
    if (closed) return;
    closed = true;
    offSignal();
    clearInterval(scanTimer);
    if (idleTimer) clearTimeout(idleTimer);
    for (const res of sseClients) {
      try {
        res.end();
      } catch {}
    }
    sseClients.clear();
    for (const s of sockets) {
      try {
        s.destroy();
      } catch {}
    }
    server.close();
  }

  function send(res, status, body, headers = {}) {
    const out = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    };
    res.writeHead(status, out);
    res.end(body);
  }

  function sendJson(res, status, obj, headers = {}) {
    send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  }

  function authorized(req, u) {
    if (keyMatches(u.searchParams.get('key'), key)) return 'query';
    const cookie = req.headers.cookie || '';
    const m = new RegExp(`(?:^|;\\s*)lesson_screen_${boundPort}=([^;\\s]+)`).exec(cookie);
    if (m && keyMatches(decodeURIComponent(m[1]), key)) return 'cookie';
    if (keyMatches(req.headers['x-lesson-screen-key'], key)) return 'header';
    return null;
  }

  async function serveScreen(name, res, extra = {}) {
    const p2 = sessionPaths(dir);
    let screensReal;
    let real;
    try {
      screensReal = fs.realpathSync(p2.screens);
      real = fs.realpathSync(path.join(screensReal, name));
    } catch {
      return send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
    }
    if (!real.startsWith(screensReal + path.sep)) {
      return send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
    }
    let body;
    try {
      body = fs.readFileSync(real, 'utf8');
    } catch {
      return send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
    }
    const probe = body.trimStart().slice(0, 64).toLowerCase();
    let html;
    if (probe.startsWith('<!doctype') || probe.startsWith('<html')) {
      const marker = '<script src="/helper.js"></script>';
      const idx = body.toLowerCase().lastIndexOf('</body>');
      html = idx >= 0 ? body.slice(0, idx) + marker + body.slice(idx) : body + marker;
    } else {
      const frame = fs.readFileSync(path.join(TEMPLATES, 'frame.html'), 'utf8');
      const title = escapeHtml(screenTitle(real, name));
      html = frame.replace('{{TITLE}}', () => title).replace('{{CONTENT}}', () => body);
    }
    send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, ...extra });
  }

  function sameOrigin(req) {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return false;
    if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return false;
    return true;
  }

  async function handle(req, res) {
    const u = new URL(req.url, 'http://local');
    const pathname = u.pathname;

    if (req.method === 'GET' && pathname === '/favicon.ico') {
      return send(res, 204, null);
    }

    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true, name: 'lesson-screen' });
    }

    const via = authorized(req, u);
    if (!via) {
      return send(res, 403, 'Open the full URL that the start command printed.', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    const extra = {};
    if (via === 'query') {
      extra['Set-Cookie'] = `lesson_screen_${boundPort}=${key}; HttpOnly; SameSite=Strict; Path=/`;
    }

    poke();

    if (req.method === 'GET' && pathname === '/') {
      const html = fs.readFileSync(path.join(TEMPLATES, 'shell.html'), 'utf8');
      return send(res, 200, html, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': CSP,
        ...extra,
      });
    }

    if (req.method === 'GET' && pathname === '/screens') {
      rescan();
      return sendJson(res, 200, { screens: cachedList }, extra);
    }

    if (req.method === 'GET' && pathname === '/helper.js') {
      const js = fs.readFileSync(path.join(TEMPLATES, 'helper.js'), 'utf8');
      return send(res, 200, js, { 'Content-Type': 'text/javascript; charset=utf-8', ...extra });
    }

    if (req.method === 'GET' && pathname === '/live') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        ...extra,
      });
      res.write(`event: screens\ndata: ${JSON.stringify({ screens: cachedList })}\n\n`);
      sseClients.add(res);
      const ping = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {}
      }, 15000);
      ping.unref();
      req.on('close', () => {
        clearInterval(ping);
        sseClients.delete(res);
      });
      return;
    }

    if (req.method === 'POST' && !sameOrigin(req)) {
      return send(res, 403, 'forbidden', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
    }

    if (req.method === 'POST' && pathname === '/event') {
      const ct = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (ct !== 'application/json') {
        return send(res, 400, 'expected application/json', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      }
      let body;
      try {
        body = await readBody(req, 8192);
      } catch (e) {
        return send(res, e.code === 413 ? 413 : 400, e.code === 413 ? 'too large' : 'bad body', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      }
      let obj;
      try {
        obj = JSON.parse(body.toString('utf8'));
      } catch {
        return send(res, 400, 'bad json', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || typeof obj.type !== 'string' || !EVENT_TYPES.has(obj.type)) {
        return send(res, 400, 'bad event', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      }
      const evt = {};
      for (const k of EVENT_KEYS) {
        if (typeof obj[k] === 'string') evt[k] = obj[k].slice(0, 500);
      }
      if (typeof obj.step === 'number' && Number.isFinite(obj.step)) evt.step = obj.step;
      else if (typeof obj.step === 'string') evt.step = obj.step.slice(0, 500);
      evt.at = new Date().toISOString();
      fs.appendFileSync(p.eventsFile, JSON.stringify(evt) + '\n');
      return send(res, 204, null, extra);
    }

    if (req.method === 'POST' && pathname === '/shutdown') {
      send(res, 204, null, extra);
      setImmediate(() => finish('stop'));
      return;
    }

    if (req.method === 'GET') {
      const sm = /^\/s\/(.+)$/.exec(pathname);
      if (sm && SCREEN_NAME_RE.test(sm[1])) {
        return serveScreen(sm[1], res, extra);
      }
      const am = ASSET_RE.exec(pathname);
      if (am) {
        const file = `${am[1]}.js`;
        if (assets === 'live') {
          return send(res, 302, 'redirect', {
            'Content-Type': 'text/plain; charset=utf-8',
            Location: `${SITE_ORIGIN}/${file}`,
            ...extra,
          });
        }
        const local = repo ? path.join(repo, 'site', file) : null;
        if (local && fs.existsSync(local) && fs.statSync(local).isFile()) {
          return send(res, 200, fs.readFileSync(local), { 'Content-Type': 'text/javascript; charset=utf-8', ...extra });
        }
        const hint = file === 'figure-manifest.js'
          ? 'figure-manifest.js is generated by site/build.js. Run "node site/build.js" in the clone first.'
          : 'not found';
        return send(res, 404, hint, { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      }
    }

    send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      try {
        send(res, 500, 'server error', { 'Content-Type': 'text/plain; charset=utf-8' });
      } catch {}
    });
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });

  const onSignal = () => finish('signal');
  const offSignal = () => {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port || 0, host, () => {
      boundPort = server.address().port;
      const display = urlHostOpt || (host === '0.0.0.0' || host === '::' ? 'localhost' : urlHost(host));
      const origin = `http://${display}:${boundPort}`;
      resolve({
        url: `${origin}/?key=${key}`,
        port: boundPort,
        key,
        origin,
        close,
      });
    });
  });
}

function httpRequest(method, urlString, { headers = {}, body = null, timeout = 2000 } = {}) {
  return new Promise((resolve) => {
    let req;
    try {
      req = http.request(urlString, { method, headers, timeout }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
    } catch {
      return resolve(null);
    }
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function probeHost(host) {
  return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : urlHost(host || '127.0.0.1');
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function readServerInfo(dir) {
  const p = sessionPaths(dir);
  try {
    const info = JSON.parse(fs.readFileSync(p.serverFile, 'utf8'));
    if (info && typeof info === 'object') return info;
  } catch {}
  return null;
}

function writeServerInfo(dir, srv, { host, assets }) {
  const p = sessionPaths(dir);
  const info = {
    pid: process.pid,
    host,
    port: srv.port,
    url: srv.url,
    key: srv.key,
    dir,
    screens: p.screens,
    state: p.state,
    assets,
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(p.serverFile, JSON.stringify(info, null, 2), { mode: 0o600 });
  fs.writeFileSync(p.lastPortFile, String(srv.port));
  try {
    fs.rmSync(p.stoppedFile, { force: true });
  } catch {}
  return info;
}

async function healthOk(base) {
  const res = await httpRequest('GET', `${base}/health`, { timeout: 1200 });
  if (!res || res.status !== 200) return false;
  try {
    const j = JSON.parse(res.body.toString('utf8'));
    return j && j.ok === true && j.name === 'lesson-screen';
  } catch {
    return false;
  }
}

function portFree(port, host) {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, host, () => {
      s.close(() => resolve(true));
    });
  });
}

function isRepo(dir) {
  try {
    return fs.statSync(path.join(dir, 'site', 'lesson-figures.js')).isFile()
      && fs.statSync(path.join(dir, 'phases')).isDirectory();
  } catch {
    return false;
  }
}

function findRepo(cwd) {
  let d = path.resolve(cwd);
  for (;;) {
    if (isRepo(d)) return d;
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}

function resolveAssets(flags) {
  const assets = flags.assets || 'live';
  if (assets !== 'live' && assets !== 'local') {
    throw new Error('--assets must be live or local');
  }
  if (assets === 'local') {
    const repo = flags.repo ? path.resolve(flags.repo) : findRepo(process.cwd());
    if (!repo) {
      throw new Error('--assets local needs a clone of the repository; pass --repo PATH or run inside a clone');
    }
    if (!isRepo(repo)) {
      throw new Error(`--repo ${repo} is not a clone of the course repository`);
    }
    return { assets, repo };
  }
  return { assets, repo: undefined };
}

function openBrowser(url) {
  try {
    if (process.platform === 'darwin') {
      const c = spawn('open', [url], { detached: true, stdio: 'ignore' });
      c.on('error', () => {});
      c.unref();
    } else if (process.platform === 'win32') {
      const c = spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' });
      c.on('error', () => {});
      c.unref();
    } else {
      const c = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      c.on('error', () => {});
      c.unref();
    }
  } catch {}
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let command = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && ['port', 'host', 'url-host', 'assets', 'repo', 'idle-minutes', 'dir', 'name', 'width', 'height', 'theme', 'wait', 'out', 'chrome'].includes(name)) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else if (command === null) {
      command = a;
    } else {
      positional.push(a);
    }
  }
  return { command, flags, positional };
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function fail(obj) {
  process.stderr.write(redact(JSON.stringify(obj)) + '\n');
  process.exit(1);
}

function resolveDir(flags) {
  return path.resolve(typeof flags.dir === 'string' ? flags.dir : '.lesson-screen');
}

async function cmdServe(flags) {
  const dir = resolveDir(flags);
  ensureDirs(dir);
  const { assets, repo } = resolveAssets(flags);
  const host = flags.host || '127.0.0.1';
  const port = flags.port !== undefined && flags.port !== true ? parseInt(flags.port, 10) : 0;
  const idleMinutes = flags['idle-minutes'] !== undefined && flags['idle-minutes'] !== true ? parseFloat(flags['idle-minutes']) : 120;
  const srv = await createServer({
    dir,
    host,
    port: Number.isFinite(port) ? port : 0,
    urlHost: flags['url-host'] || undefined,
    assets,
    repo,
    idleMs: idleMinutes * 60000,
  });
  return { srv, info: writeServerInfo(dir, srv, { host, assets }) };
}

function startJson(info, dir) {
  const p = sessionPaths(dir);
  return {
    type: 'started',
    url: info.url,
    port: info.port,
    screens: p.screens,
    state: p.state,
    next: pad2(nextIndex(dir)),
    pid: info.pid,
    assets: info.assets,
  };
}

async function cmdStart(flags) {
  const dir = resolveDir(flags);
  ensureDirs(dir);
  const p = sessionPaths(dir);
  const existing = readServerInfo(dir);
  if (existing && pidAlive(existing.pid)) {
    const base = `http://${probeHost(existing.host)}:${existing.port}`;
    if (await healthOk(base)) {
      if (flags.open) openBrowser(existing.url);
      out({ ...startJson(existing, dir), type: 'running' });
      return;
    }
  }
  const { assets, repo } = resolveAssets(flags);
  const host = flags.host || '127.0.0.1';
  let port;
  if (flags.port !== undefined && flags.port !== true) {
    port = parseInt(flags.port, 10);
  } else {
    let last = 0;
    try {
      last = parseInt(fs.readFileSync(p.lastPortFile, 'utf8'), 10) || 0;
    } catch {}
    port = last && (await portFree(last, host)) ? last : 0;
  }
  if (!Number.isFinite(port)) port = 0;

  if (flags.foreground) {
    const { info } = await cmdServe({ ...flags, port: String(port), assets, repo: repo || flags.repo });
    out(startJson(info, dir));
    if (flags.open) openBrowser(info.url);
    return;
  }

  fs.rmSync(p.serverFile, { force: true });
  const outFd = fs.openSync(p.logFile, 'a');
  const args = [SCRIPT, 'serve', '--dir', dir, '--host', host, '--port', String(port),
    '--assets', assets, '--idle-minutes', String(flags['idle-minutes'] !== undefined && flags['idle-minutes'] !== true ? flags['idle-minutes'] : 120)];
  if (repo) args.push('--repo', repo);
  if (flags['url-host']) args.push('--url-host', flags['url-host']);
  const child = spawn(process.execPath, args, { detached: true, stdio: ['ignore', outFd, outFd] });
  child.on('error', () => {});
  child.unref();
  fs.closeSync(outFd);

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const info = readServerInfo(dir);
    if (info && info.pid === child.pid && pidAlive(info.pid)) {
      const base = `http://${probeHost(info.host)}:${info.port}`;
      if (await healthOk(base)) {
        out(startJson(info, dir));
        if (flags.open) openBrowser(info.url);
        return;
      }
    }
    await sleep(120);
  }
  let tail = '';
  try {
    tail = fs.readFileSync(p.logFile, 'utf8').trim().split('\n').slice(-3).join(' ');
  } catch {}
  fail({ type: 'error', error: `the lesson screen did not start${tail ? `: ${tail}` : ''}` });
}

async function cmdStop(flags) {
  const dir = resolveDir(flags);
  const p = sessionPaths(dir);
  const info = readServerInfo(dir);
  const running = !!(info && pidAlive(info.pid));
  if (running) {
    const base = `http://${probeHost(info.host)}:${info.port}`;
    const res = await httpRequest('POST', `${base}/shutdown`, { headers: { 'x-lesson-screen-key': info.key }, timeout: 1500 });
    if (res && res.status !== 204) fail({ type: 'error', error: `the server refused the stop request with ${res.status}. The session file can point at another server` });
    const deadline = Date.now() + 3000;
    let down = false;
    while (Date.now() < deadline) {
      if (!(await healthOk(base))) {
        down = true;
        break;
      }
      await sleep(150);
    }
    if (!down && res) {
      try {
        process.kill(info.pid, 'SIGTERM');
      } catch {}
      await sleep(300);
    }
  }
  if (info && !pidAlive(info.pid)) {
    fs.rmSync(p.serverFile, { force: true });
  }
  out({ type: 'stopped', running });
}

async function cmdStatus(flags) {
  const dir = resolveDir(flags);
  const info = readServerInfo(dir);
  let running = false;
  if (info && pidAlive(info.pid)) {
    running = await healthOk(`http://${probeHost(info.host)}:${info.port}`);
  }
  const list = listScreens(dir);
  out({
    type: 'status',
    running,
    url: running ? info.url : null,
    screens: list.map((s) => s.name),
    latest: list.length ? list[list.length - 1].name : null,
    next: pad2(nextIndex(dir)),
    unread: countUnread(dir),
  });
}

function cmdEvents(flags) {
  const dir = resolveDir(flags);
  out({ type: 'events', events: readEvents(dir, { all: !!flags.all }) });
}

function cmdPublish(flags, positional) {
  const source = positional[0];
  if (!source) fail({ type: 'error', error: 'publish needs a page file' });
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) fail({ type: 'error', error: `cannot read ${source}` });
  const dir = resolveDir(flags);
  const name = typeof flags.name === 'string' ? flags.name : undefined;
  const { name: screenName, file } = publishScreen(dir, path.resolve(source), name);
  out({ type: 'screen', name: screenName, file });
}

async function cmdShot(flags, positional) {
  const raw = positional[0];
  if (!raw) fail({ type: 'error', error: 'shot needs a screen name or a page file' });
  const qi = raw.indexOf('?');
  const target = qi >= 0 ? raw.slice(0, qi) : raw;
  const query = qi >= 0 ? raw.slice(qi + 1) : '';
  const dir = resolveDir(flags);
  const p = sessionPaths(dir);
  const theme = flags.theme === 'dark' ? 'dark' : 'light';
  const width = parseInt(flags.width, 10) || 1440;
  const height = parseInt(flags.height, 10) || 900;
  const wait = Number.isFinite(parseInt(flags.wait, 10)) ? parseInt(flags.wait, 10) : 1500;
  let file = path.resolve(target);
  if (!fs.existsSync(file)) file = path.join(p.screens, target);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail({ type: 'error', error: `no screen or file named ${target}` });
  const info = readServerInfo(dir);
  let running = false;
  if (info && pidAlive(info.pid)) running = await healthOk(`http://${probeHost(info.host)}:${info.port}`);
  const inScreens = fs.existsSync(p.screens) && path.dirname(fs.realpathSync(file)) === fs.realpathSync(p.screens);
  const full = /^\s*<(!doctype|html)/i.test(fs.readFileSync(file, 'utf8').slice(0, 200));
  let url;
  if (inScreens && running) {
    url = `http://${probeHost(info.host)}:${info.port}/s/${encodeURIComponent(path.basename(file))}?${query ? `${query}&` : ''}key=${info.key}`;
  } else if (full) {
    url = pathToFileURL(file).href + (query ? `?${query}` : '');
  } else {
    fail({ type: 'error', error: 'a fragment screen needs the server. Run start first' });
  }
  const base = path.basename(file).replace(/\.html?$/i, '') + (query ? '-' + query.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '');
  const outFile = typeof flags.out === 'string'
    ? path.resolve(flags.out)
    : path.join(dir, 'shots', `${base}-${theme}-${width}x${height}.png`);
  const result = await takeShot({ url, out: outFile, width, height, theme, wait, chrome: flags.chrome });
  out({ type: 'shot', ...result, url: result.url.replace(/key=[0-9a-f]+/, 'key=...') });
}

async function cmdPractice(flags, positional) {
  const lesson = String(positional[0] || '').replace(/\/+$/, '');
  if (!lesson) fail({ type: 'error', error: 'practice needs a lesson path' });
  const repo = typeof flags.repo === 'string' ? path.resolve(flags.repo) : findLessonRepo(process.cwd(), lesson);
  if (typeof flags.repo === 'string' && !lessonOnDisk(repo, lesson)) fail({ type: 'error', error: `no lesson at ${lesson} in ${repo}` });
  const data = await loadPractice(lesson, { repo: repo || undefined });
  const name = typeof flags.name === 'string' ? flags.name : undefined;
  const { name: screenName, file } = writePracticeScreen(resolveDir(flags), data, name);
  out({ type: 'screen', name: screenName, file, questions: data.questions.length, source: data.source, from: repo ? 'clone' : 'github' });
}

async function main(argv) {
  const { command, flags, positional } = parseArgs(argv);
  switch (command) {
    case 'start':
      return cmdStart(flags);
    case 'serve':
      return cmdServe(flags);
    case 'stop':
      return cmdStop(flags);
    case 'status':
      return cmdStatus(flags);
    case 'events':
      return cmdEvents(flags);
    case 'publish':
      return cmdPublish(flags, positional);
    case 'shot':
      return cmdShot(flags, positional);
    case 'practice':
      return cmdPractice(flags, positional);
    default:
      fail({ type: 'error', error: `unknown command "${command || ''}"` });
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(SCRIPT)) {
  main(process.argv.slice(2)).catch((e) => {
    fail({ type: 'error', error: e && e.message ? e.message : String(e) });
  });
}
