'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  {
    caller: ['no client certificate', 'a pod with no certificate'],
    envoy: ['connection cut', 'curl: Broken pipe', 'rose'],
    agw: ['TLS alert', 'certificate required', 'rose'],
  },
  {
    caller: ['identity not on the list', 'ns/probe/sa/default'],
    envoy: ['TLS alert', 'certificate unknown', 'rose'],
    agw: ['connection reset', 'reset by peer, no alert', 'rose'],
  },
  {
    caller: ['allowed identity', 'ns/ate-system/sa/atenet-client'],
    envoy: ['200 from my-counter-1', 'on 443 and through 8444', 'green'],
    agw: ['200 from my-counter-1', 'on 443 and through 8444', 'green'],
  },
];

module.exports = figure('fig-6-1b', {
  height: 232,
  title: 'Three callers at atenet-router on each dataplane',
  desc: 'Three rows, one for each caller, with the outcome on the Envoy dataplane and on the agentgateway dataplane. A caller with no client certificate gets a cut connection on Envoy and the TLS alert certificate required on agentgateway. A caller whose identity is not on the list gets the TLS alert certificate unknown on Envoy and a connection reset on agentgateway. A caller with the allowed identity atenet-client gets 200 from my-counter-1 on port 443 and through port 8444 on both.',
}, f => {
  f.kicker(16, 18, 'Caller');
  f.kicker(232, 18, 'Envoy dataplane');
  f.kicker(438, 18, 'agentgateway dataplane');
  rows.forEach((row, index) => {
    const y = 28 + index * 68;
    const refused = row.envoy[2] === 'rose';
    f.box({ x: 16, y, w: 196, h: 50, hue: 'olive', title: row.caller[0], sub: row.caller[1], titleSize: 11.5, pad: 8 });
    f.box({ x: 232, y, w: 186, h: 50, hue: row.envoy[2], title: row.envoy[0], sub: row.envoy[1], titleSize: 11.5 });
    f.box({ x: 438, y, w: 186, h: 50, hue: row.agw[2], title: row.agw[0], sub: row.agw[1], titleSize: 11.5 });
    f.arrow([212, y + 25], [231, y + 25], { style: refused ? 'fail' : 'call' });
    f.arrow([418, y + 25], [437, y + 25], { style: refused ? 'fail' : 'call' });
  });
});
