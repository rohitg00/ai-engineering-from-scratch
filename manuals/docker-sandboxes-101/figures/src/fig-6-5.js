'use strict';

const { figure } = require('../../../_shared/figkit.js');

const callers = [
  { title: 'docker-agent', sub: 'host process', hue: 'violet', url: 'http://localhost:12434', note: 'TCP enabled on port 12434' },
  { title: 'printer', sub: 'Compose service', hue: 'grey', url: 'http://model-runner.docker.internal', note: 'injected as LLM_URL with /v1/' },
  { title: 'container', sub: 'Docker Engine', hue: 'grey', url: 'http://172.17.0.1:12434', note: 'from the docs, not captured', dash: 'dashed' },
  { title: 'socket client', sub: 'host, Docker socket', hue: 'grey', url: 'http://localhost/exp/vDD4.40', note: 'endpointHost in model status' },
  { title: 'docker-agent', sub: 'inside a sandbox', hue: 'blue', url: 'http://host.docker.internal:12434', note: 'through the sandbox proxy' },
];

module.exports = figure('fig-6-5', {
  height: 372,
  title: 'Five base URLs for one Docker Model Runner',
  desc: 'Left: five callers of Docker Model Runner. docker-agent on the host uses http://localhost:12434 once host TCP is enabled. The Compose service printer gets http://model-runner.docker.internal, injected as LLM_URL with the /v1/ path. A container on Docker Engine uses http://172.17.0.1:12434, from the docs and not captured. A host process that talks to the Docker socket reaches http://localhost/exp/vDD4.40, the endpointHost of docker model status. docker-agent inside a sandbox uses http://host.docker.internal:12434 through the sandbox proxy. Right: the runner with llama.cpp b9879-metal and ai/qwen3:4b, and what follows the base URL: the path prefixes /engines/v1/ for OpenAI, /engines/llama.cpp/v1/ with the engine name, and /v1/, the whole endpoints /anthropic/v1/messages and /v1/messages for Anthropic, and the prefix /api/ for Ollama. No path checks credentials.',
}, f => {
  const runner = f.box({
    x: 430, y: 30, w: 190, h: 280, hue: 'plum', title: 'Docker Model Runner', align: 'left',
    sub: ['llama.cpp b9879-metal', 'model ai/qwen3:4b', 'paths after the base URL:', '/engines/v1/ OpenAI', '/engines/llama.cpp/v1/', '/v1/ status endpoint', '/anthropic/v1/messages', '/v1/messages, examples', '/api/ Ollama'],
  });
  callers.forEach((caller, index) => {
    const box = f.box({ x: 20, y: 30 + index * 58, w: 150, h: 44, hue: caller.hue, dash: caller.dash, title: caller.title, sub: caller.sub });
    f.arrow(box.right(), [runner.x - 1, box.cy], { style: 'call', label: caller.url, labelSize: 11, note: caller.note });
  });
  f.box({ x: 20, y: 324, w: 600, h: 34, hue: 'grey', dash: 'dashed', title: 'no path checks credentials: any client that reaches the port can run models', titleSize: 11.5, weight: 400 });
});
