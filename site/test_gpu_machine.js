const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'scripts', 'gpu-machine');
const page = path.join(__dirname, 'inside-an-llm-serving-gpu.html');
const load = () => import(path.join(dir, 'model.mjs'));
const types = (run) => run.events.map((event) => event.type).join(' ');

test('the default L4 run serves one request with the measured BF16 numbers', async () => {
  const M = await load();
  const run = M.simulate();
  assert.equal(types(run), 'arrive tokenize admit send prefill first decode decode decode decode-rest detok exit');
  assert.equal(run.pool, 24094);
  assert.deepEqual(run.run, { set: 'l4', key: 'load.default' });
  assert.equal(run.outcome.status, 'served');
  assert.deepEqual({ fits: run.admission.fits, running: run.admission.running, queued: run.admission.queued }, { fits: 37, running: 8, queued: 0 });
  assert.equal(run.serve.tokS, 112.62);
  assert.equal(run.serve.stepMs, 66.01);
  assert.equal(run.decode.weightsGB, 16.41);
  assert.equal(run.decode.share, 0.86);
  assert.match(M.selfCheck(), /^self-check ok: .*24,094 tokens.*summary\/l4\.json load\.default$/);
});

test('one user on the L4: the weight read is most of the step', async () => {
  const M = await load();
  const run = M.simulate({ users: 1 });
  assert.equal(run.decode.floorMs, 55);
  assert.equal(run.point.tpot, 60.16);
  assert.equal(run.decode.share, 0.91);
  assert.deepEqual(run.launch, { on: 60.16, off: 60.63, delta: 0.47 });
});

test('BF16 at 64 users fills the pool and FP8 does not', async () => {
  const M = await load();
  const bf16 = M.simulate({ users: 64 });
  assert.equal(types(bf16).split(' ')[2], 'queue');
  assert.deepEqual([bf16.admission.running, bf16.admission.queued], [37, 27]);
  assert.equal(bf16.point.tokS, 250.85);
  assert.equal(bf16.point.ttft, 18348.57);
  assert.equal(bf16.outcome.status, 'queued');
  const fp8 = M.simulate({ users: 64, dtype: 'fp8' });
  assert.equal(fp8.pool, 142369);
  assert.equal(fp8.admission.queued, 0);
  assert.equal(fp8.point.tokS, 735.91);
  assert.equal(fp8.memory.weightsGiB, 8.81);
  assert.ok(fp8.memory.kvCells > bf16.memory.kvCells && fp8.memory.weightCells < bf16.memory.weightCells);
});

test('at a memory fraction of 0.74 the BF16 prefixes stop fitting and FP8 keeps them', async () => {
  const M = await load();
  const bf16 = M.simulate({ workload: 'shared', shared: 2048, frac: '0.74' });
  assert.equal(bf16.pool, 6559);
  assert.equal(bf16.admission.prefixFits, false);
  assert.equal(bf16.outcome.status, 'recomputed');
  assert.equal(bf16.point.ttft, 12576.16);
  const fp8 = M.simulate({ workload: 'shared', shared: 2048, frac: '0.74', dtype: 'fp8' });
  assert.equal(fp8.pool, 107299);
  assert.equal(fp8.admission.matched, 2048);
  assert.ok(types(fp8).includes('reuse'));
  assert.equal(fp8.point.tokS, 155.07);
  const near = M.simulate({ workload: 'shared', shared: 1024, frac: '0.74' });
  assert.equal(near.admission.prefixFits, true);
});

test('the radix cache off and a hot card both match their measured runs', async () => {
  const M = await load();
  const off = M.simulate({ workload: 'shared', shared: 4096, radix: false });
  assert.equal(off.point.ttft, 14706.12);
  assert.equal(off.totals.chunks, 2);
  const on = M.simulate({ workload: 'shared', shared: 4096 });
  assert.equal(on.point.ttft, 478.78);
  const hot = M.simulate({ clock: 'hot', users: 1 });
  assert.deepEqual(hot.run, { set: 'l4-hot', key: 'load.default' });
  assert.equal(hot.point.tpot, 103.38);
  assert.equal(hot.outcome.status, 'throttled');
});

test('the GB10 uses its own pools and does not claim a per-step read past one user', async () => {
  const M = await load();
  const one = M.simulate({ gpu: 'gb10', users: 1 });
  assert.equal(one.pool, 234600);
  assert.equal(one.point.tpot, 32.52);
  assert.equal(one.decode.readGB, 6.06);
  assert.match(one.decode.basis, /^estimate/);
  assert.equal(types(one).split(' ')[3], 'send');
  const many = M.simulate({ gpu: 'gb10', users: 64 });
  assert.equal(many.decode.readGB, null);
  assert.equal(many.decode.share, null);
  assert.equal(M.simulate({ gpu: 'gb10', dtype: 'fp8', frac: '0.82', users: 64 }).pool, 1378545);
  assert.equal(M.simulate({ gpu: 'gb10', dtype: 'fp8', users: 1 }).point.tpot, 18.41);
});

test('every configuration ends with an exit and reads its numbers from one serve record', async () => {
  const M = await load();
  const configs = M.allConfigs();
  assert.equal(configs.length, 576);
  for (const config of configs) {
    const run = M.simulate(config);
    assert.equal(run.events.at(-1).type, 'exit');
    assert.ok(run.events.every((event, index) => event.index === index && event.trace.length > 0 && M.stepOf(event.type) >= 0));
    assert.ok(run.events.every((event) => event.poolUsed <= run.pool));
    assert.equal(run.serve.tokS, run.point ? run.point.tokS : null);
    assert.equal(run.serve.kvPagesTotal, run.pool);
    assert.equal(run.memory.weightCells + run.memory.kvCells + run.memory.restCells, run.memory.cells);
    assert.deepEqual(M.simulate(config), run);
  }
});

test('the share URL round-trips every setting', async () => {
  const M = await load();
  assert.equal(M.encode(M.DEFAULTS), '');
  for (const config of M.allConfigs().filter((_, i) => i % 7 === 0)) assert.deepEqual(M.decode('?' + M.encode(config)), config);
  assert.deepEqual(M.decode('?gpu=x&dtype=y&frac=9&users=3&shared=7'), M.DEFAULTS);
});

test('the data module is the output of the extraction from the summaries and logs', () => {
  const out = execFileSync(process.execPath, [path.join(dir, 'extract.mjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /matches/);
});

test('the hardware specs carry their published values and a source each', async () => {
  const { SPECS, SOURCES } = await import(path.join(dir, 'hardware.mjs'));
  assert.equal(SPECS.l4.sms.value, 58);
  assert.equal(SPECS.l4.bandwidthGBs.value, 300);
  assert.equal(SPECS.l4.l2MB.value, 48);
  assert.equal(SPECS.l4.busBits.value, 192);
  assert.equal(SPECS.gb10.bandwidthGBs.value, 273);
  assert.equal(SPECS.gb10.l2MB.value, 24);
  assert.equal(SPECS.gb10.cudaCores.value, 6144);
  assert.equal(SPECS.gb10.smCount.value, null);
  for (const gpu of ['l4', 'gb10']) for (const entry of Object.values(SPECS[gpu])) if (typeof entry === 'object') assert.ok(SOURCES[entry.source].startsWith('https://'), entry.source);
});

test('the published page is the output of the build script', () => {
  const before = fs.readFileSync(page, 'utf8');
  execFileSync(process.execPath, [path.join(dir, 'build.mjs')], { stdio: 'pipe' });
  assert.equal(fs.readFileSync(page, 'utf8'), before);
});

test('the page carries every control, readout, step and social tag', () => {
  const html = fs.readFileSync(page, 'utf8');
  for (const hook of ['data-gm-run', 'data-gm-step', 'data-gm-break', 'data-gm-repair', 'data-gm-explode', 'data-gm-reset', 'id="gm-gpu"', 'id="gm-dtype"', 'id="gm-frac"', 'id="gm-graphs"', 'id="gm-users"', 'id="gm-radix"', 'id="gm-clock"', 'data-gm-mode="manual"', 'data-gm-restart', 'data-gm-stepbtn="6"', 'data-gm-hint', 'data-gm-badge', 'data-cut', 'data-sound', 'data-gauge-needle', 'aria-live="polite"', 'id="gm-wobble"', 'id="gm-labels"', 'data-pills', 'The big idea', 'window.seek', 'get("labels") === "0"']) assert.ok(html.includes(hook), hook);
  assert.match(html, /This is a simulation\./);
  assert.equal((html.match(/ data-gm-share>/g) || []).length, 1);
  assert.equal((html.match(/ data-gm-copy>/g) || []).length, 1);
  assert.match(html, /<meta property="og:image" content="https:\/\/aiengineeringfromscratch\.com\/og\/page\/inside-an-llm-serving-gpu\.png">/);
  for (const name of ['og', 'poster', 'machine', 'machine-dark']) assert.ok(fs.existsSync(path.join(__dirname, 'anatomy', `inside-an-llm-serving-gpu-${name}.png`)), name);
  assert.match(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), /href="inside-an-llm-serving-gpu\.html"/);
  assert.equal((html.match(/<a [^>]*href="https?:\/\/(?!github\.com\/rohitg00|fonts\.)/g) || []).length, 0);
});

test('the page copy avoids the banned words and outside product names', async () => {
  const { INFO, SCENARIOS } = await import(path.join(dir, 'content.mjs'));
  const html = fs.readFileSync(page, 'utf8');
  const copy = [html.slice(html.indexOf('<main'), html.indexOf('<script>', html.indexOf('<main'))).replace(/<[^>]+>/g, ' '), JSON.stringify(INFO), JSON.stringify(SCENARIOS)].join(' ');
  assert.doesNotMatch(copy, /\b(wire|wires|robust|seamless|crucial|landscape|leverage|delve|journey|unlock)\b/i);
  assert.doesNotMatch(copy, /\b(vLLM|Cloudflare|Hazy|InferenceX|Jarvislabs|TechPowerUp|MediaTek|Wikipedia)\b/);
});

test('every lesson and manual section the inspector links to exists', async () => {
  const { INFO } = await import(path.join(dir, 'content.mjs'));
  const sections = fs.readdirSync(path.join(root, 'manuals', 'sglang-101', 'sections')).map((file) => `s-${file.replace(/\.md$/, '').replace(/^\d+-\d+-/, '')}`);
  for (const [part, info] of Object.entries(INFO)) {
    const href = info.lesson.href;
    if (href.startsWith('manual-sglang-101.html#')) assert.ok(sections.includes(href.split('#')[1]), `${part}: ${href}`);
    else assert.ok(fs.existsSync(path.join(root, decodeURIComponent(href.split('path=')[1]), 'docs', 'en.md')), `${part}: ${href}`);
  }
});

test('the sglang-serving cheat sheet links to the machine', () => {
  const { loadTopicMap } = require('./cheatsheet-topics.js');
  const map = loadTopicMap(root);
  assert.deepEqual(map.errors, []);
  assert.equal(map.topics.find((entry) => entry.id === 'sglang-serving').explainer, 'inside-an-llm-serving-gpu.html');
});
