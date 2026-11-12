'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-1', {
  height: 300,
  title: 'Three clients at the router, on both dataplanes',
  desc: 'Three columns show three clients that call atenet-router on port 443: one with no certificate, one with a certificate for spiffe://cluster.local/ns/probe/sa/default, and one with a certificate for the allowed identity spiffe://cluster.local/ns/ate-system/sa/atenet-client. Two rows show the answer of each dataplane. Envoy closes the connection, sends the TLS alert certificate unknown, and returns 200. agentgateway sends the TLS alert certificate required, resets the connection, and returns 200.',
}, f => {
  const cols = [
    { x: 130, title: 'no certificate', sub: ['a plain pod'] },
    { x: 300, title: 'wrong identity', sub: ['ns/probe/sa/default'] },
    { x: 470, title: 'allowed identity', sub: ['ns/ate-system', 'sa/atenet-client'] },
  ];
  f.kicker(20, 18, 'Client');
  cols.forEach(col => f.box({ x: col.x, y: 28, w: 150, h: 62, hue: 'olive', title: col.title, sub: col.sub }));

  const rows = [
    { y: 130, name: 'Envoy', cells: [['connection closed', 'curl: Broken pipe', 'rose'], ['TLS alert', 'certificate unknown', 'rose'], ['200', 'on 443 and on 8444', 'green']] },
    { y: 214, name: 'agentgateway', cells: [['TLS alert', 'certificate required', 'rose'], ['connection reset', 'by peer', 'rose'], ['200', 'on 443 and on 8444', 'green']] },
  ];
  rows.forEach(row => {
    f.text(20, row.y + 24, row.name, { size: 12, weight: 700, hue: 'indigo' });
    f.text(20, row.y + 40, 'atenet-router', { size: 11, serif: true, hue: 'ink-soft' });
    row.cells.forEach(([title, sub, hue], index) => {
      f.box({ x: cols[index].x, y: row.y, w: 150, h: 56, pad: 8, hue, title, sub, dash: hue === 'rose' ? 'dashed' : undefined });
    });
  });
  cols.forEach((col, index) => {
    f.arrow([col.x + 75, 90], [col.x + 75, 129], { style: index === 2 ? 'call' : 'fail' });
  });
  f.text(20, 290, 'target in every probe: ate-demo-counter/my-counter-1', { size: 11, serif: true, hue: 'ink-soft' });
});
