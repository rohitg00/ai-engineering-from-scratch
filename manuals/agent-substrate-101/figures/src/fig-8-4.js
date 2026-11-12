'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-8-4', {
  height: 356,
  title: 'The four steps of a supported upgrade',
  desc: 'Four upgrade steps from top to bottom: the podcertificate-controller, atelet on each node, the workers, and then the API server with the controller and the dataplane. Running actors see nothing in the first two steps. In the worker step each actor gets SIGTERM and 30 minutes, and an actor that nothing suspends becomes crashed. The last step migrates the database schema, which a rollback does not undo.',
}, f => {
  f.kicker(20, 20, 'what moves');
  f.kicker(330, 20, 'what a running actor sees');
  const one = f.box({ x: 20, y: 30, w: 250, h: 50, hue: 'blue', title: '1  podcertificate-controller', sub: ['signs component certificates'] });
  const two = f.box({ x: 20, y: 104, w: 250, h: 50, hue: 'violet', title: '2  atelet', sub: ['one node at a time'] });
  const three = f.box({ x: 20, y: 178, w: 250, h: 50, hue: 'violet', title: '3  workers', sub: ['10 percent of a pool in each batch'] });
  const four = f.box({ x: 20, y: 284, w: 250, h: 56, hue: 'blue', title: '4  ate-api-server and the rest', sub: ['ate-idp-server, CRDs, ate-controller,', 'router, egress, SandboxConfig'] });
  f.arrow([145, 80], [145, 103], {});
  f.arrow([145, 154], [145, 177], {});
  f.arrow([145, 228], [145, 283], {});

  f.box({ x: 330, y: 30, w: 290, h: 50, hue: 'green', title: 'nothing', sub: ['the actor keeps running'] });
  f.box({ x: 330, y: 104, w: 290, h: 50, hue: 'green', title: 'nothing', sub: ['the actor keeps running'] });
  f.box({ x: 330, y: 178, w: 290, h: 50, hue: 'amber', title: 'SIGTERM, then 30 minutes', sub: ['your harness must call SuspendActor'] });
  f.box({ x: 330, y: 238, w: 290, h: 36, hue: 'rose', title: 'ACTOR_STATE_CRASHED', sub: ['if nothing suspended it in time'], titleSize: 11.5 });
  f.box({ x: 330, y: 284, w: 290, h: 56, hue: 'teal', title: 'the schema migrates', sub: ['API calls can be cut once', 'a rollback does not undo the migration'] });
  f.arrow([one.x + 250, 55], [329, 55], {});
  f.arrow([two.x + 250, 129], [329, 129], {});
  f.arrow([three.x + 250, 203], [329, 203], { style: 'state' });
  f.arrow([four.x + 250, 312], [329, 312], { style: 'write' });
  f.arrow([475, 228], [475, 237], { style: 'fail', packet: false });
});
