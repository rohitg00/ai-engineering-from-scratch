'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/lab/summary/demos-x86.json')).idle_suspender;
const END = 600;
const X0 = 136;
const X1 = 616;
const px = t => X0 + (Math.min(Math.max(t, 0), END) / END) * (X1 - X0);
const actors = ['busy', 'bursty', 'rare'];
const requests = run.requests.filter(request => request.t <= END);
const suspends = run.suspends.filter(suspend => suspend.t <= END);
const spans = name => {
  const out = [];
  let start = null;
  const events = [
    ...requests.filter(r => r.actor === name && r.kind === 'resumed').map(r => ({ t: r.t - r.seconds, on: true })),
    ...suspends.filter(s => s.actor === name).map(s => ({ t: s.t, on: false })),
  ].sort((a, b) => a.t - b.t);
  for (const event of events) {
    if (event.on && start === null) start = event.t;
    if (!event.on && start !== null) { out.push([start, event.t]); start = null; }
  }
  if (start !== null) out.push([start, END]);
  return out;
};
const one = run.capacity.filter(sample => sample.t <= END && sample.millicores === 1000).length;
const samples = run.capacity.filter(sample => sample.t <= END).length;

module.exports = figure('fig-9-1b', {
  height: 326,
  title: 'Three actors share room for two, for ten minutes',
  desc: `A timeline of ${END} seconds on the second x86 server guest. The worker has room for two actors of one CPU each. The actor busy gets a request each 5 seconds and runs for the whole time. The actor bursty gets five requests each 150 seconds, and the suspender suspends it ${suspends.filter(s => s.actor === 'bursty').length} times after 30 quiet seconds. The actor rare gets two requests and is suspended ${suspends.filter(s => s.actor === 'rare').length} times. All ${requests.length} requests returned 200. The worker had one CPU booked in ${one} of ${samples} samples and two in the rest.`,
}, f => {
  const top = 40;
  f.text(16, top + 16, 'CPU booked', { size: 12, weight: 700 });
  f.text(16, top + 31, 'of 2 CPUs', { size: 11, serif: true, hue: 'ink-soft' });
  const cap = run.capacity.filter(sample => sample.t <= END);
  cap.forEach((sample, index) => {
    const next = index + 1 < cap.length ? cap[index + 1].t : END;
    const h = sample.millicores / 2000 * 30;
    f.rect(px(sample.t), top + 34 - h, px(next) - px(sample.t), h, { fill: color('violet-fill'), stroke: 'none' });
  });
  f.rule(X0, top + 34, X1, top + 34, { hue: 'violet' });
  f.rule(X0, top + 4, X1, top + 4, { hue: 'violet', dash: 'dashed', opacity: 0.6 });
  f.text(X1, top - 4, '2 CPUs, the pool is full', { size: 11, hue: 'violet', anchor: 'end' });

  actors.forEach((name, index) => {
    const y = 108 + index * 48;
    f.text(16, y + 12, name, { size: 12, weight: 700 });
    f.text(16, y + 27, `${requests.filter(r => r.actor === name).length} requests`, { size: 11, serif: true, hue: 'ink-soft' });
    f.rule(X0, y + 8, X1, y + 8, { hue: 'ink-mute', opacity: 0.3 });
    for (const [a, b] of spans(name)) f.rect(px(a), y, px(b) - px(a), 16, { fill: color('green-fill'), stroke: color('green-ink') });
    for (const r of requests.filter(q => q.actor === name)) f.dot(px(r.t), y + 8, { hue: r.kind === 'resumed' ? 'ink' : 'green', r: r.kind === 'resumed' ? 2.6 : 1.3 });
    for (const s of suspends.filter(q => q.actor === name)) f.rule(px(s.t), y - 5, px(s.t), y + 21, { hue: 'amber', width: 2 });
  });
  const axis = 258;
  f.rule(X0, axis, X1, axis, { hue: 'ink' });
  for (let t = 0; t <= END; t += 60) {
    f.rule(px(t), axis, px(t), axis + 5, { hue: 'ink' });
    f.text(px(t), axis + 18, String(t / 60), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((X0 + X1) / 2, axis + 36, 'minutes from the first request', { size: 11.5, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.rule(X0, axis + 50, X0, axis + 62, { hue: 'amber', width: 2 });
  f.text(X0 + 8, axis + 60, 'suspend after 30 quiet seconds', { size: 11, hue: 'amber' });
  f.dot(X0 + 250, axis + 56, { hue: 'ink', r: 2.6 });
  f.text(X0 + 258, axis + 60, 'request that resumed the actor', { size: 11 });
});
