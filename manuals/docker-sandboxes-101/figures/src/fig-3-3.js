'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { y: 50, hue: 'teal', question: 'a deny rule matches?', ask: 'any scope, any source', style: 'fail', outHue: 'rose', out: 'Denied by local rule', detail: ['deny_kind: explicit · origin: local', 'rule: local:<uuid> · 09-check-deny.json'] },
  { y: 128, hue: 'grey', question: 'org governance active?', ask: 'governance.active', style: 'reply', outHue: 'grey', dash: 'dashed', out: 'false on the capture host', detail: ['when true, only org allow rules grant', 'local and kit allow rules go inactive'] },
  { y: 206, hue: 'teal', question: 'a sandbox allow matches?', ask: 'scope sandbox:m101-policy', style: 'reply', outHue: 'indigo', out: 'allowed: true', detail: ['local <uuid> example.com [tcp]', '09-check-allowed.json'] },
  { y: 284, hue: 'teal', question: 'a global or kit allow matches?', ask: 'local-policy, kit:<name>', style: 'reply', outHue: 'indigo', out: 'allowed: true', detail: ['default-ai-services api.anthropic.com:443', '03-policy-check-anthropic.json'] },
  { y: 362, hue: 'grey', question: 'nothing matched', ask: 'default deny', style: 'fail', outHue: 'rose', out: 'No matching allow rule (default deny)', detail: ['deny_kind: implicit · 09-check-verbose.json', 'inside: Approval required for example.com:443'] },
];

module.exports = figure('fig-3-3', {
  height: 440,
  title: 'How one request to example.com:443 is decided',
  desc: 'The authorizer walks five questions for op(action=net:connect:tcp, resource=net:domain:example.com:443) in the sandbox m101-policy. A matching deny rule ends in Denied by local rule with deny_kind explicit and rule local:<uuid>. Organization governance was inactive on the capture host, and when active only organization allow rules grant access. A sandbox-scoped allow or a global or kit allow returns allowed true, as the checks for example.com and api.anthropic.com show. When nothing matches, the result is No matching allow rule with deny_kind implicit, and the sandbox sees an approval request.',
}, f => {
  f.kicker(20, 18, 'the request');
  f.text(20, 36, 'op(action=net:connect:tcp, resource=net:domain:example.com:443) · context sandbox:m101-policy', { size: 11 });
  rows.forEach((row, index) => {
    const ask = f.box({ x: 20, y: row.y, w: 250, h: 56, hue: row.hue, title: row.question, sub: row.ask });
    const out = f.box({ x: 300, y: row.y, w: 320, h: 56, hue: row.outHue, dash: row.dash, title: row.out, sub: row.detail, titleSize: 12 });
    f.arrow(ask.right(), [out.x - 1, ask.cy], { style: row.style });
    if (index < rows.length - 1) f.arrow([80, row.y + 56], [80, row.y + 77], { style: 'call', label: index === 0 ? 'no' : undefined, labelSize: 11 });
  });
});
