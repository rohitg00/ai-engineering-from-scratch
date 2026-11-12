'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-1', {
  height: 356,
  title: 'The two places that check a client, and what each one decides',
  desc: 'Two bands. In the upper band, kubectl ate with no token file presents the shared identity ate-client to ate-api-server, which accepts a certificate or a bearer JWT and then applies access policies. That identity is a bootstrap owner, so it can manage every actor. In the lower band, three pods call atenet-router, which demands a client certificate whose SPIFFE ID is on one list. The identity atenet-client is on the list and gets 200 from my-counter-1, in an atespace where it holds no role. The identity ns/probe/sa/default gets the TLS alert certificate unknown. A pod with no certificate gets a closed connection.',
}, f => {
  f.kicker(20, 18, 'The API: who can manage actors');
  const cli = f.box({ x: 20, y: 28, w: 200, h: 64, hue: 'olive', pad: 8, title: 'kubectl ate', sub: ['no --token-file, so it acts as', 'ate-system:ate-client'] });
  const api = f.box({ x: 250, y: 28, w: 180, h: 64, hue: 'blue', pad: 8, title: 'ate-api-server', sub: ['certificate or bearer JWT', 'then the access policies'] });
  const owner = f.box({ x: 460, y: 28, w: 160, h: 64, hue: 'green', pad: 6, title: 'every actor', sub: ['a bootstrap owner', 'of all atespaces'] });
  f.arrow(cli.right(), [api.x - 1, cli.cy], { style: 'call' });
  f.arrow(api.right(), [owner.x - 1, api.cy], { style: 'call' });

  f.kicker(20, 130, 'The router: who can call an actor');
  const router = f.box({ x: 250, y: 140, w: 180, h: 180, hue: 'indigo', pad: 6, title: 'atenet-router', sub: ['client certificate, and', 'its SPIFFE ID on one list:', '--ingress-allowed-spiffe-ids'] });
  const rows = [
    { title: 'allowed identity', sub: 'ns/ate-system/sa/atenet-client', out: ['200 from my-counter-1', 'any actor in any atespace', 'green'] },
    { title: 'identity not on the list', sub: 'ns/probe/sa/default', out: ['TLS alert', 'certificate unknown', 'rose'] },
    { title: 'no client certificate', sub: 'a plain pod', out: ['connection closed', 'curl: Broken pipe', 'rose'] },
  ];
  rows.forEach((row, index) => {
    const y = 140 + index * 64;
    const client = f.box({ x: 20, y, w: 200, h: 52, hue: 'olive', pad: 8, titleSize: 11.5, title: row.title, sub: row.sub });
    const [title, sub, hue] = row.out;
    const out = f.box({ x: 460, y, w: 160, h: 52, hue, pad: 5, titleSize: 11.5, title, sub, dash: hue === 'rose' ? 'dashed' : undefined });
    f.arrow(client.right(), [router.x - 1, client.cy], { style: 'call' });
    f.arrow([router.x + router.w, client.cy], [out.x - 1, client.cy], { style: hue === 'rose' ? 'fail' : 'call' });
  });
  f.text(20, 344, 'The refusals are those of the Envoy dataplane. The list names identities and no atespaces.', { size: 11, serif: true, hue: 'ink-soft' });
});
