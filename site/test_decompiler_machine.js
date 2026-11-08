const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'scripts', 'decompiler-machine');
const page = path.join(__dirname, 'inside-a-decompiler.html');
const load = () => import(path.join(dir, 'model.mjs'));
const fixture = () => import(path.join(dir, 'fixture.mjs'));
const types = (run) => run.events.map((event) => event.type).join(' ');
const lesson = (name) => path.join(root, 'phases', '13-tools-and-protocols', name);

test('a healthy -O2 run decompiles percent_change into the lifter output', async () => {
  const M = await load();
  const run = M.simulate();
  assert.equal(types(run), 'header sections decode cfg lift types structure emit ledger exit');
  assert.equal(run.outcome.status, 'decompiled');
  assert.deepEqual(run.outcome.lines, ['int percent_change(int param_1, int param_2)', '{', '  if (param_1 == 0) {', '    return 0;', '  }', '  return (param_2 - param_1) * 100 / param_1;', '}']);
  assert.deepEqual({ decoded: run.totals.decoded, live: run.totals.live, dropped: run.totals.dropped }, { decoded: 9, live: 3, dropped: 0 });
  assert.equal(run.events.find((event) => event.type === 'types').signature, 'int percent_change(int, int)');
  assert.equal(run.events.find((event) => event.type === 'structure').shape, 'if-return');
  assert.deepEqual([run.totals.observed, run.totals.derived, run.totals.inferred, run.totals.unknown], [6, 6, 2, 1]);
});

test('-O0 keeps stack slots as locals and structures an if/else', async () => {
  const M = await load();
  const run = M.simulate({ opt: 'O0' });
  assert.equal(run.totals.decoded, 17);
  assert.equal(run.totals.live, 4);
  const typed = run.events.find((event) => event.type === 'types');
  assert.deepEqual(typed.locals.map((local) => local.name), ['local_4', 'local_8', 'local_c']);
  assert.equal(typed.phis, 5);
  assert.equal(run.events.find((event) => event.type === 'structure').shape, 'if-else');
  assert.equal(run.outcome.lines.length, 15);
});

test('without the symbol table the name and the end become unknowns', async () => {
  const M = await load();
  const run = M.simulate({ symbols: false });
  assert.equal(run.outcome.lines[0], 'int fn_0(int param_1, int param_2)');
  assert.equal(run.totals.unknown, 3);
  assert.ok(run.ledger.some((entry) => entry.confidence === 'inferred' && /first byte of \.text/.test(entry.claim)));
  const swept = M.simulate({ symbols: false, sweep: 'linear' });
  assert.equal(swept.totals.decoded, 84);
  assert.equal(swept.totals.dropped, 17);
  assert.deepEqual(swept.outcome.lines.slice(1), run.outcome.lines.slice(1));
});

test('linear sweep at -O0 decodes the two padding bytes and the graph drops them', async () => {
  const M = await load();
  const run = M.simulate({ opt: 'O0', sweep: 'linear' });
  assert.equal(types(run), 'header sections decode cfg prune lift types structure emit ledger exit');
  const decode = run.events.find((event) => event.type === 'decode');
  assert.deepEqual(decode.extra, [0x2e]);
  assert.equal(decode.insns.find((insn) => insn.a === 0x2e).hex, '66 90');
  assert.equal(run.totals.dropped, 1);
});

test('on the data-in-code program the sweep misses 0x14 and descent does not', async () => {
  const M = await load();
  const swept = M.simulate({ program: 'trap', sweep: 'linear' });
  const decode = swept.events.find((event) => event.type === 'decode');
  assert.deepEqual(decode.conflict, { jump: 0xe, target: 0x14, inside: 0x13, text: 'addq $0x1, %rax' });
  assert.deepEqual(decode.missed, [0x14]);
  assert.deepEqual(decode.extra, [0x10, 0x12, 0x13, 0x18]);
  const descent = M.simulate({ program: 'trap' });
  const found = descent.events.find((event) => event.type === 'decode');
  assert.equal(found.conflict, null);
  assert.equal(found.insns.find((insn) => insn.a === 0x14).text, 'addl $0x1, %eax');
  for (const run of [swept, descent]) {
    assert.equal(run.outcome.status, 'stopped');
    assert.match(run.events.find((event) => event.type === 'refuse').error, /two-byte opcode 0f b6 is outside the fixture subset/);
  }
});

test('every configuration ends with an exit, a trace on each step and a growing ledger', async () => {
  const M = await load();
  for (const program of M.PROGRAMS) {
    for (const symbols of [true, false]) {
      for (const sweep of M.SWEEPS) {
        for (const opt of M.OPTS) {
          const config = { program, symbols, sweep, opt };
          const run = M.simulate(config);
          assert.equal(run.events.at(-1).type, 'exit');
          assert.ok(['decompiled', 'stopped'].includes(run.outcome.status));
          assert.ok(run.events.every((event, index) => event.index === index && typeof event.trace === 'string' && event.trace.length > 0));
          assert.ok(run.events.every((event, index) => index === 0 || event.ledger.length >= run.events[index - 1].ledger.length));
          assert.ok(run.events.every((event) => event.stage >= 1 && event.stage <= 9));
          assert.ok(run.ledger.every((entry) => M.CONFIDENCE.includes(entry.confidence)));
          assert.deepEqual(M.simulate(config), run);
        }
      }
    }
  }
});

test('the header card and the slots show only facts the fixtures hold', async () => {
  const { FIXTURE } = await fixture();
  for (const program of Object.values(FIXTURE)) {
    assert.ok(program.ident.startsWith('7f 45 4c 46 02 01'));
    assert.equal(program.header.type, 1);
    assert.equal(program.header.machine, 62);
  }
  assert.deepEqual(FIXTURE['ledger-O2'].lift.params.map((param) => param.register), ['rdi', 'rsi']);
  assert.deepEqual(FIXTURE['ledger-O0'].lift.locals.map((local) => local.name), ['local_4', 'local_8', 'local_c']);
  assert.deepEqual(FIXTURE['ledger-O2'].lift.locals, []);
  const html = fs.readFileSync(page, 'utf8');
  for (const hook of ['data-live="drawers"', 'data-live="lanes"', 'data-live="slots"', 'data-live="elfline"', '7F 45 4C 46']) assert.ok(html.includes(hook), hook);
});

test('every timed step has a real time and the badge is computed from it', async () => {
  const M = await import(path.join(dir, 'model.mjs'));
  const Ck = await import(path.join(dir, 'clock.mjs'));
  for (const program of M.PROGRAMS)
    for (const symbols of [true, false])
      for (const sweep of M.SWEEPS) {
        const config = { program, symbols, sweep, opt: 'O2' };
        for (const ev of M.simulate(config).events) {
          const real = Ck.realOf(config, ev.type);
          if (ev.type === 'ledger' || ev.type === 'exit') assert.equal(real, null);
          else assert.ok(real.seconds > 0 && real.seconds < 0.1, ev.type);
        }
      }
  const badge = Ck.badgeOf(1.5, { seconds: 5e-5, shared: null });
  assert.equal(badge.text, '×1/30,000');
  assert.equal(Ck.badgeOf(1, { seconds: 1, shared: null }), null);
});

test('the share URL round-trips every setting', async () => {
  const M = await load();
  assert.equal(M.encode(M.DEFAULTS), '');
  const config = { program: 'trap', symbols: false, sweep: 'linear', opt: 'O0' };
  assert.deepEqual(M.decode('?' + M.encode(config)), config);
  assert.deepEqual(M.decode('?program=nonsense&sweep=x&opt=O9'), M.DEFAULTS);
});

test('the fixture bytes and instructions match the committed objects and listings', async () => {
  const { FIXTURE } = await fixture();
  for (const program of Object.values(FIXTURE)) {
    const data = fs.readFileSync(path.join(root, program.path));
    assert.equal(data.length, program.bytes);
    assert.equal(data.subarray(0, 16).toString('hex').match(/../g).join(' '), program.ident);
    const start = program.text.offset + program.target.start;
    assert.equal(data.subarray(start, start + program.target.gap - program.target.start).toString('hex').match(/../g).join(' '), program.fileBytes);
    const listing = fs.readFileSync(path.join(root, program.path.replace(/\.o$/, '.objdump.txt')), 'utf8');
    const rows = new Map();
    for (const line of listing.split('\n')) {
      const match = /^\s+([0-9a-f]+):\s((?:[0-9a-f]{2} ?)+)\s*\t([^#]*)/.exec(line);
      if (match) rows.set(parseInt(match[1], 16), { hex: match[2].trim(), text: match[3].replace(/<[^>]*>/, '').trim().replace(/\s+/g, ' ') });
    }
    for (const scope of Object.values(program.decode)) {
      for (const insn of scope.linear.insns) {
        const row = rows.get(insn.a);
        assert.ok(row, `${program.file} ${insn.a}`);
        assert.equal(insn.hex, row.hex);
        assert.equal(insn.text, row.text);
      }
    }
  }
  const doc = fs.readFileSync(lesson('34-lifting-to-pseudocode/docs/en.md'), 'utf8');
  assert.ok(doc.includes('return (param_2 - param_1) * 100 / param_1;'));
});

test('the fixture is the output of the capture script', { skip: spawnSync('python3', ['--version']).status !== 0 }, () => {
  const result = spawnSync('python3', ['-I', path.join(dir, 'capture.py'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('the published page is the output of the build script', () => {
  const before = fs.readFileSync(page, 'utf8');
  execFileSync(process.execPath, [path.join(dir, 'build.mjs')], { stdio: 'pipe' });
  assert.equal(fs.readFileSync(page, 'utf8'), before);
});

test('the page carries every control, readout and social tag', () => {
  const html = fs.readFileSync(page, 'utf8');
  for (const hook of ['data-dm-run', 'data-dm-step', 'data-dm-break', 'data-dm-repair', 'data-dm-explode', 'data-dm-reset', 'id="dm-program"', 'id="dm-symbols"', 'id="dm-sweep"', 'id="dm-opt"', 'data-dm-stage-name', 'data-dm-decoded', 'data-dm-blocks', 'data-dm-names', 'data-dm-unknowns', 'data-dm-evidence', 'data-dm-ledger', 'data-dm-trace', 'aria-live="polite"', 'id="dm-wobble"', 'id="dm-labels"', 'data-dm-pal="mint"', 'data-pills', 'id="dm-hand"', 'The big idea', 'get("labels") === "0"', 'data-dm-steplist', 'data-dm-mode="manual"', 'data-dm-mode="auto"', 'data-dm-restart', 'data-dm-hint', 'data-dm-badge', 'data-dm-cut', 'data-sfx', 'window.seek = seekTime', 'has("render")', 'localStorage.getItem("dm-mode")', 'Self-check at build:']) {
    assert.ok(html.includes(hook), hook);
  }
  assert.match(html, /This is a simulation\./);
  assert.match(html, /Linear sweep at <span class="dm-nobr">-O0<\/span>/);
  assert.ok(!/overflow-wrap: anywhere/.test(html.slice(html.indexOf('.dm {'))));
  assert.match(html, /<meta property="og:image" content="https:\/\/aiengineeringfromscratch\.com\/og\/page\/inside-a-decompiler\.png">/);
  assert.match(html, /role="img" aria-label="A decompiler built as a machine/);
  for (const name of ['og', 'poster', 'machine', 'machine-dark']) assert.ok(fs.existsSync(path.join(__dirname, 'anatomy', `inside-a-decompiler-${name}.png`)), name);
  assert.match(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), /href="inside-a-decompiler\.html"/);
});

test('the page copy avoids the banned words and outside product names', async () => {
  const { INFO, SCENARIOS } = await import(path.join(dir, 'content.mjs'));
  const html = fs.readFileSync(page, 'utf8');
  const copy = [html.slice(html.indexOf('<main'), html.indexOf('<script>', html.indexOf('<main'))).replace(/<[^>]+>/g, ' '), JSON.stringify(INFO), JSON.stringify(SCENARIOS)].join(' ');
  assert.doesNotMatch(copy, /\b(wire|wires|robust|seamless|crucial|landscape|leverage|delve|journey|unlock)\b/i);
  assert.doesNotMatch(copy, /\b(Ghidra|IDA|Binary Ninja|Hex-Rays|radare|objdump)\b/);
});

test('every lesson the inspector links to exists', async () => {
  const { INFO } = await import(path.join(dir, 'content.mjs'));
  for (const [part, info] of Object.entries(INFO)) {
    const target = decodeURIComponent(info.lesson.href.split('path=')[1]);
    assert.ok(fs.existsSync(path.join(root, target, 'docs', 'en.md')), `${part}: ${target}`);
  }
});

test('the reverse engineering cheat sheet links to the machine', () => {
  const { loadTopicMap } = require('./cheatsheet-topics.js');
  const map = loadTopicMap(root);
  assert.deepEqual(map.errors, []);
  const topic = map.topics.find((entry) => entry.id === 'reverse-engineering');
  assert.equal(topic.explainer, 'inside-a-decompiler.html');
  for (const entry of map.topics.filter((item) => item.explainer)) assert.ok(fs.existsSync(path.join(__dirname, entry.explainer)), entry.explainer);
});
