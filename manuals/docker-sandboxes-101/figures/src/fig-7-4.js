'use strict';

const { figure } = require('../../../_shared/figkit.js');

const confirmed = [
  { hue: 'teal', title: 'sentinel inside, real secret outside', sub: '10-env-sentinel.txt, 10-receiver.log' },
  { hue: 'indigo', title: 'default deny on example.com:443', sub: '09-blocked.txt, 09-check-verbose.json' },
  { hue: 'blue', title: 'private Docker Engine 29.8.1 inside', sub: '04-guest.txt' },
  { hue: 'green', title: 'fetched via sandbox-m101-clone', sub: '08-clone-host.txt' },
  { hue: 'indigo', title: 'proxy gateway.docker.internal:3128', sub: '04-env.txt' },
  { hue: 'olive', title: 'MCP_GATEWAY_URL set inside', sub: '11-static-inside.txt' },
  { hue: 'violet', title: 'toolsets prints 27 types', sub: '16-toolsets.txt' },
  { hue: 'plum', title: 'ai/qwen3:4b on DMR, no key set', sub: '25-doctor.txt, 27-inside-run.txt' },
];

const reported = [
  { hue: 'grey', title: 'HTTPS re-signed by a MITM proxy', sub: 'issue #12, not checked' },
  { hue: 'grey', title: 'the VMM is libkrun', sub: 'talk 2026-01-14, unverified' },
  { hue: 'grey', title: 'a start in tens of milliseconds', sub: 'talk 2026-02-10, K35 not run' },
  { hue: 'grey', title: 'a kit signature verifies', sub: 'sbx kit sign, not recorded' },
  { hue: 'grey', title: 'sbx policy approval is not a command', sub: '403 body names it, never run' },
  { hue: 'rose', title: 'allowed host as exfiltration path', sub: 'HN 2026-08-10, both sides printed' },
];

module.exports = figure('fig-7-4', {
  height: 440,
  title: 'Confirmed by a file, or only reported',
  desc: 'Two columns. The left column lists eight claims a recorded capture file confirms: the sentinel inside and the real secret outside, default deny on example.com:443, a private Docker Engine 29.8.1 inside, commits fetched through the sandbox-m101-clone remote, the proxy at gateway.docker.internal:3128, MCP_GATEWAY_URL set inside the sandbox, docker-agent toolsets printing 27 types, and ai/qwen3:4b answering on Docker Model Runner with no provider key set. The right column lists six claims. Five are reported without a test: a MITM proxy that re-signs HTTPS, libkrun as the VMM, a start in tens of milliseconds, a verified kit signature, and sbx policy approval missing from the help although a 403 body names it. One rose box marks the disputed exfiltration path.',
}, f => {
  f.kicker(20, 18, 'confirmed by a capture file', { hue: 'teal' });
  f.kicker(336, 18, 'reported, not tested here', { hue: 'grey' });
  f.rule(320, 8, 320, 432, { dash: 'dashed' });
  [[confirmed, 20], [reported, 336]].forEach(([column, x]) => {
    column.forEach((item, index) => {
      f.box({ x, y: 30 + index * 50, w: 284, h: 42, hue: item.hue, title: item.title, sub: item.sub, titleSize: 12, dash: item.hue === 'grey' || item.hue === 'rose' ? 'dashed' : undefined });
    });
  });
});
