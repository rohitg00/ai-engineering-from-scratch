'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const lab = path.join(__dirname, '../../capture/lab/F-egress');
const clock = text => {
  const [h, m, s] = text.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

function polled(dataplane) {
  const text = fs.readFileSync(path.join(lab, dataplane, '40-supplement.txt'), 'utf8');
  const update = clock(/### \[([0-9:.]+)\] policy update f-main <- P2\.yaml/.exec(text)[1]);
  return [...text.matchAll(/^(\d\d:\d\d:\d\d) com=status: ([A-Z]+)/gm)].map(match => ({ t: clock(match[1]) - update, ok: match[2] === 'NOERROR' }));
}

function firstLookups() {
  const text = fs.readFileSync(path.join(lab, 'envoy/20-results.txt'), 'utf8');
  const update = clock(/### \[([0-9:.]+)\] policy update f-main <- P2\.yaml/.exec(text)[1]);
  const at = label => clock(new RegExp(`### \\[([0-9:.]+)\\] ${label}`).exec(text)[1]) - update;
  return [
    { t: at('t3-https-default-store'), ok: false },
    { t: at('t3-https-trust-bundle'), ok: false },
    { t: at('t3-https-cert-seen'), ok: true },
  ];
}

const tracks = [
  { label: ['Envoy, polled', 'rule added'], points: polled('envoy') },
  { label: ['agentgateway, polled', 'rule added'], points: polled('agentgateway') },
  { label: ['Envoy, first lookups', 'of a new name'], points: firstLookups() },
];
const FROM = -6;
const TO = 20;
const px = t => 190 + (t - FROM) * 16.5;
const slow = tracks[2].points.filter(point => !point.ok).map(point => Math.round(point.t));

module.exports = figure('fig-6-3b', {
  height: 236,
  title: 'DNS answers for example.com after a rule for it is added',
  desc: `Three tracks over a time axis in seconds, where zero is the moment the policy update returned. In the polled run on Envoy and in the polled run on agentgateway, the samples up to 2 seconds before zero are NXDOMAIN and every later sample is an answer. In a third run on Envoy, with no earlier lookup of the name, requests at ${slow.join(' and ')} seconds did not resolve the host, and a request at 18 seconds did.`,
}, f => {
  f.rule(px(0), 22, px(0), 180, { hue: 'ink', dash: 'dashed' });
  f.text(px(0) + 5, 18, 'update returned', { size: 11, hue: 'ink-soft' });
  tracks.forEach((track, index) => {
    const y = 56 + index * 46;
    f.text(16, y - 3, track.label[0], { size: 11.5, weight: 700 });
    f.text(16, y + 11, track.label[1], { size: 11, serif: true, hue: 'ink-soft' });
    f.rule(px(FROM), y, px(TO), y, { opacity: 0.4 });
    for (const point of track.points) {
      if (point.t < FROM || point.t > TO) continue;
      f.dot(px(point.t), y, { hue: point.ok ? 'violet' : 'rose', r: 4 });
    }
  });
  const last = tracks[2].points;
  f.text(px(last[1].t) + 4, 56 + 2 * 46 - 12, 'not resolved', { size: 11, hue: 'rose', anchor: 'end' });
  f.rule(px(FROM), 180, px(TO), 180, { hue: 'ink' });
  for (let t = FROM; t <= TO; t += 2) {
    f.rule(px(t), 176, px(t), 184, { hue: 'ink' });
    if (t % 4 === 0) f.text(px(t), 198, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.kicker(16, 198, 'Seconds');
  f.dot(196, 222, { hue: 'rose', r: 4 });
  f.text(206, 226, 'NXDOMAIN or not resolved', { size: 11, serif: true, hue: 'ink-soft' });
  f.dot(380, 222, { hue: 'violet', r: 4 });
  f.text(390, 226, 'the relay answered', { size: 11, serif: true, hue: 'ink-soft' });
});
