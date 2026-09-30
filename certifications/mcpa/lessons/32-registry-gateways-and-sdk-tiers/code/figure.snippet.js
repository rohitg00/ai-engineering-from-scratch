function registryGatewayFigure(host) {
  ensureStyles();
  var parts = [];
  function box(cls, x, y, w, h, title, sub, titleCls, subCls) {
    parts.push('<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4"/>');
    parts.push('<text class="' + (titleCls || 'l32bt') + '" x="' + (x + 10) + '" y="' + (y + 18) + '">' + title + '</text>');
    if (sub) {
      parts.push('<text class="' + (subCls || 'l32bs') + '" x="' + (x + 10) + '" y="' + (y + 34) + '">' + sub + '</text>');
    }
  }
  function arrow(cls, marker, x1, y1, x2, y2) {
    parts.push('<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#' + marker + ')"/>');
  }
  function label(x, y, text) {
    parts.push('<text class="l32n" x="' + x + '" y="' + y + '">' + text + '</text>');
  }

  box('l32b', 30, 20, 120, 44, 'Publisher', 'proves owner');
  box('l32b', 200, 20, 150, 44, 'Registry', 'server.json');
  box('l32b', 420, 20, 120, 44, 'Aggregator', 'polls hourly');
  arrow('l32a', 'l32arrow', 150, 42, 200, 42);
  arrow('l32a', 'l32arrow', 350, 42, 420, 42);
  label(148, 14, 'verified');
  label(358, 14, 'polled');
  label(30, 78, 'public listings only; the registry is a preview');

  box('l32b', 30, 104, 110, 44, 'Client', 'the caller');
  box('l32b', 190, 104, 170, 44, 'Gateway', 'header = body?');
  box('l32b', 410, 104, 120, 44, 'Backend', 'Tier 1 SDK');
  box('l32bx', 190, 180, 170, 40, '-32020', 'header != body');
  arrow('l32a', 'l32arrow', 140, 126, 190, 126);
  arrow('l32am', 'l32arrowm', 360, 126, 410, 126);
  arrow('l32a', 'l32arrow', 275, 148, 275, 180);
  label(370, 118, 'match');
  label(283, 172, 'mismatch');

  label(30, 246, 'SDK conformance tiers, checked continuously');
  box('l32tb', 30, 256, 160, 46, 'Tier 1', '100% conformance', 'l32tt', 'l32ts');
  box('l32tb', 210, 256, 160, 46, 'Tier 2', '80% conformance', 'l32tt', 'l32ts');
  box('l32tb', 390, 256, 160, 46, 'Tier 3', 'experimental', 'l32tt', 'l32ts');

  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Finding, Routing To, and Trusting a Server</strong> registry admission, gateway header checks, and SDK tiers as three separate gates</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 320" role="img" aria-label="A publisher proves namespace ownership before the registry admits a server.json entry, which an aggregator polls on its own schedule. Separately, a client request to a gateway is routed only after its Mcp-Method and Mcp-Name headers are checked against the request body: a match reaches a Tier 1 backend, a mismatch is rejected as error -32020 before any backend is touched. Below, three SDK conformance tier badges show the pass rate each tier requires, checked continuously rather than once.">',
    '<defs>',
    '<marker id="l32arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path class="l32af" d="M0,0 L8,4 L0,8 z"/></marker>',
    '<marker id="l32arrowm" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path class="l32afm" d="M0,0 L8,4 L0,8 z"/></marker>',
    '</defs>',
    '<style>',
    '.l32b{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}',
    '.l32bx{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:4,3}',
    '.l32bt{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}',
    '.l32bs{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}',
    '.l32a{stroke:var(--ink-mute,#999);stroke-width:1.2}',
    '.l32am{stroke:var(--blueprint,#3553ff);stroke-width:1.6}',
    '.l32af{fill:var(--ink-mute,#999)}',
    '.l32afm{fill:var(--blueprint,#3553ff)}',
    '.l32n{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}',
    '.l32tb{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
    '.l32tt{fill:var(--blueprint,#3553ff);font:bold 11px var(--font-mono,monospace)}',
    '.l32ts{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}',
    '</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">A verified namespace gets a server.json into the registry, where only an aggregator reads it on its own schedule. That is unrelated to whether any one request later reaches a backend: a gateway checks Mcp-Method and Mcp-Name against the request body first, routes a match to the backend, and rejects a mismatch as -32020 before it goes further. An SDK tier badge is a third, independent fact, re-measured continuously rather than granted once.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-32-registry-flow
