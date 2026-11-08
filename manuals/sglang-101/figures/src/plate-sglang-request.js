'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const lines = fs.readFileSync(path.join(__dirname, '../../capture/gpu/out-l4/cache-experiment.txt'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const summary = Object.fromEntries(lines.filter(row => row.summary).map(row => [row.summary, row]));
const firstRound = lines.find(row => row.case === 'stable-system-prompt' && row.round === 1);
const stable = summary['stable-system-prompt'];
const atEnd = summary['id-at-end'];
const atStart = summary['id-at-start'];
const n = value => Math.round(value).toLocaleString('en-US');
const ms = value => `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms`;

module.exports = figure('plate-sglang-request', {
  height: 694,
  title: 'One radix tree on one L4',
  desc: `The three SGLang processes run on the host CPU: the TokenizerManager, the Scheduler, and the DetokenizerManager, joined by ZMQ IPC. Below them is one NVIDIA L4 card with its SM array of 58 SMs and its 24 GB of GDDR6 drawn as one memory slab. In that memory the radix tree holds KV prefixes. The system prompt is one shared node of ${n(stable.median_cached_tokens)} tokens, and each repeated request attaches below it. A request with the id at the end attaches there too, with ${n(atEnd.median_cached_tokens)} of ${n(atEnd.prompt_tokens)} tokens cached. A request with the id at the start shares only ${atStart.median_cached_tokens} tokens and starts its own branch. On our L4 the first request waited ${ms(firstRound.ttft_ms)} for its first token, and the repeats waited ${ms(stable.median_ttft_ms)}.`,
}, f => {
  const host = f.isoView({ ox: 0, oy: 150, angle: 'true' });
  const card = f.isoView({ ox: 0, oy: 470, angle: 'true' });
  const unit = (view, cx, cc, size, h, hue, options = {}) => {
    const [xc, yc] = view.at(cx, cc);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue, ...options });
  };
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const quad = (part, u0, u1, k0, k1, hue, opacity) => face(part, [[u0, part.box.d, k0], [u1, part.box.d, k0], [u1, part.box.d, k1], [u0, part.box.d, k1]], hue, opacity);
  const flat = (part, u, v, w, d, hue, opacity) => face(part, [[u, v, part.box.h], [u + w, v, part.box.h], [u + w, v + d, part.box.h], [u, v + d, part.box.h]], hue, opacity);

  f.kicker(20, 18, 'host CPU · three SGLang 0.5.22 processes');
  f.text(620, 18, 'Qwen3-8B', { size: 11, anchor: 'end', hue: 'ink-soft' });
  const procs = [
    { cx: 105, w: 170, title: 'TokenizerManager', sub: 'text to token ids' },
    { cx: 320, w: 160, title: 'Scheduler', sub: 'match_prefix, batches' },
    { cx: 535, w: 170, title: 'DetokenizerManager', sub: 'token ids to text' },
  ];
  procs.forEach(p => f.box({ x: p.cx - p.w / 2, y: 30, w: p.w, h: 52, hue: 'blue', title: p.title, sub: [p.sub] }));
  f.isoBeam(host, { sx0: 14, sx1: 626, c: 50, back: 100, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const tok = unit(host, 105, 0, 42, 26, 'blue');
  for (const v of [9, 19, 29]) flat(tok, 8, v, 26, 4, 'blue-ink', 0.55);
  const sched = unit(host, 320, 0, 42, 26, 'blue');
  for (const [u1, k] of [[34, 20], [27, 14], [20, 8]]) quad(sched, 7, u1, k - 2.4, k, 'amber-ink', 0.8);
  const detok = unit(host, 535, 0, 42, 26, 'blue');
  f.isoBlock(host, { x: detok.box.x + 42, y: detok.box.y + 11, z: 8, w: 12, d: 20, h: 2, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  [tok, sched, detok].forEach((machine, index) => f.leader([procs[index].cx, 84], machine.top, { hue: 'blue' }));

  f.beat(1);
  const ipc = (a, b, label) => {
    const from = a.P(42, 0, 13);
    const to = b.P(0, 42, 13);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style: 'event' });
    f.text((from[0] + to[0]) / 2, from[1] - 8, label, { size: 11, anchor: 'middle', hue: 'indigo', knock: true });
  };
  ipc(tok, sched, 'ZMQ IPC');

  f.beat(0);
  f.text(20, 206, 'x86_64 host', { size: 11, serif: true, hue: 'ink-mute' });
  f.rule(20, 216, 620, 216, { dash: 'dashed' });
  f.kicker(20, 236, 'NVIDIA L4 · GPU memory');

  const SX = 302;
  f.isoBeam(card, { sx0: 14, sx1: 626, c: 150, back: 330, h: 8, hue: 'grey' });
  const [dx, dy] = card.at(100, -15);
  const die = f.isoBlock(card, { x: dx - 38, y: dy - 38, z: 8, w: 76, d: 76, h: 10, hue: 'grey', shadow: false });
  let cells = 0;
  for (let row = 0; row < 8 && cells < 58; row += 1) {
    for (let col = 0; col < 8 && cells < 58; col += 1) {
      if ((row === 0 || row === 7) && (col === 0 || col === 7)) continue;
      flat(die, 4 + col * 9, 4 + row * 9, 7, 7, 'violet-ink', 0.7);
      cells += 1;
    }
  }
  f.isoBeam(card, { sx0: 200, sx1: 612, c: 130, back: 290, h: 8, z: 8, hue: 'paper', inkHue: 'grey', ink: 1.2, shadow: false });
  for (let i = 1; i < 6; i += 1) {
    const sx = 200 + (412 * i) / 6;
    const low = card.P(...card.at(sx, 130), 8);
    const high = card.P(...card.at(sx, 130), 16);
    f.rule(low[0], low[1], high[0], high[1], { hue: 'grey', opacity: 0.8 });
  }

  const Z = 16;
  const node = (sx, c, hue, size = 16, h = 7) => unit(card, sx, c, size, h, hue, { z: Z, shadow: false });
  const edge = (a, b, hue) => {
    const pa = card.P(...card.at(a[0], a[1]), Z + 1);
    const pb = card.P(...card.at(b[0], b[1]), Z + 1);
    f.rule(pa[0], pa[1], pb[0], pb[1], { hue, width: 2 });
  };
  const ROOT = [232, -15];
  const SHARED = [SX, -15];
  const START = [SX + 40, 100];
  const LEAVES = [[500, -150], [500, -105], [500, -60], [500, -15]];
  const END = [500, 50];
  edge(ROOT, SHARED, 'green');
  edge(ROOT, START, 'rose');
  LEAVES.forEach(leaf => edge(SHARED, leaf, 'green'));
  edge(SHARED, END, 'green');
  const root = node(...ROOT, 'green', 14, 5);
  const shared = node(...SHARED, 'green', 30, 14);
  const start = node(...START, 'rose', 16, 6);
  const leaves = LEAVES.map((leaf, index) => node(...leaf, index === 1 ? 'plum' : 'green', 14, 6));
  const end = node(...END, 'green', 16, 6);

  f.text(20, 262, 'SM array', { size: 12, weight: 700, hue: 'violet' });
  f.text(20, 278, '58 SMs, Ada', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([100, 284], die.top, { hue: 'violet' });
  const gddr = card.P(...card.at(240, 130), 12);
  f.leader([196, 572], gddr, { hue: 'ink-mute' });
  f.text(20, 576, '24 GB GDDR6, six packages', { size: 11, hue: 'ink-soft' });
  f.text(232, 330, 'root', { size: 11, anchor: 'middle', hue: 'green' });
  f.leader([232, 336], root.top, { hue: 'green' });

  f.beat(2);
  f.text(290, 262, 'system prompt node', { size: 12, weight: 700, hue: 'green', anchor: 'end' });
  f.text(290, 278, `${n(stable.median_cached_tokens)} tokens, shared`, { size: 11, hue: 'green', anchor: 'end' });
  f.leader([276, 284], shared.top, { hue: 'green' });
  f.leader([start.near[0], 584], start.near, { hue: 'rose' });
  f.text(start.near[0], 598, `id at the start: ${atStart.median_cached_tokens} of ${n(atStart.prompt_tokens)} cached, own branch`, { size: 11, anchor: 'middle', hue: 'rose' });

  f.beat(3);
  const down = sched.P(21, 42, 0);
  f.path(`M${down[0]} ${down[1] + 2} L${down[0]} ${shared.top[1] - 4}`, { style: 'call' });
  f.text(SX + 8, 300, 'match_prefix', { size: 11.5, knock: true });

  f.beat(4);
  f.text(620, 262, 'repeat request, round 3', { size: 12, weight: 700, anchor: 'end', hue: 'plum' });
  f.text(620, 278, `1 new token, ${n(stable.median_cached_tokens)} of`, { size: 11, anchor: 'end', hue: 'plum' });
  f.text(620, 294, `${n(stable.prompt_tokens)} cached`, { size: 11, anchor: 'end', hue: 'green' });
  f.leader([560, 300], leaves[1].top, { hue: 'plum' });
  f.leader([end.near[0], 562], end.near, { hue: 'green' });
  f.text(620, 576, `id at the end: ${n(atEnd.median_cached_tokens)} of ${n(atEnd.prompt_tokens)}`, { size: 11, anchor: 'end', hue: 'green' });

  f.beat(5);
  const back = detok.P(0, 42, 13);
  const from = sched.P(42, 0, 13);
  f.path(`M${from[0] + 2} ${from[1]} L${back[0] - 2} ${back[1]}`, { style: 'event' });
  f.text((from[0] + back[0]) / 2, from[1] - 8, 'ZMQ IPC', { size: 11, anchor: 'middle', hue: 'indigo', knock: true });

  f.beat(6);
  f.kicker(20, 634, 'time to first token on our L4, same 2,999-token prompt');
  f.text(20, 656, `first request ${ms(firstRound.ttft_ms)}`, { size: 12, weight: 700, hue: 'rose' });
  f.text(330, 656, `repeats ${ms(stable.median_ttft_ms)}, median of 4`, { size: 12, weight: 700, hue: 'plum' });
  f.beat(0);
  f.text(20, 682, `first request: ${firstRound.cached_tokens} cached tokens, the system prompt was not yet in the tree`, { size: 11, serif: true, hue: 'ink-mute' });
});
