const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const { nodeFileTrace } = require('@vercel/nft');
const { globSync } = createRequire(require.resolve('@vercel/nft'))('glob');

const ROOT = path.join(__dirname, '..');
const config = require('../vercel.json');
const budgets = { certification: 5, lesson: 30, og: 10 };
const sourceOnly = [
  /^scripts\//,
  /^projects\/(?!.*\/docs\/en\.md$)/,
  /^manuals\/.*\/capture\//,
  /^site\/(?:build[^/]*|test[_-][^/]*)(?:\/|$)/,
  /(?:^|\/)(?:tests?|__tests__)(?:\/|[_.-])/,
];

async function invoke(handler, url, headers = {}) {
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); },
    end(body) { this.body = Buffer.isBuffer(body) ? body : Buffer.from(body || ''); },
  };
  await handler({ method: 'GET', url, headers }, response);
  return response;
}

function manifest(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'site', `${name}.json`), 'utf8'));
}

async function smoke(name, root) {
  const handler = require(path.join(root, 'api', `${name}.js`));
  if (name === 'certification') {
    const track = Object.values(manifest(root, 'certification-seo').tracks)[0];
    const response = await invoke(handler, `/certification?id=${encodeURIComponent(track.id)}`);
    assert.equal(response.statusCode, 200, response.body.toString());
    assert.match(response.body.toString(), /data-server-rendered="true"/);
    assert.match(response.body.toString(), /\/og\/track\/[^" ]+\.png\?v=[a-f0-9]+/);
  } else if (name === 'lesson') {
    const lessons = Object.values(manifest(root, 'lesson-seo').lessons);
    for (const kind of ['course', 'certification']) {
      const entry = lessons.find(lesson => lesson.context.kind === kind);
      assert.ok(entry, `missing ${kind} lesson`);
      const url = `/lesson?path=${encodeURIComponent(entry.path)}`;
      const response = await invoke(handler, url);
      assert.equal(response.statusCode, 200, response.body.toString());
      assert.match(response.body.toString(), /data-server-rendered="true"/);
      assert.match(response.body.toString(), /\/og\/lesson\/[^" ]+\.png\?v=[a-f0-9]+/);
      const markdown = await invoke(handler, url, { accept: 'text/markdown' });
      assert.equal(markdown.statusCode, 200);
      assert.match(markdown.headers['content-type'], /^text\/markdown/);
      assert.equal(markdown.body.toString(), fs.readFileSync(path.join(ROOT, entry.path, 'docs', 'en.md'), 'utf8'));
    }
  } else {
    const lesson = Object.keys(manifest(root, 'lesson-seo').lessons)[0];
    const track = Object.keys(manifest(root, 'certification-seo').tracks)[0];
    for (const card of ['page/home', 'page/inside-an-ai-agent', `lesson/${lesson}`, `track/${track}`]) {
      const redirect = await invoke(handler, `/og/${card}.png`);
      assert.equal(redirect.statusCode, 307, redirect.body.toString());
      const response = await invoke(handler, redirect.headers.location);
      assert.equal(response.statusCode, 200, response.body.toString());
      assert.equal(response.headers['content-type'], 'image/png');
      assert.equal(response.body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(response.body.readUInt32BE(16), 1200);
      assert.equal(response.body.readUInt32BE(20), 630);
    }
  }
}

for (const [name, megabytes] of Object.entries(budgets)) {
  test(`${name} deployment contains only runtime files and serves from its bundle`, async function (t) {
    const entry = `api/${name}.js`;
    const trace = await nodeFileTrace([entry], { base: ROOT, ignore: ['.git', '.git/**', '.vercel/**'] });
    const files = new Set([...trace.fileList, ...globSync(config.functions[entry].includeFiles, { cwd: ROOT, nodir: true })]);
    const unexpected = [...files].filter(file => sourceOnly.some(pattern => pattern.test(file)));
    assert.equal(unexpected.length, 0, `source files leaked into ${entry}: ${unexpected.slice(0, 10).join(', ')}`);
    const bytes = [...files].reduce((total, file) => total + fs.statSync(path.join(ROOT, file)).size, 0);
    assert.ok(bytes < megabytes * 1024 * 1024, `${entry} is ${(bytes / 1024 / 1024).toFixed(2)} MiB, budget ${megabytes} MiB`);
    t.diagnostic(`${files.size} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `aiefs-${name}-bundle-`));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const file of files) {
      const destination = path.join(root, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(ROOT, file), destination);
    }
    await smoke(name, root);
  });
}
