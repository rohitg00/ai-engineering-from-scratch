'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-6', {
  height: 376,
  title: 'The capture compose.yaml with a model and a gateway',
  desc: 'The top-level models element declares llm with model ai/qwen3:4b, and Compose asks Docker Model Runner to pull and configure it. Inside the Compose project m101, the service printer on alpine:3.22 binds llm with endpoint_var LLM_URL and model_var LLM_MODEL and receives LLM_MODEL=ai/qwen3:4b and LLM_URL=http://model-runner.docker.internal/v1/. Its GET of LLM_URL followed by models answers 200 with the model list. The service mcp-gateway runs docker/mcp-gateway with --transport=streaming --port=8811 and use_api_socket true, starts no server, prints a bearer token, and answers the printer request without that token with 401 Unauthorized.',
}, f => {
  const models = f.box({ x: 20, y: 30, w: 250, h: 50, hue: 'plum', title: 'models: llm', sub: 'model: ai/qwen3:4b' });
  const runner = f.box({ x: 400, y: 30, w: 220, h: 50, hue: 'plum', title: 'Docker Model Runner', sub: 'model-runner.docker.internal' });
  f.arrow(models.right(), [runner.x - 1, models.cy], { style: 'call', label: 'pull, configure', labelSize: 11 });

  f.rect(10, 118, 360, 246, { stroke: color('ink-mute'), dash: 'dashed' });
  f.kicker(20, 110, 'compose project m101');
  const printer = f.box({ x: 20, y: 130, w: 340, h: 74, hue: 'grey', title: 'printer, alpine:3.22', sub: ['LLM_MODEL=ai/qwen3:4b', 'LLM_URL=http://model-runner.docker.internal/v1/'] });
  f.arrow([250, models.y + models.h], [250, printer.y - 1], { style: 'call', label: 'endpoint_var, model_var', labelSize: 11 });
  f.path(`M${printer.x + printer.w} 150 H560 V${runner.y + runner.h + 1}`, { style: 'call' });
  f.text(455, 144, 'GET LLM_URL models: 200', { size: 11, anchor: 'middle', knock: true });

  const gateway = f.box({ x: 20, y: 264, w: 340, h: 86, hue: 'olive', title: 'mcp-gateway, docker/mcp-gateway', sub: ['--transport=streaming --port=8811', 'use_api_socket: true, no server', 'prints a bearer token, 0 tools'] });
  f.arrow([190, printer.y + printer.h], [190, gateway.y - 1], { style: 'fail', label: '401 Unauthorized', labelSize: 11 });
  const api = f.box({ x: 450, y: 264, w: 170, h: 86, hue: 'grey', title: 'Docker Engine API', sub: ['the host socket', 'no server started'] });
  f.arrow(gateway.right(), [api.x - 1, gateway.cy], { style: 'call', label: 'API socket', labelSize: 11 });
});
