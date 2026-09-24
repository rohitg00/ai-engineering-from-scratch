function envelopeFigure(host) {
  ensureStyles();
  var shapes = [
    { title: 'request', l1: 'id required', l2: 'not null' },
    { title: 'notification', l1: 'no id field', l2: 'no reply sent' },
    { title: 'result', l1: 'id matches call', l2: 'has resultType' },
    { title: 'error', l1: 'id if readable', l2: 'code + message' }
  ];
  var cardW = 120;
  var gap = 12;
  var startX = 18;
  var cards = '';
  var i;
  var x;
  for (i = 0; i < shapes.length; i++) {
    x = startX + i * (cardW + gap);
    cards += '<rect class="l03x" x="' + x + '" y="22" width="' + cardW + '" height="70" rx="4"/>';
    cards += '<text class="l03h" x="' + (x + 8) + '" y="40">' + shapes[i].title + '</text>';
    cards += '<text class="l03t" x="' + (x + 8) + '" y="60">' + shapes[i].l1 + '</text>';
    cards += '<text class="l03t" x="' + (x + 8) + '" y="80">' + shapes[i].l2 + '</text>';
  }

  function seg(text, x0, cls, y) {
    var w = text.length * 7.2;
    return { markup: '<text class="' + cls + '" x="' + x0 + '" y="' + y + '">' + text + '</text>', next: x0 + w, width: w, x0: x0 };
  }

  var a1 = seg('io.', 18, 'l03p', 136);
  var a2 = seg('modelcontextprotocol', a1.next, 'l03chk', 136);
  var a3 = seg('/protocolVersion', a2.next, 'l03p', 136);
  var reservedHighlight = '<rect class="l03hl" x="' + (a2.x0 - 3) + '" y="124" width="' + (a2.width + 6) + '" height="16"/>';

  var b1 = seg('com.', 18, 'l03p', 182);
  var b2 = seg('example', b1.next, 'l03chk', 182);
  var b3 = seg('.mcp/scanId', b2.next, 'l03p', 182);
  var freeHighlight = '<rect class="l03hf" x="' + (b2.x0 - 3) + '" y="170" width="' + (b2.width + 6) + '" height="16"/>';

  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The JSON-RPC Envelope</strong> four message shapes and the _meta key anatomy</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 220" role="img" aria-label="Top row: four message shape cards, request, notification, result, and error, each with the field that defines it. Bottom: two _meta keys split into prefix labels and a name, with the second label highlighted. io dot modelcontextprotocol is reserved because its second label is modelcontextprotocol. com dot example dot mcp is not reserved because its second label is example.">',
    '<style>.l03x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l03h{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l03t{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l03p{fill:var(--ink-soft,#555);font:12px var(--font-mono,monospace)}.l03chk{fill:var(--ink,#111);font:bold 12px var(--font-mono,monospace)}.l03hl{fill:var(--blueprint,#3553ff);opacity:.22}.l03hf{fill:var(--rule-soft,#ccc);opacity:.6}.l03cap{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    '<text class="l03h" x="18" y="14">four message shapes share one envelope</text>',
    cards,
    '<text class="l03h" x="18" y="112">is a _meta key reserved for MCP?</text>',
    reservedHighlight,
    a1.markup, a2.markup, a3.markup,
    '<text class="l03cap" x="18" y="154">second label is modelcontextprotocol: reserved</text>',
    freeHighlight,
    b1.markup, b2.markup, b3.markup,
    '<text class="l03cap" x="18" y="200">second label is example, not mcp: not reserved</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A request always carries a non-null id, a notification never carries one, and a result or error echoes the id it answers. A _meta key is reserved for MCP only when its second dot-separated label is modelcontextprotocol or mcp, wherever mcp itself might also appear.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-03-envelope
