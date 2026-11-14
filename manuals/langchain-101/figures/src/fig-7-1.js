'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-server-x86.json'));
const servers = [
  ['dev-default', 'default, 1 job', 'rose'],
  ['dev-njobs10', '10 jobs per worker', 'indigo'],
  ['dev-njobs100', '100 jobs per worker', 'teal'],
];
const levels = [1, 10, 50, 100];
const point = (server, c) => data.load.find(row => row.server === server && row.concurrency === c);

module.exports = figure('fig-7-1', {
  height: 360,
  title: 'Runs per second under langgraph dev, by concurrent clients',
  desc: `A dot chart of runs per second against concurrent clients, 1 to 100, on a log scale, for langgraph dev on the x86 server guest, one load run per point. Default of one job per worker: ${levels.map(c => point('dev-default', c).runs_per_s).join(', ')} runs per second. Ten jobs per worker: ${levels.map(c => point('dev-njobs10', c).runs_per_s).join(', ')}. One hundred jobs per worker: ${levels.map(c => point('dev-njobs100', c).runs_per_s).join(', ')}. No run failed.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 380, h: 240, xScale: 'log10', xDomain: [0.8, 125], yDomain: [0, 60], xTicks: levels, yTicks: [0, 10, 20, 30, 40, 50, 60], yLabel: 'runs per second', xLabel: 'concurrent clients' });
  const ends = [];
  servers.forEach(([key, name, hue]) => {
    const pts = levels.map(n => [n, point(key, n).runs_per_s]);
    c.series(pts, { hue, r: 3.2 });
    ends.push({ name, hue, y: c.py(pts[pts.length - 1][1]) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  ends.forEach(end => f.text(c.px(125) + 10, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(70, 334, 'Each dot is one load run of the agent graph, 50 runs or 5 per client.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 350, 'Every one of the 2,550 runs answered, with no error.', { size: 11, serif: true, hue: 'ink-soft' });
});
