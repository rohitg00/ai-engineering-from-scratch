'use strict';

const { figure, color, measure } = require('../../../_shared/figkit.js');

const rows = [
  {
    member: 'raw',
    value: 'LS0tIGEvcGF5bWVudHMvcmVmdW5kcy5weQor',
    note: 'first 36 of 236 base64 characters',
    media: 'filename "refunds.diff"   mediaType "text/x-diff"',
    from: 'sent by the planner, a five-line diff · 06-input-required.http',
    hue: 'violet',
  },
  {
    member: 'text',
    value: '"Which base branch should I compare this diff against?"',
    media: 'mediaType absent: the kit reads it as text/plain',
    from: 'sent by code-reviewer in status.message · 06-input-required.http',
    hue: 'blue',
  },
  {
    member: 'data',
    value: '"base": "main"',
    note: 'plus "findings", two objects with file, line, severity, finding',
    media: 'mediaType "application/json"',
    from: 'part 2 of the review.json artifact, sent by code-reviewer · 06-input-required.http',
    hue: 'blue',
  },
  {
    member: 'url',
    value: '"https://example.com/screenshot.png"',
    media: 'mediaType "image/png"',
    from: 'sent by the planner · 11-errors.http',
    hue: 'violet',
    rejected: true,
  },
];

module.exports = figure('fig-four-parts', {
  height: 384,
  title: 'Four kinds of part',
  desc: 'Top: a part holds exactly one of four content members, text, raw, url or data, and every kind can also carry mediaType, filename and metadata. Below, four parts from the captures in the order they were sent: the refunds.diff file the planner sent as raw base64 with media type text/x-diff, the code-reviewer question as text, the review findings as a data part with media type application/json, and a url part labelled image/png that code-reviewer rejects with error -32005 CONTENT_TYPE_NOT_SUPPORTED.',
}, f => {
  f.kicker(20, 18, 'One part holds exactly one of');
  f.kicker(344, 18, 'Optional on every kind');
  ['text', 'raw', 'url', 'data'].forEach((member, index) => f.box({ x: 20 + index * 76, y: 26, w: 68, h: 30, hue: 'green', title: member }));
  [['mediaType', 344, 92], ['filename', 444, 84], ['metadata', 536, 84]].forEach(([field, x, w]) => f.box({ x, y: 26, w, h: 30, hue: 'green', title: field, weight: 400 }));
  f.kicker(20, 76, 'Four parts from the captures, in the order they were sent');
  let beat = 0;
  rows.forEach((row, index) => {
    const y = 84 + index * 74;
    f.beat(++beat);
    f.box({ x: 20, y, w: 68, h: 66, hue: 'green', title: row.member, titleSize: 13 });
    f.rect(88, y, 532, 66, { fill: color('paper'), stroke: color('panel-edge') });
    const first = f.text(100, y + 21, row.value, { size: 11.5 });
    if (row.note) f.text(first.right + 10, y + 21, row.note, { size: 11, serif: true, hue: 'ink-soft' });
    f.text(100, y + 39, row.media, { size: 11, hue: 'green' });
    f.text(100, y + 57, row.from, { size: 11, serif: true, hue: row.hue });
    if (row.rejected) {
      f.beat(++beat);
      f.box({ x: 396, y: y + 9, w: 214, h: 48, hue: 'rose', title: 'CONTENT_TYPE_NOT_SUPPORTED', titleSize: 12, sub: 'rejected with error -32005' });
    }
  });
  for (const row of rows) if (measure(row.from, 11, true) > 510) throw new Error('fig-four-parts: provenance line too wide');
});
