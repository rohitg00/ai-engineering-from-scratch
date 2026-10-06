'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-finding-an-agent', {
  height: 462,
  title: 'From a host to a checked call',
  desc: 'Three stages, top to bottom, drawn step by step. First, the planner finds the code-reviewer card: direct configuration gives it the host, and a GET of /.well-known/agent-card.json returns the card, while a registry is a third route the kit does not use. Second, the planner takes interface 0, JSON-RPC 1.0 at /a2a/jsonrpc, and skips interface 1, HTTP+JSON. Third, it reads the capability flags: streaming is true and pushNotifications is absent, and a CreateTaskPushNotificationConfig call that ignores the absent flag fails with error -32003.',
}, f => {
  f.kicker(20, 18, '1 · find the card');
  f.kicker(20, 176, '2 · take the first interface you speak');
  f.kicker(20, 284, '3 · check the flag before an optional call');
  const config = f.box({ x: 20, y: 35, w: 180, h: 46, hue: 'violet', title: 'direct configuration', titleSize: 12, sub: 'ports 41241, 41242, 41243' });

  f.beat(1);
  const wellKnown = f.box({ x: 245, y: 28, w: 150, h: 60, hue: 'blue', title: 'well-known URI', titleSize: 12, sub: ['GET /.well-known/', 'agent-card.json'] });
  f.arrow([config.x + config.w, 58], [wellKnown.x - 1, 58], { style: 'call', label: 'GET' });

  f.beat(2);
  const card = f.box({ x: 460, y: 35, w: 160, h: 46, hue: 'blue', title: 'code-reviewer', titleSize: 12, sub: 'agent card' });
  f.arrow([wellKnown.x + wellKnown.w, 58], [card.x - 1, 58], { style: 'reply', label: '200 OK' });

  f.beat(3);
  const registry = f.box({ x: 20, y: 100, w: 180, h: 46, hue: 'grey', dash: 'dashed', title: 'registry or catalog', titleSize: 12, sub: 'no standard query API' });
  f.path(`M${registry.x + registry.w} 123 H430 V72 H${card.x - 1}`, { style: 'reply', hue: 'grey', packet: false });
  f.text(315, 127, 'or a registry query', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', knock: true });

  f.beat(4);
  f.rule(540, card.y + card.h, 540, 188, { dash: 'dashed' });
  f.rect(20, 188, 600, 30, { hue: 'violet' });
  f.text(32, 207, '[0] JSONRPC, "1.0", http://localhost:41242/a2a/jsonrpc', { size: 11 });
  f.text(610, 207, 'chosen', { size: 11, serif: true, hue: 'violet', anchor: 'end', weight: 700 });
  f.rect(20, 224, 600, 30, { fill: color('paper'), stroke: color('ink-mute'), dash: 'dashed' });
  f.text(32, 243, '[1] HTTP+JSON, "1.0", http://localhost:41242/a2a/rest', { size: 11, hue: 'ink-mute' });
  f.text(610, 243, 'skipped: not JSON-RPC', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });

  f.beat(5);
  f.box({ x: 20, y: 294, w: 290, h: 46, hue: 'blue', title: 'streaming: true', titleSize: 12, sub: 'SendStreamingMessage, SubscribeToTask' });
  f.box({ x: 330, y: 294, w: 290, h: 46, hue: 'blue', dash: 'dashed', title: 'pushNotifications: absent', titleSize: 12, sub: 'the four push config operations fail' });

  f.beat(6);
  f.text(20, 368, 'exchange 6 of 11-errors.http calls one anyway:', { size: 11, serif: true, hue: 'ink-soft' });
  const planner = f.box({ x: 20, y: 380, w: 110, h: 72, hue: 'violet', title: 'planner', titleSize: 12, sub: 'client' });
  const reviewer = f.box({ x: 490, y: 380, w: 130, h: 72, hue: 'blue', title: 'code-reviewer', titleSize: 12, sub: '/a2a/jsonrpc' });
  f.arrow([planner.x + planner.w, 400], [reviewer.x - 1, 400], { style: 'call', label: 'CreateTaskPushNotificationConfig' });

  f.beat(7);
  f.arrow([reviewer.x, 436], [planner.x + planner.w + 1, 436], { style: 'fail', label: '-32003 PUSH_NOTIFICATION_NOT_SUPPORTED' });
});
