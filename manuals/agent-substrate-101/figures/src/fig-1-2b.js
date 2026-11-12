'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const trace = fs.readFileSync(path.join(__dirname, '../../capture/lab/B-lifecycle/10-trace.tsv'), 'utf8').trim().split('\n').map(line => line.split('\t'));
const calls = trace.filter(row => /^call-/.test(row[1])).map(row => ({ name: row[1], code: row[2], seconds: Number(row[3]) }));
const samples = trace.filter(row => row[1] === 'state').length - 3;
const label = name => (name === 'call-after-idle' ? 'after 900 s idle' : name.replace('call-', 'request '));

module.exports = figure('fig-1-2b', {
  height: 250,
  title: 'Six requests to my-counter-1 through kubectl ate proxy',
  desc: `Six horizontal bars with the client time of each request on the x86 server guest: ${calls.map(call => `${label(call.name)} ${call.seconds.toFixed(3)} s`).join(', ')}. The first bar is amber because it includes the resume from the golden snapshot. The other bars are green because the actor was already running. The actor was in ACTOR_STATE_RUNNING in all ${samples} samples of the idle period.`,
}, f => {
  const x0 = 170;
  const scale = 900;
  f.kicker(20, 18, 'client time of each request, seconds');
  calls.forEach((call, index) => {
    const y = 34 + index * 30;
    const hue = index === 0 ? 'amber' : 'green';
    f.text(160, y + 13, label(call.name), { size: 11.5, anchor: 'end' });
    f.rect(x0, y, call.seconds * scale, 18, { fill: color(`${hue}-ink`), stroke: 'none' });
    f.text(x0 + call.seconds * scale + 8, y + 13, `${call.seconds.toFixed(3)} s`, { size: 11.5, hue });
  });
  f.rule(x0, 28, x0, 214, { hue: 'ink' });
  f.text(x0 + calls[0].seconds * scale + 8, 34 + 13 + 16, 'includes the resume', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 238, `Between request 5 and the last one: ${samples} state samples in 900 s, all ACTOR_STATE_RUNNING`, { size: 11, serif: true, hue: 'ink-soft' });
});
