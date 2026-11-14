'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/crash-resume-mac.json'));
const rowsOf = [['sqlite', 'sync'], ['sqlite', 'async'], ['sqlite', 'exit'], ['postgres', 'sync'], ['postgres', 'async'], ['postgres', 'exit']];
const points = ['before_tool', 'inside_tool', 'before_put_writes', 'before_put', 'after_tool'];
const panels = [{ key: 'graph', x: 140, title: 'graph' }, { key: 'agent', x: 390, title: 'agent' }];
const colW = 48;

module.exports = figure('fig-4-3', {
  height: 330,
  title: 'Crash trials that ran the side effect twice',
  desc: `A grid of dots, one dot per trial, five per cell, for six rows of saver and durability mode and five kill points, in two panels for the graph and the agent. Rose dots ran the side effect twice: ${data.graph.twice} of ${data.graph.trials} graph trials and ${data.agent.twice} of ${data.agent.trials} agent trials. Every trial killed inside the effect ran it twice, and sync with a kill after the step ran it once on both savers.`,
}, f => {
  panels.forEach(panel => {
    f.kicker(panel.x, 20, panel.title);
    points.forEach((_, k) => f.text(panel.x + k * colW + colW / 2, 42, String(k + 1), { size: 11, anchor: 'middle', weight: 700 }));
    rowsOf.forEach(([saver, mode], r) => {
      const y = 66 + r * 30;
      points.forEach((point, k) => {
        const cell = data[panel.key].cells[`${saver} ${mode} ${point}`];
        const cx = panel.x + k * colW + 8;
        for (let t = 0; t < 5; t += 1) {
          const x = cx + t * 8;
          if (t < cell.twice) f.dot(x, y, { hue: 'rose', r: 3.2 });
          else if (t < cell.killed) f.dot(x, y, { hue: 'teal', r: 3.2 });
          else f.emit(`<circle cx="${x}" cy="${y}" r="2.8" fill="${color('paper')}" stroke="${color('ink-mute')}" stroke-width="1"/>`);
        }
      });
    });
  });
  rowsOf.forEach(([saver, mode], r) => f.text(20, 70 + r * 30, `${saver} ${mode}`, { size: 11.5, hue: mode === 'sync' ? 'teal' : 'ink' }));
  f.rule(20, 141, 620, 141, { hue: 'ink-mute', dash: 'dashed' });
  f.text(20, 264, '1 before_tool   2 inside_tool   3 before_put_writes   4 before_put   5 after_tool', { size: 11, hue: 'ink-soft' });
  f.dot(26, 290, { hue: 'rose', r: 3.2 });
  f.text(36, 294, 'ran twice', { size: 11, serif: true, hue: 'rose' });
  f.dot(120, 290, { hue: 'teal', r: 3.2 });
  f.text(130, 294, 'ran once', { size: 11, serif: true, hue: 'teal' });
  f.emit(`<circle cx="210" cy="290" r="2.8" fill="${color('paper')}" stroke="${color('ink-mute')}" stroke-width="1"/>`);
  f.text(220, 294, 'not killed, exit mode never reached it', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 318, `Totals: graph ${data.graph.twice} of ${data.graph.trials}, agent ${data.agent.twice} of ${data.agent.trials}, graph with a key ${data.graph_idempotent.twice} of ${data.graph_idempotent.trials}. The Mac.`, { size: 11, serif: true, hue: 'ink-soft' });
});
