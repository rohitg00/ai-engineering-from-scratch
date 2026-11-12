'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const results = fs.readFileSync(path.join(__dirname, '../../capture/lab/F-egress/envoy/20-results.txt'), 'utf8');
const actorIp = /inet (169\.254\.[0-9.]+\/30)/.exec(results)[1];
const relayIp = /nameserver ([0-9.]+)/.exec(results)[1];
const gatewayIp = /RemoteAddr: ([0-9.]+):/.exec(results)[1];

module.exports = figure('fig-6-2', {
  height: 318,
  title: 'Where an outgoing connection from an actor is decided',
  desc: `The actor f-main at ${actorIp} sends DNS queries to the DNS relay at ${relayIp} and every TCP connection to the TCP tunnel. Both are parts of atunnel in the worker pod. The relay forwards names that the policy lists to the cluster DNS and answers NXDOMAIN for other names. The tunnel opens an mTLS CONNECT to atenet-egress, which reads the policy of f-main from ate-api-server and connects to the upstream host. The upstream sees ${gatewayIp}. A request outside the policy gets 403 or a reset.`,
}, f => {
  f.rect(160, 26, 172, 216, { fill: 'none', stroke: color('violet-ink'), dash: 'dashed' });
  f.kicker(170, 44, 'worker pod: atunnel', { hue: 'violet' });
  const actor = f.box({ x: 16, y: 112, w: 120, h: 50, hue: 'green', title: 'actor f-main', sub: actorIp });
  const relay = f.box({ x: 172, y: 58, w: 148, h: 46, hue: 'violet', title: 'DNS relay', sub: `${relayIp}:53` });
  const tunnel = f.box({ x: 172, y: 170, w: 148, h: 46, hue: 'violet', title: 'TCP tunnel', sub: 'actor certificate' });
  const dns = f.box({ x: 384, y: 58, w: 130, h: 46, hue: 'grey', title: 'cluster DNS', sub: 'CoreDNS' });
  const egress = f.box({ x: 384, y: 170, w: 130, h: 46, hue: 'indigo', title: 'atenet-egress', sub: 'reads the policy' });
  const upstream = f.box({ x: 540, y: 170, w: 88, h: 46, hue: 'olive', title: 'whoami', sub: 'upstream', pad: 6 });
  const api = f.box({ x: 384, y: 262, w: 130, h: 44, hue: 'blue', title: 'ate-api-server', sub: 'policy of f-main' });
  f.path(`M76 ${actor.y} V81 H171`, { style: 'call' });
  f.text(16, 74, 'DNS query', { size: 11, serif: true, hue: 'ink-soft' });
  f.path(`M76 ${actor.y + actor.h} V193 H171`, { style: 'call' });
  f.text(16, 212, 'every TCP', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(16, 226, 'connection', { size: 11, serif: true, hue: 'ink-soft' });
  f.arrow(relay.right(), [dns.x - 1, relay.cy], { style: 'call', label: 'listed', labelX: 352 });
  f.text(172, 122, 'other names: NXDOMAIN', { size: 11, hue: 'rose' });
  f.arrow(tunnel.right(), [egress.x - 1, tunnel.cy], { style: 'event', label: 'mTLS', labelX: 352 });
  f.text(352, 212, 'CONNECT', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.arrow(egress.right(), [upstream.x - 1, egress.cy], { style: 'call' });
  f.text(584, 232, `sees ${gatewayIp}`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.arrow([420, egress.y + egress.h], [420, api.y - 1], { style: 'call', label: 'policy' });
  f.text(528, 274, 'outside the', { size: 11, hue: 'rose' });
  f.text(528, 288, 'policy: 403', { size: 11, hue: 'rose' });
  f.text(528, 302, 'or reset', { size: 11, hue: 'rose' });
  f.path(`M${api.x} 284 H246 V217`, { style: 'reply' });
  f.text(238, 262, 'policy,', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.text(238, 276, 'cached 5 s', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
});
