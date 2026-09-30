function manifestAnatomyFigure(host) {
  ensureStyles();
  var panels = [
    {
      title: 'server/discover',
      x: 8,
      rows: [
        { t: 'capabilities', f: false },
        { t: 'instructions', f: true },
        { t: 'cacheScope, ttlMs', f: false }
      ]
    },
    {
      title: 'tools/list',
      x: 196,
      rows: [
        { t: 'annotations: none', f: true },
        { t: 'x-mcp-header', f: true },
        { t: 'cacheScope: public', f: true }
      ]
    },
    {
      title: 'server.json',
      x: 384,
      rows: [
        { t: 'name: acme-tools', f: true },
        { t: 'packages: npm', f: false },
        { t: 'remotes: http', f: false }
      ]
    }
  ];
  var panelWidth = 168;
  var headerHeight = 26;
  var rowHeight = 34;
  var bodyTop = 30;
  var parts = [];
  var i;
  var j;
  for (i = 0; i < panels.length; i++) {
    var panel = panels[i];
    var bodyHeight = headerHeight + panel.rows.length * rowHeight + 10;
    parts.push('<rect class="l09p" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + bodyHeight + '" rx="4"/>');
    parts.push('<rect class="l09h" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + headerHeight + '" rx="4"/>');
    parts.push('<text class="l09ht" x="' + (panel.x + 9) + '" y="' + (bodyTop + 17) + '">' + panel.title + '</text>');
    for (j = 0; j < panel.rows.length; j++) {
      var row = panel.rows[j];
      var rowY = bodyTop + headerHeight + 14 + j * rowHeight;
      var markerClass = row.f ? 'l09f' : 'l09k';
      parts.push('<circle class="' + markerClass + '" cx="' + (panel.x + 13) + '" cy="' + rowY + '" r="6"/>');
      if (row.f) {
        parts.push('<text class="l09m" x="' + (panel.x + 13) + '" y="' + (rowY + 4) + '">!</text>');
      }
      parts.push('<text class="l09t" x="' + (panel.x + 26) + '" y="' + (rowY + 4) + '">' + row.t + '</text>');
    }
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Manifest Anatomy</strong> three documents, read before the first call</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 200" role="img" aria-label="Three panels: a server/discover result with capabilities and instructions, a tools/list result with a tool\'s annotations and x-mcp-header, and a registry server.json with its namespaced name. Flagged fields mark what a reviewer checks first: steering instructions, a tool with no annotations, a header exposing a secret-looking parameter, and a name with no namespace.">',
    '<style>.l09p{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l09h{fill:none;stroke:var(--rule-soft,#ccc)}.l09ht{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l09t{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l09k{fill:var(--blueprint,#3553ff)}.l09f{fill:#c94a34}.l09m{fill:#fff;font:bold 9px var(--font-mono,monospace);text-anchor:middle}.l09c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '<text class="l09c" x="8" y="188">circle marks a field; the exclamation is one a reviewer should not skip</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A manifest is three documents: what a server claims to support, what it currently offers, and how the registry names it. Marked fields, steering instructions, a tool with no annotations, a header exposing a secret-looking parameter, and a namespace-free name, are the ones a reviewer checks before the first real call.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-09-manifest-anatomy
