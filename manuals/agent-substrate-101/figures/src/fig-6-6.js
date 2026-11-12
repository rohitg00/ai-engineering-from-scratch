'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const lab = path.join(__dirname, '../../capture/lab/G-dataplane');

function containers(dataplane) {
  const pods = new Map();
  for (const line of fs.readFileSync(path.join(lab, dataplane, '13-crictl-ps-atenet.txt'), 'utf8').trim().split('\n').slice(1)) {
    const cells = line.trim().split(/\s{2,}/);
    pods.set(cells[0], { name: cells[4], pod: cells[7].replace(/-[a-z0-9]+-[a-z0-9]+$/, '') });
  }
  return fs.readFileSync(path.join(lab, dataplane, '13-crictl-stats-atenet.txt'), 'utf8').trim().split('\n').map(line => {
    const cells = line.trim().split(/\s+/);
    return { ...pods.get(cells[0]), mb: parseFloat(cells[3]) };
  });
}

const sides = [
  { key: 'envoy', label: 'Envoy dataplane', x: 16, holder: 'sdsmint', order: ['atenet-router', 'envoy', 'ext-proc', 'sdsmint'] },
  { key: 'agentgateway', label: 'agentgateway dataplane', x: 332, holder: 'agentgateway', order: ['agentgateway'] },
].map(side => {
  const all = containers(side.key);
  const inPod = pod => all.filter(item => item.pod === pod).sort((a, b) => side.order.indexOf(a.name) - side.order.indexOf(b.name));
  return { ...side, router: inPod('atenet-router'), egress: inPod('atenet-egress'), total: all.reduce((sum, item) => sum + item.mb, 0), count: all.length };
});

module.exports = figure('fig-6-6', {
  height: 300,
  title: 'The containers of each dataplane and their idle memory',
  desc: `Two columns. The Envoy dataplane has ${sides[0].count} containers that hold ${Math.round(sides[0].total)} MB in total: atenet-router and envoy in the pod atenet-router, and envoy, ext-proc, and sdsmint in the pod atenet-egress. Only sdsmint holds the CA key. The agentgateway dataplane has ${sides[1].count} containers that hold ${Math.round(sides[1].total)} MB in total: one agentgateway container in each pod. The agentgateway container in atenet-egress holds the CA key.`,
}, f => {
  f.rule(320, 8, 320, 292, { dash: 'dashed' });
  for (const side of sides) {
    f.kicker(side.x, 18, side.label);
    [['atenet-router', side.router, 28, false], ['atenet-egress', side.egress, 150, true]].forEach(([pod, items, y, egress]) => {
      f.rect(side.x, y, 292, 106, { fill: 'none', stroke: color('indigo-ink'), dash: 'dashed' });
      f.text(side.x + 10, y + 18, `pod ${pod}`, { size: 11, hue: 'indigo' });
      const gap = 8;
      const w = (292 - 20 - gap * (items.length - 1)) / items.length;
      items.forEach((item, index) => {
        const key = egress && item.name === side.holder;
        const sub = [`${item.mb.toFixed(1)} MB`];
        if (key) sub.push('CA key');
        f.box({ x: side.x + 10 + index * (w + gap), y: y + 28, w, h: 66, hue: 'indigo', title: item.name, sub, titleSize: 11, pad: 5, double: key });
      });
    });
    f.text(side.x, 282, `${Math.round(side.total)} MB in ${side.count} containers`, { size: 12, weight: 700 });
  }
});
