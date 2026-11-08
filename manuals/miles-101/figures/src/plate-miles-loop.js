'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs['plain-48'];
const m = run.median_unpaused;
const sec = (value, digits = 1) => `${value.toFixed(digits)} s`;
const diffs = run.per_step.map(p => p.train_time_s - p.log_probs_time_s).sort((a, b) => a - b);
const gradient = (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2;
const step = m.step_time_s.median;
const steps = m.step_time_s.steps;
const TURNS = [
  { hue: 'violet', time: m.rollout_time_s.median, line: 'rollout, SGLang engine' },
  { hue: 'blue', time: m.log_probs_time_s.median, line: 'log probabilities, trainer' },
  { hue: 'blue', time: gradient, line: 'GRPO update, Adam' },
  { hue: 'amber', time: m.update_weights_time_s.median, digits: 2, line: 'weight update to the engine' },
];
const untimed = step - TURNS.reduce((sum, turn) => sum + turn.time, 0);
const ACTORS = [
  { hue: 'grey', title: 'Ray head' },
  { hue: 'amber', title: 'TrainerController' },
  { hue: 'violet', title: 'RolloutExecutor' },
  { hue: 'green', title: 'math reward' },
];

module.exports = figure('plate-miles-loop', {
  height: 716,
  title: 'One GRPO step on one GB10',
  desc: `One DGX Spark GB10 package drawn in iso: a Grace CPU die with 20 Arm cores and a Blackwell GPU die, both joined to one 128 GB slab of unified LPDDR5X memory at the center. An NVLink-C2C link joins the two dies. On the Grace die run the Ray head, the TrainerController and RolloutExecutor Ray actors, and the math reward. On the Blackwell die the FSDP trainer is active and the SGLang engine waits. Inside the shared slab the trainer state is the active footprint and the engine state is parked. The trainer onloads its state from the slab in ${sec(m.wake_up_time_s.median, 2)}, and the weight update from the trainer to the parked engine state takes ${sec(m.update_weights_time_s.median, 2)}. Below, one median step of ${sec(step)} to scale: rollout ${sec(m.rollout_time_s.median)}, log probabilities ${sec(m.log_probs_time_s.median)}, GRPO update ${sec(gradient)}, weight update ${sec(m.update_weights_time_s.median, 2)}, and ${sec(untimed)} that the phase medians do not cover. Medians of ${steps} steps of a run made before we added the heat guard.`,
}, f => {
  const chip = f.isoView({ ox: 300, oy: 118, angle: 'true' });
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const flat = (part, u, v, w, d, hue, opacity) => face(part, [[u, v, part.box.h], [u + w, v, part.box.h], [u + w, v + d, part.box.h], [u, v + d, part.box.h]], hue, opacity);
  const front = (part, u0, u1, k0, k1, hue, opacity) => face(part, [[u0, part.box.d, k0], [u1, part.box.d, k0], [u1, part.box.d, k1], [u0, part.box.d, k1]], hue, opacity);
  const on = (part, u, v, w, d, h, hue, extra = {}) => f.isoBlock(chip, { x: part.box.x + u, y: part.box.y + v, z: part.box.z + part.box.h, w, d, h, hue, shadow: false, ...extra });

  f.kicker(20, 18, 'one NVIDIA DGX Spark · GB10 superchip');
  f.text(620, 18, 'Qwen3-0.6B', { size: 11, anchor: 'end', hue: 'ink-soft' });

  const pkg = f.isoBlock(chip, { x: 0, y: 0, w: 340, d: 320, h: 8, hue: 'grey' });
  const trace = points => f.polygon(points.map(([x, y]) => chip.P(x, y, 8)), { fill: color('teal-fill'), stroke: color('teal-ink'), strokeWidth: 1.2 });
  trace([[60, 172], [60, 100], [198, 100], [198, 112], [72, 112], [72, 172]]);
  const bar = (x, y, w, d) => trace([[x, y], [x + w, y], [x + w, y + d], [x, y + d]]);
  const grace = on(pkg, 14, 170, 112, 136, 12, 'grey', { shadow: true });
  for (let i = 0; i < 20; i += 1) flat(grace, i < 10 ? 4 + i * 10 : 104, i < 10 ? 128 : 6 + (i - 10) * 11, 6, 6, 'ink-mute', 0.55);
  const gpu = on(pkg, 196, 14, 130, 120, 12, 'grey', { shadow: true });
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) flat(gpu, 8 + col * 29, 6 + row * 28, 22, 22, 'violet-ink', 0.18);
  for (const y of [196, 256]) bar(126, y, 10, 12);
  for (const x of [222, 286]) bar(x, 134, 12, 10);
  const slab = on(pkg, 134, 142, 196, 168, 16, 'paper', { inkHue: 'grey', ink: 1.6, shadow: true });

  const actors = ACTORS.map((actor, i) => {
    const diff = -250 + i * 55;
    const cx = (316 + diff) / 2;
    const cy = (316 - diff) / 2;
    const block = on(grace, cx - 9 - 14, cy - 9 - 170, 18, 18, 10, actor.hue);
    front(block, 3, 15, 2, 8, `${actor.hue}-ink`, 0.7);
    flat(block, 5, 5, 8, 8, `${actor.hue}-ink`, 0.55);
    return block;
  });
  ACTORS.forEach((actor, i) => {
    const top = actors[i].top;
    const y = 148 - i * 26;
    f.text(top[0] - 4, y, actor.title, { size: 11.5, weight: 700, anchor: 'end', hue: actor.hue === 'grey' ? undefined : actor.hue });
    f.leader([top[0], y + 2], top, { hue: actor.hue === 'grey' ? 'ink-mute' : actor.hue });
  });

  const trainer = on(gpu, 14, 46, 40, 40, 26, 'blue');
  front(trainer, 6, 34, 6, 22, 'blue-ink', 0.5);
  const engine = on(gpu, 72, 46, 40, 40, 8, 'paper', { inkHue: 'violet', dash: 'dashed' });
  const active = on(slab, 14, 14, 92, 140, 14, 'blue');
  for (let v = 10; v < 140; v += 22) flat(active, 8, v, 76, 10, 'blue-ink', 0.18);
  const parked = on(slab, 116, 14, 66, 140, 5, 'paper', { inkHue: 'violet', dash: 'dashed' });

  const NL = chip.P(129, 106, 8);
  f.text(NL[0], NL[1] - 34, 'NVLink-C2C', { size: 12, weight: 700, hue: 'teal', anchor: 'middle' });
  f.leader([NL[0], NL[1] - 28], NL, { hue: 'teal' });

  const RIGHT = [
    { title: 'FSDP trainer', sub: 'FSDPTrainRayActor, active', hue: 'blue', to: trainer.top },
    { title: 'Blackwell GPU', sub: 'one die, shares the pool', hue: undefined, to: gpu.P(0, 0, 12) },
    { title: 'SGLang engine', sub: 'waits for new weights', hue: 'violet', to: engine.top },
  ];
  RIGHT.forEach((label, i) => {
    const y = 50 + i * 40;
    f.text(620, y, label.title, { size: 12, weight: 700, anchor: 'end', hue: label.hue });
    f.text(620, y + 14, label.sub, { size: 11, serif: true, anchor: 'end', hue: 'ink-soft' });
    f.leader([470, y + 10], label.to, { hue: label.hue || 'ink-mute' });
  });

  f.text(20, 380, 'Grace CPU', { size: 12, weight: 700 });
  f.text(20, 394, '20 Arm cores', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([60, 368], grace.P(56, 136, 6), { hue: 'ink-mute' });
  f.text(20, 432, 'trainer state', { size: 12, weight: 700, hue: 'blue' });
  f.text(20, 446, 'active footprint', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([128, 428], active.P(0, 140, 7), { hue: 'blue' });
  f.text(620, 400, 'engine state', { size: 12, weight: 700, hue: 'violet', anchor: 'end' });
  f.text(620, 414, 'parked in the pool', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.leader([520, 404], parked.P(66, 70, 5), { hue: 'violet' });
  f.text(300, 506, 'LPDDR5X · 128 GB unified, one pool for both dies', { size: 12, weight: 700, anchor: 'middle' });
  f.leader([300, 494], slab.P(98, 168, 4), { hue: 'ink-mute' });

  const seg = (a, b) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
  f.beat(2);
  const up0 = active.P(70, 30, 14);
  const up1 = trainer.P(26, 40, 4);
  f.path(seg(up0, up1), { style: 'state' });
  f.text((up0[0] + up1[0]) / 2 - 12, (up0[1] + up1[1]) / 2 - 8, `onload ${sec(m.wake_up_time_s.median, 2)}`, { size: 11, anchor: 'end', hue: 'amber', knock: true });

  f.beat(4);
  const w0 = trainer.P(40, 36, 8);
  const w2 = parked.P(30, 34, 5);
  f.path(seg(w0, w2), { style: 'state' });
  f.text((w0[0] + w2[0]) / 2 - 8, (w0[1] + w2[1]) / 2 + 10, `weight update ${sec(m.update_weights_time_s.median, 2)}`, { size: 11, anchor: 'end', hue: 'amber', knock: true });

  f.beat(0);
  const line = f.isoView({ ox: 0, oy: 590, angle: 'true' });
  f.kicker(20, 534, `one step to scale · ${sec(step)}, median of ${steps}`);
  const x0 = 20;
  const span = 600;
  const edges = [x0];
  TURNS.forEach(turn => edges.push(edges[edges.length - 1] + (turn.time / step) * span));
  TURNS.forEach((turn, index) => {
    f.beat(1 + index);
    f.isoBeam(line, { sx0: edges[index], sx1: edges[index + 1] - (index < 3 ? 1 : 0), c: 0, back: 16, h: 10, hue: turn.hue, shadow: false });
    const last = index === TURNS.length - 1;
    const cx = last ? edges[index] - 14 : edges[index] + 11;
    f.step(cx, 562, index + 1, { hue: turn.hue });
    f.text(last ? cx - 13 : cx + 13, 566, sec(turn.time, turn.digits || 1), { size: 11, weight: 700, hue: turn.hue, anchor: last ? 'end' : undefined });
  });
  f.isoBeam(line, { sx0: edges[4] + 1, sx1: x0 + span, c: 0, back: 16, h: 10, hue: 'paper', inkHue: 'ink-mute', ink: 1, dash: 'dashed', shadow: false });
  f.beat(0);
  TURNS.forEach((turn, index) => {
    const x = index % 2 ? 330 : 20;
    const y = 624 + Math.floor(index / 2) * 22;
    f.step(x + 9, y - 4, index + 1, { hue: turn.hue });
    f.text(x + 26, y, turn.line, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 676, `dashed end: median step minus the phase medians, ${sec(untimed)}. Trainer offload ${sec(m.sleep_time_s.median, 2)}.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 700, 'Medians from the run made before the heat guard.', { size: 11, serif: true, hue: 'ink-mute' });
});
