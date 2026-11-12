'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const outages = load(path.join(__dirname, '../../capture/lab/summary/dependency-loss-x86.json')).outages;
const panels = [
  { key: 'postgres', name: 'Postgres away' },
  { key: 'ate-api-server', name: 'ate-api-server away' },
  { key: 'kube-apiserver', name: 'kube-apiserver away' },
];
const streams = [
  { key: 'running', name: 'running actor', span: 1 },
  { key: 'suspended', name: 'new resume', span: 5 },
  { key: 'proxy', name: 'through proxy', span: 1 },
];
const LEFT = 118;
const SCALE = 3.4;
const FIRST = -10;
const LAST = 135;
const px = t => LEFT + (Math.min(Math.max(t, FIRST), LAST) - FIRST) * SCALE;

function runs(points, span) {
  const sorted = points.slice().sort((a, b) => a.t - b.t);
  const out = [];
  sorted.forEach((point, index) => {
    const next = sorted[index + 1];
    const end = next ? Math.min(next.t, point.t + span) : point.t + span;
    const last = out[out.length - 1];
    if (last && last.ok === point.ok && Math.abs(last.end - point.t) < 0.01) last.end = end;
    else out.push({ start: point.t, end, ok: point.ok });
  });
  return out;
}

module.exports = figure('fig-8-2', {
  height: 356,
  title: 'Three outages, second by second',
  desc: 'Three panels, one for each dependency that was taken away: Postgres for 61 seconds, ate-api-server for 60 seconds, and the Kubernetes API server for 86 seconds. Requests to a running actor and new resumes fail in the first two panels and all succeed in the third, where only requests through kubectl ate proxy fail.',
}, f => {
  f.rect(20, 14, 12, 8, { fill: color('green-ink'), stroke: 'none' });
  f.text(38, 22, 'request returned 200', { size: 11, hue: 'ink-soft' });
  f.rect(190, 14, 12, 8, { fill: color('rose-ink'), stroke: 'none' });
  f.text(208, 22, 'request failed', { size: 11, hue: 'ink-soft' });
  f.rect(320, 12, 12, 12, { hue: 'grey', stroke: 'none' });
  f.text(338, 22, 'dependency away', { size: 11, hue: 'ink-soft' });
  f.rule(468, 12, 468, 24, { hue: 'ink', dash: 'dashed' });
  f.text(476, 22, 'ready again', { size: 11, hue: 'ink-soft' });

  panels.forEach((panel, index) => {
    const data = outages[panel.key];
    const top = 44 + index * 96;
    f.kicker(20, top + 4, `${panel.name}, ${data.outage_seconds} s`);
    f.rect(px(0), top + 10, px(data.outage_seconds) - px(0), 62, { hue: 'grey', stroke: 'none' });
    streams.forEach((stream, row) => {
      const y = top + 18 + row * 18;
      f.text(20, y + 9, stream.name, { size: 11, serif: true, hue: 'ink-soft' });
      for (const run of runs(data.per_second[stream.key], stream.span)) {
        const x1 = px(run.start);
        const x2 = px(run.end);
        if (x2 - x1 < 0.5) continue;
        f.rect(x1, y, x2 - x1, 10, { fill: color(run.ok ? 'green-ink' : 'rose-ink'), stroke: 'none' });
      }
    });
    f.rule(px(data.dependency_ready_t), top + 10, px(data.dependency_ready_t), top + 72, { hue: 'ink', dash: 'dashed' });
  });

  f.rule(px(FIRST), 326, px(LAST), 326, { hue: 'ink' });
  for (const t of [0, 30, 60, 90, 120]) {
    f.rule(px(t), 322, px(t), 330, { hue: 'ink' });
    f.text(px(t), 344, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
});
