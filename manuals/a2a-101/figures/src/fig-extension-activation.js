'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 100, w: 150, title: 'client', sub: 'A2A client', hue: 'violet' },
  { x: 430, w: 210, title: 'Research Assistant Agent', sub: 'the §4.6.1 sample card', hue: 'blue' },
];

const rows = [
  { y: 84, from: 0, to: 1, style: 'call', label: 'GET /.well-known/agent-card.json', note: 'the client reads capabilities.extensions' },
  { y: 128, from: 1, to: 0, style: 'reply', label: 'card: capabilities.extensions', note: 'citations/v1 and geolocation/v1' },
  { y: 172, from: 0, to: 1, style: 'call', label: 'POST /message:send', note: 'A2A-Extensions: geolocation/v1', extra: 'metadata keyed by the URI: latitude, longitude' },
  { y: 232, from: 1, to: 0, style: 'reply', label: '200 OK, A2A-Extensions echoed', note: 'the guide says SHOULD, and SDKs differ' },
  { y: 276, from: 0, to: 1, style: 'call', label: 'POST /message:send, no A2A-Extensions', note: 'when the card marks the extension required' },
  { y: 320, from: 1, to: 0, style: 'fail', label: 'ExtensionSupportRequiredError', note: '-32008, HTTP 400, FAILED_PRECONDITION' },
];

module.exports = figure('fig-extension-activation', {
  height: 372,
  title: 'Activating an extension, and the error when a required one is missing',
  desc: 'A sequence with two lifelines: a client and the Research Assistant Agent from the sample card in section 4.6.1 of the specification. The client fetches the card and reads two extensions under capabilities.extensions: https://standards.org/extensions/citations/v1 and https://example.com/extensions/geolocation/v1. It sends a message with the A2A-Extensions header naming the geolocation extension and with latitude and longitude in metadata under that URI. The agent answers 200 and echoes the header, which the extensions guide recommends and the SDKs do differently. A second message without the header gets ExtensionSupportRequiredError, code -32008, when the card marks the extension required.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 8, w: lane.w, h: 38, hue: lane.hue, title: lane.title, sub: lane.sub, anchor: 'middle' });
    f.lifeline(lane.x, 46, 360);
  }
  rows.forEach((row, index) => {
    f.beat(index + 1);
    f.step(24, row.y, index + 1);
    const x1 = lanes[row.from].x;
    const x2 = lanes[row.to].x;
    const labelX = (x1 + x2) / 2;
    f.arrow([x1, row.y], [x2 + (x2 > x1 ? -1 : 1), row.y], { style: row.style, label: row.label, note: row.note, labelX });
    if (row.extra) f.text(labelX, row.y + 30, row.extra, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', knock: true });
  });
});
