'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const lab = path.join(__dirname, '../../capture/lab/F-egress');
const clock = text => {
  const [h, m, s] = text.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

function samples(dataplane) {
  const text = fs.readFileSync(path.join(lab, dataplane, '40-supplement.txt'), 'utf8');
  const partB = text.slice(text.indexOf('## B.'), text.indexOf('## C.'));
  const partC = text.slice(text.indexOf('## C.'));
  const removed = part => clock([...part.matchAll(/### \[([0-9:.]+)\] policy update f-main <- P1\.yaml/g)].pop()[1]);
  const rows = (part, pattern, ok) => {
    const zero = removed(part);
    return [...part.matchAll(pattern)].map(match => ({ t: clock(match[1]) - zero, ok: match[2] === ok }));
  };
  return {
    dns: rows(partC, /^(\d\d:\d\d:\d\d) dns=status: ([A-Z]+) http=/gm, 'NOERROR'),
    http: rows(partC, /^(\d\d:\d\d:\d\d) dns=status: [A-Z]+ http=(\d+)/gm, '200'),
    conn: rows(partB, /^(\d\d:\d\d:\d\d) dns=status: [A-Z]+ newconn_certs=(\d)/gm, '1'),
  };
}

const groups = [
  { name: 'Envoy dataplane', data: samples('envoy'), responseEnd: 39 },
  { name: 'agentgateway dataplane', data: samples('agentgateway'), responseEnd: 18 },
];
const FROM = -6;
const END = 40;
const X0 = 190;
const PER = 9.4;
const px = t => X0 + (t - FROM) * PER;
const first = points => points.find(point => !point.ok && point.t >= 0).t;
const lastServed = points => Math.max(...points.filter(point => point.ok).map(point => point.t));

module.exports = figure('fig-6-6b', {
  height: 394,
  title: 'New work and open connections after a rule is removed',
  desc: `Two groups of five tracks over a time axis from ${FROM} to ${END} seconds, where zero is the removal of the rule. Each dot is one sample, about every 2 seconds. On the Envoy dataplane, the first sample after the removal is a refusal for a new DNS lookup and for a new pass-through connection. New HTTP requests are served until ${Math.round(lastServed(groups[0].data.http))} seconds and refused from ${Math.round(first(groups[0].data.http))} seconds. An HTTP response that was open ran until the server ended it at 39 seconds, and an open pass-through connection served a second request at 20 seconds. On the agentgateway dataplane, the first sample after the removal is a refusal for all three kinds of new work. An open HTTP response ran until the server ended it at 18 seconds, and an open pass-through connection served a second request at 20 seconds.`,
}, f => {
  const lastGroupBottom = 30 + groups.length * 156;
  groups.forEach((group, g) => {
    const top = 30 + g * 156;
    f.kicker(16, top, group.name);
    const tracks = [
      ['new DNS lookup', group.data.dns],
      ['new HTTP request', group.data.http],
      ['new pass-through connection', group.data.conn],
    ];
    tracks.forEach(([label, points], index) => {
      const y = top + 26 + index * 24;
      f.text(16, y + 4, label, { size: 11, serif: true, hue: 'ink-soft' });
      f.rule(px(FROM), y, px(END), y, { opacity: 0.35 });
      for (const point of points) {
        if (point.t < FROM || point.t > END) continue;
        f.dot(px(point.t), y, { hue: point.ok ? 'green' : 'rose', r: 3.2 });
      }
      const t = first(points);
      const immediate = points.filter(point => point.t >= 0)[0].t === t;
      f.text(immediate ? px(0) + 6 : px(t) - 5, y - 8, immediate ? 'refused at the first sample' : `refused from ${Math.round(t)} s`, { size: 11, hue: 'rose', weight: 700 });
    });
    const open = [
      ['open HTTP response', group.responseEnd, `the server ended it at ${group.responseEnd} s`],
      ['open pass-through', 20, 'second request served at 20 s'],
    ];
    open.forEach(([label, end, note], index) => {
      const y = top + 26 + (index + 3) * 24;
      f.text(16, y + 4, label, { size: 11, serif: true, hue: 'ink-soft' });
      f.rect(px(FROM), y - 5, (end - FROM) * PER, 10, { fill: color('green-fill'), stroke: color('green-ink') });
      f.dot(px(end), y, { hue: 'green', r: 3.2 });
      const inside = end > 30;
      f.text(px(end) + (inside ? 0 : 10), y + (inside ? -9 : 4), note, { size: 11, hue: 'green', anchor: inside ? 'end' : 'start' });
    });
  });
  f.rule(px(0), 22, px(0), lastGroupBottom, { hue: 'ink', dash: 'dashed' });
  f.text(px(0) + 6, 20, 'rule removed', { size: 11, hue: 'ink-soft' });
  const axis = lastGroupBottom;
  f.rule(px(FROM), axis, px(END), axis, { hue: 'ink' });
  for (let t = -5; t <= END; t += 5) {
    f.rule(px(t), axis, px(t), axis + 5, { hue: 'ink' });
    if (t % 10 === 0) f.text(px(t), axis + 18, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(16, axis + 18, 'seconds after the removal', { size: 11, serif: true, hue: 'ink-soft' });
  f.dot(px(FROM) + 4, axis + 34, { hue: 'green', r: 3.2 });
  f.text(px(FROM) + 12, axis + 38, 'served', { size: 11, serif: true, hue: 'ink-soft' });
  f.dot(px(FROM) + 74, axis + 34, { hue: 'rose', r: 3.2 });
  f.text(px(FROM) + 82, axis + 38, 'refused', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(px(FROM) + 150, axis + 38, 'bar: a connection opened before the removal', { size: 11, serif: true, hue: 'ink-soft' });
});
