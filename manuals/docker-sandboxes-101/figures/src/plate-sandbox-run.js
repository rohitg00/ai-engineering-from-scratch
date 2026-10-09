'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('plate-sandbox-run', {
  height: 440,
  title: 'One agent, one microVM, one proxy',
  desc: 'The recorded docker-agent run --sandbox on the capture Mac. On the host, docker-agent v1.149.0 stages the kit sandbox-kits/<hash>, writes the allowlist with models.dev and localhost:12434 into the proxy rules, and asks sbx and sandboxd to create the sandbox, which becomes running. Below the Hypervisor.framework line, the microVM docker-agent-<hash> from docker/docker-agent-sbx-templates:latest holds docker-agent version main, its filesystem and shell tools, the workspace mounts, and an environment whose proxy is gateway.docker.internal:3128 and whose provider keys read proxy-managed. The model call goes up to host.docker.internal:12434, through the proxy, and on to Docker Model Runner on port 12434 with ai/qwen3:4b. The answer is: The working directory contains README.md with 1 line.',
}, f => {
  f.kicker(20, 18, 'host · macOS 26.2 arm64');
  f.text(620, 18, 'docker-agent run --sandbox --exec files-sandbox.yaml', { size: 11, anchor: 'end', hue: 'ink-soft' });

  const agent = f.box({ x: 20, y: 34, w: 150, h: 46, hue: 'violet', title: 'docker-agent', sub: 'v1.149.0, Homebrew', titleSize: 12 });
  const sbx = f.box({ x: 222, y: 34, w: 100, h: 46, hue: 'blue', title: 'sbx, sandboxd', sub: 'v0.47.0', titleSize: 11, pad: 6 });
  const proxy = f.box({ x: 338, y: 34, w: 110, h: 46, hue: 'indigo', title: 'proxy :3128', sub: 'on the host', titleSize: 11, pad: 6 });
  f.box({ x: 520, y: 34, w: 100, h: 46, hue: 'plum', title: 'Model Runner', sub: 'ai/qwen3:4b', titleSize: 11, pad: 6 });
  f.box({ x: 20, y: 104, w: 140, h: 46, hue: 'green', title: 'sandbox-kits/<hash>', sub: 'the staged kit', titleSize: 11, pad: 6 });
  f.box({ x: 176, y: 104, w: 124, h: 56, hue: 'teal', title: 'allowlist', sub: ['models.dev', 'localhost:12434'], titleSize: 11, pad: 6 });

  f.rule(20, 172, 620, 172, { dash: 'dashed' });
  f.rule(90, 150, 90, 231, { hue: 'green', dash: 'dashed' });
  f.line(312, 80, 312, 201, { style: 'state' });
  f.text(306, 197, 'created, running', { size: 11.5, anchor: 'end', hue: 'amber', knock: true });

  f.arrow(agent.right(23), [sbx.x - 1, sbx.y + 23], { style: 'call', label: 'create' });
  f.arrow([90, 80], [90, 103], { style: 'write', label: 'stage' });
  f.arrow([160, 80], [230, 103], { style: 'write', label: 'allow' });
  f.arrow([300, 116], [360, 81], { style: 'write', label: 'proxy rules' });
  f.arrow(proxy.right(23), [519, proxy.y + 23], { style: 'model', label: ':12434' });

  f.box({ x: 338, y: 232, w: 272, h: 58, hue: 'violet', title: 'docker-agent version main', sub: ['commit 154b78f2', 'runs files-sandbox.yaml'], titleSize: 12 });
  f.arrow([413, 231], [413, 81], { style: 'model', label: 'host.docker.internal:12434', note: 'through HTTP_PROXY' });

  f.text(30, 182, 'Hypervisor.framework · kern.hv_support: 1', { size: 11, hue: 'ink-soft', knock: true });
  f.rect(20, 202, 600, 226, { fill: 'none', stroke: color('ink-mute') });
  f.text(30, 220, 'microVM docker-agent-<hash> · docker/docker-agent-sbx-templates:latest', { size: 11, knock: true });

  f.box({ x: 30, y: 232, w: 290, h: 58, hue: 'green', title: 'workspace mounts', sub: ['repo-sandbox rw, agents ro', 'sandbox-kits ro, cfg ro'], titleSize: 12 });
  f.box({ x: 30, y: 300, w: 290, h: 58, hue: 'indigo', title: 'environment', sub: ['HTTP_PROXY gateway.docker.internal:3128', 'ANTHROPIC_API_KEY=proxy-managed'], titleSize: 12 });
  f.box({ x: 338, y: 300, w: 272, h: 58, hue: 'olive', title: 'filesystem, shell', sub: ['tools that act on the mounts', 'inside the VM'], titleSize: 12 });
  f.box({ x: 30, y: 372, w: 580, h: 40, hue: 'grey', title: 'The working directory contains README.md with 1 line.', titleSize: 12, weight: 400 });
});
