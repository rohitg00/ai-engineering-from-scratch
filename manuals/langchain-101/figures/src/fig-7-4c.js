'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const M = S.main;
const Q4 = 'qwen3:4b-instruct-2507-q4_K_M';
const MODELS = [['claude-haiku-5-5', 'Haiku 5.5'], ['qwen3:8b', 'Qwen3 8B'], [Q4, 'Qwen3 4B']];
const HARN = [
  ['plain', 'plain loop', 'violet'],
  ['deep_agent', 'deep, default', 'blue'],
  ['deep_agent_fs', 'deep, on disk', 'blue'],
];
const WRITERS = new Set(['write_file', 'edit_file', 'delete']);
const files = M.order.filter(t => M.family[t] === 'files');
if (files.length !== 20) throw new Error('fig-7-4c: expected 20 file tasks');
const cell = (m, h) => {
  const c = M.cells[`${m}|${h}|0`];
  if (!c) throw new Error(`fig-7-4c: no cell ${m} ${h}`);
  return c;
};
const pass = (m, h) => files.filter(t => cell(m, h).tasks[t].p).length;
const used = (m, h) => files.filter(t => cell(m, h).tasks[t].bi.length).length;

const X0 = 204;
const SQ = 14;
const RH = 26;
const Y0 = 54;
const SEP = 12;

module.exports = figure('fig-7-4c', {
  height: Y0 + 9 * RH + 2 * SEP + 70,
  title: 'The 20 file tasks: plain loop, deep agent, and deep agent on the disk',
  desc: `A grid of the 20 file tasks for three models and three harnesses. A filled square is a pass, a rose square a fail. A green dot under a square marks a run where the model wrote with a Deep Agents file tool, and a grey dot a run where it only read with one. With the default backend those tools write to the agent state, and the checker reads the disk. Qwen3 4B passed ${pass(Q4, 'plain')} plain, ${pass(Q4, 'deep_agent')} as a default deep agent, and ${pass(Q4, 'deep_agent_fs')} with FilesystemBackend. Qwen3 8B passed ${pass('qwen3:8b', 'plain')}, ${pass('qwen3:8b', 'deep_agent')} and ${pass('qwen3:8b', 'deep_agent_fs')}. Claude Haiku 5.5 passed ${pass('claude-haiku-5-5', 'plain')}, ${pass('claude-haiku-5-5', 'deep_agent')} and ${pass('claude-haiku-5-5', 'deep_agent_fs')}.`,
}, f => {
  f.kicker(20, 22, 'model, harness');
  f.kicker(X0, 22, 'files01 to files20');
  f.kicker(620, 22, 'pass', { anchor: 'end' });
  f.kicker(566, 22, 'built-in', { anchor: 'end' });
  let y = Y0;
  MODELS.forEach(([m, name], g) => {
    if (g) y += SEP;
    f.beat(g + 1);
    f.text(20, y + 11, name, { size: 11, weight: 700, hue: 'plum' });
    HARN.forEach(([h, label, hue], r) => {
      const c = cell(m, h);
      f.text(100, y + 11, label, { size: 11, hue });
      files.forEach((t, k) => {
        const run = c.tasks[t];
        const bx = X0 + k * (SQ + 1);
        f.rect(bx, y, SQ - 2, 13, { fill: color(run.p ? `${hue}-ink` : 'rose-ink'), stroke: 'none' });
        if (run.bi.some(b => WRITERS.has(b))) f.dot(bx + (SQ - 2) / 2, y + 19, { hue: 'green', r: 2.6 });
        else if (run.bi.length) f.dot(bx + (SQ - 2) / 2, y + 19, { hue: 'ink-mute', r: 2 });
      });
      f.text(560, y + 11, h === 'plain' ? '' : `${used(m, h)}/20`, { size: 11, anchor: 'end', hue: 'green' });
      f.text(620, y + 11, `${pass(m, h)}/20`, { size: 11, hue: 'ink', anchor: 'end', weight: 700 });
      y += RH;
    });
  });
  f.beat(0);
  const ly = y + 18;
  f.dot(24, ly - 4, { hue: 'green', r: 2.6 });
  f.text(34, ly, 'wrote with write_file, edit_file, or delete', { size: 11, serif: true, hue: 'ink-soft' });
  f.dot(344, ly - 4, { hue: 'ink-mute', r: 2 });
  f.text(354, ly, 'read only: ls, glob, read_file', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 22, 'default: StateBackend, files live in the agent state. on disk: FilesystemBackend on the task folder.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 40, 'Every row also had the five task tools that write the folder. The checker reads the folder.', { size: 11, serif: true, hue: 'ink-soft' });
});
