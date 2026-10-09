'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function block(f, x, y, w, hue, head, lines, dash) {
  const h = 26 + lines.length * 15 + 6;
  f.rect(x, y, w, h, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`), dash });
  f.text(x + 10, y + 18, head, { size: 12, weight: 700, hue });
  lines.forEach((line, index) => f.text(x + 10, y + 36 + index * 15, line, { size: 11 }));
  return { x, y, w, h, cx: x + w / 2, bottom: y + h };
}

module.exports = figure('fig-5-2', {
  height: 512,
  title: 'Two ways a model reference reaches Model Runner',
  desc: 'Left column, capture/fixtures/agents/files.yaml: agents.root with model local resolves to models.local with provider dmr, model ai/qwen3:4b and temperature 0; with no base_url the endpoint is found by running docker model status --json. Right column, capture/fixtures/agents/dmr.yaml: agents.root with model qwen resolves to models.qwen with provider runner, which resolves to providers.runner with provider dmr and base_url http://localhost:12434/engines/llama.cpp/v1. Bottom row: the auto decision as doctor printed it. No cloud provider has a credential, so auto looks for a pulled Model Runner model: with the runner up it picks dmr/docker.io/ai/qwen3:4b, and with no runner it names dmr/ai/qwen3:latest and reports no usable model.',
}, f => {
  f.box({ x: 20, y: 28, w: 285, h: 26, hue: 'violet', title: 'capture/fixtures/agents/files.yaml', titleSize: 11.5, align: 'left', pad: 8 });
  f.box({ x: 335, y: 28, w: 285, h: 26, hue: 'violet', title: 'capture/fixtures/agents/dmr.yaml', titleSize: 11.5, align: 'left', pad: 8 });

  const a1 = block(f, 20, 66, 285, 'violet', 'agents.root', ['description, instruction', 'max_iterations: 8', 'toolsets: filesystem, shell']);
  const a2 = block(f, 20, 178, 285, 'plum', 'models.local', ['provider: dmr', 'model: ai/qwen3:4b', 'temperature: 0']);
  const a3 = block(f, 20, 290, 285, 'grey', 'endpoint discovery', ['docker model status --json', 'run by docker-agent itself'], 'dashed');
  f.arrow([a1.cx, a1.bottom], [a1.cx, a2.y - 1], { style: 'call', label: 'model: local' });
  f.arrow([a2.cx, a2.bottom], [a2.cx, a3.y - 1], { style: 'call', label: 'no base_url' });

  const b1 = block(f, 335, 66, 285, 'violet', 'agents.root', ['description, instruction', 'no toolsets']);
  const b2 = block(f, 335, 178, 285, 'plum', 'models.qwen', ['provider: runner', 'model: ai/qwen3:4b', 'temperature: 0']);
  const b3 = block(f, 335, 290, 285, 'plum', 'providers.runner', ['provider: dmr', 'base_url: http://localhost:12434', '  /engines/llama.cpp/v1']);
  f.arrow([b1.cx, b1.bottom], [b1.cx, b2.y - 1], { style: 'call', label: 'model: qwen' });
  f.arrow([b2.cx, b2.bottom], [b2.cx, b3.y - 1], { style: 'call', label: 'provider: runner' });

  f.kicker(20, 402, 'model: auto, as doctor printed it');
  const q1 = f.box({ x: 20, y: 418, w: 165, h: 60, hue: 'grey', title: 'cloud credential?', sub: ['20 providers: not set'] });
  const q2 = f.box({ x: 212, y: 418, w: 170, h: 60, hue: 'grey', title: 'pulled DMR model?', sub: ['docker model status'] });
  const yes = f.box({ x: 420, y: 412, w: 200, h: 40, hue: 'plum', title: 'dmr/docker.io/ai/qwen3:4b', titleSize: 11, sub: ['25-doctor.txt, exit 0'] });
  const no = f.box({ x: 420, y: 462, w: 200, h: 40, hue: 'rose', title: 'dmr/ai/qwen3:latest', titleSize: 11, sub: ['16-doctor.txt, exit 1'] });
  f.arrow(q1.right(), [q2.x - 1, q1.cy], { style: 'call', label: 'no' });
  f.arrow([q2.x + q2.w, 438], [yes.x - 1, yes.cy], { style: 'reply' });
  f.arrow([q2.x + q2.w, 458], [no.x - 1, no.cy], { style: 'fail' });
});
