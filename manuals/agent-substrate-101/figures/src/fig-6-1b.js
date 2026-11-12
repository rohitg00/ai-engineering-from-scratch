'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const lab = path.join(__dirname, '../../capture/lab/G-dataplane');
function probes(dataplane) {
  const text = fs.readFileSync(path.join(lab, dataplane, 'ingress-auth/51-rightid-results.txt'), 'utf8');
  const out = {};
  for (const match of text.matchAll(/### \d+-rightid-([a-z0-9-]+)\n[\s\S]*?code=(\d+) t=([0-9.]+)/g)) out[match[1]] = { code: match[2], s: Number(match[3]).toFixed(3) };
  return out;
}
const envoy = probes('envoy');
const agw = probes('agentgateway');
const served = p => [`200 in ${p['https-443'].s} s`, `${p['connect-8444'].s} s through 8444`, 'green'];
const missing = (p, key, body) => [`${p[key].code} in ${p[key].s} s`, body, 'rose'];

const groups = [
  {
    name: 'Refused in the TLS layer: no HTTP status',
    rows: [
      { caller: ['no client certificate', 'a pod with no certificate'], envoy: ['connection cut', 'curl: Broken pipe', 'rose'], agw: ['TLS alert', 'certificate required', 'rose'] },
      { caller: ['identity not on the list', 'ns/probe/sa/default'], envoy: ['TLS alert', 'certificate unknown', 'rose'], agw: ['connection reset', 'reset by peer, no alert', 'rose'] },
    ],
  },
  {
    name: 'Allowed identity atenet-client: an HTTP answer',
    rows: [
      { caller: ['actor my-counter-1', 'ACTOR_STATE_RUNNING'], envoy: served(envoy), agw: served(agw) },
      { caller: ['actor does-not-exist', 'no such actor in the atespace'], envoy: missing(envoy, 'unknown-actor', 'body: actor not found'), agw: missing(agw, 'unknown-actor', 'body: ingress failed') },
      { caller: ['no routing header', 'ate-target-actor is absent'], envoy: missing(envoy, 'no-header', 'body: invalid actor reference'), agw: missing(agw, 'no-header', 'body: ingress failed') },
    ],
  },
];

module.exports = figure('fig-6-1b', {
  height: 358,
  title: 'What a caller of atenet-router sees on each dataplane',
  desc: `Five rows in two groups, with the outcome on the Envoy dataplane and on the agentgateway dataplane. In the first group the router refuses the caller in the TLS layer and the caller gets no HTTP status: with no client certificate, Envoy cuts the connection and agentgateway sends the alert certificate required. With an identity that is not on the list, Envoy sends the alert certificate unknown and agentgateway resets the connection. In the second group the caller has the allowed identity atenet-client and gets an HTTP answer: 200 from my-counter-1 in ${envoy['https-443'].s} seconds on Envoy and ${agw['https-443'].s} seconds on agentgateway, 404 for an actor that does not exist, and 404 for a request with no routing header.`,
}, f => {
  f.kicker(16, 18, 'The request');
  f.kicker(232, 18, 'Envoy dataplane');
  f.kicker(438, 18, 'agentgateway dataplane');
  let y = 30;
  groups.forEach((group, g) => {
    f.rule(16, y + 4, 624, y + 4, { opacity: 0.5 });
    f.text(16, y + 20, group.name, { size: 11.5, weight: 700, hue: g === 0 ? 'rose' : undefined });
    y += 30;
    for (const row of group.rows) {
      const tls = g === 0;
      f.box({ x: 16, y, w: 196, h: 44, hue: 'olive', title: row.caller[0], sub: row.caller[1], titleSize: 11.5, pad: 8 });
      [[row.envoy, 232], [row.agw, 438]].forEach(([cell, x]) => {
        f.box({ x, y, w: 186, h: 44, hue: cell[2], title: cell[0], sub: cell[1], titleSize: 11.5, pad: 6, dash: tls ? 'dashed' : undefined });
      });
      y += 52;
    }
    y += 4;
  });
});
