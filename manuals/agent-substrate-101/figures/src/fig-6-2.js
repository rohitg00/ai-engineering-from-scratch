'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const results = fs.readFileSync(path.join(__dirname, '../../capture/lab/F-egress/envoy/20-results.txt'), 'utf8');
const actorIp = /inet (169\.254\.[0-9.]+\/30)/.exec(results)[1];
const relayIp = /nameserver ([0-9.]+)/.exec(results)[1];
const gatewayIp = /RemoteAddr: ([0-9.]+):/.exec(results)[1];

module.exports = figure('fig-6-2', {
  height: 296,
  title: 'Where an outgoing connection from an actor is decided',
  desc: `The actor f-main at ${actorIp} sends DNS queries to the DNS relay at ${relayIp} and every TCP connection to atunnel. Both are in the worker pod. The relay forwards names that the policy lists to the cluster DNS and answers NXDOMAIN for other names. atunnel opens a mutual TLS CONNECT to atenet-egress, which checks the request and connects to the upstream host whoami. The upstream sees ${gatewayIp}. A request outside the policy gets 403 or a reset. Both checks read the EgressPolicy of f-main from ate-api-server, and the relay keeps it in a cache for 5 seconds.`,
}, f => {
  const api = f.box({ x: 240, y: 20, w: 200, h: 46, hue: 'blue', pad: 6, title: 'ate-api-server', sub: 'EgressPolicy default of f-main' });

  f.rect(160, 92, 174, 180, { fill: 'none', stroke: color('violet-ink'), dash: 'dashed' });
  f.kicker(170, 110, 'Worker pod', { hue: 'violet' });
  const actor = f.box({ x: 16, y: 163, w: 124, h: 52, hue: 'green', title: 'actor f-main', sub: actorIp });
  const relay = f.box({ x: 172, y: 120, w: 150, h: 46, hue: 'violet', title: 'DNS relay', sub: `${relayIp}:53` });
  const tunnel = f.box({ x: 172, y: 212, w: 150, h: 46, hue: 'violet', title: 'atunnel', sub: 'actor certificate' });
  const dns = f.box({ x: 450, y: 120, w: 120, h: 46, hue: 'grey', title: 'cluster DNS', sub: 'CoreDNS' });
  const egress = f.box({ x: 400, y: 212, w: 120, h: 46, hue: 'indigo', pad: 6, title: 'atenet-egress', sub: 'checks the request' });
  const upstream = f.box({ x: 548, y: 212, w: 80, h: 46, hue: 'olive', pad: 6, title: 'whoami', sub: 'upstream' });

  f.path(`M${actor.cx} ${actor.y} V${relay.cy} H${relay.x - 1}`, { style: 'call' });
  f.text(actor.cx + 6, relay.cy - 7, 'DNS query', { size: 11, serif: true, hue: 'ink-soft' });
  f.path(`M${actor.cx} ${actor.y + actor.h} V${tunnel.cy} H${tunnel.x - 1}`, { style: 'call' });
  f.text(16, tunnel.cy + 18, 'every TCP connection', { size: 11, serif: true, hue: 'ink-soft' });

  f.arrow(relay.right(), [dns.x - 1, relay.cy], { style: 'call', label: 'listed names', labelX: 380 });
  f.text(relay.x, relay.y + relay.h + 17, 'other names: NXDOMAIN', { size: 11, hue: 'rose' });
  f.arrow(tunnel.right(), [egress.x - 1, tunnel.cy], { style: 'event', label: 'CONNECT', note: 'mutual TLS', labelX: 367 });
  f.arrow(egress.right(), [upstream.x - 1, egress.cy], { style: 'call' });
  f.text(upstream.cx, upstream.y - 9, `sees ${gatewayIp}`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(egress.x, egress.y + egress.h + 18, 'outside the policy: 403 or reset', { size: 11, hue: 'rose' });

  f.line(280, api.y + api.h, 280, relay.y - 1, { style: 'reply' });
  f.text(288, 84, 'policy, cached 5 s', { size: 11, serif: true, hue: 'ink-soft' });
  f.line(432, api.y + api.h, 432, egress.y - 1, { style: 'reply' });
  f.text(440, 192, 'policy', { size: 11, serif: true, hue: 'ink-soft' });
});
