'use strict';

const { figure } = require('../../../_shared/figkit.js');

function record(f, x, y, w, h, title, lines, options = {}) {
  f.rect(x, y, w, h, { hue: options.hue || 'blue', dash: options.dash });
  f.text(x + 12, y + 20, title, { size: 12, weight: 700 });
  lines.forEach((line, index) => f.text(x + 12, y + 36 + index * 15, line, { size: 11 }));
  return { x, y, w, h };
}

module.exports = figure('fig-card-signature', {
  height: 450,
  title: 'Signing and verifying the deployer card',
  desc: 'Top half, signing, in three steps: the deployer card minus its signatures field is canonicalized with RFC 8785 into a 959-byte payload. The protected header {"alg":"HS256","typ":"JOSE","kid":"deployer-key-1"} and the payload are each base64url-encoded and joined with a period into a 1,348-character signing input, which HMAC-SHA256 signs to give signatures[0] with protected eyJhbGci and signature yPk834ji. Bottom half, verifying, in four steps: the published card rebuilds the same payload and its signature matches, so verification returns True. An edited copy whose description reads "Deploys a tagged build to production." rebuilds a different payload, and verification returns False.',
}, f => {
  f.kicker(20, 18, 'sign');
  f.kicker(20, 300, 'verify');
  const card = f.box({ x: 20, y: 30, w: 170, h: 58, hue: 'blue', title: 'deployer card', titleSize: 12, sub: ['11 members,', 'plus signatures'] });

  f.beat(1);
  const payload = f.box({ x: 280, y: 30, w: 340, h: 58, hue: 'blue', title: 'canonical payload, RFC 8785', titleSize: 12, sub: ['sorted keys, no spaces, no signatures', '959 bytes, from capabilities to version'] });
  f.arrow([card.x + card.w, 59], [payload.x - 1, 59], { style: 'call', label: 'canonicalize', labelSize: 11, note: 'rules 1 to 3' });

  f.beat(2);
  const header = record(f, 20, 118, 230, 58, 'protected header', ['{"alg":"HS256","typ":"JOSE",', '"kid":"deployer-key-1"}']);
  const input = f.box({ x: 330, y: 118, w: 290, h: 58, hue: 'blue', title: 'JWS signing input', titleSize: 12, sub: ["BASE64URL(header) '.' BASE64URL(payload)", '1,348 characters on one line'] });
  f.arrow([header.x + header.w, 147], [input.x - 1, 147], { style: 'call', label: 'base64url', labelSize: 11 });
  f.arrow([475, payload.y + payload.h], [475, input.y - 1], { style: 'call', label: 'base64url', labelSize: 11 });

  f.beat(3);
  const signature = record(f, 330, 206, 290, 58, 'signatures[0]', ['protected "eyJhbGci"', 'signature "yPk834ji"']);
  f.arrow([475, input.y + input.h], [475, signature.y - 1], { style: 'call', label: 'HMAC-SHA256', labelSize: 11 });
  f.text(467, 194, 'HS256, key deployer-key-1', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.box({ x: 20, y: 206, w: 280, h: 58, hue: 'grey', dash: 'dashed', sub: ['the kit: HS256, one shared key', 'real cards: ES256 or RS256, with', 'a public key in a JWKS at jku'] });

  f.beat(4);
  const published = f.box({ x: 20, y: 312, w: 210, h: 46, hue: 'blue', title: 'published card', titleSize: 12, sub: 'description as signed' });
  const same = record(f, 290, 312, 160, 46, 'recompute', ['"yPk834ji"']);
  f.arrow([published.x + published.w, 335], [same.x - 1, 335], { style: 'call', label: 'rebuild', labelSize: 11 });

  f.beat(5);
  const ok = f.box({ x: 510, y: 312, w: 110, h: 46, hue: 'blue', title: 'True', titleSize: 12, sub: 'step 5' });
  f.arrow([same.x + same.w, 335], [ok.x - 1, 335], { style: 'call', label: 'match', labelSize: 11 });

  f.beat(6);
  const edited = f.box({ x: 20, y: 380, w: 210, h: 58, hue: 'blue', dash: 'dashed', title: 'edited copy', titleSize: 12, sub: ['"Deploys a tagged build', 'to production."'] });
  const other = record(f, 290, 380, 160, 58, 'recompute', ['new payload,', 'another value']);
  f.arrow([edited.x + edited.w, 409], [other.x - 1, 409], { style: 'call', label: 'rebuild', labelSize: 11 });

  f.beat(7);
  const bad = f.box({ x: 510, y: 380, w: 110, h: 58, hue: 'rose', title: 'False', titleSize: 12, sub: 'step 6' });
  f.arrow([other.x + other.w, 409], [bad.x - 1, 409], { style: 'fail', label: 'differs', labelSize: 11 });
});
