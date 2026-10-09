'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const groups = [
  ['Who it is', 'identity, plus proof of who published it', [
    ['name', true, ['"test-runner"']],
    ['description', true, ['"Checks out a commit, runs its test suite in a', 'clean container, and streams the log."']],
    ['provider', false, ['organization "Platform Team", url "https://ci.example.com"']],
    ['version', true, ['"2.3.0"'], 'the agent release, not the protocol version'],
    ['documentationUrl', false, null],
    ['iconUrl', false, null],
    ['signatures', false, null, 'deployer signs its card (section 2.3)'],
  ]],
  ['Where to reach it', 'ordered, and the first entry is preferred', [
    ['supportedInterfaces', true, ['[0] JSONRPC, "1.0", http://localhost:41241/a2a/jsonrpc', '[1] HTTP+JSON, "1.0", http://localhost:41241/a2a/rest']],
  ]],
  ['What it demands', 'an absent flag counts the same as false', [
    ['capabilities', true, ['streaming true, pushNotifications true']],
    ['securitySchemes', false, null],
    ['securityRequirements', false, null, 'so calls need no credentials'],
  ]],
  ['What it offers', 'media types, and skills that describe work', [
    ['defaultInputModes', true, ['"text/plain", "application/json"']],
    ['defaultOutputModes', true, ['"text/plain", "application/json"']],
    ['skills', true, ['[0] id "run-tests", name "Run tests",', 'tags "ci", "tests"'], 'plus a description and one example'],
  ]],
];

module.exports = figure('fig-agent-card-fields', {
  height: 556,
  title: 'The test-runner agent card, field by field',
  desc: 'The agent card that test-runner serves at /.well-known/agent-card.json, drawn as rows under four headings that appear one after another. Who it is: name, description, provider and version, with documentationUrl, iconUrl and signatures not set. Where to reach it: two supportedInterfaces, JSON-RPC first and HTTP+JSON second. What it demands: capabilities with streaming and pushNotifications true, and no security fields. What it offers: text/plain and application/json modes and the run-tests skill. A dot marks each REQUIRED field.',
}, f => {
  f.box({ x: 20, y: 10, w: 600, h: 40, hue: 'blue', title: 'test-runner agent card', sub: 'GET http://localhost:41241/.well-known/agent-card.json', align: 'left' });
  let y = 58;
  groups.forEach(([kicker, note, rows], index) => {
    f.beat(index + 1);
    f.rect(20, y, 600, 24, { hue: 'blue' });
    f.kicker(32, y + 16, kicker, { hue: 'blue' });
    f.text(204, y + 16, note, { size: 11, serif: true, hue: 'ink-soft' });
    y += 24;
    for (const [field, required, values, aside] of rows) {
      const lines = values || ['not set'];
      const h = lines.length > 1 ? 36 : 22;
      if (values) f.rect(20, y, 600, h, { fill: color('paper'), stroke: color('panel-edge') });
      else f.rect(20, y, 600, h, { fill: color('paper'), stroke: color('ink-mute'), dash: 'dashed' });
      if (required) f.dot(30, y + 11, { r: 3, hue: 'blue' });
      f.text(40, y + 15, field, { size: 12, weight: required ? 700 : undefined, hue: values ? undefined : 'ink-mute' });
      lines.forEach((line, lineIndex) => f.text(204, y + 15 + lineIndex * 15, line, { size: 11, hue: values ? undefined : 'ink-mute' }));
      if (aside) f.text(610, y + 15 + (lines.length - 1) * 15, aside, { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
      y += h;
    }
    y += 6;
  });
  f.beat(0);
  f.dot(30, y + 12, { r: 3, hue: 'blue' });
  f.text(40, y + 16, 'REQUIRED in proto AgentCard', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(250, y + 5, 26, 14, { fill: color('paper'), stroke: color('ink-mute'), dash: 'dashed' });
  f.text(284, y + 16, 'optional, and not set on this card', { size: 11, serif: true, hue: 'ink-soft' });
});
