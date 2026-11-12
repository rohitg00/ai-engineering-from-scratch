'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const END = 40;
const px = t => 176 + t * 11;

const groups = [
  {
    name: 'Envoy dataplane',
    rows: [
      { label: 'new DNS lookup', bars: [[1, END, 'rose']], note: 'NXDOMAIN at 1 s', at: 1 },
      { label: 'new HTTP request', bars: [[0, 6, 'green'], [6, END, 'rose']], note: '403 from 6 s', at: 6 },
      { label: 'open HTTP response', bars: [[0, 39, 'green']], note: 'the server ended it at 39 s', at: 39, anchor: 'end' },
      { label: 'open pass-through', bars: [[0, 20, 'green']], open: 20, note: 'second request served at 20 s', at: 20, anchor: 'end' },
    ],
  },
  {
    name: 'agentgateway dataplane',
    rows: [
      { label: 'new DNS lookup', bars: [[3, END, 'rose']], note: 'NXDOMAIN within 3 s', at: 3 },
      { label: 'new HTTP request', bars: [[0, END, 'rose']], note: '403 at the first sample', at: 0 },
      { label: 'open HTTP response', bars: [[0, 18, 'green']], note: 'the server ended it at 18 s', at: 18, anchor: 'end' },
      { label: 'open pass-through', bars: [[0, 20, 'green']], open: 20, note: 'second request served at 20 s', at: 20, anchor: 'end' },
    ],
  },
];

module.exports = figure('fig-6-6b', {
  height: 344,
  title: 'New work and open connections after a rule is removed',
  desc: 'Two groups of four tracks over a time axis from 0 to 40 seconds, where zero is the removal of the rule. On the Envoy dataplane, new DNS lookups fail from 1 second, new HTTP requests are served until 6 seconds and refused with 403 after that, an HTTP response that was open ran until the server ended it at 39 seconds, and an open pass-through connection served a second request at 20 seconds. On the agentgateway dataplane, new DNS lookups fail within 3 seconds, new HTTP requests are refused at the first sample, an open HTTP response ran until the server ended it at 18 seconds, and an open pass-through connection served a second request at 20 seconds.',
}, f => {
  f.text(px(0) + 5, 46, 'rule removed', { size: 11, hue: 'ink-soft', anchor: 'start' });
  groups.forEach((group, g) => {
    const top = 34 + g * 134;
    f.kicker(16, top + 6, group.name);
    f.rule(px(0), top + 16, px(0), top + 122, { hue: 'ink', dash: 'dashed' });
    group.rows.forEach((row, index) => {
      const y = top + 30 + index * 26;
      f.text(16, y + 9, row.label, { size: 11, serif: true, hue: 'ink-soft' });
      for (const [from, to, hue] of row.bars) f.rect(px(from), y, (to - from) * 11, 10, { fill: color(`${hue}-ink`), stroke: 'none' });
      if (row.open !== undefined) f.rect(px(row.open), y, (END - row.open) * 11, 10, { fill: 'none', stroke: color('green-ink'), dash: 'dashed' });
      const anchor = row.anchor || 'start';
      f.text(px(row.at) + (anchor === 'end' ? -2 : 4), y - 4, row.note, { size: 11, hue: row.bars[row.bars.length - 1][2] === 'rose' ? 'rose' : 'green', anchor });
    });
  });
  f.rule(px(0), 300, px(END), 300, { hue: 'ink' });
  for (let t = 0; t <= END; t += 5) {
    f.rule(px(t), 296, px(t), 304, { hue: 'ink' });
    if (t % 10 === 0) f.text(px(t), 318, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.kicker(16, 318, 'Seconds');
  f.rect(176, 328, 14, 10, { fill: color('rose-ink'), stroke: 'none' });
  f.text(196, 338, 'refused', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(266, 328, 14, 10, { fill: color('green-ink'), stroke: 'none' });
  f.text(286, 338, 'served', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(356, 328, 14, 10, { fill: 'none', stroke: color('green-ink'), dash: 'dashed' });
  f.text(376, 338, 'still open, not tested longer', { size: 11, serif: true, hue: 'ink-soft' });
});
