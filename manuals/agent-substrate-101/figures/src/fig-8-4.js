'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-8-4', {
  height: 346,
  title: 'The four steps of a supported upgrade',
  desc: 'Four upgrade steps from top to bottom: the podcertificate-controller, atelet on each node, the workers, and then the API server with the controller and the dataplane. Running actors see nothing in the first two steps. In the worker step each actor gets SIGTERM and 30 minutes, and an actor that nothing suspends becomes crashed. The last step migrates the database schema, which a rollback does not undo.',
}, f => {
  const LEFT = 20;
  const WIDE = 240;
  const RIGHT = 310;
  const TALL = 60;
  const row = index => 30 + index * 80;
  f.kicker(LEFT, 20, 'what moves, in this order');
  f.kicker(RIGHT, 20, 'what a running actor sees');
  const steps = [
    { hue: 'blue', title: '1  podcertificate-controller', sub: ['signs component certificates'] },
    { hue: 'violet', title: '2  atelet', sub: ['one node at a time'] },
    { hue: 'violet', title: '3  workers', sub: ['10 percent of a pool in each batch'] },
    { hue: 'blue', title: '4  ate-api-server and the rest', sub: ['ate-idp-server, CRDs, ate-controller,', 'router, egress, SandboxConfig'] },
  ];
  steps.forEach((step, index) => {
    f.box({ x: LEFT, y: row(index), w: WIDE, h: TALL, pad: 6, ...step });
    if (index) f.arrow([LEFT + WIDE / 2, row(index - 1) + TALL], [LEFT + WIDE / 2, row(index) - 1], {});
  });
  const across = (index, style) => f.arrow([LEFT + WIDE, row(index) + TALL / 2], [RIGHT - 1, row(index) + TALL / 2], { style });
  f.box({ x: RIGHT, y: row(0), w: 310, h: TALL, hue: 'green', title: 'nothing', sub: ['the actor keeps running'] });
  f.box({ x: RIGHT, y: row(1), w: 310, h: TALL, hue: 'green', title: 'nothing', sub: ['the actor keeps running'] });
  f.box({ x: RIGHT, y: row(2), w: 176, h: TALL, hue: 'amber', title: 'SIGTERM, 30 minutes', sub: ['your harness must call', 'SuspendActor in that time'], titleSize: 12, pad: 6, strokeWidth: 2 });
  f.box({ x: RIGHT + 204, y: row(2), w: 106, h: TALL, hue: 'rose', title: 'CRASHED', sub: ['if nothing', 'suspends it'], titleSize: 12, pad: 6 });
  f.box({ x: RIGHT, y: row(3), w: 310, h: TALL, hue: 'teal', title: 'the schema migrates', sub: ['API calls can be cut once', 'a rollback does not undo the migration'] });
  across(0, 'call');
  across(1, 'call');
  across(2, 'state');
  across(3, 'write');
  f.arrow([RIGHT + 176, row(2) + TALL / 2], [RIGHT + 203, row(2) + TALL / 2], { style: 'fail' });
});
