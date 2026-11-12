'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const lab = name => fs.readFileSync(path.join(__dirname, '../../capture/lab/L-gaps/multinode', name), 'utf8').split('\n').filter(Boolean);
const rows = lab('70-stop-after-upload.tsv').map(line => line.split('\t'));
const when = text => Date.parse(text);
const origin = when(rows.find(r => r[1] === 'node-stop')[0]);
const t = text => (when(text) - origin) / 1000;
const stopped = t(rows.find(r => r[1] === 'node-stopped')[0]);
const started = t(rows.find(r => r[1] === 'node-start')[0]);
const probes = rows.filter(r => r[1] === 'probe').map(r => ({ end: t(r[0]), start: t(r[0]) - Number(r[3]), code: r[2], body: r[4], state: r[6] }));
const crashed = probes.find(p => p.state === 'ACTOR_STATE_CRASHED');
const before = probes.filter(p => p.state === 'ACTOR_STATE_RESUMING');
const after = probes.filter(p => p.state === 'ACTOR_STATE_CRASHED');
const timeouts = before.filter(p => p.code === '504').length;
const refused = before.filter(p => p.code === '503').length;
const logTime = line => t(line.match(/"time":"([^".]+\.\d{3})/)[1] + 'Z');
const marked = lab('96-controller-events.log').filter(line => line.includes('marking worker unavailable')).map(logTime).find(v => v > 0);
const drained = lab('98-worker-state-rpcs.log').filter(line => line.includes('/DrainWorker')).map(logTime).find(v => v > 0);
const clock = s => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

const X0 = 132;
const X1 = 612;
const SPAN = 480;
const px = s => X0 + (s / SPAN) * (X1 - X0);

module.exports = figure('fig-4-3b', {
  height: 318,
  title: 'A suspended actor after its node stops',
  desc: `A timeline of ${Math.round(started)} seconds after the node multi-worker2 was stopped, on a cluster with two worker nodes. The actor u1 was suspended on that node with its snapshot complete in the object store. The two workers of the node stay listed as active for ${Math.round(marked)} seconds and are then marked unavailable. Their pods are evicted after ${clock(drained)}. The actor is in the resuming state on the stopped node from the first request, and ${timeouts + refused} requests fail in that time. At ${clock(crashed.end)} the actor is crashed, and the next ${after.length} requests fail at once. The actor never moves to the other node.`,
}, f => {
  const track = (y, name, sub) => {
    f.text(20, y + 10, name, { size: 11.5, weight: 700, hue: 'ink' });
    if (sub) f.text(20, y + 24, sub, { size: 11, serif: true, hue: 'ink-soft' });
  };
  const band = (y, from, to, hue, dash) => f.rect(px(from), y, px(to) - px(from), 14, { hue, dash });

  track(40, 'node', 'multi-worker2');
  band(40, 0, stopped, 'grey');
  band(40, stopped, started, 'rose', 'dashed');
  f.text(px(stopped) + 6, 34, `docker stop, the node is gone after ${Math.round(stopped)} s`, { size: 11, hue: 'rose' });
  f.text(px(started) - 4, 68, `started again at ${clock(started)}`, { size: 11, anchor: 'end', hue: 'ink-soft' });

  track(96, 'its 2 workers', 'in the API list');
  band(96, 0, marked, 'violet');
  band(96, marked, drained, 'rose');
  f.rule(px(marked), 88, px(marked), 118, { hue: 'ink' });
  f.text(px(marked) + 6, 90, `WORKER_STATE_UNAVAILABLE after ${Math.round(marked)} s`, { size: 11, hue: 'rose' });
  f.rule(px(drained), 88, px(drained), 118, { hue: 'ink' });
  f.text(px(drained) - 6, 124, `pods evicted, ${clock(drained)}`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.text(px(0), 124, 'ACTIVE', { size: 11, hue: 'violet' });

  track(152, 'actor u1', 'suspended, sync');
  band(152, 0, before[0].start, 'teal');
  band(152, before[0].start, crashed.end, 'amber');
  band(152, crashed.end, started, 'rose');
  f.text(px(before[0].start) + 6, 146, `RESUMING on the stopped node, ${clock(crashed.end - before[0].start)}`, { size: 11, hue: 'amber' });
  f.rule(px(crashed.end), 150, px(crashed.end), 174, { hue: 'ink' });
  f.text(px(crashed.end) - 6, 180, `ACTOR_STATE_CRASHED at ${clock(crashed.end)}`, { size: 11, anchor: 'end', hue: 'rose' });

  track(208, 'requests', 'one bar for each');
  for (const p of probes) f.rect(px(p.start), 208, Math.max(1.2, px(p.end) - px(p.start)), 14, { fill: color('rose-ink'), stroke: 'none' });
  f.text(px(before[0].start), 238, `${timeouts} times 504 after 10 s, ${refused} times 503`, { size: 11, hue: 'rose' });
  f.text(px(before[0].start), 252, 'actor lab-n/u1 unavailable', { size: 11, hue: 'rose' });
  f.text(X1, 238, `${after.length} times 503 at once`, { size: 11, anchor: 'end', hue: 'rose' });
  f.text(X1, 252, 'AssignWorker prerequisite not met', { size: 11, anchor: 'end', hue: 'rose' });

  f.rule(px(0), 272, px(SPAN), 272, { hue: 'ink' });
  for (let s = 0; s <= SPAN; s += 60) {
    f.rule(px(s), 268, px(s), 276, { hue: 'ink' });
    f.text(px(s), 290, s === 0 ? '0' : `${s / 60} min`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(20, 310, 'Time from the stop command. The other node had two active workers with room.', { size: 11, serif: true, hue: 'ink-soft' });
});
