#!/usr/bin/env node
/**
 * Visual QA screenshots over the Chrome DevTools Protocol.
 *
 * Usage:
 *   node scripts/shots.mjs                       desktop, light
 *   node scripts/shots.mjs --theme dark          desktop, dark
 *   node scripts/shots.mjs --size 420x900        phone width
 *   node scripts/shots.mjs --route '#/library'   one route
 *
 * Writes PNGs to .shots/. Requires a running server and a Chromium browser.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const PORT = Number(process.env.CDP_PORT || 9444);

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const ROUTES = flag('route')
  ? [flag('route')]
  : ['#/', '#/library', '#/roadmap', '#/phase/01-math-foundations', '#/lesson/07-transformers-deep-dive/02-self-attention-from-scratch', '#/review', '#/progress'];

const [width, height] = (flag('size', '1400x1000') || '1400x1000').split('x').map(Number);
const theme = flag('theme', 'light');

const CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

const browserPath = CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!browserPath) {
  console.error('shots: no Chromium browser found. Set EDGE_PATH.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-shots-'));

const browser = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function target() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + '/')}`, {
        method: 'PUT',
      });
      if (response.ok) return response.json();
    } catch {
      /* starting */
    }
    await sleep(150);
  }
  throw new Error('CDP did not answer');
}

const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let nextId = 0;
const pending = new Map();
const errors = [];

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description ?? 'exception');
  }
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 600,
});

await sleep(900);
await evaluate(`localStorage.setItem('workbench.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('workbench.v1') || '{}'), v: 1, theme: ${JSON.stringify(theme)} }))`);

for (const route of ROUTES) {
  await send('Page.navigate', { url: `${BASE}/${route}` });
  await sleep(1500);
  const name = `${theme}-${width}x${height}-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'today'}`;
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`shot: ${name}.png`);
}

if (errors.length) for (const error of errors) console.error(`page error: ${error}`);
ws.close();
browser.kill();
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch {
  /* windows locks */
}
process.exit(errors.length ? 1 : 0);
