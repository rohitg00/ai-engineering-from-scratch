'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const outages = load(path.join(__dirname, '../../capture/lab/summary/dependency-loss-x86.json')).outages;
const FIRST = -10;
const LAST = 100;
const TOP = 118;
const HEIGHT = 168;
const WIDTH = 172;
const panels = ['postgres', 'ate-api-server', 'kube-apiserver'].map((key, index) => {
  const points = outages[key].per_second.running.filter(point => point.t >= FIRST && point.t <= LAST).sort((a, b) => a.t - b.t);
  const failed = points.filter(point => !point.ok);
  const served = points.filter(point => point.ok);
  const sorted = served.map(point => point.seconds).sort((a, b) => a - b);
  return { key, x: 52 + index * 196, data: outages[key], failed, served, slowest: failed.length ? Math.max(...failed.map(point => point.seconds)) : 0, median: sorted[Math.floor(sorted.length / 2)] };
});
function stretches(points) {
  const out = [];
  points.forEach((point, index) => {
    if (index && point.t - points[index - 1].t <= 2) out[out.length - 1].push(point);
    else out.push([point]);
  });
  return out;
}

const names = { postgres: 'Postgres away', 'ate-api-server': 'ate-api-server away', 'kube-apiserver': 'kube-apiserver away' };
const codes = panel => [...new Set(panel.failed.map(point => point.code))];

module.exports = figure('fig-8-2c', {
  height: 352,
  title: 'How long each request to a running actor took during the three outages',
  desc: `Three panels plot the seconds until the answer for every request to the running actor e-run, one request each second. Without Postgres, each failed request took ${panels[0].slowest.toFixed(1)} seconds, the client timeout, and the requests that were open when Postgres returned got a 500. Without ate-api-server, each failed request got a 503 after at most ${panels[1].slowest.toFixed(2)} seconds. Without the Kubernetes API server, every request returned 200 in about ${panels[2].median.toFixed(2)} seconds.`,
}, f => {
  f.dot(26, 18, { hue: 'rose', r: 3 });
  f.text(36, 22, 'one failed request', { size: 11, hue: 'ink-soft' });
  f.path('M186 18 H204', { hue: 'green', head: false, width: 2, packet: false });
  f.text(210, 22, 'requests that returned 200', { size: 11, hue: 'ink-soft' });
  f.rule(420, 12, 420, 24, { hue: 'ink', dash: 'dashed' });
  f.text(428, 22, 'ready again', { size: 11, hue: 'ink-soft' });

  panels.forEach((panel, index) => {
    const scale = WIDTH / (LAST - FIRST);
    const x0 = panel.x + (0 - FIRST) * scale;
    f.rect(x0, TOP, panel.data.outage_seconds * scale, HEIGHT, { hue: 'grey', stroke: 'none' });
    const c = chart(f, { x: panel.x, y: TOP, w: WIDTH, h: HEIGHT, xDomain: [FIRST, LAST], yDomain: [0, 10], xTicks: [0, 30, 60, 90], yTicks: [0, 3, 6, 9], xFormat: t => `${t}`, yLabel: index ? undefined : 'seconds until the answer' });
    f.kicker(panel.x, 48, names[panel.key], { hue: 'ink-soft' });
    f.rule(c.px(panel.data.dependency_ready_t), TOP, c.px(panel.data.dependency_ready_t), TOP + HEIGHT, { hue: 'ink', dash: 'dashed' });
    for (const run of stretches(panel.served)) c.series(run.map(point => [point.t, point.seconds]), { hue: 'green', dots: run.length === 1, width: 2.2, r: 2 });
    for (const point of panel.failed) f.dot(c.px(point.t), c.py(point.seconds), { hue: 'rose', r: 2 });
    panel.c = c;
  });

  const [pg, api, kube] = panels;
  const lines = [
    [pg, 'rose', `code 000: a timeout at ${pg.slowest.toFixed(0)} s,`, `then ${pg.failed.filter(point => point.code === '500').length} requests got a 500`],
    [api, 'rose', `${codes(api).join(', ')} after 0.5 to ${api.slowest.toFixed(2)} s:`, 'the parking budget of the router'],
    [kube, 'green', 'every request returned 200', `in about ${kube.median.toFixed(2)} s`],
  ];
  for (const [panel, hue, first, second] of lines) {
    f.text(panel.x, 64, first, { size: 11, serif: true, hue });
    f.text(panel.x, 79, second, { size: 11, serif: true, hue });
  }
  f.text(320, 340, 'second in which the request was sent, counted from the loss of the dependency', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
