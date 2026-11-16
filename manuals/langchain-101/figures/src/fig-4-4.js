'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const T = S.toolscale.cells;
const Q4 = 'qwen3:4b-instruct-2507-q4_K_M';
const SIZES = [5, 20, 50, 100];
const BLOCKS = [
  ['claude-haiku-5-5', 'Haiku 5.5', ['off', 'on']],
  [Q4, 'Qwen3 4B', ['off', 'on', 'on_desc']],
  ['qwen3:8b', 'Qwen3 8B', ['off', 'on', 'on_desc']],
];
const SEL = { off: 'no selector', on: 'selector', on_desc: 'selector + list' };
const SELHUE = { off: 'blue', on: 'plum', on_desc: 'plum' };
const get = (m, n, s) => T[`${m}|${n}|${s}`];

const X0 = 154;
const SQ = 8;
const GW = 10 * SQ + 34;
const GG = 6;
const gx = i => X0 + i * (GW + GG);
const RH = 17;
const Y0 = 46;
const SEP = 12;
const nRows = BLOCKS.reduce((a, [, , s]) => a + s.length, 0);
const height = Y0 + nRows * RH + BLOCKS.length * 18 + (BLOCKS.length - 1) * SEP + 96;
const pass = (m, n, s) => (get(m, n, s) ? get(m, n, s).pass : null);

module.exports = figure('fig-4-4', {
  height,
  title: 'Ten chain tasks at four tool counts, with and without LLMToolSelectorMiddleware',
  desc: `A grid of the ten chain tasks for each model, tool count and selector setting, create_agent on the Mac and Claude Haiku 5.5 through the API. A blue or plum square is a pass, a solid rose square a call to a distractor or no call to the needed lookup, a light rose square another failure, and a black square a run that raised. Without the selector Haiku passed 10 of 10 at 5, 20, 50 and 100 tools, and with it ${[5, 20, 50, 100].map(n => pass('claude-haiku-5-5', n, 'on')).join(', ')}. Qwen3 4B passed ${SIZES.map(n => pass(Q4, n, 'off')).join(', ')} without it and ${SIZES.map(n => pass(Q4, n, 'on')).join(', ')} with it. Qwen3 8B ran 5 and 50 tools only. Passes are lenient passes.`,
}, f => {
  f.kicker(20, 22, 'model, setting');
  SIZES.forEach((n, i) => {
    f.text(gx(i) + 5 * SQ, 22, `${n} tools`, { size: 11, hue: 'ink', anchor: 'middle', weight: 700 });
    f.rule(gx(i), 30, gx(i) + 10 * SQ, 30, { hue: 'ink-mute' });
  });
  let y = Y0;
  BLOCKS.forEach(([m, name, sels], b) => {
    if (b) y += SEP;
    f.beat(b + 1);
    f.text(20, y + 11, name, { size: 11, weight: 700, hue: 'plum' });
    y += 18;
    sels.forEach(s => {
      f.text(20, y + 11, SEL[s], { size: 11, hue: SELHUE[s] });
      SIZES.forEach((n, i) => {
        const c = get(m, n, s);
        if (!c) return;
        c.runs.forEach((r, k) => {
          const bx = gx(i) + k * SQ;
          if (r.p) f.rect(bx, y + 1, SQ - 2, RH - 5, { fill: color(`${SELHUE[s]}-ink`), stroke: 'none' });
          else if (r.c === 'harness_error') f.rect(bx, y + 1, SQ - 2, RH - 5, { fill: color('ink'), stroke: 'none' });
          else if (r.c === 'wrong_tool') f.rect(bx, y + 1, SQ - 2, RH - 5, { fill: color('rose-ink'), stroke: 'none' });
          else f.rect(bx + 0.5, y + 1.5, SQ - 3, RH - 6, { fill: color('rose-fill'), stroke: color('rose-ink') });
        });
        f.text(gx(i) + 10 * SQ + 4, y + 11, String(c.pass), { size: 11, hue: 'ink', weight: 700 });
      });
      y += RH;
    });
  });
  f.beat(0);
  const ly = y + 22;
  f.rect(20, ly - 10, 6, 12, { fill: color('blue-ink'), stroke: 'none' });
  f.rect(28, ly - 10, 6, 12, { fill: color('plum-ink'), stroke: 'none' });
  f.text(40, ly, 'pass', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(86, ly - 10, 6, 12, { fill: color('rose-ink'), stroke: 'none' });
  f.text(98, ly, 'wrong tool: a distractor, or no item lookup', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(390.5, ly - 9.5, 5, 11, { fill: color('rose-fill'), stroke: color('rose-ink') });
  f.text(402, ly, 'other failure', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(510, ly - 10, 6, 12, { fill: color('ink'), stroke: 'none' });
  f.text(522, ly, 'raised', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 22, 'The number after each group counts the passes of 10. Tools: 5 lookups, distractors, and submit_answer.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 40, 'selector + list: our own system prompt that adds each tool name and description.', { size: 11, serif: true, hue: 'ink-soft' });
});
