'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const out = fs.readFileSync(path.join(__dirname, '../../capture/lab/K-kagent/session1/turn5-egress.out'), 'utf8');
const address = /Name:\s+mock-llm\.kagent\.svc\.cluster\.local\s+Address:\s+([0-9.]+)/.exec(out)[1];

const rows = [
  { name: ['outside host', 'example.com'], relay: ['NXDOMAIN', 'no rule lists it', 'rose'], gateway: null },
  { name: ['Kubernetes API', 'kubernetes.default.svc.cluster.local'], relay: ['NXDOMAIN', 'no rule lists it', 'rose'], gateway: null },
  { name: ['full Service name', 'mock-llm.kagent.svc.cluster.local'], relay: [address, 'the rule lists it', 'violet'], gateway: ['200', 'Host is in the policy', 'indigo'] },
  { name: ['short Service name', 'mock-llm.kagent'], relay: [address, 'from the search list', 'violet'], gateway: ['403 Forbidden', 'Host mock-llm.kagent:8080', 'rose'] },
];

module.exports = figure('fig-6-3', {
  height: 280,
  title: 'Four names from one kagent actor',
  desc: `Four rows show a name that the actor asked for, the answer of the DNS relay, and the answer of atenet-egress. example.com and the Kubernetes API name get NXDOMAIN from the relay and never reach the gateway. The full Service name mock-llm.kagent.svc.cluster.local resolves to ${address} and the gateway returns 200. The short name mock-llm.kagent also resolves to ${address}, because the search list adds the suffix, and the gateway then returns 403 because the Host header is mock-llm.kagent:8080.`,
}, f => {
  f.kicker(12, 18, 'The actor asks for');
  f.kicker(272, 18, 'DNS relay');
  f.kicker(452, 18, 'atenet-egress');
  rows.forEach((row, index) => {
    const y = 28 + index * 62;
    f.box({ x: 12, y, w: 240, h: 48, hue: 'green', title: row.name[0], sub: row.name[1], titleSize: 11.5 });
    f.box({ x: 272, y, w: 160, h: 48, hue: row.relay[2], title: row.relay[0], sub: row.relay[1], titleSize: 11.5 });
    f.arrow([252, y + 24], [271, y + 24], { style: row.relay[2] === 'rose' ? 'fail' : 'call' });
    if (row.gateway) {
      f.box({ x: 452, y, w: 176, h: 48, hue: row.gateway[2], title: row.gateway[0], sub: row.gateway[1], titleSize: 11.5 });
      f.arrow([432, y + 24], [451, y + 24], { style: row.gateway[2] === 'rose' ? 'fail' : 'call' });
    } else {
      f.box({ x: 452, y, w: 176, h: 48, hue: 'grey', dash: 'dashed', title: 'not reached', sub: 'no connection is opened', titleSize: 11.5, weight: 400 });
    }
  });
});
