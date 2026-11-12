'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/kagent-turns-x86.json'));
const seconds = value => `${value.toFixed(3)} s`;
const bars = [
  { name: 'resume', value: data.resume_seconds.turns_only.median, hue: 'amber' },
  { name: 'suspend', value: data.suspend_seconds.median, hue: 'amber' },
  { name: 'turn, 4 s apart', value: data.server_turn_seconds['A-spaced'].median, hue: 'plum' },
  { name: 'turn, no pause', value: data.server_turn_seconds['B-b2b'].median, hue: 'plum' },
  { name: 'first turn', value: data.server_turn_seconds['C-first'].median, hue: 'plum' },
].map(bar => ({ ...bar, label: seconds(bar.value) }));

module.exports = figure('fig-7-1b', {
  height: 320,
  title: 'A kagent turn costs the same with a pause and with no pause',
  desc: `Five bars of median seconds from our kagent run with a mock model. Resume ${seconds(bars[0].value)}, suspend ${seconds(bars[1].value)}, a turn 4 seconds after the last one ${seconds(bars[2].value)}, a turn with no pause ${seconds(bars[3].value)}, and the first turn of a new Session ${seconds(bars[4].value)}.`,
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 200, xDomain: [0, 1], yDomain: [0, 1], yTicks: [0, 0.5, 1], yLabel: 'median seconds, with a mock model' });
  c.bars(bars, { width: 56 });
  f.text(66, 300, 'amber: the two state changes of each turn. plum: the whole turn, as kagent reports it.', { size: 11, serif: true, hue: 'ink-soft' });
});
