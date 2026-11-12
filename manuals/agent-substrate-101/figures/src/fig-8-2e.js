'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const file = name => load(path.join(__dirname, '../../capture/lab/summary', name)).outages;
const sides = [
  { name: 'Envoy', outages: file('dependency-loss-x86.json') },
  { name: 'agentgateway', outages: file('dependency-loss-agw-x86.json') },
];
const panels = [
  { key: 'postgres', name: 'Postgres away' },
  { key: 'ate-api-server', name: 'ate-api-server away' },
  { key: 'kube-apiserver', name: 'kube-apiserver away' },
];
const LEFT = 118;
const SCALE = 2.2;
const FIRST = -10;
const LAST = 120;
const px = t => LEFT + (Math.min(Math.max(t, FIRST), LAST) - FIRST) * SCALE;
const stream = (side, key) => side.outages[key].summary.running;

function spans(points) {
  const sorted = points.slice().sort((a, b) => a.t - b.t);
  const out = [];
  sorted.forEach((point, index) => {
    const next = sorted[index + 1];
    const end = next ? next.t : point.t + 1;
    const last = out[out.length - 1];
    if (last && last.ok === point.ok) last.end = end;
    else out.push({ start: point.t, end, ok: point.ok });
  });
  return out;
}

function note(side, key) {
  const s = stream(side, key);
  if (s.first_failure_t === null) return `${s.ok_during_outage} of ${s.requests_during_outage} served`;
  return `failed from ${s.first_failure_t} s to ${s.last_failure_t} s`;
}

module.exports = figure('fig-8-2e', {
  height: 318,
  title: 'The running actor in three outages, on each dataplane',
  desc: `Three panels, one for each dependency that was taken away, with one row for the Envoy dataplane and one for agentgateway. Each row is one request each second to a running actor from a pod in the cluster. Without Postgres the first failure came at ${stream(sides[0], 'postgres').first_failure_t} seconds on Envoy and at ${stream(sides[1], 'postgres').first_failure_t} seconds on agentgateway, and the last failure came at ${stream(sides[0], 'postgres').last_failure_t} and ${stream(sides[1], 'postgres').last_failure_t} seconds, with Postgres ready at ${sides[0].outages.postgres.dependency_ready_t} and ${sides[1].outages.postgres.dependency_ready_t} seconds. Without ate-api-server the failures ran from ${stream(sides[0], 'ate-api-server').first_failure_t} to ${stream(sides[0], 'ate-api-server').last_failure_t} seconds on Envoy and from ${stream(sides[1], 'ate-api-server').first_failure_t} to ${stream(sides[1], 'ate-api-server').last_failure_t} seconds on agentgateway. Without the Kubernetes API server no request failed on either dataplane.`,
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
    const top = 46 + index * 76;
    f.kicker(20, top + 4, panel.name, { hue: 'ink-soft' });
    sides.forEach((side, row) => {
      const data = side.outages[panel.key];
      const y = top + 16 + row * 22;
      f.rect(px(0), y - 3, px(data.outage_seconds) - px(0), 16, { hue: 'grey', stroke: 'none' });
      f.text(20, y + 9, side.name, { size: 11, serif: true, hue: 'ink-soft' });
      for (const run of spans(data.per_second.running)) {
        const x1 = px(run.start);
        const x2 = px(run.end);
        if (x2 - x1 < 0.5) continue;
        f.rect(x1, y, x2 - x1, 10, { fill: color(run.ok ? 'green-ink' : 'rose-ink'), stroke: 'none' });
      }
      f.rule(px(data.dependency_ready_t), y - 3, px(data.dependency_ready_t), y + 13, { hue: 'ink', dash: 'dashed' });
      const failed = stream(side, panel.key).first_failure_t !== null;
      f.text(px(LAST) + 12, y + 9, note(side, panel.key), { size: 11, hue: failed ? 'rose' : 'green' });
    });
  });

  f.rule(px(FIRST), 274, px(LAST), 274, { hue: 'ink' });
  for (const t of [0, 30, 60, 90, 120]) {
    f.rule(px(t), 270, px(t), 278, { hue: 'ink' });
    f.text(px(t), 292, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(px(FIRST), 310, 'seconds since the dependency went away, one run for each dataplane', { size: 11.5, serif: true, hue: 'ink-soft' });
});
