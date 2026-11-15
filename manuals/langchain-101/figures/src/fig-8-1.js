'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-server-x86-real.json'));
const servers = [
  ['dev-default', 'default, 1 job', 'rose'],
  ['dev-njobs10', '10 jobs per worker', 'indigo'],
];
const levels = [1, 4, 16];
const point = (server, c) => data.load.find(row => row.server === server && row.clients === c);
const runs = data.load.reduce((sum, row) => sum + row.ok, 0);
const errors = data.load.reduce((sum, row) => sum + row.errors, 0);

module.exports = figure('fig-8-1', {
  height: 360,
  title: 'Runs per second under langgraph dev with Qwen3 4B, by concurrent clients',
  desc: `A dot chart of runs per second against concurrent clients, 1, 4, and 16, on a log scale, for langgraph dev on the x86 server guest with a Qwen3 4B agent on CPU, one load run per point. Default of one job per worker: ${levels.map(c => point('dev-default', c).runs_per_s).join(', ')} runs per second. Ten jobs per worker: ${levels.map(c => point('dev-njobs10', c).runs_per_s).join(', ')}. All ${runs} runs answered right, with ${errors} errors.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 380, h: 240, xScale: 'log2', xDomain: [0.8, 20], yDomain: [0, 0.3], xTicks: levels, yTicks: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3], yLabel: 'runs per second', xLabel: 'concurrent clients' });
  const ends = [];
  servers.forEach(([key, name, hue]) => {
    const pts = levels.map(n => [n, point(key, n).runs_per_s]);
    c.series(pts, { hue, r: 3.2 });
    ends.push({ name, hue, y: c.py(pts[pts.length - 1][1]) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  ends.forEach(end => f.text(c.px(20) + 10, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(70, 334, 'Each dot is one load run of the agent graph: 10 runs at 1 and 4 clients, 32 at 16.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 350, 'Ollama served one model call at a time, 0.44 to 0.45 per second from 4 clients up.', { size: 11, serif: true, hue: 'ink-soft' });
});
