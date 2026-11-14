'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ["'email'", 'redact', 'Mail [REDACTED_EMAIL], card 4111', 'blue'],
  ["'credit_card'", 'mask', 'card **** **** **** 1111', 'blue'],
  ["'ip'", 'hash', 'from <ip_hash:55235459>', 'blue'],
  ["'url'", 'redact', 'see [REDACTED_URL]', 'blue'],
  ["'email'", 'block', 'PIIDetectionError, no model call', 'rose'],
];

module.exports = figure('fig-3-6', {
  height: 470,
  title: 'Four PII strategies on one input',
  desc: 'One human message holds an email address, a card number, an IP address, and a URL. Five rows each run one PIIMiddleware. email with redact gives [REDACTED_EMAIL]. credit_card with mask gives four groups of stars and the last four digits 1111. ip with hash gives ip_hash:55235459 in angle brackets. url with redact gives [REDACTED_URL]. email with block raises PIIDetectionError, and the model gets no call.',
}, f => {
  f.kicker(20, 20, 'the human message');
  f.box({ x: 20, y: 30, w: 600, h: 56, hue: 'violet', title: 'Mail ada@example.com, card 4111 1111 1111 1111,', sub: 'from 192.168.1.20, see https://example.com/x', align: 'left', weight: 400, titleSize: 12 });
  f.kicker(20, 118, 'PIIMiddleware(type, strategy=)');
  f.kicker(300, 118, 'what the model received');
  rows.forEach(([type, strategy, result, hue], i) => {
    const y = 130 + i * 64;
    const left = f.box({ x: 20, y, w: 220, h: 48, hue: 'blue', title: type, sub: `strategy='${strategy}'`, align: 'left' });
    const right = f.box({ x: 300, y, w: 320, h: 48, hue, title: result, align: 'left', weight: 400, titleSize: 12 });
    f.arrow(left.right(), [right.x - 1, left.cy], { style: hue === 'rose' ? 'fail' : 'call' });
  });
  f.text(20, 458, 'Each row is one run. Only the newest human message changed, because apply_to_input is the default.', { size: 11, serif: true, hue: 'ink-soft' });
});
