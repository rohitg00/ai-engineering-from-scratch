'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function band(f, y, h, label, options = {}) {
  f.rect(20, y, 520, h, { fill: color('paper'), stroke: options.stroke || color('ink-mute'), dash: options.dash });
  [].concat(label).forEach((line, index) => f.text(28, y + 17 + index * 14, line, { size: 11, hue: 'ink-soft' }));
}

function bracket(f, y1, y2, lines) {
  f.rule(552, y1, 552, y2, { hue: 'ink-mute' });
  f.rule(548, y1, 552, y1, { hue: 'ink-mute' });
  f.rule(548, y2, 552, y2, { hue: 'ink-mute' });
  const top = (y1 + y2) / 2 - (lines.length - 1) * 7 + 4;
  lines.forEach((line, index) => f.text(560, top + index * 14, line, { size: 11, hue: 'ink-soft' }));
}

module.exports = figure('fig-spec-layers', {
  height: 510,
  title: 'The A2A stack for test-runner',
  desc: 'The planner, a client agent with a card cache and an interface choice, sits on top. Below it are the three protocol layers A2A defines for test-runner at localhost:41241: bindings with the paths /.well-known/agent-card.json, /a2a/jsonrpc and /a2a/rest, the operations, and the data model. Under a dashed line sits what test-runner builds itself: an HTTP router, a request handler, a task store and an event broadcast, and below them the opaque agent logic, where a real agent would also keep a model and tools.',
}, f => {
  f.kicker(20, 18, 'client agent');
  bracket(f, 26, 90, ['you', 'build it']);
  f.kicker(20, 118, 'A2A protocol');
  band(f, 126, 60, ['card and', 'bindings']);
  band(f, 192, 60, 'operations');
  band(f, 258, 46, 'data model');
  bracket(f, 126, 304, ['A2A', 'defines it']);
  f.rule(20, 320, 540, 320, { dash: 'dashed' });
  f.kicker(20, 344, 'test-runner · localhost:41241');
  band(f, 352, 76, 'server');
  band(f, 434, 66, ['agent', 'logic'], { stroke: color('plum-ink'), dash: 'dashed' });
  bracket(f, 352, 500, ['its owner', 'builds it']);

  f.beat(1);
  f.box({ x: 20, y: 26, w: 400, h: 64, hue: 'violet', title: 'planner', sub: ['card cache: agents by skill id', 'interface: JSONRPC, version 1.0'] });

  f.beat(2);
  f.box({ x: 96, y: 132, w: 212, h: 48, hue: 'blue', title: '/.well-known/agent-card.json', sub: 'the card, a plain GET', titleSize: 11.5, pad: 8 });
  f.arrow([202, 90], [202, 131], { style: 'call', label: 'GET the card' });

  f.beat(3);
  f.box({ x: 316, y: 132, w: 112, h: 48, hue: 'blue', title: '/a2a/jsonrpc', sub: 'JSONRPC 1.0', titleSize: 11.5, pad: 8 });
  f.box({ x: 436, y: 132, w: 96, h: 48, hue: 'blue', title: '/a2a/rest', sub: 'HTTP+JSON 1.0', titleSize: 11.5, pad: 8 });
  f.arrow([372, 90], [372, 131], { style: 'call', label: 'POST SendMessage' });

  f.beat(4);
  ['SendMessage · SendStreamingMessage · GetTask', 'ListTasks · CancelTask · SubscribeToTask', '4 push config operations · GetExtendedAgentCard']
    .forEach((line, index) => f.text(110, 209 + index * 15, line, { size: 11 }));

  f.beat(5);
  ['AgentCard · Task · TaskStatus · Message · Part', 'Artifact · TaskStatusUpdateEvent · TaskArtifactUpdateEvent']
    .forEach((line, index) => f.text(110, 276 + index * 15, line, { size: 11 }));

  f.beat(6);
  f.box({ x: 84, y: 358, w: 100, h: 64, hue: 'grey', title: 'HTTP router', sub: ['Handler', 'routes 3 paths'], titleSize: 12, pad: 8 });
  f.box({ x: 190, y: 358, w: 120, h: 64, hue: 'blue', title: 'request handler', sub: ['Agent.send', 'creates the task'], titleSize: 12, pad: 6 });
  f.box({ x: 316, y: 358, w: 92, h: 64, hue: 'teal', title: 'task store', sub: ['Agent.tasks', 'in memory'], titleSize: 12, pad: 8 });
  f.box({ x: 414, y: 358, w: 118, h: 64, hue: 'indigo', title: 'broadcast', sub: ['Agent.broadcast', 'SSE and webhooks'], titleSize: 12, pad: 8 });

  f.beat(7);
  f.box({ x: 84, y: 442, w: 150, h: 50, hue: 'plum', title: 'run_tests()', sub: 'capture/agents.py', titleSize: 12, pad: 8 });
  f.box({ x: 242, y: 442, w: 120, h: 50, hue: 'plum', dash: 'dashed', title: 'model', sub: 'not in the kit', titleSize: 12, pad: 8 });
  f.box({ x: 370, y: 442, w: 162, h: 50, hue: 'olive', dash: 'dashed', title: 'Git, container', sub: 'not in the kit', titleSize: 12, pad: 8 });
});
