'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const outages = load(path.join(__dirname, '../../capture/lab/summary/dependency-loss-x86.json')).outages;
const lag = key => outages[key].summary.suspended.last_failure_t - outages[key].dependency_ready_t;
const kube = outages['kube-apiserver'].summary;
const panels = [
  { key: 'postgres', name: 'Postgres away', sign: `a timeout at 9 s, then 500. New resumes fail for ${lag('postgres')} s after ready.` },
  { key: 'ate-api-server', name: 'ate-api-server away', sign: '503 within 5 s. The router finds the new pods by itself.' },
  { key: 'kube-apiserver', name: 'kube-apiserver away', sign: `${kube.running.ok_during_outage} of ${kube.running.requests_during_outage} requests and ${kube.suspended.ok_during_outage} of ${kube.suspended.requests_during_outage} new resumes served.` },
];
const streams = [
  { key: 'running', name: 'running actor', span: 1 },
  { key: 'suspended', name: 'new resume', span: 5 },
  { key: 'proxy', name: 'through proxy', span: 1 },
];
const LEFT = 118;
const SCALE = 3.3;
const FIRST = -10;
const LAST = 120;
const px = t => LEFT + (Math.min(Math.max(t, FIRST), LAST) - FIRST) * SCALE;

function runs(points, span) {
  const sorted = points.slice().sort((a, b) => a.t - b.t);
  const out = [];
  sorted.forEach((point, index) => {
    const next = sorted[index + 1];
    const end = next ? next.t : point.t + span;
    const last = out[out.length - 1];
    if (last && last.ok === point.ok) last.end = end;
    else out.push({ start: point.t, end, ok: point.ok });
  });
  return out;
}

module.exports = figure('fig-8-2', {
  height: 392,
  title: 'Three outages, second by second',
  desc: 'Three panels, one for each dependency that was taken away: Postgres for 61 seconds, ate-api-server for 60 seconds, and the Kubernetes API server for 86 seconds. Requests to a running actor and new resumes fail in the first two panels and all succeed in the third, where only requests through kubectl ate proxy fail. The count of failed requests is at the end of each row.',
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
    const top = 46 + index * 100;
    f.kicker(20, top + 4, `${panel.name}, ${data.outage_seconds} s`, { hue: 'ink-soft' });
    f.text(620, top + 4, panel.sign, { size: 11, serif: true, anchor: 'end', hue: 'ink-soft' });
    f.rect(px(0), top + 12, px(data.outage_seconds) - px(0), 64, { hue: 'grey', stroke: 'none' });
    streams.forEach((stream, row) => {
      const y = top + 20 + row * 18;
      const points = data.per_second[stream.key];
      const failed = points.filter(point => !point.ok).length;
      f.text(20, y + 9, stream.name, { size: 11, serif: true, hue: 'ink-soft' });
      for (const run of runs(points, stream.span)) {
        const x1 = px(run.start);
        const x2 = px(run.end);
        if (x2 - x1 < 0.5) continue;
        f.rect(x1, y, x2 - x1, 10, { fill: color(run.ok ? 'green-ink' : 'rose-ink'), stroke: 'none' });
      }
      f.text(620, y + 9, `${failed} failed`, { size: 11, anchor: 'end', weight: failed ? 700 : undefined, hue: failed ? 'rose' : 'green' });
    });
    f.rule(px(data.dependency_ready_t), top + 12, px(data.dependency_ready_t), top + 76, { hue: 'ink', dash: 'dashed' });
  });

  f.rule(px(FIRST), 344, px(LAST), 344, { hue: 'ink' });
  for (const t of [0, 30, 60, 90, 120]) {
    f.rule(px(t), 340, px(t), 348, { hue: 'ink' });
    f.text(px(t), 362, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((px(FIRST) + px(LAST)) / 2, 380, 'seconds since the dependency went away', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
