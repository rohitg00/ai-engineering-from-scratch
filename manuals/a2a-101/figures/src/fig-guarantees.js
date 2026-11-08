'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  [['blue', 'a card at a known path', '/.well-known/agent-card.json'], ['which agents to trust', 'registries, allowlists, signing keys']],
  [['blue', 'declared security schemes', 'credentials travel in HTTP headers'], ['issuing the credentials', 'tokens, OAuth, an operator channel']],
  [['amber', 'task ids and states', 'a finished task never changes'], ['what an approval allows', 'authorization policy and audit']],
  [['indigo', 'ordered events per stream', 'at least one attempt per webhook'], ['exactly-once effects', 'dedupe and idempotent handlers']],
  [['teal', 'GetTask while it is kept', 'no retention period is set'], ['your own task records', 'retention, history, purge']],
  [['green', 'four kinds of part', 'each with a media type'], ['what to believe', 'validation, injection checks']],
];

module.exports = figure('fig-guarantees', {
  height: 430,
  title: 'What A2A guarantees and what the host builds',
  desc: 'Two columns of six rows. Left, what the A2A specification guarantees: a card at a known path, declared security schemes with credentials in HTTP headers, task ids and states where a finished task never changes, ordered events per stream with at least one attempt per webhook, tasks readable with GetTask while the server keeps them, and four kinds of part with media types. Right, in grey, what the host builds: which agents to trust, issuing credentials, what an approval allows, exactly-once effects, its own task records and retention, and what content to believe.',
}, f => {
  f.kicker(20, 18, 'A · the protocol guarantees');
  f.kicker(336, 18, 'B · the host builds');
  f.rule(320, 8, 320, 422, { dash: 'dashed' });
  rows.forEach(([[hue, title, sub], [hostTitle, hostSub]], index) => {
    const y = 30 + index * 66;
    f.beat(index + 1);
    f.box({ x: 20, y, w: 284, h: 50, hue, title, sub });
    f.box({ x: 336, y, w: 284, h: 50, hue: 'grey', title: hostTitle, sub: hostSub });
    f.rule(304, y + 25, 336, y + 25);
  });
});
