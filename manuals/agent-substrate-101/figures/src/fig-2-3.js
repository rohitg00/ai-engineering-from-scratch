'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../capture/lab/summary/dependency-loss-x86.json'), 'utf8'));
const outage = data.outages['kube-apiserver'];
const proxy = outage.summary.proxy;
const running = outage.summary.running;

module.exports = figure('fig-2-3', {
  height: 330,
  title: 'Two paths to one actor while kube-apiserver is down',
  desc: `Two columns. On the left, curl sends to kubectl ate proxy, which tunnels through kube-apiserver to atenet-router port 8444 and then to the actor. With kube-apiserver down for ${outage.outage_seconds} seconds, ${proxy.ok_during_outage} of ${proxy.requests_during_outage} requests on this path were served. On the right, a pod with a client certificate sends to atenet-router port 443 directly, and ${running.ok_during_outage} of ${running.requests_during_outage} requests were served in the same ${outage.outage_seconds} seconds.`,
}, f => {
  f.kicker(20, 18, 'A · kubectl ate proxy actor');
  f.kicker(336, 18, 'B · a pod with a client certificate');
  f.rule(320, 8, 320, 322, { dash: 'dashed' });
  const left = [
    { hue: 'olive', title: 'curl', sub: 'POST http://localhost:8000/' },
    { hue: 'olive', title: 'kubectl ate proxy actor', sub: 'on your machine' },
    { hue: 'rose', title: 'kube-apiserver', sub: `down for ${outage.outage_seconds} s`, dash: 'dashed' },
    { hue: 'indigo', title: 'atenet-router:8444', sub: 'mTLS CONNECT' },
  ];
  const right = [
    { hue: 'olive', title: 'e-prober pod', sub: 'ate-target-actor: lab-e/e-run' },
    { hue: 'indigo', title: 'atenet-router:443', sub: 'checks the SPIFFE ID' },
    { hue: 'violet', title: 'worker pod', sub: 'CONNECT to port 8443' },
    { hue: 'green', title: 'actor e-run', sub: 'ACTOR_STATE_RUNNING' },
  ];
  left.forEach((item, index) => {
    const y = 30 + index * 66;
    f.box({ x: 20, y, w: 284, h: 42, ...item });
    if (index < left.length - 1) {
      f.beat(index + 1);
      f.arrow([162, y + 42], [162, y + 65], { style: index >= 1 ? 'fail' : 'call' });
      f.beat(0);
    }
  });
  right.forEach((item, index) => {
    const y = 30 + index * 66;
    f.box({ x: 336, y, w: 284, h: 42, ...item });
    if (index < right.length - 1) {
      f.beat(index + 4);
      f.arrow([478, y + 42], [478, y + 65], { style: index === 1 ? 'event' : 'call' });
      f.beat(0);
    }
  });
  f.text(162, 300, `${proxy.ok_during_outage} of ${proxy.requests_during_outage} requests served`, { size: 12.5, weight: 700, anchor: 'middle', hue: 'rose' });
  f.text(478, 300, `${running.ok_during_outage} of ${running.requests_during_outage} requests served`, { size: 12.5, weight: 700, anchor: 'middle', hue: 'green' });
  f.text(162, 318, 'every one timed out at the client', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
  f.text(478, 318, 'kube-apiserver is not on this path', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
