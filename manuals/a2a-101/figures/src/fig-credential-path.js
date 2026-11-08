'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-credential-path', {
  height: 456,
  title: 'From the card to an enforced request and an in-task approval',
  desc: 'Five steps for the deployer agent. Step one: the card declares a bearer scheme and requires it, and the platform team issues a token outside A2A. Step two: GetExtendedAgentCard without a token gets HTTP 401 with a WWW-Authenticate challenge. Step three: the same call with the token gets the extended card with a rollback skill. Step four: a streamed deploy with the token stops the task in TASK_STATE_AUTH_REQUIRED. Step five: an operator approves at the deployer outside A2A and the task works and completes on the same stream.',
}, f => {
  const left = 20;
  const leftW = 236;
  const right = 340;
  const rightW = 280;
  const gapLabel = (left + leftW + right) / 2;

  f.kicker(left, 18, '1 · the card declares, the client obtains');
  f.kicker(left, 122, '2 · HTTP checks before any A2A method runs');
  f.kicker(left, 282, '3 · the task asks for more, outside A2A');

  f.beat(1);
  f.box({ x: left, y: 26, w: leftW, h: 68, hue: 'blue', title: 'deployer card', sub: ['securitySchemes: bearer', 'httpAuthSecurityScheme, Bearer', 'securityRequirements: bearer'] });
  f.box({ x: right, y: 26, w: rightW, h: 68, hue: 'grey', title: 'platform team', sub: ['issues the token dpl_test_7c1e4b', 'outside A2A, before any request'] });

  f.beat(2);
  const noToken = f.box({ x: left, y: 130, w: leftW, h: 46, hue: 'violet', title: 'GetExtendedAgentCard', sub: 'no Authorization header' });
  const refused = f.box({ x: right, y: 130, w: rightW, h: 46, hue: 'rose', title: 'HTTP 401 Unauthorized', sub: 'WWW-Authenticate: Bearer realm="deployer"' });
  f.arrow(noToken.right(), [refused.x - 1, noToken.cy], { style: 'fail', label: 'refused', labelX: gapLabel });

  f.beat(3);
  const withToken = f.box({ x: left, y: 196, w: leftW, h: 58, hue: 'violet', title: 'GetExtendedAgentCard', sub: ['Authorization: Bearer', 'dpl_test_7c1e4b'] });
  const card = f.box({ x: right, y: 196, w: rightW, h: 58, hue: 'blue', title: '200 OK, extended card', sub: ['one more skill: rollback', 'shown only to authenticated callers'] });
  f.arrow(withToken.right(), [card.x - 1, withToken.cy], { style: 'reply', label: 'accepted', labelX: gapLabel });

  f.beat(4);
  const deploy = f.box({ x: left, y: 290, w: leftW, h: 58, hue: 'violet', title: 'SendStreamingMessage', sub: ['Deploy build 2026.10.06-1', 'to staging, with the token'] });
  const waiting = f.box({ x: right, y: 290, w: rightW, h: 58, hue: 'amber', dash: 'dashed', title: 'TASK_STATE_AUTH_REQUIRED', sub: ['task ecf2dcb6 waits, stream open', 'an operator must approve'] });
  f.arrow(deploy.right(), [waiting.x - 1, deploy.cy], { style: 'call', label: 'deploy', labelX: gapLabel });

  f.beat(5);
  const operator = f.box({ x: left, y: 384, w: leftW, h: 58, hue: 'grey', title: 'operator approves', sub: ['POST /approve/ecf2dcb6', 'at the deployer, not in A2A'] });
  const done = f.box({ x: right, y: 384, w: rightW, h: 58, hue: 'amber', double: true, title: 'TASK_STATE_COMPLETED', sub: ['after TASK_STATE_WORKING', 'on the same stream'] });
  f.path(`M${waiting.x + 40} ${waiting.y + waiting.h} V366 H${operator.x + operator.w / 2} V${operator.y - 1}`, { style: 'effect' });
  f.text(gapLabel, 360, 'the approval link', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.arrow(operator.right(), [done.x - 1, operator.cy], { style: 'effect', label: 'resumes', labelX: gapLabel });
});
