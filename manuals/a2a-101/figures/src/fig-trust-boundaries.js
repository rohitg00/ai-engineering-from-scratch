'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  {
    where: ['blue', 'agent card', '/.well-known/agent-card.json'],
    threat: ['spoofed card', 'messages go to its endpoint'],
    check: ['violet', 'verify signatures', 'kid deployer-key-1, HTTPS'],
  },
  {
    where: ['green', 'parts in replies', 'review.json, test-log.txt'],
    threat: ['injected orders', 'text that reads as orders'],
    check: ['violet', 'validate data parts', 'decide on typed fields'],
  },
  {
    where: ['green', 'file and URL parts', 'refunds.diff, screenshot.png'],
    threat: ['bad files, SSRF', 'the agent fetches any URL'],
    check: ['blue', 'check type and size', 'validate URLs first'],
  },
  {
    where: ['indigo', 'webhook URL', 'localhost:41250/a2a-events'],
    threat: ['SSRF', 'posts to internal hosts'],
    check: ['blue', 'reject private hosts', 'or keep an allowlist'],
  },
  {
    where: ['indigo', 'POST /a2a-events', 'a notification arrives'],
    threat: ['forged notification', 'acts on a fake event'],
    check: ['violet', 'check Authorization', 'and that taskId is yours'],
  },
  {
    where: ['teal', 'stored records', 'history, configs, logs'],
    threat: ['secrets kept in clear', 'hook_secret_91d2 echoed'],
    check: ['blue', 'redact, scope reads', 'set a retention policy'],
  },
];

module.exports = figure('fig-trust-boundaries', {
  height: 444,
  title: 'Trust boundaries in the kit',
  desc: 'Six rows, one per place where data crosses between parties in the kit, shown in the order the planner meets them. Agent card: a spoofed card sends messages elsewhere, so the planner verifies signatures over HTTPS. Parts in replies such as review.json: text written as orders, so the planner validates data parts and decides on typed fields. File and URL parts: bad files, or an agent that fetches any URL it is given, so the agent checks type, size, and URLs. Webhook URL: SSRF, so the agent rejects private hosts. Incoming notifications: forgery, so the planner checks Authorization and the task id. Stored records: secrets kept in clear, so agents redact, scope reads, and set retention.',
}, f => {
  const cols = [{ x: 20, w: 200 }, { x: 232, w: 188 }, { x: 432, w: 188 }];
  f.kicker(cols[0].x, 18, 'Where data crosses');
  f.kicker(cols[1].x, 18, 'Threat');
  f.kicker(cols[2].x, 18, 'Check');
  f.rect(232, 422, 14, 12, { hue: 'violet' });
  f.text(252, 432, 'the planner checks', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(432, 422, 14, 12, { hue: 'blue' });
  f.text(452, 432, 'the remote agent checks', { size: 11, serif: true, hue: 'ink-soft' });
  rows.forEach((row, index) => {
    const y = 28 + index * 66;
    const [whereHue, whereTitle, whereSub] = row.where;
    const [threatTitle, threatSub] = row.threat;
    const [checkHue, checkTitle, checkSub] = row.check;
    f.beat(index + 1);
    f.box({ x: cols[0].x, y, w: cols[0].w, h: 50, hue: whereHue, title: whereTitle, sub: whereSub, titleSize: 12 });
    f.box({ x: cols[1].x, y, w: cols[1].w, h: 50, hue: 'rose', title: threatTitle, sub: threatSub, titleSize: 12 });
    f.box({ x: cols[2].x, y, w: cols[2].w, h: 50, hue: checkHue, title: checkTitle, sub: checkSub, titleSize: 12 });
    f.rule(cols[0].x + cols[0].w, y + 25, cols[1].x, y + 25);
    f.rule(cols[1].x + cols[1].w, y + 25, cols[2].x, y + 25);
  });
});
