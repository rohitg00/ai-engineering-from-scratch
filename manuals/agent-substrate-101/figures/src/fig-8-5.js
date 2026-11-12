'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { does: 'SuspendActor when asked', detail: ['no idle timer: RUNNING in 60 of 60 samples'], add: 'the decision to suspend', how: ['kagent suspends after each turn'], hue: 'plum' },
  { does: 'a fixed number of workers', detail: ['a full pool returns 503 after 5 s'], add: 'an autoscaler', how: ['on free worker slots, not on CPU use'], hue: 'grey' },
  { does: 'CRASHED when a sandbox dies', detail: ['a process exit leaves the actor RUNNING'], add: 'a probe for dead processes', how: ['watch for the upstream connect error'], hue: 'grey' },
  { does: 'one router and one Postgres', detail: ['one egress gateway, two ate-api-server'], add: 'failover', how: ['a database standby, more routers'], hue: 'grey' },
  { does: 'a key pool and three commands', detail: ['add, activate, and remove a JWT key'], add: 'the rotation schedule', how: ['no component rotates the key'], hue: 'grey' },
  { does: 'one ingress allowlist', detail: ['a listed client reaches every actor'], add: 'isolation between tenants', how: ['outside Substrate at v1.0.0'], hue: 'grey' },
];

module.exports = figure('fig-8-5', {
  height: 408,
  title: 'Who does each job at v1.0.0',
  desc: 'Six jobs in rows. On the left is what Substrate does at v1.0.0: it suspends on request, keeps a fixed number of workers, marks an actor crashed when its sandbox dies, runs one router and one database, offers key commands, and keeps one ingress allowlist. On the right is what the operator or the harness must add for each.',
}, f => {
  f.kicker(20, 20, 'Substrate does');
  f.kicker(340, 20, 'you add');
  rows.forEach((row, index) => {
    const y = 30 + index * 62;
    f.box({ x: 20, y, w: 290, h: 52, hue: 'blue', title: row.does, sub: row.detail });
    f.box({ x: 340, y, w: 280, h: 52, hue: row.hue, title: row.add, sub: row.how });
    f.rule(310, y + 26, 340, y + 26, { hue: 'ink-mute', dash: 'dotted' });
  });
});
