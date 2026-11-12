'use strict';

const { figure } = require('../../../_shared/figkit.js');

const xs = [20, 144, 268, 392, 516];
const rows = [
  {
    y: 34,
    kicker: 'A · the dataplane of Substrate, by your choice',
    note: 'ate-setup installs it when you pass --atenet-dataplane=agentgateway',
    boxes: [
      { hue: 'olive', title: 'client', sub: 'mTLS client' },
      { hue: 'indigo', title: 'atenet-router', sub: 'agentgateway' },
      { hue: 'green', title: 'actor', sub: 'my-counter-1' },
      { hue: 'indigo', title: 'atenet-egress', sub: 'agentgateway' },
      { hue: 'olive', title: 'host', sub: 'in the policy' },
    ],
  },
  {
    y: 166,
    kicker: 'B · the dataplane inside the kagent distribution',
    note: 'the kagent charts install agentgateway v1.7.0, and they have no Envoy option',
    boxes: [
      { hue: 'plum', title: 'kagent', sub: 'controller' },
      { hue: 'indigo', title: 'atenet-router', sub: 'agentgateway' },
      { hue: 'green', title: 'actor', sub: 'session-<uuid>' },
      { hue: 'indigo', title: 'atenet-egress', sub: 'agentgateway' },
      { hue: 'plum', title: 'model host', sub: 'in the policy' },
    ],
  },
  {
    y: 298,
    kicker: 'C · a gateway that the actor calls through an egress rule',
    note: 'dashed: you deploy it, and it selects models and tools. We did not run it.',
    boxes: [
      { hue: 'green', title: 'actor', sub: 'session-<uuid>' },
      { hue: 'indigo', title: 'atenet-egress', sub: 'one allow rule' },
      { hue: 'grey', title: 'agentgateway', sub: 'model gateway', dash: 'dashed' },
      { hue: 'plum', title: 'model', sub: 'the provider' },
    ],
  },
];

module.exports = figure('fig-7-2', {
  height: 400,
  title: 'Three places where agentgateway can sit next to Substrate',
  desc: 'Three rows. Row A: agentgateway is the proxy in atenet-router and atenet-egress when you install Substrate with the agentgateway dataplane. Row B: the kagent distribution installs the same two proxies and has no Envoy option. Row C: a separate agentgateway is a model gateway that the actor reaches through one egress rule, and that gateway selects models and tools.',
}, f => {
  for (const row of rows) {
    f.kicker(20, row.y - 10, row.kicker);
    row.boxes.forEach((box, index) => {
      f.box({ x: xs[index], y: row.y, w: 104, h: 46, pad: 6, titleSize: 11.5, ...box });
      if (index < row.boxes.length - 1) f.arrow([xs[index] + 104, row.y + 23], [xs[index + 1] - 1, row.y + 23], { style: 'call' });
    });
    f.text(20, row.y + 66, row.note, { size: 11, serif: true, hue: 'ink-soft' });
  }
  f.rule(20, 132, 620, 132, { dash: 'dashed', opacity: 0.5 });
  f.rule(20, 264, 620, 264, { dash: 'dashed', opacity: 0.5 });
});
