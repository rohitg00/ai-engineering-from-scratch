'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-7', {
  height: 440,
  title: 'One registration, two gateways, two tool lists',
  desc: 'On the host, the MCP store holds m101-deepwiki, registered with sbx mcp add from https://mcp.deepwiki.com/mcp as a remote streamable-http server that needs no OAuth. Each sandbox gets its own gateway at MCP_GATEWAY_URL http://mcp-gateway.docker.internal/mcp. The sandbox m101-mcp was created with --static-mcp m101-deepwiki and lists ask_wiki_question, read_wiki_contents, read_wiki_structure, code-mode, and mcp-exec. The sandbox m101-mcp-dyn started with code-mode, mcp-add, mcp-config-set, mcp-exec, and mcp-find, and sbx mcp load added the three deepwiki tools with a tools/list_changed notice. The remote server runs outside the VM, and no OAuth server was captured.',
}, f => {
  f.kicker(20, 18, 'host');
  f.kicker(350, 18, 'sandboxes');

  const remote = f.box({ x: 350, y: 26, w: 270, h: 50, hue: 'grey', title: 'mcp.deepwiki.com/mcp', sub: 'remote endpoint, outside the VM' });
  const store = f.box({ x: 20, y: 26, w: 270, h: 84, hue: 'olive', title: 'sbx mcp add m101-deepwiki', sub: ['--url https://mcp.deepwiki.com/mcp', 'remote · streamable-http', 'requires_oauth: false · auth status: []'] });
  f.arrow(store.right(26), [remote.x - 1, 52], { style: 'effect', label: 'no policy', labelX: 320 });

  const gw1 = f.box({ x: 70, y: 150, w: 230, h: 56, hue: 'olive', title: 'mcp-gateway-m101-mcp', sub: 'static · --static-mcp' });
  const gw2 = f.box({ x: 70, y: 280, w: 230, h: 56, hue: 'olive', title: 'gateway of m101-mcp-dyn', sub: 'dynamic · sbx mcp load' });
  f.arrow([150, 110], [150, 149], { style: 'call', label: 'fixed at create' });
  f.path('M40 110 V308 H69', { style: 'call' });
  f.text(48, 250, 'load, live', { size: 11.5, knock: true });

  const sb1 = f.box({ x: 380, y: 128, w: 240, h: 100, hue: 'blue', title: 'm101-mcp · tools/list', sub: ['ask_wiki_question read_wiki_contents', 'read_wiki_structure', 'code-mode mcp-exec', 'no mcp-find, mcp-add, mcp-config-set'] });
  const sb2 = f.box({ x: 380, y: 250, w: 240, h: 124, hue: 'blue', title: 'm101-mcp-dyn · tools/list', sub: ['before: code-mode mcp-add', 'mcp-config-set mcp-exec mcp-find', 'after load: + ask_wiki_question', 'read_wiki_contents', 'read_wiki_structure'] });
  f.arrow(gw1.right(), [sb1.x - 1, gw1.cy], { style: 'call', label: 'gateway URL', labelSize: 11 });
  f.arrow(gw2.right(), [sb2.x - 1, gw2.cy], { style: 'event', label: 'list_changed', labelSize: 11 });

  f.box({ x: 20, y: 386, w: 600, h: 40, hue: 'grey', dash: 'dashed', title: '<server>-authorize and sbx mcp auth: no OAuth server in this capture', titleSize: 11.5, weight: 400 });
});
