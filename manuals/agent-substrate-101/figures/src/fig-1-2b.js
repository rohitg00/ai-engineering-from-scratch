'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const trace = fs.readFileSync(path.join(__dirname, '../../capture/lab/B-lifecycle/10-trace.tsv'), 'utf8').trim().split('\n').map(line => line.split('\t'));
const seconds = text => Date.parse(text) / 1000;
const calls = trace.filter(row => /^call-/.test(row[1])).map(row => ({ name: row[1], seconds: Number(row[3]) }));
const start = seconds(trace.find(row => row[1] === 'idle-watch-start')[0]);
const end = seconds(trace.find(row => row[1] === 'idle-watch-end')[0]);
const watch = trace.filter(row => row[1] === 'state' && seconds(row[0]) > start && seconds(row[0]) < end).map(row => ({ t: seconds(row[0]) - start, state: row[2] }));
const running = watch.filter(sample => sample.state === 'ACTOR_STATE_RUNNING');
const warm = calls.slice(1, 5).map(call => call.seconds).sort((a, b) => a - b);
const typical = (warm[1] + warm[2]) / 2;
const extra = calls[0].seconds - typical;
const last = calls[calls.length - 1];
const label = name => (name === 'call-after-idle' ? 'request 6' : name.replace('call-', 'request '));

module.exports = figure('fig-1-2b', {
  height: 336,
  title: 'Six requests to my-counter-1, and its state in the 900 seconds between the last two',
  desc: `The upper part has six horizontal bars with the client time of each request through kubectl ate proxy on the x86 server guest: ${calls.map(call => `${label(call.name)} ${call.seconds.toFixed(3)} s`).join(', ')}. The first bar is amber because it includes the resume from the golden snapshot, which adds about ${extra.toFixed(2)} s. The other bars are green because the actor was already running. The lower part is a time axis of the ${Math.round(end - start)} seconds with no request between request 5 and request 6. It has one dot for each of the ${watch.length} state samples, and all ${running.length} are in the row ACTOR_STATE_RUNNING. The row ACTOR_STATE_SUSPENDED is empty.`,
}, f => {
  const x0 = 170;
  const scale = 1000;
  const px = value => x0 + value * scale;
  f.kicker(20, 18, 'client time of each request');
  calls.forEach((call, index) => {
    const y = 30 + index * 22;
    const hue = index === 0 ? 'amber' : 'green';
    f.text(x0 - 10, y + 12, label(call.name), { size: 11.5, anchor: 'end' });
    f.rect(x0, y, call.seconds * scale, 15, { fill: color(`${hue}-ink`), stroke: 'none' });
    f.text(px(call.seconds) + 8, y + 12, `${call.seconds.toFixed(3)} s`, { size: 11.5, hue, weight: index === 0 ? 700 : undefined });
  });
  f.text(x0 - 10, 30 + 5 * 22 + 26, 'after 900 s idle', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.rule(px(typical), 26, px(typical), 166, { hue: 'ink', dash: 'dashed' });
  const nx = px(0.15);
  f.leader([nx + 60, 80], [nx + 60, 46], { hue: 'amber' });
  f.text(nx, 94, `about ${extra.toFixed(2)} s more than requests 2 to 5:`, { size: 11, serif: true, hue: 'amber' });
  f.text(nx, 108, 'the resume from the golden snapshot', { size: 11, serif: true, hue: 'amber' });
  f.rule(nx, 136, nx + 20, 136, { hue: 'ink', dash: 'dashed' });
  f.text(nx + 28, 140, `${typical.toFixed(3)} s, the median of requests 2 to 5`, { size: 11, serif: true, hue: 'ink-soft' });

  f.rule(x0, 166, px(0.4), 166, { hue: 'ink' });
  f.rule(x0, 26, x0, 166, { hue: 'ink' });
  for (const tick of [0, 0.1, 0.2, 0.3, 0.4]) {
    f.rule(px(tick), 166, px(tick), 170, { hue: 'ink' });
    f.text(px(tick), 183, tick === 0 ? '0' : tick.toFixed(1), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(px(0.4) + 12, 183, 'seconds', { size: 11.5, serif: true, hue: 'ink-soft' });

  const t0 = 170;
  const t1 = 600;
  const span = 930;
  const tx = value => t0 + (value / span) * (t1 - t0);
  f.kicker(20, 216, 'state of my-counter-1 between request 5 and request 6');
  f.text(620, 216, `${running.length} of ${watch.length} samples`, { size: 11.5, weight: 700, hue: 'green', anchor: 'end' });
  const rowY = { ACTOR_STATE_RUNNING: 252, ACTOR_STATE_SUSPENDED: 276 };
  f.rule(t0, rowY.ACTOR_STATE_RUNNING, t1, rowY.ACTOR_STATE_RUNNING, { hue: 'ink-mute', opacity: 0.25 });
  f.rule(t0, rowY.ACTOR_STATE_SUSPENDED, t1, rowY.ACTOR_STATE_SUSPENDED, { hue: 'ink-mute', opacity: 0.25 });
  f.text(t0 - 10, rowY.ACTOR_STATE_RUNNING + 4, 'ACTOR_STATE_RUNNING', { size: 11, anchor: 'end', weight: 700, hue: 'green' });
  f.text(t0 - 10, rowY.ACTOR_STATE_SUSPENDED + 4, 'ACTOR_STATE_SUSPENDED', { size: 11, anchor: 'end', hue: 'ink-mute' });
  for (const sample of watch) f.dot(tx(sample.t), rowY[sample.state], { hue: sample.state === 'ACTOR_STATE_RUNNING' ? 'green' : 'amber', r: 2.6 });
  f.text((t0 + t1) / 2, rowY.ACTOR_STATE_SUSPENDED + 4, `${watch.length - running.length} samples: no idle timer suspended the actor`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', knock: true });

  f.rule(tx(0), 230, tx(0), 290, { hue: 'ink' });
  f.rule(tx(end - start), 230, tx(end - start), 290, { hue: 'ink' });
  f.text(tx(0) + 6, 238, 'request 5', { size: 11, hue: 'ink-soft' });
  f.text(tx(end - start) - 6, 238, `request 6, ${last.seconds.toFixed(3)} s`, { size: 11, hue: 'ink-soft', anchor: 'end' });
  f.rule(t0, 290, t1, 290, { hue: 'ink' });
  for (let tick = 0; tick <= 900; tick += 150) {
    f.rule(tx(tick), 290, tx(tick), 294, { hue: 'ink' });
    f.text(tx(tick), 307, String(tick), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((t0 + t1) / 2, 326, 'seconds with no request, one state sample every 15 s', { size: 11.5, serif: true, hue: 'ink-soft', anchor: 'middle' });
});
