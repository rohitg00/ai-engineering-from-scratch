'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const mac = load(path.join(__dirname, '../../capture/lab/summary/crash-resume-mac.json'));
const x86 = load(path.join(__dirname, '../../capture/lab/summary/crash-resume-x86.json'));
const rowsOf = [['sqlite', 'sync'], ['sqlite', 'async'], ['sqlite', 'exit'], ['postgres', 'sync'], ['postgres', 'async'], ['postgres', 'exit']];
const points = ['before_tool', 'inside_tool', 'before_put_writes', 'before_put', 'after_tool'];
const colW = 48;
const none = x86.keys.none;
const order = x86.keys.order;

const hollow = (f, x, y, r) => f.emit(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color('paper')}" stroke="${color('ink-mute')}" stroke-width="1"/>`);
const trial = (f, x, y, t, cell, r) => {
  if (t < cell.twice) f.dot(x, y, { hue: 'rose', r });
  else if (t < cell.killed) f.dot(x, y, { hue: 'teal', r });
  else hollow(f, x, y, r - 0.4);
};

module.exports = figure('fig-5-3', {
  height: 340,
  title: 'Crash trials that charged the order twice',
  desc: `A grid of dots, one dot per trial, for six rows of saver and durability mode and five kill points, in two panels. The left panel is the graph on the Mac with no model, five trials per cell: ${mac.graph.twice} of ${mac.graph.trials} ran the effect twice. The right panel is the Qwen3 4B agent on the x86 server guest with no key, one bar of twenty trials per cell with the count that charged twice: ${none.twice} of ${none.killed} killed trials charged twice. Every kill inside the tool charged twice, and sync with a kill after the step charged once.`,
}, f => {
  const panels = [{ x: 140, title: 'graph, the Mac, no model' }, { x: 390, title: 'agent, x86, Qwen3 4B' }];
  panels.forEach(panel => {
    f.kicker(panel.x, 20, panel.title);
    points.forEach((_, k) => f.text(panel.x + k * colW + colW / 2, 42, String(k + 1), { size: 11, anchor: 'middle', weight: 700 }));
  });
  rowsOf.forEach(([saver, mode], r) => {
    const y = 66 + r * 30;
    points.forEach((point, k) => {
      const key = `${saver} ${mode} ${point}`;
      const left = mac.graph.cells[key];
      for (let t = 0; t < left.trials; t += 1) trial(f, 140 + k * colW + 8 + t * 8, y, t, left, 3.2);
      const right = none.cells[key];
      const x0 = 390 + k * colW + 4;
      const unit = 26 / right.trials;
      f.emit(`<rect x="${x0}" y="${y - 5}" width="26" height="10" fill="${color('paper')}" stroke="${color('ink-mute')}" stroke-width="1"/>`);
      if (right.twice) f.emit(`<rect x="${x0}" y="${y - 5}" width="${(right.twice * unit).toFixed(1)}" height="10" fill="${color('rose-ink')}"/>`);
      if (right.killed > right.twice) f.emit(`<rect x="${(x0 + right.twice * unit).toFixed(1)}" y="${y - 5}" width="${((right.killed - right.twice) * unit).toFixed(1)}" height="10" fill="${color('teal-ink')}"/>`);
      f.text(x0 + 29, y + 4, String(right.twice), { size: 11, hue: right.twice ? 'rose' : 'ink-soft' });
    });
    f.text(20, 70 + r * 30, `${saver} ${mode}`, { size: 11.5, hue: mode === 'sync' ? 'teal' : 'ink' });
  });
  f.rule(20, 141, 620, 141, { hue: 'ink-mute', dash: 'dashed' });
  f.text(20, 264, '1 before_tool   2 inside_tool   3 before_put_writes   4 before_put   5 after_tool', { size: 11, hue: 'ink-soft' });
  f.dot(26, 290, { hue: 'rose', r: 3.2 });
  f.text(36, 294, 'charged twice', { size: 11, serif: true, hue: 'rose' });
  f.dot(140, 290, { hue: 'teal', r: 3.2 });
  f.text(150, 294, 'charged once', { size: 11, serif: true, hue: 'teal' });
  hollow(f, 250, 290, 2.8);
  f.text(260, 294, 'not killed, exit mode never reached it', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 318, `Totals: graph ${mac.graph.twice} of ${mac.graph.trials}, agent ${none.twice} of ${none.killed} killed with no key.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 334, `Keyed on the thread and order id: graph ${mac.graph_idempotent.twice} of ${mac.graph_idempotent.trials}, agent ${order.twice} of ${order.killed} killed.`, { size: 11, serif: true, hue: 'ink-soft' });
});
