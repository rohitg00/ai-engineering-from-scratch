function specMapFigure(host) {
  ensureStyles();
  var must = ['Base Protocol', 'Versioning', 'Message Patterns'];
  var may = ['Authorization', 'Server Features', 'Client Features', 'Utilities'];
  var mustW = 150, mustGap = 10, mustStartX = 45, mustY = 66, mustH = 26;
  var mayW = 125, mayGap = 8, mayStartX = 18, mayY = 138, mayH = 26;
  var rootX = 200, rootY = 12, rootW = 160, rootH = 32;
  var rootCx = rootX + rootW / 2;
  var nodes = [];
  var lines = [];
  var i;
  var x;
  for (i = 0; i < must.length; i++) {
    x = mustStartX + i * (mustW + mustGap);
    nodes.push('<rect class="l01m" x="' + x + '" y="' + mustY + '" width="' + mustW + '" height="' + mustH + '" rx="3"/>');
    nodes.push('<text class="l01mt" x="' + (x + mustW / 2) + '" y="' + (mustY + 17) + '" text-anchor="middle">' + must[i] + '</text>');
    lines.push('<line class="l01l" x1="' + rootCx + '" y1="' + (rootY + rootH) + '" x2="' + (x + mustW / 2) + '" y2="' + mustY + '"/>');
  }
  for (i = 0; i < may.length; i++) {
    x = mayStartX + i * (mayW + mayGap);
    nodes.push('<rect class="l01y" x="' + x + '" y="' + mayY + '" width="' + mayW + '" height="' + mayH + '" rx="3"/>');
    nodes.push('<text class="l01yt" x="' + (x + mayW / 2) + '" y="' + (mayY + 17) + '" text-anchor="middle">' + may[i] + '</text>');
    lines.push('<line class="l01l" x1="' + rootCx + '" y1="' + (rootY + rootH) + '" x2="' + (x + mayW / 2) + '" y2="' + mayY + '"/>');
  }
  var chips = ['Active', 'Deprecated', 'Removed'];
  var chipW = 110, chipGap = 40, chipStartX = 75, chipY = 210, chipH = 26;
  var chipNodes = [];
  var arrowLines = [];
  for (i = 0; i < chips.length; i++) {
    x = chipStartX + i * (chipW + chipGap);
    chipNodes.push('<rect class="l01c" x="' + x + '" y="' + chipY + '" width="' + chipW + '" height="' + chipH + '" rx="13"/>');
    chipNodes.push('<text class="l01ct" x="' + (x + chipW / 2) + '" y="' + (chipY + 17) + '" text-anchor="middle">' + chips[i] + '</text>');
    if (i > 0) {
      arrowLines.push('<line class="l01a" marker-end="url(#l01arrow)" x1="' + (chipStartX + (i - 1) * (chipW + chipGap) + chipW) + '" y1="' + (chipY + chipH / 2) + '" x2="' + (x - 4) + '" y2="' + (chipY + chipH / 2) + '"/>');
    }
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Reading the Specification</strong> what every implementation MUST support, what it MAY add, and how a feature ages</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 300" role="img" aria-label="A map of the MCP specification: a root node for the 2026-07-28 Current revision branches to three MUST-support components, base protocol, versioning, and message patterns, and four MAY components, authorization, server features, client features, and utilities. Below, three chips show a feature moving from Active to Deprecated to Removed, a lifecycle independent of the revision.">',
    '<style>.l01r{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l01rt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l01m{fill:var(--blueprint,#3553ff);fill-opacity:.14;stroke:var(--blueprint,#3553ff);stroke-width:1.2}.l01mt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l01y{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc);stroke-width:1}.l01yt{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}.l01l{stroke:var(--ink-mute,#999);stroke-width:.7;opacity:.65}.l01c{fill:var(--bg-surface,#eee);stroke:var(--ink-soft,#888);stroke-width:1}.l01ct{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l01a{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l01cap{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    '<marker id="l01arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blueprint,#3553ff)"/></marker>',
    '<rect class="l01r" x="' + rootX + '" y="' + rootY + '" width="' + rootW + '" height="' + rootH + '" rx="4"/>',
    '<text class="l01rt" x="' + rootCx + '" y="' + (rootY + 14) + '" text-anchor="middle">Specification</text>',
    '<text class="l01rt" x="' + rootCx + '" y="' + (rootY + 27) + '" text-anchor="middle">2026-07-28, Current</text>',
    lines.join(''),
    nodes.join(''),
    '<text class="l01cap" x="' + mustStartX + '" y="' + (mustY - 6) + '">MUST support</text>',
    '<text class="l01cap" x="' + mayStartX + '" y="' + (mayY - 6) + '">MAY support</text>',
    chipNodes.join(''),
    arrowLines.join(''),
    '<text class="l01cap" x="75" y="' + (chipY + chipH + 18) + '">feature lifecycle, independent of the revision state</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Every implementation MUST support the base protocol, versioning, and message patterns. Authorization, server features, client features, and utilities are added as needed. A feature also carries its own Active, Deprecated, or Removed state, tracked separately from whether the document itself is Draft, Current, or Final.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-01-spec-map
