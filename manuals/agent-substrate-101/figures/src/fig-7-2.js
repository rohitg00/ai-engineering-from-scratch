'use strict';

const { figure } = require('../../../_shared/figkit.js');

const xs = [20, 144, 268, 392, 516];
const rows = [
  {
    y: 34,
    decides: 'decides: who gets in, which hosts an actor reaches, one injected header',
    kicker: 'A · the dataplane of Substrate, by your choice',
    note: 'ate-setup --atenet-dataplane=agentgateway. Idle: 38 MB in 2 containers. Envoy: 91 MB in 5.',
    boxes: [
      { hue: 'olive', title: 'client', sub: 'mTLS client' },
      { hue: 'indigo', title: 'atenet-router', sub: 'agentgateway' },
      { hue: 'green', title: 'actor', sub: 'my-counter-1' },
      { hue: 'indigo', title: 'atenet-egress', sub: 'agentgateway' },
      { hue: 'olive', title: 'host', sub: 'in the policy' },
    ],
  },
  {
    y: 178,
    decides: 'decides: the same three things',
    kicker: 'B · the dataplane inside the kagent distribution',
    note: 'The kagent charts install agentgateway v1.7.0 and have no Envoy option. 98 turns ran through it.',
    boxes: [
      { hue: 'plum', title: 'kagent', sub: 'controller' },
      { hue: 'indigo', title: 'atenet-router', sub: 'agentgateway' },
      { hue: 'green', title: 'actor', sub: 'session-<uuid>' },
      { hue: 'indigo', title: 'atenet-egress', sub: 'agentgateway' },
      { hue: 'plum', title: 'model host', sub: 'in the policy' },
    ],
  },
  {
    y: 322,
    decides: 'decides: models, tools, budgets',
    kicker: 'C · a gateway that the actor calls through an egress rule',
    note: 'dashed: your own workload, behind one egress allow rule. We did not run it.',
    boxes: [
      { hue: 'green', title: 'actor', sub: 'session-<uuid>' },
      { hue: 'indigo', title: 'atenet-egress', sub: 'one allow rule' },
      { hue: 'grey', title: 'agentgateway', sub: 'model gateway', dash: 'dashed', strokeWidth: 1.8 },
      { hue: 'plum', title: 'model', sub: 'the provider' },
    ],
  },
];

module.exports = figure('fig-7-2', {
  height: 432,
  title: 'Three places where agentgateway can sit next to Substrate',
  desc: 'Three rows. Row A: agentgateway is the proxy in atenet-router and atenet-egress when you install Substrate with the agentgateway dataplane. Row B: the kagent distribution installs the same two proxies and has no Envoy option. Row C: a separate agentgateway is a model gateway that the actor reaches through one egress rule, and that gateway selects models and tools.',
}, f => {
  for (const row of rows) {
    f.kicker(20, row.y - 10, row.kicker);
    row.boxes.forEach((box, index) => {
      f.box({ x: xs[index], y: row.y, w: 104, h: 46, pad: 6, titleSize: 11.5, ...box });
      if (index < row.boxes.length - 1) f.arrow([xs[index] + 104, row.y + 23], [xs[index + 1] - 1, row.y + 23], { style: 'call' });
    });
    f.text(20, row.y + 68, row.decides, { size: 11.5, weight: 700, hue: row.y > 300 ? 'plum' : 'indigo' });
    f.text(20, row.y + 86, row.note, { size: 11, serif: true, hue: 'ink-soft' });
  }
  f.rule(20, 142, 620, 142, { dash: 'dashed', opacity: 0.5 });
  f.rule(20, 286, 620, 286, { dash: 'dashed', opacity: 0.5 });
});
