'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const results = fs.readFileSync(path.join(__dirname, '../../capture/lab/F-egress/envoy/20-results.txt'), 'utf8');
const issuers = [...results.matchAll(/^issuer=(.*)$/gm)].map(match => match[1]);
const minted = issuers[0];
const real = /CN=(.*)$/.exec(issuers[1])[1];

module.exports = figure('fig-6-4', {
  height: 262,
  title: 'Who holds the TLS session for each rule kind',
  desc: `Two columns. On the left, an https rule for example.com: the actor f-main holds TLS session 1 with atenet-egress, which presents a leaf certificate from ${minted}, and atenet-egress holds TLS session 2 with example.com. On the right, a tlsPassthrough rule for example.org: the actor holds one TLS session with example.org, atenet-egress reads only the server name and forwards the bytes, and the actor sees a certificate from ${real}.`,
}, f => {
  f.kicker(20, 18, 'https rule: example.com');
  f.kicker(336, 18, 'tlsPassthrough rule: example.org');
  f.rule(320, 8, 320, 254, { dash: 'dashed' });
  const left = [
    { hue: 'green', title: 'actor f-main', sub: 'trusts the projected bundle' },
    { hue: 'indigo', title: 'atenet-egress', sub: `leaf from ${minted}` },
    { hue: 'olive', title: 'example.com', sub: 'public certificate, checked by the gateway' },
  ];
  const right = [
    { hue: 'green', title: 'actor f-main', sub: 'uses its normal root store' },
    { hue: 'indigo', title: 'atenet-egress', sub: 'reads the server name, forwards bytes', dash: 'dashed' },
    { hue: 'olive', title: 'example.org', sub: `issuer ${real}` },
  ];
  const labels = [['TLS session 1', 'TLS session 2'], ['one TLS session', 'the same session']];
  [[left, 20], [right, 336]].forEach(([column, x], side) => {
    column.forEach((item, index) => {
      const y = 30 + index * 84;
      f.box({ x, y, w: 284, h: 48, ...item });
      if (index < column.length - 1) f.arrow([x + 100, y + 48], [x + 100, y + 83], { style: side === 0 ? 'call' : 'event', label: labels[side][index] });
    });
  });
});
