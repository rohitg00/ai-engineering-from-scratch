'use strict';

const { figure } = require('../../../_shared/figkit.js');

const left = [
  { hue: 'grey', title: 'you type', sub: 'sbx run docker-agent ~/my-project' },
  { hue: 'blue', title: 'sbx creates the sandbox', sub: 'docker/sandbox-templates:docker-agent' },
  { hue: 'violet', title: 'startup command inside', sub: 'docker-agent run --yolo' },
  { hue: 'green', title: 'agent file', sub: 'project config in the workspace only' },
  { hue: 'indigo', title: 'network', sub: 'the sbx policy of the sandbox' },
  { hue: 'grey', title: 'in this manual', sub: 'docs only, no capture', dash: 'dashed' },
];
const right = [
  { hue: 'grey', title: 'you type', sub: 'docker-agent run --sandbox agent.yaml' },
  { hue: 'blue', title: 'docker-agent drives sbx', sub: 'docker/docker-agent-sbx-templates:latest' },
  { hue: 'violet', title: 'agent binary inside', sub: 'docker-agent version main' },
  { hue: 'green', title: 'agent file', sub: 'its directory mounted ro, kit ro' },
  { hue: 'indigo', title: 'network', sub: 'sbx policy, plus models.dev and allow hosts' },
  { hue: 'grey', title: 'in this manual', sub: 'capture/out/27-*' },
];

module.exports = figure('fig-1-2', {
  height: 412,
  title: 'Two ways to start docker-agent in a sandbox',
  desc: 'Two columns, one per launch path. Left: sbx run docker-agent on a project directory, where sbx creates the sandbox from docker/sandbox-templates:docker-agent, starts docker-agent run --yolo inside, reads only project config in the workspace, and applies the sbx policy; this manual has no capture of it. Right: docker-agent run --sandbox agent.yaml, where the host docker-agent drives sbx with docker/docker-agent-sbx-templates:latest, the binary inside reports version main, the agent file directory and the kit are mounted read-only, and models.dev and the sandbox allow hosts are opened; recorded in capture/out/27.',
}, f => {
  f.text(20, 20, 'A · sbx run docker-agent', { size: 12, weight: 700, hue: 'blue' });
  f.text(336, 20, 'B · docker-agent run --sandbox', { size: 12, weight: 700, hue: 'violet' });
  f.rule(320, 8, 320, 404, { dash: 'dashed' });
  [[left, 20], [right, 336]].forEach(([column, x]) => {
    column.forEach((item, index) => {
      f.box({ x, y: 32 + index * 62, w: 284, h: 50, titleSize: 12, ...item });
    });
  });
});
