#!/usr/bin/env node
/**
 * End-to-end smoke test over the Chrome DevTools Protocol.
 *
 * Walks a full lesson (pre-test, reading, code, practice, quiz, recall, done),
 * then checks the review queue and the library. Captures one screenshot per
 * step in .smoke/ and fails on any page exception.
 *
 *   node scripts/smoke.mjs
 *   EDGE_PATH="C:/path/to/msedge.exe" node scripts/smoke.mjs
 *
 * Requires a Chromium-based browser. No npm packages.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.smoke');
const PORT = Number(process.env.CDP_PORT || 9333);
const BASE = process.env.BASE_URL || 'http://localhost:5173';

const CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

const browserPath = CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!browserPath) {
  console.error('smoke: no Chromium browser found. Set EDGE_PATH.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-smoke-'));

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
    '--window-size=1400,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function endpoint(pathname, options) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}${pathname}`, options);
      if (response.ok) return response.json();
    } catch {
      /* browser still starting */
    }
    await sleep(150);
  }
  throw new Error(`CDP endpoint ${pathname} did not answer`);
}

async function main() {
  const target = await endpoint(`/json/new?${encodeURIComponent(BASE + '/#/')}`, { method: 'PUT' });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (message) => {
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed');
    }
    return result.result.value;
  };

  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  };

  await send('Page.enable');
  await send('Runtime.enable');

  const click = (selector) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  const exists = (selector) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() ?? null`);

  const navigate = async (hash) => {
    await evaluate(`location.hash = ${JSON.stringify(hash)}`);
    await sleep(700);
  };

  const seen = new Set();
  const report = [];

  async function waitForLesson() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await exists('.lesson-body')) return;
      await sleep(150);
    }
    throw new Error('lesson did not render');
  }

  await navigate('#/lesson/14-agent-engineering/01-the-agent-loop');
  await waitForLesson();

  for (let step = 0; step < 40; step += 1) {
    if (await exists('.done-mark')) {
      report.push('done');
      break;
    }

    const label = (await text('.step-label .chip')) ?? 'unknown';
    if (!seen.has(label)) {
      seen.add(label);
      await shot(`${String(seen.size).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    }
    report.push(label);

    if (label === 'Before you read' || label === 'Check yourself') {
      for (let question = 0; question < 8; question += 1) {
        if (await exists('.quiz .option:not(:disabled)')) {
          await evaluate(`document.querySelector('.quiz .option').click()`);
          await sleep(120);
        }
        if (await exists('.quiz-foot .btn--sm')) {
          await evaluate(`document.querySelector('.quiz-foot .btn--sm').click()`);
          await sleep(150);
          if (await exists('.quiz-q') && (await text('.quiz-q'))?.includes('Round complete')) break;
          if ((await text('.quiz-q'))?.includes('on the first try')) break;
        } else {
          break;
        }
      }
      await shot(`${String(seen.size).padStart(2, '0')}-quiz-result`);
      await click('.lesson-foot .btn--primary');
      await sleep(450);
      continue;
    }

    if (label === 'Practice') {
      await evaluate(`document.querySelector('.task')?.click()`);
      await evaluate(`(() => { const n = document.querySelector('.note'); if (!n) return; n.value = 'Smoke test note: tracked one tool call.'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await sleep(150);
      await shot(`${String(seen.size).padStart(2, '0')}-practice-ticked`);
      await click('.lesson-foot .btn--primary');
      await sleep(450);
      continue;
    }

    if (label === 'Recall') {
      await evaluate(`(() => { const n = document.querySelector('.note'); n.value = 'An agent is a loop: think, call a tool, feed the observation back, repeat until a stop condition fires.'; })()`);
      const compare = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Compare')); if (!b) return false; b.click(); return true; })()`);
      note(compare, 'compare button');
      await sleep(200);
      await shot(`${String(seen.size).padStart(2, '0')}-recall-compared`);
      const rate = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('teach this')); if (!b) return false; b.click(); return true; })()`);
      note(rate, 'self rating button');
      await sleep(450);
      continue;
    }

    if (label === 'Build it') {
      const reveal = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Reveal')); if (!b) return false; b.click(); return true; })()`);
      if (reveal) await shot(`${String(seen.size).padStart(2, '0')}-build-revealed`);
      await click('.lesson-foot .btn--primary');
      await sleep(400);
      continue;
    }

    const advanced = await click('.lesson-foot .btn--primary');
    if (!advanced) {
      report.push('stuck');
      break;
    }
    await sleep(400);
  }

  await shot('99-done');

  const state = await evaluate(`JSON.parse(localStorage.getItem('workbench.v1') || '{}')`);
  const done = Object.values(state.lessons ?? {}).filter((lesson) => lesson.done).length;

  await navigate('#/review');
  await sleep(500);
  await shot('50-review');
  const reviewTitle = await text('h1');

  await navigate('#/library');
  await sleep(400);
  const searchOk = await evaluate(`(() => { const i = document.querySelector('.searchbar input'); if (!i) return false; i.value = 'attention'; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await sleep(500);
  const results = await text('.section-head h2');
  await shot('51-search-attention');

  await navigate('#/progress');
  await sleep(400);
  await shot('52-progress');

  await navigate('#/roadmap');
  await sleep(400);
  const roadmapHead = await text('h1');
  const roadmapRows = await evaluate("document.querySelectorAll('.lesson-row').length");
  await shot('53-roadmap');

  const failures = [];
  if (done !== 1) failures.push(`expected 1 completed lesson, got ${done}`);
  if (!searchOk) failures.push('search input missing');
  if (!results || !/\d+ match/.test(results)) failures.push(`search returned "${results}"`);
  if (!reviewTitle) failures.push('review page did not render');
  if (roadmapHead !== 'Roadmap') failures.push(`roadmap page rendered "${roadmapHead}"`);
  if (!(roadmapRows > 0)) failures.push(`roadmap rendered ${roadmapRows} lesson rows`);
  if (!report.includes('done')) failures.push('lesson loop did not reach the done step');
  if (errors.length) failures.push(...errors.map((error) => `page error: ${error}`));

  console.log(`steps: ${report.join(' → ')}`);
  console.log(`screenshots: ${path.relative(process.cwd(), OUT)}`);
  if (failures.length) {
    console.error('smoke: failed');
    for (const failure of failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('smoke: ok');
  }

  ws.close();
}

function note(value, name) {
  if (!value) throw new Error(`could not click ${name}`);
}

main()
  .catch((error) => {
    console.error(`smoke: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sleep(200);
    browser.kill();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* windows file locks */
    }
  });
