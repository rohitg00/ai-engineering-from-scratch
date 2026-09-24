function nByMFigure(host) {
  ensureStyles();
  var apps = ['chat', 'editor', 'agent', 'portal'];
  var systems = ['files', 'tickets', 'crm', 'docs', 'db', 'ci'];
  var left = [];
  var right = [];
  var i;
  var j;
  for (i = 0; i < apps.length; i++) {
    for (j = 0; j < systems.length; j++) {
      left.push('<line class="nbl" x1="92" y1="' + (46 + i * 44) + '" x2="208" y2="' + (30 + j * 30) + '"/>');
    }
  }
  for (i = 0; i < apps.length; i++) {
    left.push('<rect class="nbx" x="16" y="' + (34 + i * 44) + '" width="76" height="24"/><text class="nbt" x="24" y="' + (50 + i * 44) + '">' + apps[i] + '</text>');
    right.push('<rect class="nbx" x="300" y="' + (34 + i * 44) + '" width="76" height="24"/><text class="nbt" x="308" y="' + (50 + i * 44) + '">' + apps[i] + '</text>');
    right.push('<line class="nba" x1="376" y1="' + (46 + i * 44) + '" x2="420" y2="120"/>');
  }
  for (j = 0; j < systems.length; j++) {
    left.push('<rect class="nbx" x="208" y="' + (18 + j * 30) + '" width="60" height="22"/><text class="nbt" x="214" y="' + (33 + j * 30) + '">' + systems[j] + '</text>');
    right.push('<rect class="nbx" x="486" y="' + (18 + j * 30) + '" width="60" height="22"/><text class="nbt" x="492" y="' + (33 + j * 30) + '">' + systems[j] + '</text>');
    right.push('<line class="nba" x1="440" y1="120" x2="486" y2="' + (29 + j * 30) + '"/>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Integration Problem</strong> 24 custom links versus 10 protocol implementations</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="Left: four applications wired to six systems with twenty-four links. Right: the same applications and systems each connect once to one shared protocol, ten connections.">',
    '<style>.nbx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.nbt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.nbl{stroke:var(--ink-mute,#999);stroke-width:.6;opacity:.7}.nba{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.nbp{fill:var(--blueprint,#3553ff)}.nbc{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    left.join(''),
    right.join(''),
    '<rect class="nbp" x="420" y="100" width="20" height="40" rx="3"/>',
    '<text class="nbc" x="96" y="222">N x M = 24 integrations</text>',
    '<text class="nbc" x="358" y="222">N + M = 10 implementations</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Bespoke glue grows with every application-system pair. With one protocol, each application implements a client once and each system implements a server once, and any client can discover any server at runtime.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-02-n-by-m
