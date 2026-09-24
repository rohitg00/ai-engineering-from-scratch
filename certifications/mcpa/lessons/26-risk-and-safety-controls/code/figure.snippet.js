function attackSurfaceFigure(host) {
  ensureStyles();
  var threats = [
    'poisoned description',
    'rug pull',
    'tool shadowing',
    'token passthrough',
    'requestState tamper',
    'network $ref (SSRF)',
    'DNS rebinding',
    'supply chain drift'
  ];
  var cx = 280;
  var cy = 150;
  var r = 108;
  var boxW = 122;
  var boxH = 24;
  var n = threats.length;
  var spokes = [];
  var nodes = [];
  var labels = [];
  var i;
  for (i = 0; i < n; i++) {
    var angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    var x = cx + r * Math.cos(angle);
    var y = cy + r * Math.sin(angle);
    var bx = x - boxW / 2;
    var by = y - boxH / 2;
    spokes.push('<line class="l26l" x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>');
    nodes.push('<rect class="l26x" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + boxW + '" height="' + boxH + '" rx="3"/>');
    labels.push('<text class="l26t" x="' + (bx + 6).toFixed(1) + '" y="' + (by + 15).toFixed(1) + '">' + threats[i] + '</text>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Attack Surface Around a Tool Call</strong> eight threats a gateway still faces after consent and OAuth are both correct</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 300" role="img" aria-label="A central gateway node surrounded by eight labeled threats: poisoned description, rug pull, tool shadowing, token passthrough, requestState tamper, network dollar-ref SSRF, DNS rebinding, and supply chain drift, each connected to the gateway by a spoke.">',
    '<style>.l26x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l26t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l26l{stroke:var(--ink-mute,#999);stroke-width:1;opacity:.8}.l26g{fill:var(--bg,#fff);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l26gt{fill:var(--ink,#111);font:11px var(--font-mono,monospace);font-weight:600}.l26gc{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}</style>',
    spokes.join(''),
    '<circle class="l26g" cx="' + cx + '" cy="' + cy + '" r="46"/>',
    '<text class="l26gt" x="' + (cx - 28) + '" y="' + (cy - 4) + '">gateway</text>',
    '<text class="l26gc" x="' + (cx - 38) + '" y="' + (cy + 13) + '">pin . scan . limit</text>',
    nodes.join(''),
    labels.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">Each spoke names one threat this lesson covers. The gateway at the center holds the controls that answer them: definition pinning and quarantine for rug pulls, an injection scanner for poisoned descriptions, server-qualified names against shadowing, audience validation against passthrough, integrity-protected state, a refusal to auto-dereference network references, and admission pinning against supply chain drift, so no single control has to catch everything alone.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-26-attack-surface
