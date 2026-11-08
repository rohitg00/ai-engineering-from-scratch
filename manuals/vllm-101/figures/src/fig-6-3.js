'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-3', {
  height: 236,
  title: 'Split prefill and decode: the KV cache moves between two servers',
  desc: 'A router sends a new request to a prefill server, which computes the prompt and writes its KV cache. The NixlConnector copies the cache to a decode server, which then streams the tokens back. Both servers set a kv_connector in --kv-transfer-config.',
}, f => {
  const router = f.box({ x: 20, y: 60, w: 120, h: 54, hue: 'olive', title: 'router', sub: 'picks a pair' });
  const pre = f.box({ x: 190, y: 20, w: 170, h: 54, hue: 'plum', title: 'prefill server', sub: 'computes the prompt' });
  const dec = f.box({ x: 190, y: 130, w: 170, h: 54, hue: 'plum', title: 'decode server', sub: 'writes the tokens' });
  const kv = f.box({ x: 440, y: 76, w: 180, h: 54, hue: 'green', title: 'NixlConnector', sub: 'copies KV blocks' });
  f.arrow([140, 76], [189, 47], { style: 'call', label: '' });
  f.arrow([360, 47], [439, 92], { style: 'write' });
  f.arrow([439, 116], [361, 157], { style: 'write' });
  f.arrow([189, 157], [141, 100], { style: 'event' });
  f.text(20, 214, 'Both servers: --kv-transfer-config with "kv_connector": "NixlConnector".', { size: 11.5, serif: true, hue: 'ink-soft' });
});
