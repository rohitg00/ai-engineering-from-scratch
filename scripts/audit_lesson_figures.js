'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(REPO_ROOT, 'site');
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIN_TEXT_PX = 9;
const TEXT_PX_TOLERANCE = 0.5;
const FIGURE_TIMEOUT_MS = 20000;
const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 2400, column: 760 },
  { tag: 'phone', width: 375, height: 2400, column: 343 },
];
const MODES = [
  { tag: 'still', reduced: true, times: [null] },
  { tag: 'motion', reduced: false, times: [0.8, 3.2] },
];
const CONTENT_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function parseArgs(argv) {
  const options = { only: null, shots: null, json: null, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    if (!['--only', '--shots', '--json'].includes(arg)) throw new Error(`unknown argument: ${arg}`);
    const value = argv[++i];
    if (value === undefined || value === '' || value.startsWith('--')) throw new Error(`${arg} needs a value`);
    if (arg === '--only') {
      options.only = new Set(value.split(',').map(item => item.trim()).filter(Boolean));
      if (!options.only.size) throw new Error('--only needs at least one figure name');
    } else if (arg === '--shots') {
      options.shots = path.resolve(value);
    } else {
      options.json = path.resolve(value);
    }
  }
  return options;
}

function collectMarkdown(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdown(full, out);
    else if (entry.name === 'en.md') out.push(full);
  }
  return out;
}

function discoverFences(repoRoot = REPO_ROOT) {
  const fences = new Map();
  for (const root of ['phases', 'certifications']) {
    for (const file of collectMarkdown(path.join(repoRoot, root), [])) {
      const markdown = fs.readFileSync(file, 'utf8');
      for (const match of markdown.matchAll(/```figure\s*\r?\n([\s\S]*?)```/g)) {
        const fence = match[1].trim().replace(/\s+/g, ' ');
        if (!fence) continue;
        if (!fences.has(fence)) fences.set(fence, []);
        fences.get(fence).push(path.relative(repoRoot, file));
      }
    }
  }
  return fences;
}

function harnessHtml(siteDir, providers) {
  const lesson = fs.readFileSync(path.join(siteDir, 'lesson.html'), 'utf8');
  const styles = [...lesson.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  const sheets = [...lesson.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(match => match[0].replace(/href="(?!https?:)/, 'href="/')).join('\n');
  const scripts = ['lesson-figures.js', ...providers].map(file => `<script src="/${file}"></script>`).join('\n');
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">${sheets}<style>${styles}</style></head>`
    + `<body><article id="stage" class="lesson-article" style="margin:0 auto;padding:0 16px;box-sizing:content-box"></article>`
    + `${scripts}</body></html>`;
}

function serve(siteDir, html) {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(request.url.split('?')[0]);
    if (url === '/__figure-audit.html') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(html);
      return;
    }
    const file = path.join(siteDir, url);
    if (!file.startsWith(siteDir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function measureInPage(fence, times, textFloor, allowScroll) {
  const stage = document.getElementById('stage');
  if (window.AIFSFigureRuntime && window.AIFSFigureRuntime.disposeRoot) window.AIFSFigureRuntime.disposeRoot(stage);
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  const host = document.createElement('div');
  host.className = 'lesson-figure';
  host.setAttribute('data-figure', fence);
  stage.appendChild(host);
  window.mountLessonFigures(stage);
  const settle = ms => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, ms)));
  await settle(90);
  const findings = [];
  const seen = new Set();
  const add = (rule, detail) => {
    const key = `${rule}|${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ rule, detail });
  };
  if (!host.dataset.lfMounted) {
    add('figure-mount', 'figure did not mount');
    return findings;
  }
  const clip = text => (text.length > 44 ? `${text.slice(0, 43)}~` : text);
  const overhang = (rect, frame) => Math.max(frame.left - rect.left, rect.right - frame.right, frame.top - rect.top, rect.bottom - frame.bottom);
  const visibleOpacity = (node, stop) => {
    let opacity = 1;
    for (let current = node; current && current !== stop && current.nodeType === 1; current = current.parentNode) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      opacity *= parseFloat(style.opacity || '1');
    }
    const own = getComputedStyle(node);
    return opacity * parseFloat(own.fillOpacity || '1');
  };
  const scrollClip = node => {
    for (let current = node.parentElement; current && current !== stage; current = current.parentElement) {
      const overflow = getComputedStyle(current).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return current;
    }
    return null;
  };
  const still = times.length === 1 && times[0] === null;
  const sweep = () => {
    const pageScroll = document.documentElement.scrollWidth - window.innerWidth;
    if (pageScroll > 1) add('page-scroll', `page scrolls sideways by ${Math.round(pageScroll)}px`);
    const hostFrame = host.getBoundingClientRect();
    for (const node of host.querySelectorAll('*')) {
      if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      const style = getComputedStyle(node);
      if (style.overflowX !== 'visible' && style.overflowX !== 'clip') continue;
      if (scrollClip(node)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.right - hostFrame.right > 1.5) add('html-overflow', `<${node.tagName.toLowerCase()} class="${node.className}"> leaves the figure by ${Math.round(rect.right - hostFrame.right)}px`);
    }
    for (const svg of host.querySelectorAll('svg')) {
      const frame = svg.getBoundingClientRect();
      if (frame.width < 40 || frame.height < 20) continue;
      const scroller = scrollClip(svg);
      if (scroller && !allowScroll && scroller.scrollWidth - scroller.clientWidth > 1.5) add('figure-scroll', `drawing needs ${Math.round(scroller.scrollWidth - scroller.clientWidth)}px of sideways scroll at desktop width`);
      if (!scroller && frame.right - hostFrame.right > 1.5) add('svg-overflow', `svg leaves the figure by ${Math.round(frame.right - hostFrame.right)}px`);
      const items = [];
      for (const text of svg.querySelectorAll('text')) {
        const content = text.textContent.replace(/\s+/g, ' ').trim();
        if (!content) continue;
        if (visibleOpacity(text, svg.parentNode) < 0.25) continue;
        const rect = text.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        items.push({ content, rect, node: text });
        const matrix = text.getScreenCTM();
        const px = parseFloat(getComputedStyle(text).fontSize) * (matrix ? Math.hypot(matrix.a, matrix.b) : 1);
        if (px < textFloor) add('text-small', `"${clip(content)}" renders at ${px.toFixed(1)}px`);
        const over = overhang(rect, frame);
        if (over > 1.5) add('text-clip', `"${clip(content)}" leaves the drawing by ${Math.round(over)}px`);
      }
      for (const item of items) {
        const { node, rect, content } = item;
        if (rect.bottom > window.innerHeight || rect.right > window.innerWidth || rect.left < 0 || rect.top < 0) continue;
        const haloed = getComputedStyle(node).stroke !== 'none';
        const probes = [];
        const midY = rect.top + rect.height * 0.55;
        for (let x = rect.left + 2; x <= rect.right - 2; x += 1.5) probes.push([x, midY]);
        for (const fraction of [0.2, 0.5, 0.8]) {
          const x = rect.left + rect.width * fraction;
          for (let y = rect.top + rect.height * 0.3; y <= rect.bottom - rect.height * 0.2; y += 1.5) probes.push([x, y]);
        }
        let covered = null;
        let crossed = null;
        let backing = null;
        for (const [x, y] of probes) {
          const stack = document.elementsFromPoint(x, y).filter(element => element.ownerSVGElement === svg);
          const own = stack.findIndex(element => element === node || node.contains(element));
          const above = own < 0 ? [] : stack.slice(0, own);
          const below = own < 0 ? stack : stack.slice(own + 1);
          for (const element of above) {
            if (element.tagName === 'text' || element.tagName === 'tspan' || element.closest('text')) continue;
            if (visibleOpacity(element, svg.parentNode) < 0.5) continue;
            covered = covered || element;
          }
          for (const element of below) {
            if (element.closest('text')) continue;
            const style = getComputedStyle(element);
            const filled = style.fill !== 'none';
            if (filled) {
              if (!backing && (element.tagName === 'rect')) backing = element;
              if (parseFloat(style.fillOpacity || '1') >= 0.9 && parseFloat(style.opacity || '1') >= 0.9) break;
              continue;
            }
            if (haloed || style.stroke === 'none') continue;
            if (parseFloat(style.strokeOpacity || '1') * visibleOpacity(element, svg.parentNode) / Math.max(parseFloat(style.fillOpacity || '1'), 0.01) < 0.5) continue;
            crossed = crossed || element;
          }
        }
        if (!still) { covered = null; crossed = null; }
        if (covered) add('text-covered', `"${clip(content)}" is under a <${covered.tagName}>`);
        else if (crossed) add('text-crossed', `a <${crossed.tagName}> stroke runs through "${clip(content)}"`);
        if (backing) {
          const box = backing.getBoundingClientRect();
          const spill = Math.max(box.left - rect.left, rect.right - box.right);
          if (spill > 1.5 && box.height < rect.height * 5) add('text-spill', `"${clip(content)}" is ${Math.round(spill)}px wider than its box`);
        }
      }
      if (still) {
        const boxes = [];
        for (const box of svg.querySelectorAll('rect')) {
          if (box.closest('defs,marker,pattern,clipPath,mask,symbol')) continue;
          const style = getComputedStyle(box);
          if (style.stroke === 'none' || visibleOpacity(box, svg.parentNode) < 0.5) continue;
          const rect = box.getBoundingClientRect();
          if (rect.width >= 24 && rect.height >= 14) boxes.push(rect);
        }
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (width < 4 || height < 4) continue;
            const nested = (a.left <= b.left + 1 && a.right >= b.right - 1 && a.top <= b.top + 1 && a.bottom >= b.bottom - 1)
              || (b.left <= a.left + 1 && b.right >= a.right - 1 && b.top <= a.top + 1 && b.bottom >= a.bottom - 1);
            if (!nested) add('box-overlap', `two outlined boxes overlap by ${Math.round(width)} x ${Math.round(height)}px`);
          }
        }
      }
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const a = items[i].rect;
          const b = items[j].rect;
          const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (width > 2 && height > 0.35 * Math.min(a.height, b.height)) add('text-overlap', `"${clip(items[i].content)}" overlaps "${clip(items[j].content)}"`);
        }
      }
      for (const shape of svg.querySelectorAll('rect,circle,ellipse,polygon,path')) {
        if (shape.tagName === 'path' && !/z\s*$/i.test(shape.getAttribute('d') || '')) continue;
        if (shape.closest('defs,marker,pattern,clipPath,mask,symbol')) continue;
        if (visibleOpacity(shape, svg.parentNode) < 0.25) continue;
        const rect = shape.getBoundingClientRect();
        if (rect.width < 1 && rect.height < 1) continue;
        const over = overhang(rect, frame);
        const size =Math.max(rect.width, rect.height);
        if (over > 6 && over > 0.2 * size) add('shape-clip', `<${shape.tagName}> leaves the drawing by ${Math.round(over)}px`);
      }
    }
  };
  const seekTo = async index => {
    const time = times[index];
    if (time === null) return;
    const runtime = host._aifsFigureRuntime;
    for (const controller of (runtime && runtime.controllers) || []) {
      if (typeof controller.seek === 'function') controller.seek((index + 1) / (times.length + 1));
    }
    for (const svg of host.querySelectorAll('svg')) {
      if (typeof svg.pauseAnimations !== 'function') continue;
      svg.pauseAnimations();
      svg.setCurrentTime(time);
    }
    await settle(20);
  };
  let firstFailure = -1;
  for (let index = 0; index < times.length; index += 1) {
    await seekTo(index);
    const before = findings.length;
    sweep();
    if (firstFailure < 0 && findings.length > before) firstFailure = index;
  }
  if (firstFailure >= 0 && firstFailure !== times.length - 1) await seekTo(firstFailure);
  return findings;
}

async function audit(options = {}) {
  const build = require(path.join(SITE_DIR, 'build.js'));
  const puppeteer = require('puppeteer-core');
  const chrome = process.env.CHROME_PATH || DEFAULT_CHROME;
  const providers = build.discoverFigureProviderOrder(SITE_DIR);
  const manifest = build.buildFigureProviderManifest(REPO_ROOT, SITE_DIR, providers);
  const fences = discoverFences();
  const server = await serve(SITE_DIR, harnessHtml(SITE_DIR, providers));
  const base = `http://127.0.0.1:${server.address().port}`;
  const rows = [];
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'], timeout: 60000 });
    for (const viewport of VIEWPORTS) {
      for (const mode of MODES) {
        const pageErrors = [];
        const open = async () => {
          const fresh = await browser.newPage();
          fresh.on('pageerror', error => pageErrors.push(error.message));
          await fresh.setViewport({ width: viewport.width, height: viewport.height });
          await fresh.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: mode.reduced ? 'reduce' : 'no-preference' }]);
          await fresh.goto(`${base}/__figure-audit.html`, { waitUntil: 'load' });
          await fresh.evaluate(column => {
            document.getElementById('stage').style.width = `${column}px`;
            return Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 4000))]);
          }, viewport.column);
          return fresh;
        };
        let page = await open();
        let targets = [...fences.keys()];
        if (options.all) {
          const registered = await page.evaluate(() => Object.keys(window.LESSON_FIGURES));
          const fenced = new Set(targets.map(fence => fence.split(' ')[0]));
          targets = targets.concat(registered.filter(name => !fenced.has(name)));
        }
        if (options.only) {
          targets = targets.filter(fence => options.only.has(fence.split(' ')[0]));
          const found = new Set(targets.map(fence => fence.split(' ')[0]));
          const unknown = [...options.only].filter(name => !found.has(name));
          if (unknown.length) throw new Error(`--only names no figure: ${unknown.join(', ')}`);
        }
        for (const fence of targets.sort()) {
          const where = `${viewport.tag}/${mode.tag}`;
          const name = fence.split(' ')[0];
          const provider = (manifest.providersByFigure[name] || ['lesson-figures.js']).slice(-1)[0];
          const before = pageErrors.length;
          let findings;
          let timer;
          try {
            findings = await Promise.race([
              page.evaluate(measureInPage, fence, mode.times, MIN_TEXT_PX - TEXT_PX_TOLERANCE, viewport.tag === 'phone'),
              new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('figure did not settle within 20 seconds')), FIGURE_TIMEOUT_MS); }),
            ]);
          } catch (error) {
            findings = [{ rule: 'figure-mount', detail: String(error.message || error).split('\n')[0] }];
            await page.close({ runBeforeUnload: false }).catch(() => {});
            page = await open();
          } finally {
            clearTimeout(timer);
          }
          for (const message of pageErrors.slice(before)) findings.push({ rule: 'page-error', detail: message });
          for (const finding of findings) rows.push({ fence, provider, where, ...finding });
          if (options.shots && findings.length) {
            fs.mkdirSync(options.shots, { recursive: true });
            const host = await page.$('#stage .lesson-figure');
            if (host) await host.screenshot({ path: path.join(options.shots, `${fence.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${viewport.tag}-${mode.tag}.png`) });
          }
        }
        await page.close().catch(() => {});
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  return { rows, figures: fences.size };
}

function report(result) {
  const grouped = new Map();
  for (const row of result.rows) {
    const key = `${row.provider}  ${row.fence}`;
    if (!grouped.has(key)) grouped.set(key, new Map());
    const detail = `${row.rule}: ${row.detail}`;
    if (!grouped.get(key).has(detail)) grouped.get(key).set(detail, new Set());
    grouped.get(key).get(detail).add(row.where);
  }
  for (const key of [...grouped.keys()].sort()) {
    console.log(key);
    for (const [detail, where] of grouped.get(key)) console.log(`  ${detail}  [${[...where].join(', ')}]`);
  }
  const rules = {};
  for (const row of result.rows) {
    if (!rules[row.rule]) rules[row.rule] = new Set();
    rules[row.rule].add(row.fence);
  }
  for (const rule of Object.keys(rules).sort()) console.log(`${rule}: ${rules[rule].size} figures`);
  console.log(`FIGURES ${result.figures}`);
  console.log(`TOTAL ${grouped.size}`);
  return grouped.size;
}

if (require.main === module) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('usage: CHROME_PATH=<chrome> node scripts/audit_lesson_figures.js [--only a,b] [--all] [--shots dir] [--json file]');
    process.exit(2);
  }
  audit(options).then(result => {
    if (options.json) fs.writeFileSync(options.json, JSON.stringify(result.rows, null, 2));
    process.exitCode = report(result) ? 1 : 0;
  }, error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { MIN_TEXT_PX, audit, discoverFences, measureInPage, parseArgs, report };
