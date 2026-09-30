function rolesMapFigure(host) {
  ensureStyles();
  var panels = [
    {
      title: 'stdio',
      x: 8,
      rows: [
        { t: 'author: discover', f: false },
        { t: 'operator: env creds', f: true },
        { t: 'user: can deny call', f: false }
      ]
    },
    {
      title: 'http, no gateway',
      x: 196,
      rows: [
        { t: 'author: PRM, origin', f: true },
        { t: 'client: RFC 8707', f: false },
        { t: 'governance: tokens', f: false }
      ]
    },
    {
      title: 'gateway-fronted',
      x: 384,
      rows: [
        { t: 'operator: origin', f: true },
        { t: 'author: keeps PRM', f: false },
        { t: 'governance: tokens', f: false }
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
    parts.push('<rect class="l28p" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + bodyHeight + '" rx="4"/>');
    parts.push('<rect class="l28h" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + headerHeight + '" rx="4"/>');
    parts.push('<text class="l28ht" x="' + (panel.x + 9) + '" y="' + (bodyTop + 17) + '">' + panel.title + '</text>');
    for (j = 0; j < panel.rows.length; j++) {
      var row = panel.rows[j];
      var rowY = bodyTop + headerHeight + 14 + j * rowHeight;
      var markerClass = row.f ? 'l28f' : 'l28k';
      parts.push('<circle class="' + markerClass + '" cx="' + (panel.x + 13) + '" cy="' + rowY + '" r="6"/>');
      if (row.f) {
        parts.push('<text class="l28m" x="' + (panel.x + 13) + '" y="' + (rowY + 4) + '">!</text>');
      }
      parts.push('<text class="l28t" x="' + (panel.x + 26) + '" y="' + (rowY + 4) + '">' + row.t + '</text>');
    }
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Roles Map</strong> the same MUST, three deployments, two different owners</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 200" role="img" aria-label="Three panels: stdio, plain HTTP with no gateway, and a gateway-fronted deployment. Each panel names which role owns a sample of that shape\'s MUST and SHOULD requirements. The origin validation requirement is flagged in both HTTP panels: the server author owns it under plain HTTP, but ownership moves to the platform or gateway operator once a gateway sits in front of the server.">',
    '<style>.l28p{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l28h{fill:none;stroke:var(--rule-soft,#ccc)}.l28ht{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l28t{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l28k{fill:var(--blueprint,#3553ff)}.l28f{fill:#c94a34}.l28m{fill:#fff;font:bold 9px var(--font-mono,monospace);text-anchor:middle}.l28c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '<text class="l28c" x="8" y="188">circle marks the owner; the flagged row is the requirement that changes owner</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Adoption changes who signs up for a MUST, not whether it still applies. Origin validation is a server MUST in every HTTP-reachable deployment; plain HTTP leaves it with the server author, and a gateway-fronted deployment moves it to the platform or gateway operator who terminates the connection first.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-28-roles-map
