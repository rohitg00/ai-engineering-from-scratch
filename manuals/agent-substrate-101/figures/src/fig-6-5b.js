'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/rotation-x86.json')).dataplanes;
const agw = runs.agentgateway;
const envoy = runs.envoy;
const cycle = agw.seconds_between_first_seen;
const one = value => value.toFixed(1);
const list = side => side.changes.map(item => `${one(item.seconds)}`).join(', ');
const old = side => side.changes.map(item => item.requests_with_old_value).join(', ');

module.exports = figure('fig-6-5b', {
  height: 330,
  title: 'Seconds until the upstream saw a changed credential',
  desc: `A chart with a logarithmic time axis. The Kubernetes Secret behind one replaceHeaders rule was changed three times on each dataplane, with one request each second from one actor. On agentgateway the upstream saw the new value after ${list(agw)} seconds, and ${old(agw)} requests still carried the old value. On Envoy it took ${list(envoy)} seconds, and ${old(envoy)} requests carried the old value. The three first-seen times on agentgateway are ${cycle.map(v => Math.round(v)).join(' and ')} seconds apart. No request failed on either dataplane, in ${agw.probe_requests} and ${envoy.probe_requests} requests.`,
}, f => {
  const c = chart(f, { x: 60, y: 40, w: 380, h: 230, xDomain: [0.5, 3.5], yDomain: [0.5, 500], yScale: 'log10', xTicks: [1, 2, 3], yTicks: [1, 10, 100, 300], xFormat: v => `change ${v}`, yFormat: v => `${v} s`, xLabel: 'changes of the Kubernetes Secret, in order', yLabel: 'seconds until the upstream saw the new value, log scale' });
  f.rule(c.px(0.5), c.py(300), c.px(3.5), c.py(300), { hue: 'rose', dash: 'dashed' });
  c.series(agw.changes.map(item => [item.change, item.seconds]), { hue: 'indigo', name: 'agentgateway', r: 3.4 });
  c.series(envoy.changes.map(item => [item.change, item.seconds]), { hue: 'indigo', name: 'Envoy', dash: 'dashed', r: 3.4 });
  for (const item of agw.changes) f.text(c.px(item.change), c.py(item.seconds) + 18, `${one(item.seconds)} s`, { size: 11, anchor: 'middle', hue: 'indigo', knock: true });
  for (const item of envoy.changes) f.text(c.px(item.change), c.py(item.seconds) - 9, `${one(item.seconds)} s`, { size: 11, anchor: 'middle', hue: 'indigo', knock: true });

  f.text(456, c.py(agw.changes[2].seconds) + 22, 'agentgateway', { size: 11.5, weight: 700, hue: 'indigo' });
  f.text(456, c.py(agw.changes[2].seconds) + 37, `old value in ${old(agw)}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(456, c.py(agw.changes[2].seconds) + 51, 'requests after the change', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(456, c.py(envoy.changes[2].seconds) + 4, 'Envoy', { size: 11.5, weight: 700, hue: 'indigo' });
  f.text(456, c.py(envoy.changes[2].seconds) + 19, `old value in ${old(envoy)}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(456, c.py(envoy.changes[2].seconds) + 33, 'requests after the change', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(456, c.py(300) + 4, '300 s', { size: 11.5, weight: 700, hue: 'rose' });
  f.text(456, c.py(300) + 19, `new values appeared ${Math.round(cycle[0])} s`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(456, c.py(300) + 33, 'apart on agentgateway', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(60, 322, `One request each second. No request failed: ${agw.probe_requests} on agentgateway and ${envoy.probe_requests} on Envoy.`, { size: 11, serif: true, hue: 'ink-soft' });
});
